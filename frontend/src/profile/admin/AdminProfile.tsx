import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { ProfileData } from '../types';
import {
  Save,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image as ImageIcon
} from 'lucide-react';

export const AdminProfile: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    document.title = 'Edit Profile Information — Admin';

    async function load() {
      try {
        const data = await ProfileApi.getProfile();
        setProfile(data);
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: err.message || 'Failed to load profile' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setStatusMsg(null);

    try {
      const updated = await ProfileApi.updateProfile(profile);
      setProfile(updated);
      setStatusMsg({ type: 'success', text: 'Profile information saved successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'profile_image' | 'cover_image' | 'resume_url') => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    try {
      setStatusMsg(null);
      const res = await ProfileApi.uploadMedia(file);
      setProfile({ ...profile, [field]: res.url });
      setStatusMsg({ type: 'success', text: `Uploaded ${file.name} successfully.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Upload failed: ${err.message}` });
    }
  };

  return (
    <AdminLayout
      title="Profile & Heritage Management"
      subtitle="Edit official names, titles, contact information, and biography narratives"
      actions={
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="pf-btn-primary text-xs py-1.5 px-4 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      }
    >
      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200'
          }`}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">
          Loading profile settings...
        </div>
      ) : profile && (
        <form onSubmit={handleSave} className="space-y-8">
          {/* Visuals & Imagery */}
          <div className="pf-card p-6 space-y-6">
            <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">Imagery & Visual Assets</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile / Portrait Image */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[var(--pf-text-main)]">Profile Portrait Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-24 rounded-xl overflow-hidden border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] shrink-0">
                    <img
                      src={profile.profile_image}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-2 flex-1 text-xs">
                    <input
                      type="text"
                      value={profile.profile_image}
                      onChange={e => setProfile({ ...profile, profile_image: e.target.value })}
                      placeholder="Image URL or relative path"
                      className="w-full px-3 py-1.5 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] hover:bg-[var(--pf-bg)] cursor-pointer text-[11px] font-semibold">
                      <Upload className="w-3.5 h-3.5 text-[var(--pf-gold)]" />
                      <span>Upload New Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleFileUpload(e, 'profile_image')}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Cover Image */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[var(--pf-text-main)]">Hero Cover / Showroom Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-28 h-20 rounded-xl overflow-hidden border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] shrink-0">
                    <img
                      src={profile.cover_image}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-2 flex-1 text-xs">
                    <input
                      type="text"
                      value={profile.cover_image}
                      onChange={e => setProfile({ ...profile, cover_image: e.target.value })}
                      placeholder="Cover image URL or path"
                      className="w-full px-3 py-1.5 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs"
                    />
                    <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] hover:bg-[var(--pf-bg)] cursor-pointer text-[11px] font-semibold">
                      <Upload className="w-3.5 h-3.5 text-[var(--pf-gold)]" />
                      <span>Upload Cover</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleFileUpload(e, 'cover_image')}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Identity */}
          <div className="pf-card p-6 space-y-4 text-xs">
            <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">Profile Identity</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[var(--pf-text-main)] mb-1">Brand / Profile Name *</label>
                <input
                  type="text"
                  required
                  value={profile.full_name}
                  onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-serif font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--pf-text-main)] mb-1">Founder / Managing Director</label>
                <input
                  type="text"
                  value={profile.founder || ''}
                  onChange={e => setProfile({ ...profile, founder: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[var(--pf-text-main)] mb-1">Professional Title & Lineage Tagline *</label>
              <input
                type="text"
                required
                value={profile.professional_title}
                onChange={e => setProfile({ ...profile, professional_title: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-[var(--pf-gold)] font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--pf-text-main)] mb-1">Short Introduction (Hero Kicker) *</label>
              <textarea
                rows={2}
                required
                value={profile.short_bio}
                onChange={e => setProfile({ ...profile, short_bio: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] leading-relaxed"
              />
            </div>

            <div>
              <label className="block font-bold text-[var(--pf-text-main)] mb-1">Comprehensive Biography & Story</label>
              <textarea
                rows={6}
                value={profile.full_bio}
                onChange={e => setProfile({ ...profile, full_bio: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] leading-relaxed whitespace-pre-line"
              />
            </div>
          </div>

          {/* Contact Details & Availability */}
          <div className="pf-card p-6 space-y-4 text-xs">
            <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">Location & Reachability</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[var(--pf-text-main)] mb-1">Location / Headquarters</label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={e => setProfile({ ...profile, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--pf-text-main)] mb-1">Availability Status</label>
                <input
                  type="text"
                  value={profile.availability}
                  onChange={e => setProfile({ ...profile, availability: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-semibold text-emerald-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-[var(--pf-text-main)] mb-1">Primary Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={e => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--pf-text-main)] mb-1">Direct Telephone</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={e => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--pf-text-main)] mb-1">Website URL</label>
                <input
                  type="url"
                  value={profile.website}
                  onChange={e => setProfile({ ...profile, website: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-[var(--pf-text-main)] mb-1">Brochure / Resume Document Path</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={profile.resume_url || ''}
                  onChange={e => setProfile({ ...profile, resume_url: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] hover:bg-[var(--pf-bg)] cursor-pointer text-xs font-semibold shrink-0">
                  <Upload className="w-3.5 h-3.5 text-[var(--pf-gold)]" />
                  <span>Upload PDF</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={e => handleFileUpload(e, 'resume_url')}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="pf-btn-primary text-xs py-2 px-6 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  );
};

export default AdminProfile;
