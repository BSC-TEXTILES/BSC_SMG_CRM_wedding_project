import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { SkillItem } from '../types';
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';

export const AdminSkills: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSkill, setEditingSkill] = useState<Partial<SkillItem> | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await ProfileApi.getSkills();
      setSkills(data || []);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load skills' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Manage Skills & Disciplines — Admin';
    load();
  }, []);

  const handleOpenAdd = () => {
    setEditingSkill({
      name: '',
      category: 'Craftsmanship & Weaving',
      proficiency: 90,
      years_of_experience: 10,
      is_published: true
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSkill) return;

    try {
      await ProfileApi.saveSkill(editingSkill);
      setStatusMsg({ type: 'success', text: `Saved skill "${editingSkill.name}".` });
      setEditingSkill(null);
      await load();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save skill' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this skill?')) return;
    try {
      await ProfileApi.deleteSkill(id);
      setStatusMsg({ type: 'success', text: 'Skill deleted.' });
      await load();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Delete failed' });
    }
  };

  return (
    <AdminLayout
      title="Craftsmanship & Disciplines"
      subtitle="Categorized skill ratings, master weaving competencies, and years of experience"
      actions={
        <button onClick={handleOpenAdd} className="pf-btn-primary text-xs py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" />
          <span>Add Skill</span>
        </button>
      }
    >
      {statusMsg && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skills.map(s => (
          <div key={s.id} className="pf-card p-4 space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="pf-badge-gold text-[9px]">{s.category}</span>
                <span className="text-[10px] font-mono text-[var(--pf-text-subtle)] font-bold">{s.years_of_experience} Yrs</span>
              </div>
              <h4 className="font-serif font-bold text-sm text-[var(--pf-text-main)]">{s.name}</h4>
              <div className="flex items-center justify-between text-[11px] text-[var(--pf-text-muted)] pt-1">
                <span>Proficiency</span>
                <span className="font-bold text-[var(--pf-burgundy)]">{s.proficiency}%</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--pf-border-soft)] flex justify-end gap-1.5">
              <button
                onClick={() => setEditingSkill({ ...s })}
                className="p-1 rounded border border-[var(--pf-border)] hover:bg-[var(--pf-bg-alt)]"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(s.id)}
                className="p-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[var(--pf-bg-card)] border border-[var(--pf-border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
              <h3 className="font-serif font-bold text-base">{editingSkill.id ? 'Edit Skill' : 'Add Skill'}</h3>
              <button onClick={() => setEditingSkill(null)} className="p-1 rounded text-[var(--pf-text-muted)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Skill Name *</label>
                <input
                  type="text"
                  required
                  value={editingSkill.name || ''}
                  onChange={e => setEditingSkill({ ...editingSkill, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Category *</label>
                <select
                  value={editingSkill.category || 'Craftsmanship & Weaving'}
                  onChange={e => setEditingSkill({ ...editingSkill, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                >
                  <option value="Craftsmanship & Weaving">Craftsmanship & Weaving</option>
                  <option value="Client Advisory">Client Advisory</option>
                  <option value="Design & Tailoring">Design & Tailoring</option>
                  <option value="Business & Management">Business & Management</option>
                  <option value="Leadership">Leadership</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Proficiency % ({editingSkill.proficiency || 90}%)</label>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={editingSkill.proficiency || 90}
                    onChange={e => setEditingSkill({ ...editingSkill, proficiency: parseInt(e.target.value, 10) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Years of Exp</label>
                  <input
                    type="number"
                    value={editingSkill.years_of_experience || 0}
                    onChange={e => setEditingSkill({ ...editingSkill, years_of_experience: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-1.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--pf-border)] flex justify-end gap-2">
                <button type="button" onClick={() => setEditingSkill(null)} className="pf-btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="pf-btn-primary text-xs">
                  Save Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminSkills;
