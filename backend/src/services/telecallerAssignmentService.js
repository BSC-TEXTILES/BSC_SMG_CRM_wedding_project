/**
 * Telecaller Assignment Service
 * Implements intelligent Balanced Workload & Round-Robin automatic assignment
 * strictly matching the customer's store location (BEL, DAV, SHI).
 */
const pool = require('../config/db');

class TelecallerAssignmentService {
  /**
   * Find the most eligible active telecaller for a specific store location.
   * Priority: Lowest active customer workload among active telecallers in the same location.
   *
   * @param {Object} options
   * @param {number} options.locationId - Customer's store location ID (1: BEL, 2: DAV, 3: SHI)
   * @param {Object} [options.connection] - Optional existing database connection / transaction
   * @returns {Promise<{id: number, full_name: string, username: string, workload: number}|null>}
   */
  async getEligibleTelecaller({ locationId, connection = null }) {
    const executor = connection || pool;
    const targetLocId = parseInt(locationId, 10) || 2;

    try {
      // 1. First look for active telecallers strictly assigned to this store location
      const querySameLocation = `
        SELECT 
          u.id, 
          u.full_name, 
          u.username,
          u.location_id,
          (
            SELECT COUNT(*) 
            FROM wedding_customers wc 
            WHERE wc.assigned_telecaller_id = u.id 
              AND wc.is_deleted = 0 
              AND (wc.lifecycle_status = 'ACTIVE' OR wc.lifecycle_status IS NULL)
              AND wc.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
          ) AS active_workload,
          COALESCE((
            SELECT MAX(wc2.created_at)
            FROM wedding_customers wc2
            WHERE wc2.assigned_telecaller_id = u.id
          ), '1970-01-01') AS last_assigned_at
        FROM users u
        WHERE u.active = TRUE
          AND u.role IN ('Telecaller', 'CRM Executive', 'VM Extension Telecaller', 'VM Telecaller', 'Team Lead')
          AND u.location_id = ?
        ORDER BY active_workload ASC, last_assigned_at ASC, u.id ASC
        LIMIT 1
      `;

      const [locResults] = await executor.query(querySameLocation, [targetLocId]);

      if (locResults && locResults.length > 0) {
        const selected = locResults[0];
        return {
          id: selected.id,
          full_name: selected.full_name || selected.username,
          username: selected.username,
          workload: Number(selected.active_workload) || 0
        };
      }

      // 2. If no location-specific telecaller exists, check global telecallers (location_id IS NULL)
      const queryGlobalTelecaller = `
        SELECT 
          u.id, 
          u.full_name, 
          u.username,
          u.location_id,
          (
            SELECT COUNT(*) 
            FROM wedding_customers wc 
            WHERE wc.assigned_telecaller_id = u.id 
              AND wc.is_deleted = 0 
              AND (wc.lifecycle_status = 'ACTIVE' OR wc.lifecycle_status IS NULL)
              AND wc.customer_status NOT IN ('Converted', 'Visited Store', 'Not Interested', 'Cancelled', 'Closed')
          ) AS active_workload,
          COALESCE((
            SELECT MAX(wc2.created_at)
            FROM wedding_customers wc2
            WHERE wc2.assigned_telecaller_id = u.id
          ), '1970-01-01') AS last_assigned_at
        FROM users u
        WHERE u.active = TRUE
          AND u.role IN ('Telecaller', 'CRM Executive', 'VM Extension Telecaller', 'VM Telecaller', 'Team Lead')
          AND u.location_id IS NULL
        ORDER BY active_workload ASC, last_assigned_at ASC, u.id ASC
        LIMIT 1
      `;

      const [globalResults] = await executor.query(queryGlobalTelecaller);

      if (globalResults && globalResults.length > 0) {
        const selected = globalResults[0];
        return {
          id: selected.id,
          full_name: selected.full_name || selected.username,
          username: selected.username,
          workload: Number(selected.active_workload) || 0
        };
      }

      return null;
    } catch (err) {
      console.error('[TelecallerAssignmentService.getEligibleTelecaller Error]', err);
      return null;
    }
  }

  /**
   * Automatically assigns a customer to an eligible telecaller and logs the audit trail.
   */
  async assignCustomer({ customerId, locationId, connection = null }) {
    const executor = connection || pool;
    const telecaller = await this.getEligibleTelecaller({ locationId, connection: executor });

    if (!telecaller) {
      console.warn(`[TelecallerAssignmentService] No active telecaller available for location ${locationId}`);
      return null;
    }

    try {
      await executor.query(`
        UPDATE wedding_customers
        SET assigned_telecaller = ?,
            assigned_telecaller_id = ?,
            last_updated_by = 'Auto-Assignment Engine',
            updated_at = NOW()
        WHERE id = ?
      `, [telecaller.full_name, telecaller.id, customerId]);

      await executor.query(`
        INSERT INTO wedding_audit_logs (customer_id, location_id, user_name, action, details)
        VALUES (?, ?, 'System', 'Telecaller Auto-Assigned', ?)
      `, [
        customerId,
        locationId,
        `Auto-assigned customer to ${telecaller.full_name} based on balanced workload (${telecaller.workload} active leads).`
      ]);

      return telecaller;
    } catch (err) {
      console.error('[TelecallerAssignmentService.assignCustomer Error]', err);
      return null;
    }
  }
}

module.exports = new TelecallerAssignmentService();
