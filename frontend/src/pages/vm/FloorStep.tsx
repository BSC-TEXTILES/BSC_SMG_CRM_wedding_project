import { useState, type ReactNode } from 'react';
import {
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Layers,
  PencilRuler,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import type { VmFloorSummary } from './vmTypes';
import { dashIfEmpty, formatVmDate } from './vmFlowUtils';
import {
  VmEmptyState,
  VmErrorState,
  VmPill,
  VmScoreDial,
  VmSectionHeader,
  VmSkeletonCard,
  vmBtnPrimary,
  vmBtnSecondary,
  vmCard,
  vmClickableCard,
  vmLabel,
  type VmTone
} from './VmPrimitives';
import CreateFloorModal from './CreateFloorModal';
import { API } from '../../services/api';

interface FloorStepProps {
  /** Straight from GET /vm/floor-summary — never derived in the browser. */
  floors: VmFloorSummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (floorName: string) => void;
  /** Write permission: view-only users get the cards but no audit entry point. */
  canAudit: boolean;
  /** Server Asia/Kolkata day, returned by the same endpoint. */
  today: string;
  checkpointCount: number;
  /** Admin access: only admins can create new floors and manage floor configuration. */
  isAdmin?: boolean;
  onFloorCreated?: () => void;
}

/** One gutter everywhere: 1 card on a phone, 2 on a tablet, 3-4 on a wide desktop. */
const CARD_GRID = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4';

const SECTION_CHIP =
  'max-w-full break-words rounded-xl border border-[#E8D9D4] bg-[#FFF7F2] px-2.5 py-1 text-[12px] font-bold text-[#4A173A]';

const TILE = 'grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#E8D9D4] bg-[#FFF7F2] text-[#4A173A]';

/**
 * Step 1 — pick the store floor.
 *
 * A floor card answers "what is the state of this floor" from stored rows only:
 * sections, whether a Draft is open, the last completed audit and that audit's
 * score. No audits yet means "Not audited yet" and a dash, never a fabricated 0%.
 *
 * Admins can configure and create new store floors with sections directly here.
 */
export default function FloorStep({
  floors,
  loading,
  error,
  onRetry,
  onSelect,
  canAudit,
  today,
  checkpointCount,
  isAdmin = false,
  onFloorCreated
}: FloorStepProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingFloor, setDeletingFloor] = useState<VmFloorSummary | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteFloor = async () => {
    if (!deletingFloor) return;
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      await API.deleteVmFloor(deletingFloor.id || deletingFloor.name);
      setDeletingFloor(null);
      onFloorCreated?.();
      onRetry();
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete floor.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return <LoadingBlock />;
  }

  if (error) {
    return <VmErrorState title="Unable to load the store floors" message={error} onRetry={onRetry} />;
  }

  if (floors.length === 0) {
    return (
      <>
        <VmEmptyState
          icon={<Layers className="w-5 h-5" />}
          title="No store floors are configured yet"
          hint={
            isAdmin
              ? 'As an Administrator, you can configure the store floors and sections now to start visual merchandising audits.'
              : 'Floors and their sections come from the VM configuration. Ask a System Administrator to add them before an audit can be started.'
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className={vmBtnPrimary}
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Store Floor</span>
                </button>
              )}
              <button type="button" onClick={onRetry} className={vmBtnSecondary}>
                <RefreshCw className="w-4 h-4 text-[#B76E79]" />
                <span>Check again</span>
              </button>
            </div>
          }
        />
        {isAdmin && (
          <CreateFloorModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onSuccess={() => {
              onFloorCreated?.();
              onRetry();
            }}
          />
        )}
      </>
    );
  }

  const drafts = floors.filter((f) => f.hasDraft).length;

  return (
    <div className="space-y-5">
      {/* Heading plus its meta row & admin action */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <VmSectionHeader
          className="min-w-0 flex-1"
          icon={<Building2 className="w-5 h-5" />}
          title="Choose the floor to audit"
          subtitle="One card per configured floor, with its sections, open draft and last filed audit."
        />

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {/* Admin-only Create New Floor Action */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className={`${vmBtnPrimary} shadow-md`}
              title="Admin privilege: Add a new floor level and assign merchandising sections"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Floor</span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <VmPill icon={<Layers className="w-3.5 h-3.5" />}>
              {floors.length} floor{floors.length === 1 ? '' : 's'}
            </VmPill>
            <VmPill icon={<ClipboardList className="w-3.5 h-3.5" />}>
              {checkpointCount > 0 ? `${checkpointCount} checkpoints` : 'Checkpoints loading…'}
            </VmPill>
            {drafts > 0 && (
              <VmPill tone="brand" icon={<PencilRuler className="w-3.5 h-3.5" />}>
                {drafts} draft{drafts === 1 ? '' : 's'} open
              </VmPill>
            )}
            {today && <VmPill icon={<CalendarDays className="w-3.5 h-3.5" />}>{formatVmDate(today) || today}</VmPill>}
          </div>
        </div>
      </div>

      <div className={CARD_GRID}>
        {floors.map((floor) => (
          <FloorCard
            key={floor.name}
            floor={floor}
            canAudit={canAudit}
            isAdmin={isAdmin}
            onSelect={onSelect}
            onRequestDelete={() => setDeletingFloor(floor)}
          />
        ))}
      </div>

      {/* Admin Create Floor Modal */}
      {isAdmin && (
        <CreateFloorModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            onFloorCreated?.();
            onRetry();
          }}
        />
      )}

      {/* Admin Delete Confirmation Dialog */}
      {isAdmin && deletingFloor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => !deleteLoading && setDeletingFloor(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[#FFFDFC] border border-[#E8D9D4] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-700">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-[17px] font-black text-[#4A173A]">Delete Store Floor?</h3>
                <p className="mt-1 text-[13px] font-semibold text-[#6F5963]">
                  Are you sure you want to remove <strong className="text-[#4A173A]">"{deletingFloor.name}"</strong>?
                  Sections and historical audit submissions will be preserved in records.
                </p>
              </div>
            </div>

            {deleteError && (
              <p className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-[12px] font-bold text-red-800">
                {deleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeletingFloor(null)}
                className={vmBtnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDeleteFloor}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-[13px] font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {deleteLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Floor</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FloorCard({
  floor,
  canAudit,
  isAdmin,
  onSelect,
  onRequestDelete
}: {
  floor: VmFloorSummary;
  canAudit: boolean;
  isAdmin?: boolean;
  onSelect: (name: string) => void;
  onRequestDelete?: () => void;
}) {
  const clickable = canAudit && floor.sections.length > 0;
  const neverAudited = floor.totalAudits === 0 || !floor.lastAuditDate;
  const lastAuditLabel = neverAudited ? 'Not audited yet' : formatVmDate(floor.lastAuditDate) || 'Not audited yet';

  // Audit state read off the same server flags the card already used.
  const state: { tone: VmTone; label: string; icon: ReactNode } = floor.hasDraft
    ? { tone: 'brand', label: 'Draft', icon: <PencilRuler className="w-3.5 h-3.5" /> }
    : neverAudited
      ? { tone: 'muted', label: 'Not audited yet', icon: <Clock className="w-3.5 h-3.5" /> }
      : { tone: 'positive', label: 'Completed', icon: <Check className="w-3.5 h-3.5" strokeWidth={3} /> };

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={() => clickable && onSelect(floor.name)}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(floor.name);
        }
      }}
      className={`${clickable ? `${vmClickableCard} cursor-pointer` : vmCard()} relative flex min-w-0 flex-col gap-3.5 p-4 sm:p-5`}
    >
      {/* Admin quick actions (top right) */}
      {isAdmin && onRequestDelete && (
        <div className="absolute top-3.5 right-3.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRequestDelete();
            }}
            title="Delete this floor (Admin only)"
            className="rounded-xl border border-transparent p-1.5 text-[#6F5963] hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Identity: icon tile, floor name, description from the summary row. */}
      <div className="flex min-w-0 items-start gap-3 pr-6">
        <span className={TILE} aria-hidden="true">
          <Building2 className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-[17px] font-black leading-snug text-[#4A173A]">{floor.name}</h3>
          <p className="mt-1 break-words text-[13px] font-semibold leading-snug text-[#6F5963]">
            {dashIfEmpty(floor.description, 'No description recorded for this floor.')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <VmPill tone={state.tone} icon={state.icon}>
          {state.label}
        </VmPill>
        <VmPill icon={<Layers className="w-3.5 h-3.5" />}>
          {floor.sectionCount} section{floor.sectionCount === 1 ? '' : 's'}
        </VmPill>
      </div>

      {/* Score of the latest completed audit — a dash when the floor has none. */}
      <div
        className="rounded-2xl border border-[#E8D9D4] bg-[#FFF7F2] px-3.5 py-3"
        title={floor.lastScore === null ? 'No completed audit score on this floor yet' : 'Score of the latest completed audit'}
      >
        <VmScoreDial percent={floor.lastScore} label="Latest score" caption={lastAuditLabel} size={72} />
      </div>

      <div className="min-w-0">
        <p className={`${vmLabel} mb-1.5`}>Included sections</p>
        {floor.sections.length === 0 ? (
          <p className="text-[12px] font-semibold italic text-[#6F5963]">No sections configured on this floor yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {floor.sections.map((section) => (
              <li key={`${floor.name}-${section}`} className={SECTION_CHIP}>
                {section}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto space-y-2">
        {floor.hasDraft && (
          <p className="flex items-start gap-2 rounded-2xl border border-[#B76E79]/40 bg-[#FFF7F2] px-3 py-2 text-[12px] font-bold leading-snug text-[#4A173A]">
            <PencilRuler className="mt-px w-4 h-4 shrink-0 text-[#B76E79]" />
            <span>
              Draft in progress{floor.draftSections.length > 0 ? ` — ${floor.draftSections.join(', ')}` : ''}. Not a
              completed inspection yet.
            </span>
          </p>
        )}
        {floor.unauditedSections.length > 0 && (
          <p className="text-[12px] font-semibold leading-snug text-[#6F5963]">
            {floor.unauditedSections.length} section{floor.unauditedSections.length === 1 ? '' : 's'} never audited:
            <span className="font-bold text-[#4A173A]"> {floor.unauditedSections.join(', ')}</span>
          </p>
        )}

        {canAudit ? (
          <span
            className={`inline-flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-black transition-colors ${
              clickable
                ? 'bg-[#4A173A] text-white group-hover:bg-[#6A2853]'
                : 'border border-[#E8D9D4] bg-[#FFF7F2] text-[#6F5963]'
            }`}
          >
            {clickable ? (
              <>
                <span>Choose section to audit</span>
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              <span>No sections configured</span>
            )}
          </span>
        ) : (
          <p className="rounded-xl border border-[#E8D9D4] bg-[#FFF7F2] px-3 py-2.5 text-[12px] font-bold text-[#6F5963]">
            View-only access: audits are filed by the store team.
          </p>
        )}
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="space-y-4" aria-busy="true">
      <p className="flex items-center gap-2 text-[13px] font-bold text-[#6F5963]">
        <RefreshCw className="w-4 h-4 animate-spin text-[#B76E79]" />
        <span>Loading floors…</span>
      </p>
      <div className={CARD_GRID}>
        {[0, 1, 2, 3].map((i) => (
          <VmSkeletonCard key={i} lines={4} />
        ))}
      </div>
    </div>
  );
}
