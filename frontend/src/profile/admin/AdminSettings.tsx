import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { SiteSettings } from '../types';
import { Save, CheckCircle2, AlertCircle, Globe, Search, Shield } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    document.title = 'SEO & Site Configuration — Admin';
    async function load() {
      try {
        const data = await ProfileApi.getAdminSettings();
        setSettings(data);
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: err.message || 'Failed to load settings' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const updated = await ProfileApi.updateSettings(settings);
      setSettings(updated);
      setStatusMsg({ type: 'success', text: 'SEO metadata and site configurations updated.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="SEO, Meta Tags & System Settings"
      subtitle="Configure dynamic OpenGraph metadata, search engine indexing tags, canonical URLs, and privacy settings"
      actions={
        <button
          onClick={handleSave}
          disabled={saving}
          className="pf-btn-primary text-xs py-1.5 px-4 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      }
    >
      {statusMsg && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">Loading settings...</div>
      ) : settings && (
        <form onSubmit={handleSave} className="space-y-6 text-xs">
          {/* SEO & Meta Tags */}
          <div className="pf-card p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--pf-border)] pb-3">
              <Search className="w-4 h-4 text-[var(--pf-gold)]" />
              <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">Search Engine Optimization (SEO)</h3>
            </div>

            <div>
              <label className="block font-bold mb-1">HTML Page Title & Meta Title *</label>
              <input
                type="text"
                required
                value={settings.site_title}
                onChange={e => setSettings({ ...settings, site_title: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold mb-1">Meta Description (150-160 characters recommended)</label>
              <textarea
                rows={3}
                value={settings.meta_description}
                onChange={e => setSettings({ ...settings, meta_description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-1">Keywords</label>
                <input
                  type="text"
                  value={settings.keywords}
                  onChange={e => setSettings({ ...settings, keywords: e.target.value })}
                  placeholder="Comma separated search terms..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Canonical URL</label>
                <input
                  type="url"
                  value={settings.canonical_url}
                  onChange={e => setSettings({ ...settings, canonical_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">OpenGraph / Social Share Image Path</label>
              <input
                type="text"
                value={settings.og_image}
                onChange={e => setSettings({ ...settings, og_image: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
              />
            </div>
          </div>

          {/* Contact Routing & Theme */}
          <div className="pf-card p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--pf-border)] pb-3">
              <Globe className="w-4 h-4 text-[var(--pf-gold)]" />
              <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">System Defaults & Contact Routing</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-1">Inquiry Notification Email</label>
                <input
                  type="email"
                  value={settings.contact_email}
                  onChange={e => setSettings({ ...settings, contact_email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Flagship Contact Telephone</label>
                <input
                  type="tel"
                  value={settings.contact_phone}
                  onChange={e => setSettings({ ...settings, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold">
                <input
                  type="checkbox"
                  checked={settings.enable_cookie_consent}
                  onChange={e => setSettings({ ...settings, enable_cookie_consent: e.target.checked })}
                  className="rounded"
                />
                <span>Enable Cookie Consent Banner</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-600">
                <input
                  type="checkbox"
                  checked={settings.maintenance_mode || false}
                  onChange={e => setSettings({ ...settings, maintenance_mode: e.target.checked })}
                  className="rounded"
                />
                <span>Maintenance Mode</span>
              </label>
            </div>
          </div>
        </form>
      )}
    </AdminLayout>
  );
};

export default AdminSettings;
