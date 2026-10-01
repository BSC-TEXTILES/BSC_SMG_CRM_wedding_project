import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { BreadcrumbCrumb } from '../../utils/breadcrumbs';

interface BreadcrumbsProps {
  items: BreadcrumbCrumb[];
  className?: string;
}

/**
 * ── The Executive Breadcrumb Renderer ────────────────────────────────────
 * Minimal, executive, highly readable navigation breadcrumb:
 *  - Semantic <nav aria-label="Breadcrumbs"> + ordered list
 *  - aria-current="page" on the current crumb
 *  - Parent crumbs are clickable links with smooth hover states
 *  - Current page crumb is primary text (#182033), never clickable
 *  - Separators use subtle champagne gold
 *  - Clean responsive handling with graceful truncation
 */
export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  const lastIndex = items.length - 1;
  const parentCrumb = items.length >= 2 ? items[items.length - 2] : null;
  const currentCrumb = items[lastIndex];

  return (
    <nav aria-label="Breadcrumbs" className={`min-w-0 flex items-center ${className}`}>
      {/* Mobile concise breadcrumb: parent link + current page */}
      {items.length > 2 && parentCrumb && (
        <div className="sm:hidden flex items-center min-w-0 text-[13px] font-medium">
          {parentCrumb.href ? (
            <Link
              to={parentCrumb.href}
              title={parentCrumb.label}
              className="text-[#687080] hover:text-[#123C35] hover:underline underline-offset-2 transition-colors flex items-center gap-1 truncate max-w-[40vw]"
            >
              <span>‹</span>
              <span className="truncate">{parentCrumb.label}</span>
            </Link>
          ) : (
            <span className="text-[#687080] truncate max-w-[38vw]">
              ‹ {parentCrumb.label}
            </span>
          )}
          <ChevronRight className="w-3.5 h-3.5 mx-1 text-[#C9A45C] flex-shrink-0" aria-hidden="true" />
          <span className="text-[#182033] font-bold truncate max-w-[46vw]" aria-current="page">
            {currentCrumb.label}
          </span>
        </div>
      )}

      {/* Standard breadcrumb list (shown always when <= 2 items, or on sm+ screens) */}
      <ol
        className={`items-center min-w-0 text-[13px] font-medium ${
          items.length > 2 ? 'hidden sm:flex flex-wrap gap-y-1' : 'flex flex-wrap gap-y-1'
        }`}
      >
        {items.map((crumb, idx) => {
          const isLast = idx === lastIndex;
          const clickable = !isLast && Boolean(crumb.href);

          return (
            <li
              key={`${idx}-${crumb.label}`}
              className="flex items-center min-w-0"
              aria-current={isLast ? 'page' : undefined}
            >
              {idx > 0 && (
                <ChevronRight
                  className="w-3.5 h-3.5 mx-1.5 text-[#C9A45C] flex-shrink-0 opacity-80"
                  aria-hidden="true"
                />
              )}
              {clickable ? (
                <Link
                  to={crumb.href!}
                  title={crumb.label}
                  className="text-[#687080] hover:text-[#123C35] hover:underline underline-offset-4 transition-colors truncate max-w-[200px] md:max-w-[260px] lg:max-w-[320px] rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A45C]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  title={crumb.label}
                  className={`truncate max-w-[240px] md:max-w-[320px] lg:max-w-[400px] ${
                    isLast
                      ? 'text-[#182033] font-bold'
                      : 'text-[#687080]'
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
