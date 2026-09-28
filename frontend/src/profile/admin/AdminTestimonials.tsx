import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { TestimonialItem } from '../types';
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, X, Star } from 'lucide-react';

export const AdminTestimonials: React.FC = () => {
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Partial<TestimonialItem> | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await ProfileApi.getTestimonials();
      setTestimonials(data || []);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load reviews' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Manage Testimonials & Client Reviews — Admin';
    load();
  }, []);

  const handleOpenAdd = () => {
    setEditingItem({
      client_name: '',
      position: 'Bride / Patron',
      company: 'Family Wedding',
      avatar_url: '/images/women-real.webp',
      testimonial_text: '',
      rating: 5,
      date_given: '2026',
      is_featured: true,
      is_published: true
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      await ProfileApi.saveTestimonial(editingItem);
      setStatusMsg({ type: 'success', text: `Saved testimonial from ${editingItem.client_name}.` });
      setEditingItem(null);
      await load();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save review' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this testimonial?')) return;
    try {
      await ProfileApi.deleteTestimonial(id);
      setStatusMsg({ type: 'success', text: 'Testimonial deleted.' });
      await load();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Delete failed' });
    }
  };

  return (
    <AdminLayout
      title="Testimonials & Patron Feedback"
      subtitle="Client endorsements, wedding family reviews, ratings, and featured status"
      actions={
        <button onClick={handleOpenAdd} className="pf-btn-primary text-xs py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" />
          <span>Add Testimonial</span>
        </button>
      }
    >
      {statusMsg && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {testimonials.map(t => (
          <div key={t.id} className="pf-card p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex gap-0.5 text-amber-500">
                  {[...Array(t.rating || 5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <span className="text-[10px] text-[var(--pf-text-subtle)] font-mono">{t.date_given}</span>
              </div>
              <p className="text-xs text-[var(--pf-text-muted)] italic line-clamp-3">"{t.testimonial_text}"</p>
            </div>

            <div className="pt-3 border-t border-[var(--pf-border-soft)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={t.avatar_url} alt={t.client_name} className="w-8 h-8 rounded-full object-cover border" />
                <div>
                  <h4 className="font-serif font-bold text-xs">{t.client_name}</h4>
                  <span className="text-[10px] text-[var(--pf-text-subtle)] block">{t.company}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setEditingItem({ ...t })} className="p-1 rounded border border-[var(--pf-border)] hover:bg-[var(--pf-bg-alt)]">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(t.id)} className="p-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[var(--pf-bg-card)] border border-[var(--pf-border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
              <h3 className="font-serif font-bold text-base">{editingItem.id ? 'Edit Review' : 'Add Review'}</h3>
              <button onClick={() => setEditingItem(null)} className="p-1 rounded text-[var(--pf-text-muted)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Client / Family Name *</label>
                <input
                  type="text"
                  required
                  value={editingItem.client_name || ''}
                  onChange={e => setEditingItem({ ...editingItem, client_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Position / Occasion</label>
                  <input
                    type="text"
                    value={editingItem.position || ''}
                    onChange={e => setEditingItem({ ...editingItem, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Family / Company</label>
                  <input
                    type="text"
                    value={editingItem.company || ''}
                    onChange={e => setEditingItem({ ...editingItem, company: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Avatar Image URL</label>
                <input
                  type="text"
                  value={editingItem.avatar_url || ''}
                  onChange={e => setEditingItem({ ...editingItem, avatar_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Testimonial Quote *</label>
                <textarea
                  rows={3}
                  required
                  value={editingItem.testimonial_text || ''}
                  onChange={e => setEditingItem({ ...editingItem, testimonial_text: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Rating (1 to 5 Stars)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editingItem.rating || 5}
                    onChange={e => setEditingItem({ ...editingItem, rating: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-1.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Date</label>
                  <input
                    type="text"
                    value={editingItem.date_given || ''}
                    onChange={e => setEditingItem({ ...editingItem, date_given: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--pf-border)] flex justify-end gap-2">
                <button type="button" onClick={() => setEditingItem(null)} className="pf-btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="pf-btn-primary text-xs">
                  Save Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminTestimonials;
