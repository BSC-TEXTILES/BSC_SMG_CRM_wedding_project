import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { API, Auth } from '../../services/api';
import { canAccessRoute } from '../../utils/moduleRegistry';

interface SearchResult {
  type: string;
  title: string;
  subtitle: string;
  href: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const titleCase = (value?: string) =>
  value ? value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : '';

/**
 * Enterprise directory search.
 *
 * Every result source is gated by the same `canAccessRoute` check the sidebar
 * and route guards use, so a user cannot discover records or modules they are
 * not permitted to open. The backend enforces the same scoping again — this is
 * presentation hygiene, not the security boundary.
 */
export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Guards against a slow earlier request overwriting a newer one.
  const requestSeq = useRef(0);

  const session = Auth.get();
  const allowedModules = session?.modules ?? null;
  const role = session?.role;

  const allowed = useCallback(
    (route: string) => canAccessRoute(route, allowedModules, role),
    [allowedModules, role]
  );

  // Ctrl/Cmd+K is owned by Topbar; the modal must not register a second
  // listener for the same chord or the two toggle each other.
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setResults([]);
    setFailed(false);
    setActiveIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const term = query.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return;
    }

    const seq = ++requestSeq.current;
    setLoading(true);
    setFailed(false);

    const timer = setTimeout(async () => {
      const q = term.toLowerCase();
      const collected: SearchResult[] = [];
      let anyFailure = false;

      // Each source is isolated so one denied or failing endpoint cannot
      // discard the results the user is allowed to see.
      const safe = async <T,>(run: () => Promise<T>): Promise<T | null> => {
        try {
          return await run();
        } catch (err: any) {
          // A 403 means "not permitted", which is an expected outcome rather
          // than a search failure.
          if (err?.status && err.status !== 403) anyFailure = true;
          return null;
        }
      };

      if (allowed('/candidates')) {
        const candRes = await safe<any>(() => API.getCandidates({ q: term, limit: 8 }));
        (candRes?.candidates || []).forEach((c: any) => {
          collected.push({
            type: 'Candidate',
            title: titleCase(c.name),
            subtitle: `${c.appNo} · ${c.desig} · ${c.status}`,
            href: `/candidates?search=${encodeURIComponent(c.appNo || '')}`
          });
        });
      }

      if (allowed('/employees')) {
        const empRes = await safe<any>(() => API.getEmployees());
        (empRes?.employees || [])
          .filter((e: any) =>
            (e.name && e.name.toLowerCase().includes(q)) ||
            (e.appNo && String(e.appNo).toLowerCase().includes(q)) ||
            (e.phone && String(e.phone).includes(q))
          )
          .slice(0, 5)
          .forEach((e: any) => {
            collected.push({
              type: 'Employee',
              title: titleCase(e.name),
              subtitle: `${e.appNo} · ${e.desig} · Active Staff`,
              href: '/employees'
            });
          });
      }

      if (allowed('/wedding-crm/customers')) {
        const wedRes = await safe<any>(() => API.getWeddingCustomers({ search: term, limit: 8 }));
        (wedRes?.customers || []).slice(0, 6).forEach((c: any) => {
          collected.push({
            type: 'Wedding',
            title: titleCase(c.customer_name),
            subtitle: `${c.customer_code} · ${c.location_name || 'Store'} · ${c.customer_status || 'New'}`,
            href: `/wedding-crm/customers/${c.id}`
          });
        });
      }

      if (allowed('/feedback-collection')) {
        const fbRes = await safe<any>(() => API.getFeedbacks({ search: term }));
        (fbRes?.feedbacks || []).slice(0, 5).forEach((f: any) => {
          collected.push({
            type: 'Feedback',
            title: titleCase(f.customerName || 'Anonymous'),
            subtitle: `${f.mobile || 'No mobile'} · ${f.locationName || 'Store'} feedback`,
            href: '/feedback-collection'
          });
        });
      }

      if (allowed('/broadcast-center')) {
        const bcRes = await safe<any>(() => API.getBroadcasts());
        (bcRes?.broadcasts || [])
          .filter((b: any) =>
            (b.title && String(b.title).toLowerCase().includes(q)) ||
            (b.subject && String(b.subject).toLowerCase().includes(q))
          )
          .slice(0, 4)
          .forEach((b: any) => {
            collected.push({
              type: 'Broadcast',
              title: titleCase(b.title),
              subtitle: `${b.category || 'Announcement'} · ${b.status || 'Sent'}`,
              href: '/broadcast-center'
            });
          });
      }

      if (allowed('/employees')) {
        const locRes = await safe<any>(() => API.getLocations());
        const locs = Array.isArray(locRes) ? locRes : (locRes?.locations || []);
        locs
          .filter((l: any) =>
            (l.location_name && String(l.location_name).toLowerCase().includes(q)) ||
            (l.location_code && String(l.location_code).toLowerCase().includes(q))
          )
          .slice(0, 4)
          .forEach((l: any) => {
            collected.push({
              type: 'Store',
              title: titleCase(l.location_name),
              subtitle: `${l.store_name || 'BSC Textiles'} · ${l.location_code || ''}`.trim(),
              href: '/employees'
            });
          });
      }

      // Module / page shortcuts, filtered to what this user may open.
      const pages: SearchResult[] = [
        { type: 'Page', title: 'Dashboard Analytics', subtitle: 'Executive Overview', href: '/dashboard' },
        { type: 'Page', title: 'Manpower Openings', subtitle: 'Role Requisitions', href: '/openings' },
        { type: 'Page', title: 'Broadcast Center', subtitle: 'System Notifications & Broadcasts', href: '/broadcast-center' },
        { type: 'Page', title: 'Wedding CRM', subtitle: 'Customer Registration & Pipeline', href: '/wedding-crm/customers' },
        { type: 'Page', title: 'Feedback Collection', subtitle: 'Ratings & Voice of Customer', href: '/feedback-collection' },
        { type: 'Page', title: 'Employee & Store Directory', subtitle: 'Staff and Locations', href: '/employees' },
        { type: 'Page', title: 'User Management', subtitle: 'Accounts & Access Control', href: '/user-management' }
      ];

      pages.forEach((page) => {
        const haystack = `${page.title} ${page.subtitle} ${page.href}`.toLowerCase();
        if (!haystack.includes(q)) return;
        if (!allowed(page.href)) return;
        collected.push(page);
      });

      if (seq !== requestSeq.current) return; // a newer query already answered

      setResults(collected.slice(0, 25));
      setActiveIndex(0);
      setFailed(anyFailure && collected.length === 0);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen, allowed]);

  const hasResults = results.length > 0;

  const go = useCallback((result?: SearchResult) => {
    const target = result ?? results[activeIndex];
    if (!target) return;
    onClose();
    navigate(target.href);
  }, [results, activeIndex, onClose, navigate]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (hasResults) setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (hasResults) setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  const emptyHint = useMemo(() => {
    if (failed) return 'Unable to complete search. Please try again.';
    if (query.trim() && !loading && !hasResults) return `No results found for “${query.trim()}”.`;
    return '';
  }, [failed, query, loading, hasResults]);

  if (!isOpen) return null;

  return (
    <ModalPortal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Global Directory Search"
      className="items-start pt-16 sm:pt-24"
    >
      <div className="w-full max-w-xl bg-card rounded-3xl overflow-hidden shadow-2xl border border-border">
        {/* Search Bar Input */}
        <div className="p-4 border-b border-border flex items-center gap-3 bg-background">
          <Search className="w-5 h-5 text-accent flex-shrink-0" />
          <input
            type="text"
            autoFocus
            role="combobox"
            aria-expanded={hasResults}
            aria-controls="global-search-results"
            aria-activedescendant={hasResults ? `global-search-option-${activeIndex}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type to search candidates, employees, customers, modules... (ESC to exit)"
            className="w-full text-sm font-semibold bg-transparent text-text-primary focus:outline-none placeholder:text-text-muted"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]); }}
              aria-label="Clear search"
              className="p-1 rounded-lg text-text-muted hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="p-1 rounded-lg text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div id="global-search-results" role="listbox" className="max-h-96 overflow-y-auto p-3 space-y-1 text-xs">
          {loading && (
            <div className="p-6 text-center text-text-secondary font-semibold flex items-center justify-center gap-2">
              <span className="spinner" />
              <span>Searching enterprise directory...</span>
            </div>
          )}

          {!loading && hasResults && (
            results.map((r, idx) => (
              <button
                key={`${r.type}-${r.title}-${idx}`}
                id={`global-search-option-${idx}`}
                role="option"
                aria-selected={idx === activeIndex}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => go(r)}
                className={`w-full p-3 rounded-2xl flex items-center justify-between gap-3 text-left transition-colors font-medium border ${
                  idx === activeIndex ? 'bg-background border-border' : 'border-transparent hover:bg-background hover:border-border'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
                      {r.type}
                    </span>
                    <span className="font-extrabold text-text-primary truncate">{r.title}</span>
                  </div>
                  <div className="text-[11px] text-text-secondary mt-0.5 truncate">{r.subtitle}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted flex-shrink-0" />
              </button>
            ))
          )}

          {!loading && emptyHint && (
            <div className="p-8 text-center text-text-secondary font-semibold">
              {emptyHint}
            </div>
          )}

          {!query.trim() && (
            <div className="p-6 text-center text-text-secondary font-semibold text-xs space-y-2">
              <div className="text-text-primary font-bold">Quick Search Shortcuts</div>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-2.5 py-1 rounded-xl bg-background border border-border font-mono text-text-secondary">Ctrl + K</span>
                <span className="px-2.5 py-1 rounded-xl bg-background border border-border font-mono text-text-secondary">Candidate Names</span>
                <span className="px-2.5 py-1 rounded-xl bg-background border border-border font-mono text-text-secondary">Application Numbers</span>
                <span className="px-2.5 py-1 rounded-xl bg-background border border-border font-mono text-text-secondary">Phone Numbers</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
