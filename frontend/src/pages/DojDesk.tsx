import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import { 
  CalendarClock, Users, AlertTriangle, CheckCircle, Clock, 
  Search, Phone, Calendar, ArrowRight, UserCheck, XCircle, 
  Store, Building, RefreshCw, X, ShieldAlert
} from 'lucide-react';

interface NotJoinedCandidate {
  app_no: string;
  name: string;
  phone: string;
  designation?: string;
  department?: string;
  section?: string;
  candidate_status: string;
  scheduled_doj: string;
  offer_status?: string;
  notice_period?: string;
  offer_remarks?: string;
  location_id: number;
  location_name?: string;
  location_code?: string;
  delay_days: number;
  doj_urgency: 'Overdue' | 'Joining Today' | 'Upcoming';
}

interface JoinedEmployee {
  app_no: string;
  emp_code: string;
  name: string;
  phone: string;
  email?: string;
  designation: string;
  department: string;
  section?: string;
  joined_date: string;
  location_id: number;
  location_name: string;
  location_code: string;
  staff_status: string;
}

export default function DojDesk() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());
  const [activeTab, setActiveTab] = useState<'not_joined' | 'joined_store'>('not_joined');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  // Not Joined Desk State
  const [candidates, setCandidates] = useState<NotJoinedCandidate[]>([]);
  const [stats, setStats] = useState({ total: 0, overdue: 0, today: 0, upcoming: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Joined Store Directory State
  const [joinedEmployees, setJoinedEmployees] = useState<JoinedEmployee[]>([]);
  const [joinedCount, setJoinedCount] = useState(0);

  // Modals
  const [rescheduleModal, setRescheduleModal] = useState<{ open: boolean; appNo: string; name: string; currentDoj: string }>({
    open: false,
    appNo: '',
    name: '',
    currentDoj: ''
  });
  const [newDoj, setNewDoj] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const [dropModal, setDropModal] = useState<{ open: boolean; appNo: string; name: string }>({
    open: false,
    appNo: '',
    name: ''
  });
  const [dropReason, setDropReason] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (activeTab === 'not_joined') {
        const res = await API.get(
          `/employees/not-joined?search=${encodeURIComponent(searchQuery)}&overdueOnly=${overdueOnly}`
        );
        if (res.success) {
          setCandidates(res.candidates || []);
          setStats(res.stats || { total: 0, overdue: 0, today: 0, upcoming: 0 });
        }
      } else {
        const res = await API.get(`/employees/joined-store?search=${encodeURIComponent(searchQuery)}`);
        if (res.success) {
          setJoinedEmployees(res.employees || []);
          setJoinedCount(res.count || 0);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load desk data', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, overdueOnly]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    loadData();

    const handleLocChange = () => {
      loadData();
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, [navigate, loadData]);

  // Action handlers
  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoj) return;
    try {
      const res = await API.post('/employees/not-joined/action', {
        appNo: rescheduleModal.appNo,
        action: 'reschedule',
        new_doj: newDoj,
        reason: rescheduleReason
      });
      if (res.success) {
        showToast('Date of Joining rescheduled successfully!', 'success');
        setRescheduleModal({ open: false, appNo: '', name: '', currentDoj: '' });
        setNewDoj('');
        setRescheduleReason('');
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reschedule', 'error');
    }
  };

  const handleDropCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await API.post('/employees/not-joined/action', {
        appNo: dropModal.appNo,
        action: 'mark_not_joining',
        reason: dropReason
      });
      if (res.success) {
        showToast('Candidate marked as Not Joining', 'success');
        setDropModal({ open: false, appNo: '', name: '' });
        setDropReason('');
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleMarkJoined = async (appNo: string, name: string) => {
    if (!window.confirm(`Confirm that ${name} has joined the store today?`)) return;
    try {
      const res = await API.post('/employees/not-joined/action', {
        appNo,
        action: 'mark_joined'
      });
      if (res.success) {
        showToast(`${name} successfully recorded in Joined Store Directory!`, 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Could not mark joined', 'error');
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <ToastContainer />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} session={session} />

      <div className={`flex-1 flex flex-col min-w-0 overflow-y-auto transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Topbar 
          title="DOJ Desk & Joined Store Directory" 
          session={session} 
          onMenuClick={() => setSidebarOpen(true)}
          breadcrumbs={[{ label: 'DOJ & Not Joined Desk' }]}
        />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* ── KPI Summary Cards ────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <CalendarClock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary/60">Pending Joining</p>
                <p className="text-xl sm:text-2xl font-black text-primary">{stats.total}</p>
                <p className="text-[10px] text-accent font-bold mt-0.5">{stats.upcoming} Scheduled Upcoming</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C0392B]/10 flex items-center justify-center text-[#C0392B]">
                <AlertTriangle className="w-5 h-5 text-[#C0392B]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary/60">Overdue DOJ</p>
                <p className="text-xl sm:text-2xl font-black text-[#C0392B]">{stats.overdue}</p>
                <p className="text-[10px] text-red-600 font-bold mt-0.5">Immediate Follow-up Needed</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary/60">Joining Today</p>
                <p className="text-xl sm:text-2xl font-black text-primary">{stats.today}</p>
                <p className="text-[10px] text-orange-600 font-bold mt-0.5">Ready for Verification</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-accent-soft shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-status-success/10 flex items-center justify-center text-status-success">
                <Store className="w-5 h-5 text-status-success" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary/60">Active Store Staff</p>
                <p className="text-xl sm:text-2xl font-black text-primary">{joinedCount || '—'}</p>
                <p className="text-[10px] text-status-success font-bold mt-0.5">Joined Store Directory</p>
              </div>
            </div>
          </div>

          {/* ── Main Tab Navigation & Filters ────────────────────────── */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-accent-soft shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => setActiveTab('not_joined')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'not_joined'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-background hover:bg-primary/5 text-primary border border-accent-soft'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-accent" />
                <span>Not Joined Desk ({stats.total})</span>
              </button>

              <button
                onClick={() => setActiveTab('joined_store')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'joined_store'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-background hover:bg-primary/5 text-primary border border-accent-soft'
                }`}
              >
                <Store className="w-4 h-4 text-[#2D8659]" />
                <span>Joined Store Directory</span>
              </button>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {activeTab === 'not_joined' && (
                <button
                  type="button"
                  onClick={() => setOverdueOnly(!overdueOnly)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    overdueOnly 
                      ? 'bg-red-50 text-red-700 border-red-200' 
                      : 'bg-background text-primary border-accent-soft hover:border-accent'
                  }`}
                >
                  Overdue Only ({stats.overdue})
                </button>
              )}

              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-primary/40 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search candidate, phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-accent-soft bg-background text-xs font-medium text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <button
                onClick={() => loadData()}
                className="p-2 rounded-xl border border-accent-soft hover:bg-background text-primary/60 hover:text-primary transition-all"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Tab Content ─────────────────────────────────────────── */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-xs font-semibold text-primary/60">Loading desk data...</p>
            </div>
          ) : activeTab === 'not_joined' ? (
            /* TAB 1: NOT JOINED DESK */
            candidates.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-accent-soft shadow-xs">
                <CheckCircle className="w-12 h-12 text-[#2D8659] mx-auto mb-3 opacity-80" />
                <h3 className="text-base font-bold text-primary">Zero Pending Candidates</h3>
                <p className="text-xs text-primary/60 mt-1 max-w-sm mx-auto">
                  All offered candidates have either reported on their DOJ or no candidates are currently awaiting onboarding.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-accent-soft shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-background border-b border-accent-soft text-primary/70 font-extrabold text-[11px] uppercase tracking-wider">
                        <th className="py-3.5 px-4">Candidate & App No</th>
                        <th className="py-3.5 px-4">Role & Store Branch</th>
                        <th className="py-3.5 px-4">Scheduled DOJ</th>
                        <th className="py-3.5 px-4">Urgency / Delay</th>
                        <th className="py-3.5 px-4">Current Status</th>
                        <th className="py-3.5 px-4 text-right">Desk Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent-soft/40">
                      {candidates.map(cand => (
                        <tr key={cand.app_no} className="hover:bg-background/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <p className="font-extrabold text-primary">{cand.name}</p>
                            <p className="font-mono text-[10px] text-accent font-bold mt-0.5">{cand.app_no}</p>
                            <p className="text-[11px] text-primary/60 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-primary/40" /> {cand.phone}
                            </p>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-primary">{cand.designation || 'Retail Staff'}</p>
                            <p className="text-[11px] text-primary/60">{cand.department || 'Floor'}</p>
                            <span className="inline-block font-bold text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary mt-1">
                              {cand.location_name || 'Davanagere'} ({cand.location_code || 'DAV'})
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-bold text-primary">
                              <Calendar className="w-3.5 h-3.5 text-accent" />
                              <span>
                                {cand.scheduled_doj 
                                  ? new Date(cand.scheduled_doj).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                  : 'Not Set'}
                              </span>
                            </div>
                            {cand.notice_period && (
                              <p className="text-[10px] text-primary/50 mt-0.5">Notice: {cand.notice_period}</p>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              cand.doj_urgency === 'Overdue' 
                                ? 'bg-red-100 text-red-800' :
                              cand.doj_urgency === 'Joining Today'
                                ? 'bg-orange-100 text-orange-800' :
                                'bg-blue-100 text-blue-800'
                            }`}>
                              {cand.doj_urgency}
                              {cand.delay_days > 0 && ` (${cand.delay_days}d overdue)`}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-primary/80">
                              {cand.offer_status || cand.candidate_status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleMarkJoined(cand.app_no, cand.name)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-status-success text-white hover:opacity-90 font-bold text-[11px] shadow-2xs"
                                title="Candidate has arrived and joined the store"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Mark Joined
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setRescheduleModal({
                                    open: true,
                                    appNo: cand.app_no,
                                    name: cand.name,
                                    currentDoj: cand.scheduled_doj ? cand.scheduled_doj.split('T')[0] : ''
                                  });
                                  setNewDoj(cand.scheduled_doj ? cand.scheduled_doj.split('T')[0] : '');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-accent-soft hover:border-accent text-primary font-bold text-[11px] shadow-2xs"
                                title="Reschedule joining date"
                              >
                                <CalendarClock className="w-3.5 h-3.5 text-accent" /> Reschedule
                              </button>

                              <button
                                type="button"
                                onClick={() => setDropModal({ open: true, appNo: cand.app_no, name: cand.name })}
                                className="p-1 rounded-lg hover:bg-red-50 text-red-600"
                                title="Candidate rejected or not joining"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            /* TAB 2: JOINED STORE DIRECTORY */
            joinedEmployees.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-accent-soft shadow-xs">
                <Store className="w-12 h-12 text-accent mx-auto mb-3 opacity-60" />
                <h3 className="text-base font-bold text-primary">No Staff Records Found</h3>
                <p className="text-xs text-primary/60 mt-1 max-w-sm mx-auto">
                  No staff members have been marked as Joined in this location yet.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-accent-soft shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-background border-b border-accent-soft text-primary/70 font-extrabold text-[11px] uppercase tracking-wider">
                        <th className="py-3.5 px-4">Employee Code & Name</th>
                        <th className="py-3.5 px-4">Designation & Department</th>
                        <th className="py-3.5 px-4">Store Location</th>
                        <th className="py-3.5 px-4">Date of Joining</th>
                        <th className="py-3.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-accent-soft/40">
                      {joinedEmployees.map(emp => (
                        <tr key={emp.app_no || emp.emp_code} className="hover:bg-background/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <p className="font-extrabold text-primary">{emp.name}</p>
                            <p className="font-mono text-[10px] text-accent font-bold mt-0.5">{emp.emp_code || emp.app_no}</p>
                            <p className="text-[11px] text-primary/60 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-primary/40" /> {emp.phone}
                            </p>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-primary">{emp.designation}</p>
                            <p className="text-[11px] text-primary/60">{emp.department || 'Retail Store'}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block font-bold text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">
                              {emp.location_name} ({emp.location_code})
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-primary">
                            {emp.joined_date 
                              ? new Date(emp.joined_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 text-green-600" /> Active Staff
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </main>
      </div>

      {/* ── RESCHEDULE MODAL ──────────────────────────────────────── */}
      {rescheduleModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-accent-soft space-y-4">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <h3 className="text-sm font-extrabold text-primary">Reschedule Date of Joining (DOJ)</h3>
              <button onClick={() => setRescheduleModal({ open: false, appNo: '', name: '', currentDoj: '' })} className="text-primary/60 hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-primary/70">
              Rescheduling joining date for <strong className="text-primary">{rescheduleModal.name}</strong> ({rescheduleModal.appNo}).
            </p>

            <form onSubmit={handleReschedule} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-primary mb-1">New Date of Joining *</label>
                <input
                  type="date"
                  required
                  value={newDoj}
                  onChange={e => setNewDoj(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-1">Reason for Rescheduling</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Candidate requested 1 extra week for relocation..."
                  value={rescheduleReason}
                  onChange={e => setRescheduleReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleModal({ open: false, appNo: '', name: '', currentDoj: '' })}
                  className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs"
                >
                  Save New DOJ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── NOT JOINING / DROP MODAL ──────────────────────────────── */}
      {dropModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-accent-soft space-y-4">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <h3 className="text-sm font-extrabold text-[#C0392B] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Mark Candidate Not Joining
              </h3>
              <button onClick={() => setDropModal({ open: false, appNo: '', name: '' })} className="text-primary/60 hover:text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-primary/70">
              Confirm that <strong className="text-primary">{dropModal.name}</strong> will not be joining BSC Textiles.
            </p>

            <form onSubmit={handleDropCandidate} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-primary mb-1">Reason / Feedback *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Accepted another offer / Unreachable / Personal reasons..."
                  value={dropReason}
                  onChange={e => setDropReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-accent-soft bg-background text-xs font-medium focus:ring-2 focus:ring-accent outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDropModal({ open: false, appNo: '', name: '' })}
                  className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#C0392B] text-white text-xs font-bold hover:bg-red-700 shadow-xs"
                >
                  Confirm Not Joining
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
