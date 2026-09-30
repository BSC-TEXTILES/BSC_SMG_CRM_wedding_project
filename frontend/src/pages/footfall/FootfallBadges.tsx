import { Smartphone, UserCog, History, Tag } from 'lucide-react';
import { formatIstStamp } from './shared';

/**
 * Where a footfall row came from. Greeter Kiosk reads in rose gold, Admin Entry
 * in plum, untagged legacy rows in the neutral border tone — existing tokens
 * only, so the badge cannot drift from the rest of the register.
 */
export function SourceBadge({ source }: { source?: string | null }) {
  const value = String(source || '').trim();
  const isGreeter = value.toLowerCase().includes('greeter');
  const isAdmin = value.toLowerCase().includes('admin');

  if (!value) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-background border border-accent-soft text-[10px] font-black uppercase tracking-wider text-[#5D4E42] whitespace-nowrap">
        <Tag className="w-3 h-3" />
        <span>Untagged</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap border ${
        isGreeter
          ? 'bg-accent/15 border-accent/45 text-[#4A173A]'
          : isAdmin
            ? 'bg-primary/10 border-primary/25 text-primary'
            : 'bg-background border-accent-soft text-[#5D4E42]'
      }`}
      title={`Entry source: ${value}`}
    >
      {isGreeter ? <Smartphone className="w-3 h-3" /> : <UserCog className="w-3 h-3" />}
      <span>{value}</span>
    </span>
  );
}

/** Correction marker: how many times a row was edited and when the last edit landed. */
export function EditedBadge({ editCount, lastEditedAt }: { editCount?: number | string; lastEditedAt?: string | number | Date | null }) {
  const count = Number(editCount) || 0;

  if (count <= 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-background border border-accent-soft text-[10px] font-black uppercase tracking-wider text-primary/55 whitespace-nowrap">
        Original
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary text-accent text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-2xs"
      title={lastEditedAt ? `Last edited ${formatIstStamp(lastEditedAt)}` : 'Edited'}
    >
      <History className="w-3 h-3" />
      <span>{count > 1 ? `Edited ×${count}` : 'Edited'}</span>
    </span>
  );
}

/** Compact "who + role" line used by the entries table. */
export function EditorCell({ name, role }: { name?: string | null; role?: string | null }) {
  if (!name) return <span className="text-primary/45">—</span>;
  return (
    <span className="block whitespace-nowrap">
      <span className="font-black text-primary">{name}</span>
      {role && <span className="block text-[10px] font-bold uppercase tracking-wider text-accent">{role}</span>}
    </span>
  );
}
