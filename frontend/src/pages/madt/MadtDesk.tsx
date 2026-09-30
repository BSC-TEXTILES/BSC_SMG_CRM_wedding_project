import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MadtLayout from './MadtLayout';
import {
  generateUnifiedAdvocationData,
  formatAutoAdvocationLetter,
  copyToClipboard
} from '../../utils/autoAdvocation';

interface RequestItem {
  id: string;
  ref: string;
  kind: string;
  name: string;
  email: string;
  phone: string;
  floor?: string;
  side?: string;
  date?: string;
  day?: string;
  needs?: string[];
  note?: string;
  status: string;
  created: string;
}

export default function MadtDesk() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLetter, setSelectedLetter] = useState<{ id: string; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Desk Floor Book — MADT';

    fetch('/api/madt/me')
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then(u => {
        setUser(u);
        return fetch('/api/madt/requests');
      })
      .then(res => (res.ok ? res.json() : { items: [] }))
      .then(data => {
        setItems(data.items || []);
      })
      .catch(() => {
        // Check session storage fallback
        const saved = sessionStorage.getItem('madt_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setUser(parsed);
          } catch {}
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const markNoted = async (id: string) => {
    try {
      const res = await fetch(`/api/madt/requests/${id}/noted`, { method: 'POST' });
      if (res.ok) {
        setItems(prev => prev.map(item => (item.id === id ? { ...item, status: 'noted' } : item)));
      }
    } catch {}
  };

  const handleShowLetter = (item: RequestItem) => {
    if (selectedLetter && selectedLetter.id === item.id) {
      setSelectedLetter(null);
      return;
    }

    const advocacy = generateUnifiedAdvocationData({
      name: item.name,
      email: item.email,
      phone: item.phone,
      floor: item.floor,
      side: item.side,
      weddingDate: item.date,
      preferredDay: item.day,
      needs: item.needs,
      note: item.note,
      ref: item.ref,
      kind: item.kind,
      role: 'Registered Client',
      status: item.status
    });

    const letter = formatAutoAdvocationLetter(advocacy);
    setSelectedLetter({ id: item.id, text: letter });
  };

  const handleCopyLetter = async (id: string, text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  if (loading) {
    return (
      <MadtLayout page="desk">
        <main id="main" className="subpage">
          <div className="wrap narrow">
            <p>Loading the floor book…</p>
          </div>
        </main>
      </MadtLayout>
    );
  }

  return (
    <MadtLayout page="desk">
      <main id="main" className="subpage">
        <div className="wrap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <p className="kicker">House Register</p>
              <h1>The Floor Book</h1>
              <p className="lede">
                {user ? `Signed in as ${user.name} (${user.role})` : 'Floor desk requests and appointment registry.'}
              </p>
            </div>
            {!user && (
              <div>
                <Link to="/madt/login" className="btn btn-sm">Sign in to desk</Link>
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', background: 'var(--paper-deep, #EBE5DC)', borderRadius: '8px' }}>
              <p style={{ margin: 0, color: 'var(--muted, #666)' }}>No recorded notes in the book yet.</p>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <Link to="/madt/wedding" className="btn btn-sm">New Wedding Note</Link>
                <Link to="/madt/consult" className="btn btn-sm btn-ghost">New Consultation</Link>
              </div>
            </div>
          ) : (
            <div className="table-frame custom-scrollbar">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line-strong, #CCC)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Ref</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Kind</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Name & Contact</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Floor / Side</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Advocacy</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <React.Fragment key={item.id}>
                      <tr style={{ borderBottom: '1px solid var(--line, #E5E0D8)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{item.ref}</td>
                        <td style={{ padding: '0.75rem 0.5rem', textTransform: 'capitalize' }}>{item.kind}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <strong>{item.name}</strong>
                          <br />
                          <small style={{ color: 'var(--muted, #666)' }}>{item.phone} • {item.email}</small>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {item.floor || item.side || '—'}
                          {item.date ? ` (${item.date})` : ''}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            background: item.status === 'noted' ? '#E8F5E9' : '#FFF3E0',
                            color: item.status === 'noted' ? '#2E7D32' : '#E65100'
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            onClick={() => handleShowLetter(item)}
                          >
                            {selectedLetter?.id === item.id ? 'Hide Brief' : 'View Brief'}
                          </button>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {item.status !== 'noted' ? (
                            <button
                              type="button"
                              className="text-btn"
                              style={{ fontSize: '0.8rem' }}
                              onClick={() => markNoted(item.id)}
                            >
                              Mark noted
                            </button>
                          ) : (
                            <span style={{ color: 'var(--muted, #888)', fontSize: '0.8rem' }}>✓ Noted</span>
                          )}
                        </td>
                      </tr>
                      {selectedLetter?.id === item.id && (
                        <tr>
                          <td colSpan={7} style={{ background: 'var(--paper-deep, #EBE5DC)', padding: '1rem', borderBottom: '2px solid var(--line-strong, #CCC)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <strong style={{ fontSize: '0.85rem' }}>Auto-Advocation Unified Brief ({item.ref})</strong>
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() => handleCopyLetter(item.id, selectedLetter.text)}
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                              >
                                {copiedId === item.id ? '✓ Copied' : 'Copy Brief'}
                              </button>
                            </div>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.8rem', color: 'var(--ink-soft, #444)', maxHeight: '200px', overflowY: 'auto' }}>
                              {selectedLetter.text}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </MadtLayout>
  );
}
