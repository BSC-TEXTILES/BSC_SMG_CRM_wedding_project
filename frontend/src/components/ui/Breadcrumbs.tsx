import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { BreadcrumbCrumb } from '../../utils/breadcrumbs';

interface BreadcrumbsProps {
  items: BreadcrumbCrumb[];
  className?: string;
}

/**
 * ── The one-and-only breadcrumb renderer ─────────────────────────────────
 * Semantic, keyboard-accessible and responsive:
 *  - <nav aria-label="Breadcrumb"> + ordered list
 *  - aria-current="page" on the current crumb
 *  - parent crumbs are links (client-side navigation, no reloads)
 *  - current crumb is plain text, never clickable
 *  - single ChevronRight separator + truncation for long paths, wrapping on
 *    narrow screens so navigation always stays reachable.
 */
export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;
  const lastIndex = items.length - 1;

  return (
    <nav aria-label="Breadcrumb" className={`min-w-0 ${className}`}>
      <ol className="flex flex-wrap items-center gap-y-0.5 min-w-0 text-[11px] font-semibold leading-tight">
        {items.map((crumb, idx) => {
          const isLast = idx === lastIndex;
          const clickable = !isLast && !!crumb.href;
          return (
            <li
              key={`${idx}-${crumb.label}`}
              aria-current={isLast ? 'page' : undefined}
              className="flex items-center min-w-0 max-w-full"
            >
              {idx > 0 && (
                <ChevronRight className="w-3 h-3 mx-1 text-[#C9A45C] flex-shrink-0" aria-hidden="true" />
              )}
              {clickable ? (
                <Link
                  to={crumb.href!}
                  title={crumb.label}
                  className="text-[#687080] hover:text-[#C9A45C] hover:underline underline-offset-2 transition-colors truncate rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C] max-w-[40vw] xs:max-w-[45vw] sm:max-w-[240px]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  title={crumb.label}
                  className={`truncate max-w-[55vw] xs:max-w-[60vw] sm:max-w-[300px] ${
                    isLast ? 'text-[#182033] font-bold' : 'text-[#687080]'
                  }`}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
