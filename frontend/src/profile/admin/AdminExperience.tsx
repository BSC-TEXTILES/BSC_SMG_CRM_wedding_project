import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { ExperienceItem } from '../types';
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';

export const AdminExperience: React.FC = () => {
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingExp, setEditingExp] = useState<Partial<ExperienceItem> | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await ProfileApi.getAdminExperience();
      setExperiences(data || []);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load experience records' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Manage Experience Milestones — Admin';
    load();
  }, []);

  const handleOpenAdd = () => {
    setEditingExp({
      company: 'BSC Textiles',
      position: '',
      location: 'Belagavi, Karnataka',
      start_date: '2020',
      end_date: 'Present',
      is_current: true,
      employment_type: 'Full-time / Lineage',
      responsibilities: ['Floor leadership and client advisory'],
      achievements: ['Record bridal customer satisfaction'],
      skills_used: ['Silk Weaving', 'Customer Relations'],
      is_published: true
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExp) return;

    try {
      await ProfileApi.saveExperience(editingExp);
      setStatusMsg({ type: 'success', text: `Saved experience milestone.` });
      setEditingExp(null);
      await load();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save experience' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this experience milestone?')) return;
    try {
      await ProfileApi.deleteExperience(id);
      setStatusMsg({ type: 'success', text: 'Milestone removed.' });
      await load();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Delete failed' });
    }
  };

  return (
    <AdminLayout
      title="Experience & Milestones Timeline"
      subtitle="Manage career history, advisory roles, and handloom preservation milestones"
      actions={
        <button onClick={handleOpenAdd} className="pf-btn-primary text-xs py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" />
          <span>Add Milestone</span>
        </button>
      }
    >
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="space-y-4">
        {experiences.map(item => (
          <div key={item.id} className="pf-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="pf-badge-gold text-[10px]">{item.employment_type}</span>
                <span className="font-mono text-xs text-[var(--pf-text-subtle)] font-bold">
                  {item.start_date} – {item.is_current ? 'Present' : item.end_date}
                </span>
              </div>
              <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">{item.position}</h3>
              <p className="text-xs text-[var(--pf-gold)] font-medium">{item.company} · {item.location}</p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => setEditingExp({ ...item })}
                className="p-1.5 rounded-lg border border-[var(--pf-border)] hover:bg-[var(--pf-bg-alt)]"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingExp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[var(--pf-bg-card)] border border-[var(--pf-border)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
              <h3 className="font-serif font-bold text-base">
                {editingExp.id ? 'Edit Experience' : 'Add Experience Milestone'}
              </h3>
              <button onClick={() => setEditingExp(null)} className="p-1 rounded text-[var(--pf-text-muted)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Company / Organization *</label>
                <input
                  type="text"
                  required
                  value={editingExp.company || ''}
                  onChange={e => setEditingExp({ ...editingExp, company: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Role / Position Title *</label>
                <input
                  type="text"
                  required
                  value={editingExp.position || ''}
                  onChange={e => setEditingExp({ ...editingExp, position: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-bold font-serif"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Start Date</label>
                  <input
                    type="text"
                    value={editingExp.start_date || ''}
                    onChange={e => setEditingExp({ ...editingExp, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">End Date</label>
                  <input
                    type="text"
                    value={editingExp.end_date || ''}
                    onChange={e => setEditingExp({ ...editingExp, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Location</label>
                <input
                  type="text"
                  value={editingExp.location || ''}
                  onChange={e => setEditingExp({ ...editingExp, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Responsibilities (Comma separated)</label>
                <textarea
                  rows={2}
                  value={editingExp.responsibilities ? editingExp.responsibilities.join(', ') : ''}
                  onChange={e => setEditingExp({ ...editingExp, responsibilities: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--pf-border)] flex justify-end gap-2">
                <button type="button" onClick={() => setEditingExp(null)} className="pf-btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="pf-btn-primary text-xs">
                  Save Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminExperience;
