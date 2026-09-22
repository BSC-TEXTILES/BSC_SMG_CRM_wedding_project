import React, { useState, useEffect, useMemo } from 'react';
import { API } from '../services/api';
import { showToast } from './Toast';
import { BSC_DEPARTMENTS, getUniqueDepartments } from '../utils/bscDepartments';
import { Layers, Plus, Edit3, Trash2, X, Save, Check } from 'lucide-react';

interface ManageSectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSectionsUpdated: () => void;
}

export default function ManageSectionsModal({ isOpen, onClose, onSectionsUpdated }: ManageSectionsModalProps) {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterDept, setFilterDept] = useState('All');

  // New Section Form
  const [newDept, setNewDept] = useState(BSC_DEPARTMENTS[0] || 'Mens');
  const [newSectionName, setNewSectionName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDept, setEditDept] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const departmentOptions = useMemo(() => {
    return getUniqueDepartments(sections.map(s => s.department));
  }, [sections]);

  const loadSections = async () => {
    try {
      setLoading(true);
      const res = await API.getDepartmentSections();
      if (res && res.sections) {
        setSections(res.sections);
      }
    } catch (err: any) {
      console.warn('Failed to load department sections', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSections();
    }
  }, [isOpen]);

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) {
      showToast('Please enter a section name', 'warn');
      return;
    }

    try {
      const res = await API.addDepartmentSection({
        department: newDept,
        sectionName: newSectionName.trim(),
        description: newDescription.trim()
      });

      if (res && res.success !== false) {
        showToast(`Section "${newSectionName}" created successfully!`, 'success');
        setNewSectionName('');
        setNewDescription('');
        await loadSections();
        onSectionsUpdated();
      } else {
        showToast(res.error || 'Failed to add section', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error adding section', 'error');
    }
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) {
      showToast('Section name cannot be empty', 'warn');
      return;
    }

    try {
      const res = await API.editDepartmentSection({
        id,
        department: editDept,
        sectionName: editName.trim(),
        description: editDesc.trim()
      });

      if (res && res.success !== false) {
        showToast('Section updated successfully!', 'success');
        setEditingId(null);
        await loadSections();
        onSectionsUpdated();
      } else {
        showToast(res.error || 'Failed to update section', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Update error', 'error');
    }
  };

  const handleDeleteSection = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete section "${name}"?`)) return;

    try {
      const res = await API.deleteDepartmentSection(id);
      if (res && res.success !== false) {
        showToast(`Section "${name}" deleted`, 'success');
        await loadSections();
        onSectionsUpdated();
      } else {
        showToast(res.error || 'Failed to delete section', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Delete error', 'error');
    }
  };

  if (!isOpen) return null;

  const filtered = sections.filter(s => filterDept === 'All' || s.department === filterDept);

  return (
    <div className="fixed inset-0 z-50 bg-primary/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-background rounded-3xl border border-accent-soft shadow-2xl w-full max-w-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto relative animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-accent-soft pb-3.5">
          <div>
            <h3 className="font-extrabold text-primary text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-accent" />
              <span>Manage Department Sections</span>
            </h3>
            <p className="text-xs text-primary font-medium mt-0.5">
              Add, edit or remove floor sections stored directly in the database.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary hover:text-white text-primary flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add New Section Form */}
        <form onSubmit={handleAddSection} className="p-4 rounded-2xl bg-white border border-accent-soft space-y-3 shadow-xs">
          <div className="text-xs font-black uppercase text-primary tracking-wider flex items-center gap-1.5 border-b border-accent-soft pb-2">
            <Plus className="w-4 h-4 text-accent" />
            <span>Add New Department Section</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">Department</label>
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-semibold text-primary focus:outline-none"
              >
                {departmentOptions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">Section Name *</label>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g. Designer Saree 2..."
                className="w-full px-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-semibold text-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase block mb-1">Description (Optional)</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Notes or location..."
                className="w-full px-2.5 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-semibold text-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Section</span>
            </button>
          </div>
        </form>

        {/* Existing Sections List */}
        <div className="p-4 rounded-2xl bg-white border border-accent-soft space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-accent-soft pb-2.5">
            <div className="text-xs font-black uppercase text-primary tracking-wider">
              Database Sections ({filtered.length})
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-extrabold text-[#5D4E42] uppercase">Filter Dept:</span>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-2.5 py-1 rounded-xl border border-accent-soft bg-background text-xs font-bold text-primary"
              >
                <option value="All">All Departments</option>
                {departmentOptions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-accent-soft text-[10.5px] font-black uppercase text-primary bg-background">
                  <th className="py-2.5 px-3 text-center w-12">SL.NO</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Section Name</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-soft/60 font-medium">
                {filtered.length > 0 ? (
                  filtered.map((sec, idx) => {
                    const isEditing = editingId === sec.id;

                    if (isEditing) {
                      return (
                        <tr key={sec.id} className="bg-black/5">
                          <td className="py-2 px-3 text-center font-bold text-primary">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <select
                              value={editDept}
                              onChange={(e) => setEditDept(e.target.value)}
                              className="px-2 py-1 rounded-lg border border-accent-soft bg-white text-xs font-bold"
                            >
                              {departmentOptions.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="px-2 py-1 rounded-lg border border-accent-soft bg-white text-xs font-bold"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              className="px-2 py-1 rounded-lg border border-accent-soft bg-white text-xs"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleSaveEdit(sec.id)}
                                className="btn-success text-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="btn-secondary text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={sec.id} className="hover:bg-black/5 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-primary">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-primary">{sec.department}</td>
                        <td className="py-2.5 px-3 font-black text-accent">{sec.section_name}</td>
                        <td className="py-2.5 px-3 text-primary">{sec.description || '—'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingId(sec.id);
                                setEditDept(sec.department);
                                setEditName(sec.section_name);
                                setEditDesc(sec.description || '');
                              }}
                              className="p-1 rounded-lg bg-sky-100 text-sky-800 hover:bg-sky-600 hover:text-black transition-colors"
                              title="Edit Section"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSection(sec.id, sec.section_name)}
                              className="p-1 rounded-lg bg-rose-100 text-rose-800 hover:bg-rose-600 hover:text-black transition-colors"
                              title="Delete Section"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-primary font-semibold">
                      No department sections found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end border-t border-accent-soft pt-3">
          <button
            onClick={onClose}
            className="btn-primary text-xs shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
