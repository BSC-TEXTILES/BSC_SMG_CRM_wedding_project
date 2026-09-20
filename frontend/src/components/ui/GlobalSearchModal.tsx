import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Users, UserCheck, Briefcase, FileText, Settings, ArrowRight } from 'lucide-react';
import { API } from '../../services/api';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ type: string; title: string; subtitle: string; href: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.toLowerCase();
        const resList: { type: string; title: string; subtitle: string; href: string }[] = [];

        // Search Candidates
        const candRes = await API.getCandidates({ q: query, limit: 10 });
        if (candRes && candRes.candidates) {
          candRes.candidates.forEach((c: any) => {
            const formattedName = c.name ? c.name.toLowerCase().replace(/\b\w/g, (char: string) => char.toUpperCase()) : '';
            resList.push({
              type: 'Candidate',
              title: formattedName,
              subtitle: `${c.appNo} · ${c.desig} · ${c.status}`,
              href: `/candidates?search=${c.appNo}`
            });
          });
        }

        // Search Employees
        const empRes = await API.getEmployees();
        if (empRes && empRes.employees) {
          empRes.employees.filter((e: any) => 
            (e.name && e.name.toLowerCase().includes(q)) || 
            (e.appNo && e.appNo.toLowerCase().includes(q)) ||
            (e.phone && e.phone.includes(q))
          ).slice(0, 5).forEach((e: any) => {
            const formattedName = e.name ? e.name.toLowerCase().replace(/\b\w/g, (char: string) => char.toUpperCase()) : '';
            resList.push({
              type: 'Employee',
              title: formattedName,
              subtitle: `${e.appNo} · ${e.desig} · Active Staff`,
              href: `/employees`
            });
          });
        }

        // Static Quick Pages
        if ('dashboard'.includes(q)) resList.push({ type: 'Page', title: 'Dashboard Analytics', subtitle: 'Executive Overview', href: '/dashboard' });
        if ('openings'.includes(q) || 'manpower'.includes(q)) resList.push({ type: 'Page', title: 'Manpower Openings', subtitle: 'Role Requisitions', href: '/openings' });
        if ('broadcast'.includes(q) || 'announcement'.includes(q)) resList.push({ type: 'Page', title: 'Broadcast Center', subtitle: 'System Notifications & Broadcasts', href: '/broadcast-center' });

        setResults(resList);
      } catch (e) {} finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-card rounded-3xl overflow-hidden shadow-2xl border border-border animate-fade-in">
        {/* Search Bar Input */}
        <div className="p-4 border-b border-border flex items-center gap-3 bg-background">
          <Search className="w-5 h-5 text-accent" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search candidates, employees, openings, modules... (ESC to exit)"
            className="w-full text-sm font-semibold bg-transparent text-text-primary focus:outline-none placeholder:text-text-muted"
          />
          <button onClick={onClose} className="p-1 rounded-lg text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-1 text-xs">
          {loading && (
            <div className="p-6 text-center text-text-secondary font-semibold flex items-center justify-center gap-2">
              <span className="spinner" />
              <span>Searching enterprise directory...</span>
            </div>
          )}

          {!loading && results.length > 0 && (
            results.map((r, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onClose();
                  navigate(r.href);
                }}
                className="w-full p-3 rounded-2xl flex items-center justify-between gap-3 hover:bg-background text-left transition-colors font-medium border border-transparent hover:border-border"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-primary/10 text-primary border border-primary/20">
                      {r.type}
                    </span>
                    <span className="font-extrabold text-text-primary">{r.title}</span>
                  </div>
                  <div className="text-[11px] text-text-secondary mt-0.5">{r.subtitle}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-text-muted" />
              </button>
            ))
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="p-8 text-center text-text-secondary font-semibold">
              No matching candidate or system records found for "{query}".
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
    </div>
  );
}
