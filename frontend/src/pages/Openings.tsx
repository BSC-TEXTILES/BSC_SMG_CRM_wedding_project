import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import { Users, Plus, Save, Trash2, X, Edit3 } from 'lucide-react';

export default function OpeningsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);
  const [openings, setOpenings] = useState<any[]>([]);
  const [editMode, setEditMode] = useState<{ [key: string]: number }>({});

  // Add New Role Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleRequired, setNewRoleRequired] = useState<number>(1);
  const [addingRole, setAddingRole] = useState(false);

  const loadOpenings = useCallback(async () => {
    try {
      const res = await API.call('getOpenings');
      const list = res.openings || [];
      list.sort((a: any, b: any) => (a.designation || '').localeCompare(b.designation || ''));
      setOpenings(list);
    } catch (err: any) {
      showToast('Could not load openings', 'error');
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    if (sess?.role !== 'Admin' && sess?.role !== 'HR' && sess?.role !== 'Super Admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
    setSession(sess);
    loadOpenings();
  }, [navigate, loadOpenings]);

  const handleUpdateRequirement = async (designation: string) => {
    const count = editMode[designation];
    if (count === undefined) return;

    try {
      await API.call('updateOpening', { designation, required_count: count });
      showToast(`Role requirement updated successfully for ${designation}.`, 'success');
      
      const newEdit = { ...editMode };
      delete newEdit[designation];
      setEditMode(newEdit);
      
      loadOpenings();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleAddNewRole = async () => {
    if (!newRoleName.trim()) {
      showToast('Role designation name is required', 'error');
      return;
    }

    setAddingRole(true);
    try {
      // 1. Add designation to DB
      await API.addDesignation(newRoleName.trim());
      
      // 2. Set initial required count in manpower_requisitions
      await API.call('updateOpening', { 
        designation: newRoleName.trim(), 
        required_count: newRoleRequired || 0 
      });

      showToast(`Role "${newRoleName.trim()}" created successfully.`, 'success');
      setAddModalOpen(false);
      setNewRoleName('');
      setNewRoleRequired(1);
      loadOpenings();
    } catch (err: any) {
      showToast('Error adding role: ' + err.message, 'error');
    } finally {
      setAddingRole(false);
    }
  };

  const handleDeleteRole = async (designation: string) => {
    if (!window.confirm(`Are you sure you want to delete designation "${designation}"?`)) return;

    try {
      await API.deleteDesignation(designation);
      showToast(`Role "${designation}" deleted successfully.`, 'success');
      loadOpenings();
    } catch (err: any) {
      showToast('Error deleting role: ' + err.message, 'error');
    }
  };

  const isAdmin = session?.role === 'Admin' || session?.role === 'Super Admin';

  return (
    <div className="min-h-screen bg-background flex">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar
          title="Manpower Planning"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-primary flex items-center gap-2">
                <Users className="w-5 h-5" />
                Hiring Capacity &amp; Openings
              </h2>
              <p className="text-sm text-primary mt-1">Define manpower requisitions for each role and track fulfillment across the company.</p>
            </div>

            {isAdmin && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary flex items-center gap-2 shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Role / Designation</span>
            </button>
            )}
          </div>

          <div className="card-glass p-4 overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-accent-soft text-xs font-black uppercase text-[#6B5D50] tracking-wider">
                  <th className="py-3 px-3 text-center w-12">SL.NO</th>
                  <th className="py-3 px-4">Designation Role</th>
                  <th className="py-3 px-4">Required Openings</th>
                  <th className="py-3 px-4">Already Hired</th>
                  <th className="py-3 px-4">Still Needed</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-soft/50">
                {openings.map((op, idx) => {
                  const isEditing = editMode[op.designation] !== undefined;
                  const reqCount = isEditing ? editMode[op.designation] : op.required;
                  const stillNeeded = Math.max(0, reqCount - op.hired);
                  
                  return (
                    <tr key={op.designation} className="hover:bg-black/5 transition-colors font-medium">
                      <td className="py-4 px-3 text-center font-bold text-primary">{idx + 1}</td>
                      <td className="py-4 px-4 text-primary font-bold">{op.designation}</td>
                      <td className="py-4 px-4">
                        {isEditing ? (
                          <input 
                            type="number"
                            min="0"
                            value={reqCount}
                            onChange={(e) => setEditMode({ ...editMode, [op.designation]: parseInt(e.target.value) || 0 })}
                            className="w-24 p-1.5 border border-primary rounded-md font-bold text-primary text-center bg-white"
                          />
                        ) : (
                          <span className="text-lg font-black text-primary">{op.required}</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-lg font-black text-emerald-600">{op.hired}</span>
                        <div className="text-[10px] text-emerald-700/60 font-bold uppercase mt-0.5">Selected / Joined</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-lg font-black ${stillNeeded > 0 ? 'text-amber-600' : 'text-[#6B5D50]'}`}>
                          {stillNeeded}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleUpdateRequirement(op.designation)}
                              className="px-3 py-1.5 rounded-lg bg-primary text-white font-bold flex items-center gap-1 hover:bg-primary text-xs"
                            >
                              <Save className="w-4 h-4" /> Save
                            </button>
                            <button
                              onClick={() => {
                                const newEdit = { ...editMode };
                                delete newEdit[op.designation];
                                setEditMode(newEdit);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-accent-soft text-primary font-bold hover:bg-white text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {isAdmin && (
                            <button
                              onClick={() => setEditMode({ ...editMode, [op.designation]: op.required })}
                              className="px-3 py-1.5 rounded-lg border border-primary text-primary font-bold text-xs hover:bg-primary hover:text-white transition-colors flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit Requirement
                            </button>
                            )}
                            {isAdmin && (
                            <button
                              onClick={() => handleDeleteRole(op.designation)}
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 font-bold text-xs hover:bg-red-50 transition-colors"
                              title="Delete Role"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {openings.length > 0 && (() => {
                  const totalRequired = openings.reduce((acc, op) => acc + ((editMode[op.designation] !== undefined) ? editMode[op.designation] : op.required), 0);
                  const totalHired = openings.reduce((acc, op) => acc + op.hired, 0);
                  const totalStillNeeded = openings.reduce((acc, op) => acc + Math.max(0, ((editMode[op.designation] !== undefined) ? editMode[op.designation] : op.required) - op.hired), 0);
                  return (
                    <tr className="bg-primary/10 border-t-2 border-primary font-black text-sm text-primary">
                      <td className="py-4 px-4 font-black uppercase text-xs tracking-wider">
                        Total Manpower Summary
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-xl font-black text-primary">{totalRequired}</span>
                        <div className="text-[10px] text-primary font-bold uppercase mt-0.5">Total Openings</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-xl font-black text-emerald-700">{totalHired}</span>
                        <div className="text-[10px] text-emerald-800/70 font-bold uppercase mt-0.5">Total Hired</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-xl font-black ${totalStillNeeded > 0 ? 'text-amber-700' : 'text-[#6B5D50]'}`}>
                          {totalStillNeeded}
                        </span>
                        <div className="text-[10px] text-amber-800/70 font-bold uppercase mt-0.5">Total Still Needed</div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="px-2.5 py-1 rounded-full bg-primary text-white font-bold text-[10px] uppercase">Overall Total</span>
                      </td>
                    </tr>
                  );
                })()}
                {openings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#6B5D50]">
                      No active designations found. Click "Add New Role / Designation" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* Add New Role Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <h3 className="font-extrabold text-primary text-base">Add New Role / Designation</h3>
              <button onClick={() => setAddModalOpen(false)} className="text-[#6B5D50] hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-primary mb-1">
                  Designation / Role Title *
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Senior Floor Manager, Store Executive"
                  className="w-full p-2.5 rounded-lg border border-accent-soft bg-background font-bold text-primary"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-primary mb-1">
                  Required Manpower Openings *
                </label>
                <input
                  type="number"
                  min="1"
                  value={newRoleRequired}
                  onChange={(e) => setNewRoleRequired(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 rounded-lg border border-accent-soft bg-background font-bold text-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-accent-soft">
              <button
                onClick={() => setAddModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-accent-soft text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewRole}
                disabled={addingRole}
                className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50"
              >
                {addingRole ? 'Adding Role...' : 'Add Role across System'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
