'use strict';

/**
 * The checklist's own audit trail.
 *
 * `audit_logs` already receives one coarse row per VM action, but it is a global
 * security/operations log: it cannot answer "what happened to THIS checklist, in
 * order, by whom". `vm_photo_history` covers evidence only. This table is the
 * checklist-level trail the module needs — created, saved, filed, evidence added or
 * removed — written inside the same transaction as the change it describes so a
 * rolled-back save never leaves a phantom event behind.
 *
 * Recording never throws. A history row is worth having, but never at the cost of
 * the answer the auditor just typed.
 */

const pool = require('../config/db');

const VM_EVENT = {
  CREATED: 'Created',
  DRAFT_SAVED: 'DraftSaved',
  SUBMITTED: 'Submitted',
  ATTACHMENT_ADDED: 'AttachmentAdded',
  ATTACHMENT_REPLACED: 'AttachmentReplaced',
  ATTACHMENT_REMOVED: 'AttachmentRemoved'
};

function text(value, max = 5000) {
  if (value === null || value === undefined) return null;
  return String(value).slice(0, max);
}

/**
 * @param executor pool or an open transaction connection
 * @param {{
 *   submissionId: string, locationId?: number|null, action: string,
 *   field?: string|null, pointId?: string|null, oldValue?: string|null, newValue?: string|null,
 *   statusBefore?: string|null, statusAfter?: string|null, scorePercent?: number|null,
 *   summary?: string|null, actor?: any
 * }} event
 */
async function recordVmAuditEvent(executor, event) {
  const conn = executor || pool;
  try {
    if (!event || !event.submissionId || !event.action) return false;
    const actor = event.actor || {};
    await conn.query(
      `INSERT INTO vm_submission_history
         (submission_id, location_id, action, field, point_id, old_value, new_value,
          status_before, status_after, score_percent, summary,
          changed_by, changed_by_user_id, changed_by_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        text(event.submissionId, 64),
        event.locationId === undefined || event.locationId === null ? null : Number(event.locationId),
        text(event.action, 40),
        text(event.field, 60),
        text(event.pointId, 64),
        text(event.oldValue),
        text(event.newValue),
        text(event.statusBefore, 30),
        text(event.statusAfter, 30),
        event.scorePercent === undefined || event.scorePercent === null ? null : Number(event.scorePercent),
        text(event.summary, 500),
        text(actor.username || actor.fullName || actor.name || 'VM', 150),
        actor.id === undefined || actor.id === null ? null : Number(actor.id),
        text(actor.role, 60)
      ]
    );
    return true;
  } catch (err) {
    console.warn('[VM Audit History] Could not record', event && event.action, ':', err.message);
    return false;
  }
}

/** Newest first, capped — the trail is read by a person, not exported. */
async function getVmAuditHistory(submissionId, limit = 200) {
  const cap = Math.max(1, Math.min(Number(limit) || 200, 500));
  const [rows] = await pool.query(
    `SELECT id, submission_id, location_id, action, field, point_id, old_value, new_value,
            status_before, status_after, score_percent, summary,
            changed_by, changed_by_user_id, changed_by_role, changed_at
       FROM vm_submission_history
      WHERE submission_id = ?
      ORDER BY changed_at DESC, id DESC
      LIMIT ${cap}`,
    [submissionId]
  );
  return (rows || []).map((r) => ({
    id: Number(r.id),
    auditId: r.submission_id,
    locationId: r.location_id === null ? null : Number(r.location_id),
    action: r.action,
    field: r.field,
    pointId: r.point_id,
    oldValue: r.old_value,
    newValue: r.new_value,
    statusBefore: r.status_before,
    statusAfter: r.status_after,
    scorePercent: r.score_percent === null ? null : Number(r.score_percent),
    summary: r.summary,
    changedBy: r.changed_by,
    changedByUserId: r.changed_by_user_id === null ? null : Number(r.changed_by_user_id),
    changedByRole: r.changed_by_role,
    changedAt: r.changed_at
  }));
}

/** "7 Pass · 2 Fail · 1 N/A" — the line a manager scans for. */
function describeScore(score) {
  if (!score) return null;
  return `${score.passed || 0} Pass · ${score.failed || 0} Fail · ${score.notApplicable || 0} N/A · ${score.percent || 0}%`;
}

module.exports = { VM_EVENT, recordVmAuditEvent, getVmAuditHistory, describeScore };
