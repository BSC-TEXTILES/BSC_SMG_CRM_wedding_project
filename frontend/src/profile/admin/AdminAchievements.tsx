import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { AchievementItem } from '../types';
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, X, ExternalLink } from 'lucide-react';

export const AdminAchievements: React.FC = () => {
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAch, setEditingAch] = useState<Partial<AchievementItem> | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await ProfileApi.getAchievements();
      setAchievements(data || []);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load achievements' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Manage Achievements & Honors — Admin';
    load();
  }, []);

  const handleOpenAdd = () => {
    setEditingAch({
      title: '',
      category: 'Award',
      organization: '',
      issue_date: '2026',
      description: '',
      credential_url: '',
      is_published: true
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAch) return;

    try {
      await ProfileApi.saveAchievement(editingAch);
      setStatusMsg({ type: 'success', text: `Saved achievement "${editingAch.title}".` });
      setEditingAch(null);
      await load();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save achievement' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this achievement?')) return;
    try {
      await ProfileApi.deleteAchievement(id);
      setStatusMsg({ type: 'success', text: 'Achievement removed.' });
      await load();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Delete failed' });
    }
  };

  return (
    <AdminLayout
      title="Accreditations & Honors"
      subtitle="Manage national awards, Silk Mark certifications, diamond milestones, and press recognitions"
      actions={
        <button onClick={handleOpenAdd} className="pf-btn-primary text-xs py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" />
          <span>Add Honor</span>
        </button>
      }
    >
      {statusMsg && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {achievements.map(ach => (
          <div key={ach.id} className="pf-card p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="pf-badge-gold text-[10px]">{ach.category}</span>
                <span className="font-mono text-xs text-[var(--pf-text-subtle)] font-bold">{ach.issue_date}</span>
              </div>
              <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">{ach.title}</h3>
              <p className="text-xs font-semibold text-[var(--pf-gold)]">{ach.organization}</p>
              <p className="text-xs text-[var(--pf-text-muted)] line-clamp-3 leading-relaxed">{ach.description}</p>
            </div>

            <div className="pt-3 border-t border-[var(--pf-border-soft)] flex items-center justify-between">
              {ach.credential_url ? (
                <a href={ach.credential_url} target="_blank" rel="noreferrer" className="text-[11px] text-[var(--pf-burgundy)] hover:underline flex items-center gap-1">
                  <span>Credential Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : <span className="text-[11px] text-[var(--pf-text-subtle)]">Internal verification</span>}

              <div className="flex items-center gap-1.5">
                <button onClick={() => setEditingAch({ ...ach })} className="p-1 rounded border border-[var(--pf-border)] hover:bg-[var(--pf-bg-alt)]">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(ach.id)} className="p-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingAch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[var(--pf-bg-card)] border border-[var(--pf-border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
              <h3 className="font-serif font-bold text-base">{editingAch.id ? 'Edit Honor' : 'Add Honor'}</h3>
              <button onClick={() => setEditingAch(null)} className="p-1 rounded text-[var(--pf-text-muted)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={editingAch.title || ''}
                  onChange={e => setEditingAch({ ...editingAch, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-serif font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Category *</label>
                  <select
                    value={editingAch.category || 'Award'}
                    onChange={e => setEditingAch({ ...editingAch, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  >
                    <option value="Award">Award</option>
                    <option value="Certification">Certification</option>
                    <option value="Milestone">Milestone</option>
                    <option value="Recognition">Recognition</option>
                    <option value="Speaking">Speaking Event</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Issue Date *</label>
                  <input
                    type="text"
                    required
                    value={editingAch.issue_date || ''}
                    onChange={e => setEditingAch({ ...editingAch, issue_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Issuing Body / Organization *</label>
                <input
                  type="text"
                  required
                  value={editingAch.organization || ''}
                  onChange={e => setEditingAch({ ...editingAch, organization: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editingAch.description || ''}
                  onChange={e => setEditingAch({ ...editingAch, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Credential URL</label>
                <input
                  type="url"
                  value={editingAch.credential_url || ''}
                  onChange={e => setEditingAch({ ...editingAch, credential_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--pf-border)] flex justify-end gap-2">
                <button type="button" onClick={() => setEditingAch(null)} className="pf-btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="pf-btn-primary text-xs">
                  Save Honor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminAchievements;
