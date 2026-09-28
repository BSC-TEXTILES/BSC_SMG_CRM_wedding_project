import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { GalleryItem } from '../types';
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, X, Upload } from 'lucide-react';

export const AdminGallery: React.FC = () => {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Partial<GalleryItem> | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await ProfileApi.getGallery();
      setGallery(data || []);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load gallery' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Manage Media Gallery — Admin';
    load();
  }, []);

  const handleOpenAdd = () => {
    setEditingItem({
      title: '',
      category: 'Bridal Silks',
      media_url: '/images/wedding.jpg',
      caption: '',
      is_published: true
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      await ProfileApi.saveGalleryItem(editingItem);
      setStatusMsg({ type: 'success', text: `Saved media item "${editingItem.title}".` });
      setEditingItem(null);
      await load();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save gallery item' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this gallery media?')) return;
    try {
      await ProfileApi.deleteGalleryItem(id);
      setStatusMsg({ type: 'success', text: 'Media deleted.' });
      await load();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Delete failed' });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingItem) return;

    try {
      const res = await ProfileApi.uploadMedia(file);
      setEditingItem({ ...editingItem, media_url: res.url });
      setStatusMsg({ type: 'success', text: 'Media uploaded successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Upload failed: ${err.message}` });
    }
  };

  return (
    <AdminLayout
      title="Media & Showroom Gallery"
      subtitle="Upload photographs, tag categories, add captions, and organize showroom imagery"
      actions={
        <button onClick={handleOpenAdd} className="pf-btn-primary text-xs py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" />
          <span>Upload Media</span>
        </button>
      }
    >
      {statusMsg && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {gallery.map(item => (
          <div key={item.id} className="pf-card overflow-hidden group flex flex-col justify-between">
            <div>
              <div className="relative aspect-[4/3] bg-[var(--pf-bg-alt)] overflow-hidden">
                <img src={item.media_url} alt={item.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <span className="absolute top-2 left-2 bg-black/60 text-white text-[9px] uppercase px-2 py-0.5 rounded font-bold">
                  {item.category}
                </span>
              </div>
              <div className="p-3 space-y-1">
                <h4 className="font-serif font-bold text-xs text-[var(--pf-text-main)] truncate">{item.title}</h4>
                {item.caption && <p className="text-[10px] text-[var(--pf-text-muted)] line-clamp-2">{item.caption}</p>}
              </div>
            </div>

            <div className="p-3 pt-0 border-t border-[var(--pf-border-soft)] mt-2 flex items-center justify-between text-xs">
              <span className="text-[10px] text-emerald-600 font-bold">Active</span>
              <div className="flex gap-1">
                <button onClick={() => setEditingItem({ ...item })} className="p-1 rounded hover:bg-[var(--pf-bg-alt)]">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1 rounded text-rose-600 hover:bg-rose-50">
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
              <h3 className="font-serif font-bold text-base">{editingItem.id ? 'Edit Media' : 'Add Media Item'}</h3>
              <button onClick={() => setEditingItem(null)} className="p-1 rounded text-[var(--pf-text-muted)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block font-bold mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={editingItem.title || ''}
                  onChange={e => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Category *</label>
                <select
                  value={editingItem.category || 'Bridal Silks'}
                  onChange={e => setEditingItem({ ...editingItem, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                >
                  <option value="Bridal Silks">Bridal Silks</option>
                  <option value="Showrooms">Showrooms</option>
                  <option value="Menswear & Suiting">Menswear & Suiting</option>
                  <option value="Craftsmanship">Craftsmanship</option>
                  <option value="Moments">Moments</option>
                  <option value="Home Linen">Home Linen</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Media URL or Upload</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={editingItem.media_url || ''}
                    onChange={e => setEditingItem({ ...editingItem, media_url: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                  <label className="p-2 border border-[var(--pf-border)] rounded-xl bg-[var(--pf-bg-alt)] hover:bg-[var(--pf-bg)] cursor-pointer">
                    <Upload className="w-4 h-4 text-[var(--pf-gold)]" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Caption / Notes</label>
                <textarea
                  rows={2}
                  value={editingItem.caption || ''}
                  onChange={e => setEditingItem({ ...editingItem, caption: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--pf-border)] flex justify-end gap-2">
                <button type="button" onClick={() => setEditingItem(null)} className="pf-btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="pf-btn-primary text-xs">
                  Save Media
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminGallery;
