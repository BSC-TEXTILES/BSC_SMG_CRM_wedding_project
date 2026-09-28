import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { ServiceItem } from '../types';
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';

export const AdminServices: React.FC = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<Partial<ServiceItem> | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await ProfileApi.getServices();
      setServices(data || []);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load services' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Manage Services & Suites — Admin';
    loadServices();
  }, []);

  const handleOpenAdd = () => {
    setEditingService({
      title: '',
      short_description: '',
      detailed_description: '',
      icon_name: 'Sparkles',
      features: ['Personalized Consultation', 'Silk Mark Certified'],
      starting_price: '₹15,000',
      cta_text: 'Reserve Suite',
      is_published: true
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    try {
      await ProfileApi.saveService(editingService);
      setStatusMsg({ type: 'success', text: `Saved service "${editingService.title}".` });
      setEditingService(null);
      await loadServices();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save service' });
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!window.confirm(`Delete service "${title}"?`)) return;
    try {
      await ProfileApi.deleteService(id);
      setStatusMsg({ type: 'success', text: `Deleted "${title}".` });
      await loadServices();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Delete failed' });
    }
  };

  return (
    <AdminLayout
      title="Services & Private Suites"
      subtitle="Manage bespoke consulting offerings, trousseau packages, and floor reservations"
      actions={
        <button onClick={handleOpenAdd} className="pf-btn-primary text-xs py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" />
          <span>Add Service</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map(s => (
          <div key={s.id} className="pf-card p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="pf-badge-gold text-[10px]">{s.icon_name}</span>
                <span className="font-serif text-xs font-bold text-[var(--pf-burgundy)]">{s.starting_price}</span>
              </div>
              <h3 className="font-serif text-base font-bold text-[var(--pf-text-main)]">{s.title}</h3>
              <p className="text-xs text-[var(--pf-text-muted)] line-clamp-3">{s.short_description}</p>
            </div>

            <div className="pt-3 border-t border-[var(--pf-border-soft)] flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${s.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600'}`}>
                {s.is_published ? 'Published' : 'Draft'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setEditingService({ ...s })}
                  className="p-1.5 rounded-lg border border-[var(--pf-border)] hover:bg-[var(--pf-bg-alt)]"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(s.id, s.title)}
                  className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-[var(--pf-bg-card)] border border-[var(--pf-border)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
              <h3 className="font-serif font-bold text-base">
                {editingService.id ? `Edit: ${editingService.title}` : 'Add Service'}
              </h3>
              <button onClick={() => setEditingService(null)} className="p-1 rounded text-[var(--pf-text-muted)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Service Title *</label>
                <input
                  type="text"
                  required
                  value={editingService.title || ''}
                  onChange={e => setEditingService({ ...editingService, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Starting Price *</label>
                  <input
                    type="text"
                    required
                    value={editingService.starting_price || ''}
                    onChange={e => setEditingService({ ...editingService, starting_price: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-serif"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Icon Style</label>
                  <select
                    value={editingService.icon_name || 'Sparkles'}
                    onChange={e => setEditingService({ ...editingService, icon_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  >
                    <option value="Crown">Crown (Bridal Trousseau)</option>
                    <option value="Sparkles">Sparkles (Mulberry Silk)</option>
                    <option value="Scissors">Scissors (Bespoke Suiting)</option>
                    <option value="Gift">Gift (Family Gifting)</option>
                    <option value="Store">Store (Private Floor Suite)</option>
                    <option value="ShieldCheck">Shield (Restoration)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Short Description</label>
                <textarea
                  rows={2}
                  required
                  value={editingService.short_description || ''}
                  onChange={e => setEditingService({ ...editingService, short_description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Features (Comma separated)</label>
                <input
                  type="text"
                  value={editingService.features ? editingService.features.join(', ') : ''}
                  onChange={e =>
                    setEditingService({
                      ...editingService,
                      features: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--pf-border)] flex justify-end gap-2">
                <button type="button" onClick={() => setEditingService(null)} className="pf-btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="pf-btn-primary text-xs">
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminServices;
