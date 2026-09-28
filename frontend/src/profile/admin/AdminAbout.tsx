import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { ProfileData } from '../types';
import { Save, CheckCircle2, AlertCircle, Plus, Trash2, Target, Compass, Sparkles } from 'lucide-react';

export const AdminAbout: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    document.title = 'About, Mission & Values — Admin';
    async function load() {
      try {
        const data = await ProfileApi.getProfile();
        setProfile(data);
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: err.message || 'Failed to load data' });
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
      setStatusMsg({ type: 'success', text: 'Heritage story, mission, and core values saved.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddValue = () => {
    if (!profile) return;
    const values = profile.core_values || [];
    setProfile({
      ...profile,
      core_values: [...values, { title: 'New Core Value', description: 'Describe value' }]
    });
  };

  const handleRemoveValue = (index: number) => {
    if (!profile) return;
    const values = [...(profile.core_values || [])];
    values.splice(index, 1);
    setProfile({ ...profile, core_values: values });
  };

  const handleAddHighlight = () => {
    if (!profile) return;
    const hl = profile.highlights || [];
    setProfile({ ...profile, highlights: [...hl, 'New milestone accomplishment'] });
  };

  const handleRemoveHighlight = (index: number) => {
    if (!profile) return;
    const hl = [...(profile.highlights || [])];
    hl.splice(index, 1);
    setProfile({ ...profile, highlights: hl });
  };

  return (
    <AdminLayout
      title="About Story, Mission & Core Values"
      subtitle="Refine the heritage lineage, brand philosophy, mission statements, and core principles"
      actions={
        <button
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
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs text-[var(--pf-text-muted)]">Loading content...</div>
      ) : profile && (
        <form onSubmit={handleSave} className="space-y-8 text-xs">
          {/* Mission & Vision */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="pf-card p-6 space-y-3">
              <div className="flex items-center gap-2 text-[var(--pf-burgundy)] font-serif font-bold text-base">
                <Target className="w-5 h-5" />
                <h3>Mission Statement</h3>
              </div>
              <textarea
                rows={4}
                value={profile.mission || ''}
                onChange={e => setProfile({ ...profile, mission: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] leading-relaxed"
              />
            </div>

            <div className="pf-card p-6 space-y-3">
              <div className="flex items-center gap-2 text-[var(--pf-gold)] font-serif font-bold text-base">
                <Compass className="w-5 h-5" />
                <h3>Vision Statement</h3>
              </div>
              <textarea
                rows={4}
                value={profile.vision || ''}
                onChange={e => setProfile({ ...profile, vision: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] leading-relaxed"
              />
            </div>
          </div>

          {/* Core Values */}
          <div className="pf-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
              <div>
                <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">Core Values</h3>
                <p className="text-[11px] text-[var(--pf-text-muted)]">Featured on the public About page and footer highlights</p>
              </div>
              <button type="button" onClick={handleAddValue} className="pf-btn-secondary text-xs py-1.5 px-3">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Value</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(profile.core_values || []).map((val, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] space-y-2 relative">
                  <button
                    type="button"
                    onClick={() => handleRemoveValue(idx)}
                    className="absolute top-3 right-3 text-rose-600 hover:text-rose-800"
                    title="Remove value"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[var(--pf-gold)] mb-1">Value Title</label>
                    <input
                      type="text"
                      value={val.title}
                      onChange={e => {
                        const vals = [...(profile.core_values || [])];
                        vals[idx].title = e.target.value;
                        setProfile({ ...profile, core_values: vals });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-bg)] font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[var(--pf-gold)] mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={val.description}
                      onChange={e => {
                        const vals = [...(profile.core_values || [])];
                        vals[idx].description = e.target.value;
                        setProfile({ ...profile, core_values: vals });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Highlights */}
          <div className="pf-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--pf-border)] pb-3">
              <div>
                <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">Heritage Lineage Highlights</h3>
                <p className="text-[11px] text-[var(--pf-text-muted)]">Key accomplishment bullet points shown in the About section</p>
              </div>
              <button type="button" onClick={handleAddHighlight} className="pf-btn-secondary text-xs py-1.5 px-3">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bullet</span>
              </button>
            </div>

            <div className="space-y-2">
              {(profile.highlights || []).map((hl, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={hl}
                    onChange={e => {
                      const hls = [...(profile.highlights || [])];
                      hls[idx] = e.target.value;
                      setProfile({ ...profile, highlights: hls });
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveHighlight(idx)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      )}
    </AdminLayout>
  );
};

export default AdminAbout;
