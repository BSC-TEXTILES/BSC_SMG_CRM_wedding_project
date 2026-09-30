import { Building2, Check, ChevronRight, ClipboardList, Clock, Layers, PencilRuler, RefreshCw, Store } from 'lucide-react';
import type { VmFloorSummary } from './vmTypes';
import { formatVmDate } from './vmFlowUtils';
import {
  VmEmptyState,
  VmErrorState,
  VmPill,
  VmSectionHeader,
  VmSkeletonCard,
  vmBtnPrimary,
  vmCard,
  vmClickableCard,
  vmBody
} from './VmPrimitives';

interface SectionStepProps {
  floorName: string;
  /** The floor row from GET /vm/floor-summary; its `sections` array is the list. */
  floor: VmFloorSummary | null;
  /**
   * Real checkpoint count for the active checklist (GET /vm/points `totalQuestions`).
   * 0 while the checklist is still loading, so the card says so instead of 0.
   */
  checkpointCount: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (section: string) => void;
  canAudit: boolean;
}

const CARD_GRID = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4';

const TILE = 'grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#E8D9D4] bg-[#FFF7F2] text-[#4A173A]';

/**
 * Step 2 — pick the section inside the chosen floor.
 *
 * Even a single-section floor stops here: the spec asks for the explicit step, and
 * the card is one click away from the audit form.
 */
export default function SectionStep({
  floorName,
  floor,
  checkpointCount,
  loading,
  error,
  onRetry,
  onSelect,
  canAudit
}: SectionStepProps) {
  const sections = floor?.sections || [];
  const draftSections = floor?.draftSections || [];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="flex items-center gap-1.5 text-[#B76E79]">
          <Store className="w-4 h-4" aria-hidden="true" />
          <span className="text-[11px] font-black uppercase tracking-[0.08em]">Floor selected</span>
        </p>
        {/* Heading plus its meta row: the pills wrap under the title on a phone rather than squeeze it. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <VmSectionHeader
            className="min-w-0 flex-1"
            icon={<Building2 className="w-5 h-5" />}
            title={floorName || '—'}
            subtitle={
              floor
                ? `${floor.sectionCount} section${floor.sectionCount === 1 ? '' : 's'} on this floor` +
                  (floor.lastAuditDate
                    ? ` · last completed audit ${formatVmDate(floor.lastAuditDate)}`
                    : ' · not audited yet')
                : 'Section list is loading from the VM configuration.'
            }
          />
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            <VmPill tone={loading ? 'muted' : 'neutral'} icon={<ClipboardList className="w-3.5 h-3.5" />}>
              {loading
                ? 'Loading checklist…'
                : error
                  ? 'Checkpoint count unavailable'
                  : `${checkpointCount} checkpoints per section`}
            </VmPill>
            {draftSections.length > 0 && (
              <VmPill tone="brand" icon={<PencilRuler className="w-3.5 h-3.5" />}>
                {draftSections.length} draft open
              </VmPill>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4" aria-busy="true">
          <p className="flex items-center gap-2 text-[13px] font-bold text-[#6F5963]">
            <RefreshCw className="w-4 h-4 animate-spin text-[#B76E79]" />
            <span>Loading sections…</span>
          </p>
          <div className={CARD_GRID}>
            {[0, 1, 2].map((i) => (
              <VmSkeletonCard key={i} lines={4} />
            ))}
          </div>
        </div>
      ) : null}

      {!loading && error ? (
        <VmErrorState title="The checkpoint list could not be loaded" message={error} onRetry={onRetry} />
      ) : null}

      {!loading && !error && sections.length === 0 ? (
        <VmEmptyState
          icon={<Layers className="w-5 h-5" />}
          title={`No sections configured on ${floorName || 'this floor'}`}
          hint="Sections are maintained with the floor configuration. Add a section to start auditing this floor."
        />
      ) : null}

      {!loading && !error && sections.length > 0 ? (
        <div className={CARD_GRID}>
          {sections.map((section) => {
            const hasDraft = draftSections.includes(section);
            // `unauditedSections` is server-computed: a section with no completed audit.
            const neverAudited = (floor?.unauditedSections || []).includes(section);
            const clickable = canAudit;
            return (
              <div
                key={`${floorName}-${section}`}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={() => clickable && onSelect(section)}
                onKeyDown={(e) => {
                  if (!clickable) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(section);
                  }
                }}
                className={`${clickable ? `${vmClickableCard} cursor-pointer` : vmCard()} flex min-w-0 flex-col gap-3 p-4 sm:p-5`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className={TILE} aria-hidden="true">
                    <Layers className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-[16px] font-black leading-snug text-[#4A173A]">{section}</h3>
                    <p className={`${vmBody} mt-1`}>
                      {checkpointCount > 0 ? `${checkpointCount} checkpoints to rate` : 'Checkpoint count loading'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <VmPill tone="muted">{floorName}</VmPill>
                  {hasDraft ? (
                    <VmPill tone="brand" icon={<PencilRuler className="w-3.5 h-3.5" />}>
                      Draft
                    </VmPill>
                  ) : neverAudited ? (
                    <VmPill tone="muted" icon={<Clock className="w-3.5 h-3.5" />}>
                      Not audited yet
                    </VmPill>
                  ) : (
                    <VmPill tone="positive" icon={<Check className="w-3.5 h-3.5" strokeWidth={3} />}>
                      Audited
                    </VmPill>
                  )}
                </div>

                {hasDraft && (
                  <p className="flex items-start gap-2 rounded-2xl border border-[#B76E79]/40 bg-[#FFF7F2] px-3 py-2 text-[12px] font-bold leading-snug text-[#4A173A]">
                    <PencilRuler className="mt-px w-4 h-4 shrink-0 text-[#B76E79]" />
                    <span>Draft already open — re-entering resumes it. Not a completed inspection.</span>
                  </p>
                )}

                {clickable ? (
                  <span className={`${vmBtnPrimary} mt-auto w-full group-hover:bg-[#6A2853]`}>
                    <span>{hasDraft ? 'Resume audit' : neverAudited ? 'Start first audit' : 'Start audit'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                ) : (
                  <p className="mt-auto rounded-xl border border-[#E8D9D4] bg-[#FFF7F2] px-3 py-2.5 text-[12px] font-bold text-[#6F5963]">
                    View-only access: audits are filed by the store team.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
