import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import {
  PhoneCall,
  TriangleAlert,
  CircleCheck,
  Clock,
  Filter,
  MessageSquare,
  Search,
  Calendar,
  RefreshCw,
  ShieldAlert,
  User,
  Phone,
  History,
  FileText,
  Tag,
  X,
  Send
} from 'lucide-react';
import { API } from '../services/api';
import { io } from 'socket.io-client';
import { showToast } from '../components/Toast';

export default function FeedbackList() {
  const [callQueue, setCallQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Selected Call Ticket Modal
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [callOutcome, setCallOutcome] = useState<string>('Connected');
  const [issueCategory, setIssueCategory] = useState<string>('Staff Courtesy');
  const [status, setStatus] = useState<string>('called');
  const [notes, setNotes] = useState<string>('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState<string>('');
  const [nextFollowUpTime, setNextFollowUpTime] = useState<string>('11:00');
  const [updating, setUpdating] = useState<boolean>(false);

  // Filter States
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');

  const getISTDate = (d: Date = new Date()) => {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + istOffset);
    return istDate.toISOString().split('T')[0];
  };

  const fetchCallQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      const todayStr = getISTDate(new Date());

      if (datePreset === 'today') {
        params.date = todayStr;
      } else if (datePreset === 'yesterday') {
        const y = new Date(Date.now() - 86400000);
        params.date = getISTDate(y);
      } else if (datePreset === 'week') {
        const w = new Date(Date.now() - 6 * 86400000);
        params.startDate = getISTDate(w);
        params.endDate = todayStr;
      } else if (datePreset === 'month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        params.startDate = getISTDate(start);
        params.endDate = todayStr;
      } else if (datePreset === 'last_month') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        params.startDate = getISTDate(start);
        params.endDate = getISTDate(end);
      } else if (datePreset === 'custom') {
        if (startDateInput) params.startDate = startDateInput;
        if (endDateInput) params.endDate = endDateInput;
      }

      if (statusFilter !== 'all') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await API.getCallQueue(params);
      if (res && res.callQueue) {
        setCallQueue(res.callQueue);
      }
    } catch (err) {
      console.warn('fetchCallQueue sync notice:', err);
    } finally {
      setLoading(false);
    }
  }, [datePreset, startDateInput, endDateInput, statusFilter, search]);

  useEffect(() => {
    fetchCallQueue();

    // Socket.IO Push Listener for instant 0ms latency synchronization
    const socket = io({ path: '/socket.io', autoConnect: true });
    socket.on('feedback:negative', () => fetchCallQueue());
    socket.on('feedback:submitted', () => fetchCallQueue());
    socket.on('callqueue:updated', () => fetchCallQueue());

    // Auto-refresh call queue every 5 seconds for real-time synchronization
    const interval = setInterval(() => {
      fetchCallQueue();
    }, 5000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [fetchCallQueue]);

  const handleOpenCallModal = (item: any) => {
    setSelectedItem(item);
    setNotes(item.actionTaken || item.notes || '');
    setCallOutcome('Connected');
    setIssueCategory('Staff Courtesy');
    setStatus(item.status === 'resolved' ? 'resolved' : 'called');
    setNextFollowUpDate(getISTDate(new Date(Date.now() + 86400000)));
  };

  const handleUpdateCall = async (targetStatusOverride?: string) => {
    if (!selectedItem) return;
    setUpdating(true);
    try {
      const finalStatus = targetStatusOverride || status;
      const callTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newLogEntry = `[Call #${(selectedItem.attempts || 0) + 1} - ${callTime}] Outcome: ${callOutcome} | Category: ${issueCategory} | Notes: ${notes || 'Follow-up call logged.'}`;

      const updatedNotesHistory = selectedItem.notes ? `${selectedItem.notes}\n${newLogEntry}` : newLogEntry;

      await API.updateCallQueue({
        id: selectedItem.id,
        feedbackId: selectedItem.feedbackId || selectedItem.id,
        status: finalStatus,
        notes: updatedNotesHistory,
        followUpDate: nextFollowUpDate ? `${nextFollowUpDate} ${nextFollowUpTime}` : null
      });

      setSelectedItem(null);
      fetchCallQueue();
      showToast('Call activity saved successfully.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Unable to save call activity. Please try again.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Compute SLA Overdue status
  const getSLAStatus = (createdDateStr: string) => {
    if (!createdDateStr) return { label: '< 2h Normal', color: 'bg-emerald-100 text-emerald-800' };
    const createdTime = new Date(createdDateStr).getTime();
    const hoursElapsed = (Date.now() - createdTime) / (1000 * 60 * 60);

    if (hoursElapsed > 24) {
      return { label: '🚨 SLA Critical (>24h)', color: 'bg-rose-600 text-white font-black animate-pulse' };
    } else if (hoursElapsed > 2) {
      return { label: '⚠️ SLA Warning (>2h)', color: 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold' };
    }
    return { label: 'Normal (<2h)', color: 'bg-emerald-100 text-emerald-800 font-extrabold' };
  };

  const pendingCount = callQueue.filter(q => q.status === 'new' || q.status === 'pending').length;
  const inProgressCount = callQueue.filter(q => q.status === 'called' || q.status === 'in_progress').length;
  const resolvedCount = callQueue.filter(q => q.status === 'resolved' || q.status === 'closed').length;
  const escalatedCount = callQueue.filter(q => q.status === 'escalated' || q.status === 'escalated_manager').length;

  return (
    <DashboardLayout title="Feedback Call Queue Desk" subtitle="Telecaller Resolution Workspace & Customer Issue Lifecycle Management">
      <div className="space-y-6">

        {/* KPI Analytics Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-glass p-5 flex items-center justify-between border-l-4 border-l-rose-500">
            <div>
              <div className="text-[10.5px] font-black uppercase text-primary tracking-wider">Pending Calls</div>
              <div className="text-2xl font-black text-rose-600 mt-1">{pendingCount}</div>
              <div className="text-[11px] text-rose-700 font-bold mt-0.5 flex items-center gap-1">
                <TriangleAlert className="w-3 h-3" /> Auto-Escalated Tickets
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-black">
              <PhoneCall className="w-6 h-6 text-rose-600" />
            </div>
          </div>

          <div className="card-glass p-5 flex items-center justify-between">
            <div>
              <div className="text-[10.5px] font-black uppercase text-primary tracking-wider">In Progress</div>
              <div className="text-2xl font-black text-blue-600 mt-1">{inProgressCount}</div>
              <div className="text-[11px] text-blue-700 font-bold mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Telecaller Contacted
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <div className="card-glass p-5 flex items-center justify-between">
            <div>
              <div className="text-[10.5px] font-black uppercase text-primary tracking-wider">Resolved Today</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">{resolvedCount}</div>
              <div className="text-[11px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                <CircleCheck className="w-3 h-3" /> Issue Closed
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">
              <CircleCheck className="w-6 h-6 text-emerald-600" />
            </div>
          </div>

          <div className="card-glass p-5 flex items-center justify-between">
            <div>
              <div className="text-[10.5px] font-black uppercase text-primary tracking-wider">Escalated Manager</div>
              <div className="text-2xl font-black text-purple-700 mt-1">{escalatedCount}</div>
              <div className="text-[11px] text-purple-800 font-bold mt-0.5 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Senior Review
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
              <ShieldAlert className="w-6 h-6 text-purple-700" />
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="card-glass p-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search call queue by customer name, mobile, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-modern pl-9 py-2 text-xs font-semibold"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-accent hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select-modern text-xs font-bold py-2"
            >
              <option value="all">All Call Statuses</option>
              <option value="new">Pending / New</option>
              <option value="called">In Progress / Called</option>
              <option value="resolved">Resolved</option>
              <option value="escalated_manager">Escalated to Store Manager</option>
            </select>

            <Calendar className="w-3.5 h-3.5 text-accent hidden sm:block ml-2" />
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="select-modern text-xs font-bold py-2"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom date</option>
            </select>

            {datePreset === 'custom' && (
              <div className="flex items-center gap-1.5 animate-fade-in">
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(e) => setStartDateInput(e.target.value)}
                  className="input-modern text-xs font-semibold py-1.5"
                />
                <span className="text-xs font-bold text-gray-500">to</span>
                <input
                  type="date"
                  value={endDateInput}
                  onChange={(e) => setEndDateInput(e.target.value)}
                  className="input-modern text-xs font-semibold py-1.5"
                />
              </div>
            )}
          </div>
        </div>

        {/* Call Queue Master Register Table */}
        <div className="card-glass overflow-hidden">
          <div className="p-5 border-b border-accent-soft flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-primary uppercase tracking-wider flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-accent" />
              <span>Feedback Call Queue Register ({callQueue.length})</span>
            </h3>
            <button onClick={fetchCallQueue} className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Real-Time Queue</span>
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-500 font-bold text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-accent" />
              <span>Loading telecaller call queue...</span>
            </div>
          ) : callQueue.length === 0 ? (
            <div className="py-12 text-center text-gray-500 font-bold text-xs space-y-2">
              <CircleCheck className="w-10 h-10 text-emerald-400 mx-auto" />
              <div className="text-sm text-primary font-black">No Pending Follow-up Calls</div>
              <p className="text-gray-400 font-medium">All escalated customer feedbacks have been handled or resolved.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold border-collapse">
                <thead className="bg-primary text-white uppercase text-[10.5px] tracking-wider">
                  <tr>
                    <th className="p-4">Customer Details</th>
                    <th className="p-4">Submission Date &amp; Time</th>
                    <th className="p-4">SLA Tracking</th>
                    <th className="p-4">Call Attempts</th>
                    <th className="p-4">Workflow Status</th>
                    <th className="p-4">Call History / Remarks</th>
                    <th className="p-4 text-right">Action Desk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {callQueue.map((item) => {
                    const sla = getSLAStatus(item.createdAt);

                    return (
                      <tr key={item.id} className="hover:bg-black/5 transition-colors">
                        <td className="p-4">
                          <div className="font-extrabold text-primary flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-accent" />
                            <span>{item.customerName || 'Valued Customer'}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span>{item.mobile || 'N/A'}</span>
                          </div>
                        </td>

                        <td className="p-4 text-gray-600">
                          <div className="font-bold text-primary font-mono text-[11px]">
                            {item.entryDate || 'Today'}
                          </div>
                          {item.entryTime && (
                            <div className="text-[10.5px] text-gray-500 font-semibold flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-accent" />
                              <span>{item.entryTime}</span>
                            </div>
                          )}
                        </td>

                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10.5px] shadow-2xs ${sla.color}`}>
                            {sla.label}
                          </span>
                        </td>

                        <td className="p-4 font-extrabold text-primary">
                          {item.attempts || 0} Call Logged
                        </td>

                        <td className="p-4">
                          {item.status === 'resolved' || item.status === 'closed' ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max">
                              <CircleCheck className="w-3.5 h-3.5" /> Resolved
                            </span>
                          ) : item.status === 'escalated_manager' ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1 w-max">
                              <ShieldAlert className="w-3.5 h-3.5 text-purple-700" /> Manager Esc.
                            </span>
                          ) : item.status === 'called' || item.status === 'in_progress' ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 flex items-center gap-1 w-max">
                              <Clock className="w-3.5 h-3.5" /> In Progress
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 flex items-center gap-1 w-max">
                              <TriangleAlert className="w-3.5 h-3.5" /> Pending Call
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-gray-600 max-w-xs truncate text-[11px] font-medium">
                          {item.notes || 'Negative feedback auto-escalated to call queue.'}
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleOpenCallModal(item)}
                            className="btn-gold text-[11px] py-1.5 px-3 shadow-xs inline-flex items-center gap-1"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Log Structured Call</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Structured Call Outcome Logging Modal */}
        {selectedItem && (
          <div className="fixed inset-0 bg-primary/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="card-glass p-6 sm:p-8 max-w-lg w-full space-y-5 animate-scale-in shadow-2xl rounded-3xl border border-white/40 bg-white text-primary max-h-[90vh] overflow-y-auto">

              <div className="flex items-center justify-between border-b border-accent-soft pb-3">
                <h3 className="text-lg font-black text-primary flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-accent" />
                  <span>Log Telecaller Call Outcome</span>
                </h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Customer Ticket Context Header */}
              <div className="p-4 rounded-2xl bg-background border border-accent-soft space-y-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-accent">Customer Context</div>
                <div className="font-extrabold text-sm text-primary flex items-center justify-between">
                  <span>{selectedItem.customerName || 'Valued Customer'}</span>
                  <span className="font-mono text-xs text-gray-600">{selectedItem.mobile}</span>
                </div>
                <div className="text-[11px] text-gray-500 font-medium pt-0.5">
                  Submission Date: {selectedItem.entryDate || 'Today'} | Total Attempts: {selectedItem.attempts || 0}
                </div>
              </div>

              <div className="space-y-4">

                {/* Call Outcome Select */}
                <div>
                  <label className="block text-xs font-extrabold text-primary mb-1.5">Call Outcome *</label>
                  <select
                    value={callOutcome}
                    onChange={(e) => setCallOutcome(e.target.value)}
                    className="select-modern text-xs font-bold py-2 bg-white"
                  >
                    <option value="Connected">Connected (Spoke with customer)</option>
                    <option value="Not Answered">Not Answered / No Reply</option>
                    <option value="Busy">Line Busy</option>
                    <option value="Switched Off">Switched Off / Out of Reach</option>
                    <option value="Call Back Later">Call Back Later Requested</option>
                    <option value="Wrong Number">Wrong Number</option>
                    <option value="Issue Resolved">Issue Resolved on Call</option>
                    <option value="Escalated">Escalated to Store Manager</option>
                  </select>
                </div>

                {/* Issue Category Select */}
                <div>
                  <label className="block text-xs font-extrabold text-primary mb-1.5">Issue Category *</label>
                  <select
                    value={issueCategory}
                    onChange={(e) => setIssueCategory(e.target.value)}
                    className="select-modern text-xs font-bold py-2 bg-white"
                  >
                    <option value="Staff Courtesy">Staff Behavior / Courtesy</option>
                    <option value="Product Quality">Product Quality / Fit Issue</option>
                    <option value="Stock Out">Product Out of Stock</option>
                    <option value="Price / Billing">Pricing / Billing Concern</option>
                    <option value="Store Environment">Store Environment / AC / Billing Counter</option>
                    <option value="Other">Other General Feedback</option>
                  </select>
                </div>

                {/* Next Follow-up Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-primary mb-1.5">Next Follow-Up Date</label>
                    <input
                      type="date"
                      value={nextFollowUpDate}
                      onChange={(e) => setNextFollowUpDate(e.target.value)}
                      className="input-modern text-xs font-semibold py-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-primary mb-1.5">Next Follow-Up Time</label>
                    <input
                      type="time"
                      value={nextFollowUpTime}
                      onChange={(e) => setNextFollowUpTime(e.target.value)}
                      className="input-modern text-xs font-semibold py-2 bg-white"
                    />
                  </div>
                </div>

                {/* Call Notes */}
                <div>
                  <label className="block text-xs font-extrabold text-primary mb-1.5">Telecaller Resolution & Call Remarks *</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter customer response, compensation code offered, replacement status, or call remarks..."
                    className="textarea-modern text-xs font-medium bg-white"
                  ></textarea>
                </div>

                {/* Existing Call History Log Display */}
                {selectedItem.notes && (
                  <div className="space-y-1.5 pt-2 border-t border-accent-soft">
                    <div className="text-[10.5px] font-black uppercase text-primary tracking-wider flex items-center gap-1">
                      <History className="w-3.5 h-3.5 text-accent" /> Call Log History
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-[11px] font-mono text-gray-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {selectedItem.notes}
                    </div>
                  </div>
                )}

                {/* Modal Footer Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-accent-soft">
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold text-gray-600 bg-gray-100 hover:bg-gray-200"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateCall('escalated_manager')}
                      disabled={updating}
                      className="px-3.5 py-2 rounded-xl bg-purple-700 text-white font-extrabold text-xs shadow-xs"
                    >
                      Escalate Manager
                    </button>

                    <button
                      onClick={() => handleUpdateCall('resolved')}
                      disabled={updating}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow-xs flex items-center gap-1"
                    >
                      <CircleCheck className="w-3.5 h-3.5" />
                      <span>Mark Resolved</span>
                    </button>

                    <button
                      onClick={() => handleUpdateCall()}
                      disabled={updating}
                      className="btn-gold text-xs py-2 px-4 shadow-md flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{updating ? 'Saving...' : 'Save Log'}</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

