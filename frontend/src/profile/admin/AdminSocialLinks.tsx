import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { SocialLink } from '../types';
import { Plus, Trash2, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export const AdminSocialLinks: React.FC = () => {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    document.title = 'Social Media Channels — Admin';
    async function load() {
      try {
        const data = await ProfileApi.getSocialLinks();
        setLinks(data || []);
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: err.message || 'Failed to load social links' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAddLink = () => {
    const maxId = links.reduce((m, l) => Math.max(m, l.id || 0), 0);
    setLinks([
      ...links,
      {
        id: maxId + 1,
        platform: 'instagram',
        label: 'New Platform',
        url: 'https://',
        icon_name: 'Globe',
        is_active: true,
        display_order: links.length + 1
      }
    ]);
  };

  const handleRemove = (id: number) => {
    setLinks(links.filter(l => l.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      await ProfileApi.updateSocialLinks(links);
      setStatusMsg({ type: 'success', text: 'Social media channels updated.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save channels' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Official Social Media & Links"
      subtitle="Configure external channels: LinkedIn, Instagram, Facebook, YouTube, GitHub, and Website"
      actions={
        <div className="flex gap-2">
          <button onClick={handleAddLink} className="pf-btn-secondary text-xs py-1.5 px-3">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Channel</span>
          </button>
          <button onClick={handleSave} disabled={saving} className="pf-btn-primary text-xs py-1.5 px-4 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save All'}</span>
          </button>
        </div>
      }
    >
      {statusMsg && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="pf-card p-6 space-y-4">
        {links.map((link, idx) => (
          <div key={link.id} className="p-4 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
            <div className="sm:col-span-3">
              <label className="block text-[10px] uppercase font-bold text-[var(--pf-gold)] mb-1">Platform Label</label>
              <input
                type="text"
                value={link.label}
                onChange={e => {
                  const updated = [...links];
                  updated[idx].label = e.target.value;
                  setLinks(updated);
                }}
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-bg)] font-semibold"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-[10px] uppercase font-bold text-[var(--pf-gold)] mb-1">External URL</label>
              <input
                type="url"
                value={link.url}
                onChange={e => {
                  const updated = [...links];
                  updated[idx].url = e.target.value;
                  setLinks(updated);
                }}
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-bg)] font-mono"
              />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 pt-4 sm:pt-0">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={link.is_active}
                  onChange={e => {
                    const updated = [...links];
                    updated[idx].is_active = e.target.checked;
                    setLinks(updated);
                  }}
                  className="rounded"
                />
                <span className="font-semibold">Active</span>
              </label>
            </div>

            <div className="sm:col-span-1 flex justify-end pt-4 sm:pt-0">
              <button
                type="button"
                onClick={() => handleRemove(link.id)}
                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminSocialLinks;
