import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import { 
  Layers, Plus, Search, Calendar, User, Users, CircleCheck, 
  Clock, CircleAlert, Trash2, Edit3, ChevronRight, ChevronDown, UserPlus, X, Award
} from 'lucide-react';

interface BatchMember {
  id: number;
  group_id: number;
  batch_id: number;
  member_name: string;
  phone?: string;
  status: 'Assigned' | 'In Progress' | 'Graduated' | 'Dropped';
  join_date?: string;
  remarks?: string;
}

interface BatchGroup {
  id: number;
  batch_id: number;
  group_name: string;
  mentor_name?: string;
  target_count: number;
  notes?: string;
  members: BatchMember[];
}

interface Batch {
  id: number;
  batch_number: string;
  batch_name: string;
  location_id: number;
  location_name?: string;
  location_code?: string;
  start_date: string;
  target_end_date?: string;
  status: 'Draft' | 'Active' | 'Completed' | 'Cancelled';
  department: string;
  trainer_name?: string;
  notes?: string;
  group_count?: number;
  total_trainees?: number;
  graduated_count?: number;
  groups?: BatchGroup[];
}

export default function BatchPlan() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [stats, setStats] = useState<any>({
    totalBatches: 0,
    activeBatches: 0,
    completedBatches: 0,
    totalTrainees: 0,
    activeTrainees: 0,
    graduatedTrainees: 0,
    droppedTrainees: 0
  });

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBatchId, setExpandedBatchId] = useState<number | null>(null);
  const [expandedBatchData, setExpandedBatchData] = useState<Batch | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modals
  const [createBatchOpen, setCreateBatchOpen] = useState(false);
  const [newBatch, setNewBatch] = useState({
    batch_name: '',
    department: 'Weaving',
    trainer_name: '',
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: '',
    status: 'Active',
    notes: ''
  });

  const [addGroupModal, setAddGroupModal] = useState<{ open: boolean; batchId: number | null }>({
    open: false,
    batchId: null
  });
  const [newGroup, setNewGroup] = useState({ group_name: '', mentor_name: '', target_count: 10, notes: '' });

  const [addMemberModal, setAddMemberModal] = useState<{ open: boolean; groupId: number | null; batchId: number | null }>({
    open: false,
    groupId: null,
    batchId: null
  });
  const [newMember, setNewMember] = useState({ member_name: '', phone: '', status: 'Assigned', remarks: '' });

  const loadBatches = useCallback(async () => {
    try {
      setLoading(true);
      const [resBatches, resStats] = await Promise.all([
        API.get(`/batch-plan/batches?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`),
        API.get('/batch-plan/stats')
      ]);

      if (resBatches.success) setBatches(resBatches.batches || []);
      if (resStats.success) setStats(resStats.stats || {});
    } catch (err: any) {
      showToast(err.message || 'Failed to load batches', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    loadBatches();

    const handleLocChange = () => {
      loadBatches();
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, [navigate, loadBatches]);

  // Load single batch details when expanded
  const handleToggleExpand = async (batchId: number) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      setExpandedBatchData(null);
      return;
    }

    try {
      setLoadingDetail(true);
      setExpandedBatchId(batchId);
      const res = await API.get(`/batch-plan/batches/${batchId}`);
      if (res.success) {
        setExpandedBatchData(res.batch);
      }
    } catch (err: any) {
      showToast('Could not load batch groups', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await API.post('/batch-plan/batches', newBatch);
      if (res.success) {
        showToast('Batch created successfully!', 'success');
        setCreateBatchOpen(false);
        setNewBatch({
          batch_name: '',
          department: 'Weaving',
          trainer_name: '',
          start_date: new Date().toISOString().split('T')[0],
          target_end_date: '',
          status: 'Active',
          notes: ''
        });
        loadBatches();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create batch', 'error');
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addGroupModal.batchId) return;
    try {
      const res = await API.post(`/batch-plan/batches/${addGroupModal.batchId}/groups`, newGroup);
      if (res.success) {
        showToast('Group added successfully!', 'success');
        setAddGroupModal({ open: false, batchId: null });
        setNewGroup({ group_name: '', mentor_name: '', target_count: 10, notes: '' });
        // Refresh details
        handleToggleExpand(addGroupModal.batchId);
        loadBatches();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add group', 'error');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberModal.groupId || !addMemberModal.batchId) return;
    try {
      const res = await API.post(`/batch-plan/groups/${addMemberModal.groupId}/members`, {
        ...newMember,
        batch_id: addMemberModal.batchId
      });
      if (res.success) {
        showToast('Trainee enrolled successfully!', 'success');
        setAddMemberModal({ open: false, groupId: null, batchId: null });
        setNewMember({ member_name: '', phone: '', status: 'Assigned', remarks: '' });
        // Refresh details
        handleToggleExpand(addMemberModal.batchId);
        loadBatches();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to enroll member', 'error');
    }
  };

  const handleUpdateMemberStatus = async (memberId: number, status: string, batchId: number) => {
    try {
      const res = await API.put(`/batch-plan/members/${memberId}`, { status });
      if (res.success) {
        showToast(`Status updated to ${status}`, 'success');
        handleToggleExpand(batchId);
        loadBatches();
      }
    } catch (err: any) {
      showToast('Could not update member status', 'error');
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <ToastContainer />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} session={session} />

      <div className={`flex-1 flex flex-col min-w-0 overflow-y-auto transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar 
          title="Batch Plan & Weaving Operations" 
          session={session} 
          onMenuClick={() => setSidebarOpen(true)}
          breadcrumbs={[{ label: 'Batch Plan' }]}
        />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* ── KPI Summary Cards ────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Layers className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary/60">Total Batches</p>
                <p className="text-xl sm:text-2xl font-black text-primary">{stats.totalBatches}</p>
                <p className="text-[10px] text-accent font-bold mt-0.5">{stats.activeBatches} Currently Active</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-status-success/10 flex items-center justify-center text-status-success">
                <Users className="w-5 h-5 text-status-success" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary/60">Active Trainees</p>
                <p className="text-xl sm:text-2xl font-black text-primary">{stats.activeTrainees}</p>
                <p className="text-[10px] text-primary/60 font-semibold mt-0.5">Across {stats.totalTrainees} enrolled</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent-dark">
                <Award className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary/60">Graduated Weavers</p>
                <p className="text-xl sm:text-2xl font-black text-primary">{stats.graduatedTrainees}</p>
                <p className="text-[10px] text-green-600 font-bold mt-0.5">
                  {stats.totalTrainees > 0 ? `${Math.round((stats.graduatedTrainees / stats.totalTrainees) * 100)}% Success Rate` : '0%'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <CircleAlert className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary/60">Dropout Count</p>
                <p className="text-xl sm:text-2xl font-black text-primary">{stats.droppedTrainees}</p>
                <p className="text-[10px] text-orange-600 font-bold mt-0.5">Need Retraining Review</p>
              </div>
            </div>
          </div>

          {/* ── Filter & Search Toolbar ─────────────────────────────── */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-accent-soft shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {['all', 'Active', 'Draft', 'Completed'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === st
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-background hover:bg-primary/5 text-primary border border-accent-soft'
                  }`}
                >
                  {st === 'all' ? 'All Batches' : st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-primary/40 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search batch, trainer..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <button
                type="button"
                onClick={() => setCreateBatchOpen(true)}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl bg-accent text-primary hover:bg-accent-hover font-bold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>New Batch</span>
              </button>
            </div>
          </div>

          {/* ── Batches List ────────────────────────────────────────── */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-xs font-semibold text-primary/60">Loading batch plan & weaving cohorts...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-accent-soft shadow-xs">
              <Layers className="w-12 h-12 text-accent mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-bold text-primary">No Batches Found</h3>
              <p className="text-xs text-primary/60 mt-1 max-w-sm mx-auto">
                No active weaving cohorts match the current filter or store location. Create a new batch to get started.
              </p>
              <button
                onClick={() => setCreateBatchOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-xs hover:bg-primary-hover"
              >
                <Plus className="w-4 h-4" /> Create First Batch
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {batches.map(batch => {
                const isExpanded = expandedBatchId === batch.id;
                return (
                  <div 
                    key={batch.id} 
                    className="bg-white rounded-2xl border border-accent-soft shadow-xs overflow-hidden transition-all hover:border-accent/60"
                  >
                    {/* Batch Summary Row */}
                    <div 
                      onClick={() => handleToggleExpand(batch.id)}
                      className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-background/40 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 font-bold text-xs">
                          {batch.location_code || 'DAV'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-accent px-2 py-0.5 rounded-md bg-accent/10">
                              {batch.batch_number}
                            </span>
                            <h3 className="text-sm font-extrabold text-primary truncate">{batch.batch_name}</h3>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              batch.status === 'Active' ? 'bg-green-100 text-green-800' :
                              batch.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {batch.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-primary/60 mt-1 flex-wrap font-medium">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-accent" />
                              Start: {new Date(batch.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            {batch.trainer_name && (
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-accent" />
                                Trainer: {batch.trainer_name}
                              </span>
                            )}
                            <span>Dept: {batch.department}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Stats & Expand Toggle */}
                      <div className="flex items-center gap-4 sm:gap-6 self-end md:self-auto flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-bold text-primary">{batch.group_count || 0} Groups</p>
                          <p className="text-[11px] text-primary/60">{batch.total_trainees || 0} Trainees ({batch.graduated_count || 0} Passed)</p>
                        </div>
                        <div className="w-7 h-7 rounded-lg bg-background flex items-center justify-center text-primary/60">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content: Groups and Trainees */}
                    {isExpanded && (
                      <div className="border-t border-accent-soft/60 bg-background/50 p-4 sm:p-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary">
                            Weaving Cohort Groups
                          </h4>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddGroupModal({ open: true, batchId: batch.id });
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white border border-accent-soft hover:border-accent text-xs font-bold text-primary shadow-2xs cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-accent" /> Add Group
                          </button>
                        </div>

                        {loadingDetail ? (
                          <p className="text-xs text-primary/60 text-center py-4">Loading cohort details...</p>
                        ) : !expandedBatchData?.groups || expandedBatchData.groups.length === 0 ? (
                          <div className="p-6 text-center bg-white rounded-xl border border-accent-soft">
                            <p className="text-xs text-primary/60 font-semibold">No loom groups created yet.</p>
                            <button
                              onClick={() => setAddGroupModal({ open: true, batchId: batch.id })}
                              className="mt-2 text-xs font-bold text-accent hover:underline"
                            >
                              + Add the first group
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {expandedBatchData.groups.map(group => (
                              <div key={group.id} className="bg-white rounded-xl border border-accent-soft p-4 shadow-2xs space-y-3">
                                <div className="flex items-center justify-between border-b border-accent-soft/60 pb-2">
                                  <div>
                                    <h5 className="text-xs font-bold text-primary">{group.group_name}</h5>
                                    <p className="text-[10px] text-primary/60">
                                      Mentor: {group.mentor_name || 'Unassigned'} · Quota: {group.members?.length || 0}/{group.target_count}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setAddMemberModal({ open: true, groupId: group.id, batchId: batch.id })}
                                    className="p-1 rounded-lg bg-accent/10 hover:bg-accent/20 text-primary text-[10px] font-bold flex items-center gap-1 px-2"
                                  >
                                    <UserPlus className="w-3 h-3 text-accent" /> Enroll
                                  </button>
                                </div>

                                {/* Member List */}
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                  {group.members && group.members.length > 0 ? (
                                    group.members.map(member => (
                                      <div key={member.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-background hover:bg-accent-soft/30 transition-colors">
                                        <div className="min-w-0 pr-2">
                                          <p className="font-semibold text-primary truncate">{member.member_name}</p>
                                          <p className="text-[10px] text-primary/60">{member.phone || 'No phone'}</p>
                                        </div>
                                        <select
                                          value={member.status}
                                          onChange={(e) => handleUpdateMemberStatus(member.id, e.target.value, batch.id)}
                                          className="text-[10px] font-bold py-1 px-2 rounded border border-accent-soft bg-white text-primary focus:outline-none"
                                        >
                                          <option value="Assigned">Assigned</option>
                                          <option value="In Progress">In Progress</option>
                                          <option value="Graduated">Graduated</option>
                                          <option value="Dropped">Dropped</option>
                                        </select>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-[11px] text-primary/40 italic py-2 text-center">No trainees enrolled yet</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ── CREATE BATCH MODAL ────────────────────────────────────── */}
      {createBatchOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-accent-soft space-y-4">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <h3 className="text-sm font-extrabold text-primary">Create New Weaving Batch</h3>
              <button onClick={() => setCreateBatchOpen(false)} className="text-primary/60 hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-primary mb-1">Batch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Weavers Autumn Cohort"
                  value={newBatch.batch_name}
                  onChange={e => setNewBatch({ ...newBatch, batch_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Department</label>
                  <input
                    type="text"
                    value={newBatch.department}
                    onChange={e => setNewBatch({ ...newBatch, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Trainer / Master</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh K"
                    value={newBatch.trainer_name}
                    onChange={e => setNewBatch({ ...newBatch, trainer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={newBatch.start_date}
                    onChange={e => setNewBatch({ ...newBatch, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Target End Date</label>
                  <input
                    type="date"
                    value={newBatch.target_end_date}
                    onChange={e => setNewBatch({ ...newBatch, target_end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Special instructions or loom requirements..."
                  value={newBatch.notes}
                  onChange={e => setNewBatch({ ...newBatch, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateBatchOpen(false)}
                  className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs"
                >
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD GROUP MODAL ───────────────────────────────────────── */}
      {addGroupModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-accent-soft space-y-4">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <h3 className="text-sm font-extrabold text-primary">Add Loom / Group to Batch</h3>
              <button onClick={() => setAddGroupModal({ open: false, batchId: null })} className="text-primary/60 hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddGroup} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-primary mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jacquard Section Group A"
                  value={newGroup.group_name}
                  onChange={e => setNewGroup({ ...newGroup, group_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Mentor Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Suresh M"
                    value={newGroup.mentor_name}
                    onChange={e => setNewGroup({ ...newGroup, mentor_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Target Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={newGroup.target_count}
                    onChange={e => setNewGroup({ ...newGroup, target_count: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddGroupModal({ open: false, batchId: null })}
                  className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs"
                >
                  Save Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ENROLL MEMBER MODAL ───────────────────────────────────── */}
      {addMemberModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-accent-soft space-y-4">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <h3 className="text-sm font-extrabold text-primary">Enroll Trainee into Group</h3>
              <button onClick={() => setAddMemberModal({ open: false, groupId: null, batchId: null })} className="text-primary/60 hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-primary mb-1">Trainee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manjunatha B"
                  value={newMember.member_name}
                  onChange={e => setNewMember({ ...newMember, member_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-1">Contact Phone</label>
                <input
                  type="tel"
                  placeholder="+91 9876543210"
                  value={newMember.phone}
                  onChange={e => setNewMember({ ...newMember, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-1">Initial Status</label>
                <select
                  value={newMember.status}
                  onChange={e => setNewMember({ ...newMember, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                >
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress (Active)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddMemberModal({ open: false, groupId: null, batchId: null })}
                  className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs"
                >
                  Enroll Trainee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
