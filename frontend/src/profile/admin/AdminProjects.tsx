import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import { ProfileApi } from '../api';
import { ProjectItem } from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Upload,
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';

export const AdminProjects: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit / Add Modal state
  const [editingProject, setEditingProject] = useState<Partial<ProjectItem> | null>(null);
  const [techInput, setTechInput] = useState('');
  const [resultInput, setResultInput] = useState('');

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await ProfileApi.getAdminProjects();
      setProjects(data || []);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to load projects' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Manage Projects & Portfolio — Admin';
    loadProjects();
  }, []);

  const handleOpenAdd = () => {
    setEditingProject({
      title: '',
      category: 'Bridal Silks',
      short_description: '',
      full_description: '',
      cover_image: '/images/floor.jpg',
      gallery: [],
      client_name: '',
      role: 'Master Silk Curator',
      completion_date: '2026',
      project_url: '',
      technologies: ['Pure Mulberry Silk', 'Silk Mark Certified'],
      results: ['Generational heirloom preserved'],
      is_featured: false,
      is_published: true
    });
    setTechInput('');
    setResultInput('');
  };

  const handleOpenEdit = (p: ProjectItem) => {
    setEditingProject({ ...p });
    setTechInput('');
    setResultInput('');
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    try {
      await ProfileApi.saveProject(editingProject);
      setStatusMsg({ type: 'success', text: `Project "${editingProject.title}" saved successfully.` });
      setEditingProject(null);
      await loadProjects();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save project' });
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}"?`)) return;

    try {
      await ProfileApi.deleteProject(id);
      setStatusMsg({ type: 'success', text: `Deleted project "${title}" successfully.` });
      await loadProjects();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete project' });
    }
  };

  const handleTogglePublish = async (p: ProjectItem) => {
    try {
      await ProfileApi.saveProject({ id: p.id, is_published: !p.is_published });
      setProjects(prev => prev.map(item => item.id === p.id ? { ...item, is_published: !item.is_published } : item));
      setStatusMsg({ type: 'success', text: `Updated status for "${p.title}".` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to toggle status' });
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingProject) return;

    try {
      const res = await ProfileApi.uploadMedia(file);
      setEditingProject({ ...editingProject, cover_image: res.url });
      setStatusMsg({ type: 'success', text: 'Image uploaded successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Upload failed: ${err.message}` });
    }
  };

  const filtered = projects.filter(p =>
    p.title?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase()) ||
    p.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout
      title="Portfolio & Projects Management"
      subtitle="Create, update, publish, or archive heritage weaves and architectural case studies"
      actions={
        <button onClick={handleOpenAdd} className="pf-btn-primary text-xs py-1.5 px-3">
          <Plus className="w-3.5 h-3.5" />
          <span>New Project</span>
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

      {/* Search Header */}
      <div className="pf-card p-4 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pf-text-subtle)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects by title, client..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] text-xs text-[var(--pf-text-main)] focus:outline-none focus:border-[var(--pf-gold)]"
          />
        </div>
        <div className="text-xs text-[var(--pf-text-muted)] font-medium">
          Total: <strong>{projects.length}</strong> items
        </div>
      </div>

      {/* Data Table */}
      <div className="pf-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--pf-border)] bg-[var(--pf-bg-alt)] text-[11px] uppercase tracking-wider text-[var(--pf-gold)] font-bold">
                <th className="py-3 px-4">Cover</th>
                <th className="py-3 px-4">Title & Category</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pf-border-soft)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--pf-text-muted)]">
                    Loading projects...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--pf-text-muted)]">
                    No projects found. Click "New Project" to add your first portfolio piece.
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-[var(--pf-bg-alt)]/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="w-12 h-9 rounded-lg overflow-hidden border border-[var(--pf-border)] bg-[var(--pf-bg-alt)]">
                        <img src={p.cover_image} alt={p.title} className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-serif font-bold text-sm text-[var(--pf-text-main)]">{p.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] uppercase font-bold text-[var(--pf-gold)]">{p.category}</span>
                        {p.is_featured && (
                          <span className="text-[9px] bg-[var(--pf-gold-light)] text-[var(--pf-gold)] px-1.5 py-0.2 rounded font-bold">
                            Signature
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[var(--pf-text-muted)] font-medium">
                      {p.client_name || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[var(--pf-text-subtle)]">
                      {p.completion_date || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleTogglePublish(p)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                          p.is_published
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {p.is_published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{p.is_published ? 'Published' : 'Draft'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg border border-[var(--pf-border)] hover:bg-[var(--pf-bg-alt)] text-[var(--pf-text-main)]"
                          title="Edit Project"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.title)}
                          className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600"
                          title="Delete Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Create Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div
            className="bg-[var(--pf-bg-card)] border border-[var(--pf-border)] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-[var(--pf-border)] bg-[var(--pf-bg-alt)] flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-[var(--pf-text-main)]">
                {editingProject.id ? `Edit: ${editingProject.title}` : 'Add New Portfolio Project'}
              </h3>
              <button
                onClick={() => setEditingProject(null)}
                className="p-1.5 rounded-lg border border-[var(--pf-border)] text-[var(--pf-text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1">Project Title *</label>
                  <input
                    type="text"
                    required
                    value={editingProject.title || ''}
                    onChange={e => setEditingProject({ ...editingProject, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Category *</label>
                  <select
                    value={editingProject.category || 'Bridal Silks'}
                    onChange={e => setEditingProject({ ...editingProject, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  >
                    <option value="Bridal Silks">Bridal Silks</option>
                    <option value="Heritage Weaves">Heritage Weaves</option>
                    <option value="Bespoke Suiting">Bespoke Suiting</option>
                    <option value="Retail Architecture">Retail Architecture</option>
                    <option value="Home Furnishing">Home Furnishing</option>
                  </select>
                </div>
              </div>

              {/* Cover Image & Upload */}
              <div>
                <label className="block font-bold mb-1">Cover Image URL *</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    required
                    value={editingProject.cover_image || ''}
                    onChange={e => setEditingProject({ ...editingProject, cover_image: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg-alt)] hover:bg-[var(--pf-bg)] cursor-pointer font-semibold shrink-0">
                    <Upload className="w-3.5 h-3.5 text-[var(--pf-gold)]" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Short Description *</label>
                <textarea
                  rows={2}
                  required
                  value={editingProject.short_description || ''}
                  onChange={e => setEditingProject({ ...editingProject, short_description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Detailed Case Study Narrative</label>
                <textarea
                  rows={4}
                  value={editingProject.full_description || ''}
                  onChange={e => setEditingProject({ ...editingProject, full_description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] whitespace-pre-line"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold mb-1">Client / Family Name</label>
                  <input
                    type="text"
                    value={editingProject.client_name || ''}
                    onChange={e => setEditingProject({ ...editingProject, client_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Curator Role</label>
                  <input
                    type="text"
                    value={editingProject.role || ''}
                    onChange={e => setEditingProject({ ...editingProject, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Completion Date</label>
                  <input
                    type="text"
                    value={editingProject.completion_date || ''}
                    onChange={e => setEditingProject({ ...editingProject, completion_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                  />
                </div>
              </div>

              {/* Technologies / Craft tags */}
              <div className="space-y-1.5">
                <label className="block font-bold">Materials & Weaves (Comma separated)</label>
                <input
                  type="text"
                  value={editingProject.technologies ? editingProject.technologies.join(', ') : ''}
                  onChange={e =>
                    setEditingProject({
                      ...editingProject,
                      technologies: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })
                  }
                  placeholder="Pure Mulberry Silk, Real Gold Zari, Korvai..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)]"
                />
              </div>

              {/* Status Toggles */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={editingProject.is_featured || false}
                    onChange={e => setEditingProject({ ...editingProject, is_featured: e.target.checked })}
                    className="rounded"
                  />
                  <span>Signature / Featured Project</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={editingProject.is_published !== false}
                    onChange={e => setEditingProject({ ...editingProject, is_published: e.target.checked })}
                    className="rounded"
                  />
                  <span>Published on Website</span>
                </label>
              </div>

              <div className="pt-4 border-t border-[var(--pf-border)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="pf-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="pf-btn-primary text-xs">
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminProjects;
