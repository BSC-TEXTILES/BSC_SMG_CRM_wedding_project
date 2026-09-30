import { type ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

/**
 * Shared visual language for the VM audit workspace.
 *
 * The six guided-flow steps used to carry their own copies of every card, pill and
 * heading, which is how the page ended up on six elevation styles and ninety spans
 * set at 8-10px — unreadable for someone holding a tablet on a shop floor. These
 * primitives are the single place the look is defined, so a step cannot drift from
 * the rest of the flow.
 *
 * Type floor: nothing below 11px. Question text is the core job, so it is 15px.
 */

export const VM_SURFACE = 'bg-[#FFFDFC] border border-[#E8D9D4] rounded-2xl shadow-[0_1px_2px_rgba(74,23,58,0.04)]';
export const VM_RAISED = 'shadow-[0_6px_18px_-8px_rgba(74,23,58,0.28)]';

export const vmCard = (extra = '') => `${VM_SURFACE} ${extra}`.trim();

/** Interactive card: lifts on hover, has a visible keyboard focus ring. */
export const vmClickableCard =
  'group w-full text-left bg-[#FFFDFC] border border-[#E8D9D4] rounded-2xl ' +
  'shadow-[0_1px_2px_rgba(74,23,58,0.04)] transition-all duration-150 ' +
  'hover:border-[#B76E79] hover:shadow-[0_10px_24px_-12px_rgba(74,23,58,0.35)] hover:-translate-y-0.5 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B76E79] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFF7F2]';

export const vmLabel = 'text-[11px] font-black uppercase tracking-[0.07em] text-[#6F5963]';
export const vmMeta = 'text-[12px] font-semibold text-[#6F5963]';
export const vmBody = 'text-[13px] font-semibold text-[#2B1722]';
export const vmTitle = 'text-[15px] font-black text-[#2B1722] leading-snug';
export const vmHeading = 'text-[17px] sm:text-[19px] font-black text-[#4A173A] leading-tight';

export const btnBase =
  'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-[13px] font-bold ' +
  'transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[#B76E79] focus-visible:ring-offset-1';

export const vmBtnPrimary = `${btnBase} bg-[#4A173A] text-white hover:bg-[#6A2853] shadow-[0_4px_12px_-6px_rgba(74,23,58,0.6)]`;
export const vmBtnSecondary = `${btnBase} bg-white text-[#4A173A] border border-[#E8D9D4] hover:border-[#B76E79] hover:bg-[#FFF7F2]`;
export const vmBtnGhost = `${btnBase} bg-transparent text-[#6A2853] border border-transparent hover:bg-[#FFF7F2]`;

/* ── pills ─────────────────────────────────────────────────────────────── */

export type VmTone = 'neutral' | 'brand' | 'positive' | 'warning' | 'danger' | 'muted';

const TONE_CLASS: Record<VmTone, string> = {
  neutral: 'bg-[#FFF7F2] text-[#6A2853] border-[#E8D9D4]',
  brand: 'bg-[#4A173A] text-white border-[#4A173A]',
  positive: 'bg-[#E8F5EE] text-[#146B41] border-[#198754]/30',
  warning: 'bg-[#FFF4D6] text-[#8A5B00] border-[#C58A18]/40',
  danger: 'bg-[#FDE8E7] text-[#9B1C15] border-[#B42318]/30',
  muted: 'bg-[#F4F2F0] text-[#6F5963] border-[#E8D9D4]'
};

export function VmPill({
  tone = 'neutral',
  icon,
  children,
  className = ''
}: {
  tone?: VmTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ` +
        `uppercase tracking-[0.06em] whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

/* ── section header ────────────────────────────────────────────────────── */

export function VmSectionHeader({
  icon,
  title,
  subtitle,
  right,
  className = ''
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {icon && (
        <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#4A173A] to-[#6A2853] text-[#E8C7A8] shadow-[0_4px_12px_-6px_rgba(74,23,58,0.8)]">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className={vmHeading}>{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12px] font-semibold text-[#6F5963] leading-snug">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">{right}</div>}
    </div>
  );
}

/* ── score dial ──────────────────────────────────────────────────────────
 * Renders whatever percentage the server computed. A null value is drawn as an
 * empty ring with a dash — never as 0%, which would read as a failed audit.
 */

export const scoreTone = (percent: number | null | undefined): VmTone => {
  if (percent === null || percent === undefined) return 'muted';
  if (percent >= 80) return 'positive';
  if (percent >= 50) return 'warning';
  return 'danger';
};

const TONE_STROKE: Record<VmTone, string> = {
  neutral: '#B76E79',
  brand: '#4A173A',
  positive: '#198754',
  warning: '#C58A18',
  danger: '#B42318',
  muted: '#C9BDC3'
};

export function VmScoreDial({
  percent,
  label = 'Compliance',
  caption,
  size = 84
}: {
  percent: number | null;
  label?: string;
  caption?: ReactNode;
  size?: number;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const known = percent !== null && percent !== undefined && Number.isFinite(percent);
  const pct = known ? Math.max(0, Math.min(100, Number(percent))) : 0;
  const tone = scoreTone(known ? pct : null);

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDE4E7" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={TONE_STROKE[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c}`}
            strokeDashoffset={c - (pct / 100) * c}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 240ms ease, stroke 240ms ease' }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          {/* Static sizes only: an interpolated `text-[${n}px]` is invisible to Tailwind's
              source scan, so it compiles to no class at all and the text falls back. */}
          <span
            className={`${size > 70 ? 'text-[18px]' : 'text-[15px]'} font-black leading-none`}
            style={{ color: known ? TONE_STROKE[tone] : '#8C7A84' }}
          >
            {known ? `${Math.round(pct)}%` : '—'}
          </span>
        </span>
      </div>
      <div className="min-w-0">
        <p className={vmLabel}>{label}</p>
        {caption && <p className="mt-0.5 text-[12px] font-bold text-[#4A173A] leading-snug">{caption}</p>}
      </div>
    </div>
  );
}

/* ── progress bar ──────────────────────────────────────────────────────── */

export function VmProgressBar({
  value,
  total,
  tone = 'brand',
  label
}: {
  value: number;
  total: number;
  tone?: VmTone;
  label?: ReactNode;
}) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div className="min-w-0">
      {label && <p className={`${vmLabel} mb-1`}>{label}</p>}
      <div
        className="h-2 w-full rounded-full bg-[#EDE4E7] overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: TONE_STROKE[tone] }}
        />
      </div>
    </div>
  );
}

/* ── states ────────────────────────────────────────────────────────────── */

export function VmEmptyState({
  icon,
  title,
  hint,
  action
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`${VM_SURFACE} px-6 py-10 text-center`}>
      <span className="mx-auto mb-3 grid place-items-center w-11 h-11 rounded-full bg-[#FFF7F2] border border-[#E8D9D4] text-[#B76E79]">
        {icon || <Inbox className="w-5 h-5" />}
      </span>
      <p className="text-[14px] font-black text-[#4A173A]">{title}</p>
      {hint && <p className="mt-1 text-[12px] font-semibold text-[#6F5963] max-w-md mx-auto leading-relaxed">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function VmErrorState({
  title = 'Something could not be loaded.',
  message,
  onRetry
}: {
  title?: ReactNode;
  message?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-[#FFFDFC] border border-[#B42318]/30 rounded-2xl px-6 py-9 text-center shadow-[0_1px_2px_rgba(74,23,58,0.04)]">
      <span className="mx-auto mb-3 grid place-items-center w-11 h-11 rounded-full bg-[#FDE8E7] border border-[#B42318]/30 text-[#B42318]">
        <AlertTriangle className="w-5 h-5" />
      </span>
      <p className="text-[14px] font-black text-[#4A173A]">{title}</p>
      {message && <p className="mt-1 text-[12px] font-semibold text-[#6F5963] max-w-xl mx-auto break-words">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${vmBtnSecondary} mt-4`}>
          <RefreshCw className="w-4 h-4 text-[#B76E79]" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}

/** One resting row while data loads, so a pending fetch never looks like an empty list. */
export function VmSkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className={`${VM_SURFACE} p-4 animate-pulse`}>
      <div className="h-4 w-1/2 rounded bg-[#EDE4E7]" />
      <div className="mt-2 h-3 w-3/4 rounded bg-[#F1EAEC]" />
      {Array.from({ length: Math.max(0, lines - 2) }).map((_, i) => (
        <div key={i} className="mt-2 h-3 w-full rounded bg-[#F1EAEC]" />
      ))}
    </div>
  );
}
