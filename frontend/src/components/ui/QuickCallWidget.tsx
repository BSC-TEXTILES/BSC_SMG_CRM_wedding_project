import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  Phone,
  X,
  Search,
  User,
  Clock,
  Calendar,
  Check,
  RotateCcw,
  Sparkles,
  PhoneOutgoing,
  History,
  Send,
  Building2,
  Minimize2
} from 'lucide-react';
import { API, Auth } from '../../services/api';
import { showToast } from '../Toast';

interface ContactItem {
  id?: number | string;
  name: string;
  phone: string;
  type: 'Customer' | 'Staff';
  subtext?: string;
}

export default function QuickCallWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dial' | 'history'>('dial');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContactItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Dialer Form
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerId, setCustomerId] = useState<number | string | null>(null);
  const [callOutcome, setCallOutcome] = useState('Connected');
  const [remarks, setRemarks] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  // Recent Logs
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const session = Auth.get();
  const searchTimeoutRef = useRef<any>(null);

  // Search contacts as user types
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const query = searchQuery.trim();
        // Fetch matching wedding customers
        const res = await API.getWeddingCustomers({ search: query, limit: 8 }).catch(() => null);
        const customers: any[] = res?.customers || res?.data || (Array.isArray(res) ? res : []);

        const results: ContactItem[] = customers.map((c: any) => ({
          id: c.id,
          name: c.customer_name || c.name || 'Customer',
          phone: c.mobile_number || c.phone || '',
          type: 'Customer' as const,
          subtext: c.wedding_date ? `Wedding: ${new Date(c.wedding_date).toLocaleDateString()}` : c.city || ''
        })).filter(c => Boolean(c.phone));

        setSearchResults(results);
      } catch (e) {
        console.warn('[QuickCall] Contact search error:', e);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const loadRecentCalls = async () => {
    setLoadingLogs(true);
    try {
      const res = await API.getWeddingExportData({ type: 'call_logs' }).catch(() => null);
      const logs = Array.isArray(res) ? res : res?.data || res?.logs || [];
      setRecentLogs(logs.slice(0, 15));
    } catch (e) {
      console.warn('[QuickCall] Failed to load recent calls:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      loadRecentCalls();
    }
  }, [isOpen, activeTab]);

  const selectContact = (contact: ContactItem) => {
    setCustomerName(contact.name);
    setPhoneNumber(contact.phone);
    setCustomerId(contact.id || null);
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleSaveCallLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      showToast('Please enter a phone number', 'warn');
      return;
    }

    setSavingLog(true);
    try {
      const payload = {
        customer_id: customerId || undefined,
        customer_name: customerName.trim() || 'Direct Call',
        customer_mobile: phoneNumber.trim(),
        call_date: new Date().toISOString().slice(0, 10),
        call_time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        call_status: 'Completed',
        call_outcome: callOutcome,
        remarks: remarks.trim() || 'Call placed via Quick Dialer',
        next_follow_up_date: nextFollowUpDate || undefined,
        telecaller_name: session?.fullName || session?.username || 'Staff'
      };

      await API.logWeddingCall(payload);
      showToast('Call log saved successfully', 'success');

      // Reset form
      setRemarks('');
      setNextFollowUpDate('');
    } catch (err: any) {
      showToast(err.message || 'Failed to save call log', 'error');
    } finally {
      setSavingLog(false);
    }
  };

  // Do not render on public pages
  if (typeof window !== 'undefined') {
    const p = window.location.pathname;
    if (p === '/login' || p === '/' || p.startsWith('/madt') || p === '/feedback-public' || p === '/feedback-qr' || p === '/tv') {
      return null;
    }
  }

  return (
    <>
      {/* Floating Call Button: positioned above ChatWidget */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-[130px] right-4 sm:bottom-[152px] sm:right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 border-2 cursor-pointer ${
          isOpen
            ? 'bg-emerald-700 text-white border-emerald-500 scale-105'
            : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white border-emerald-400/50 hover:scale-105 hover:shadow-emerald-500/30'
        }`}
        title={isOpen ? 'Close Quick Dialer' : 'Open Quick Call / Telecaller'}
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <PhoneCall className="w-5 h-5 text-white animate-pulse" />
        )}
      </button>

      {/* Quick Call Modal Drawer */}
      {isOpen && (
        <div className="fixed bottom-20 sm:bottom-24 right-3 sm:right-6 z-50 w-[390px] max-w-[calc(100vw-1.5rem)] bg-white rounded-3xl shadow-2xl border-2 border-emerald-500/30 flex flex-col overflow-hidden animate-slide-up max-h-[580px]">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-900 text-white px-4 py-3.5 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <PhoneCall className="w-4 h-4 text-emerald-200" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white leading-tight">Quick Call Center</h3>
                <p className="text-[10px] text-emerald-200 font-medium">1-Click Dial &amp; Call Logger</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <div className="flex bg-white/10 rounded-lg p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('dial')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === 'dial' ? 'bg-white text-emerald-900 shadow-xs' : 'text-white/80 hover:text-white'}`}
                >
                  Dialer
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${activeTab === 'history' ? 'bg-white text-emerald-900 shadow-xs' : 'text-white/80 hover:text-white'}`}
                >
                  History
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer ml-1"
                title="Minimize"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {activeTab === 'dial' ? (
            <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
              {/* Search Customer or Staff */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customer name or mobile..."
                  className="input-modern pl-8 pr-3 py-2 text-xs w-full font-medium"
                />
                {searching && (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" />
                )}

                {/* Search Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-emerald-200 z-20 max-h-48 overflow-y-auto divide-y divide-gray-100">
                    {searchResults.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectContact(item)}
                        className="w-full text-left p-2.5 hover:bg-emerald-50 transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <span className="font-extrabold text-primary text-xs block group-hover:text-emerald-700">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-primary/60 font-mono">
                            {item.phone} {item.subtext ? `• ${item.subtext}` : ''}
                          </span>
                        </div>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Select
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dial Form */}
              <form onSubmit={handleSaveCallLog} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-primary/70 uppercase block mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      className="input-modern py-1.5 px-2.5 text-xs w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-primary/70 uppercase block mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="10-digit mobile"
                      required
                      className="input-modern py-1.5 px-2.5 text-xs w-full font-mono font-bold"
                    />
                  </div>
                </div>

                {/* 1-Click Dial Link */}
                {phoneNumber.trim() && (
                  <div className="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PhoneOutgoing className="w-4 h-4 text-emerald-600 animate-bounce" />
                      <div>
                        <span className="text-[10px] text-emerald-800 font-bold block">Ready to Connect</span>
                        <span className="text-xs font-mono font-extrabold text-emerald-950">{phoneNumber}</span>
                      </div>
                    </div>
                    <a
                      href={`tel:${phoneNumber.replace(/[^0-9+]/g, '')}`}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-transform hover:scale-105"
                      title="Launch Call Application"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Dial Now</span>
                    </a>
                  </div>
                )}

                {/* Call Outcome */}
                <div>
                  <label className="text-[10px] font-bold text-primary/70 uppercase block mb-1">
                    Call Outcome
                  </label>
                  <select
                    value={callOutcome}
                    onChange={(e) => setCallOutcome(e.target.value)}
                    className="select-modern py-1.5 text-xs w-full font-bold"
                  >
                    <option value="Connected">Connected - Discussed</option>
                    <option value="Callback Requested">Callback Requested</option>
                    <option value="Interested - Visiting Soon">Interested - Visiting Soon</option>
                    <option value="Shopping Completed">Shopping Completed</option>
                    <option value="Ringing / No Answer">Ringing / No Answer</option>
                    <option value="Busy / Line Engaged">Busy / Line Engaged</option>
                    <option value="Switched Off / Not Reachable">Switched Off / Not Reachable</option>
                    <option value="Not Interested">Not Interested</option>
                  </select>
                </div>

                {/* Remarks & Notes */}
                <div>
                  <label className="text-[10px] font-bold text-primary/70 uppercase block mb-1">
                    Conversation Notes / Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Customer preference, budget, saree style, wedding date..."
                    className="w-full p-2 rounded-xl border border-accent-soft bg-card text-xs text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Next Follow-up Date */}
                <div>
                  <label className="text-[10px] font-bold text-primary/70 uppercase block mb-1">
                    Next Follow-up Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="input-modern py-1.5 px-2.5 text-xs w-full"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={savingLog || !phoneNumber.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {savingLog ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Call Record…</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Call Log</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* History Tab */
            <div className="p-3 space-y-2 overflow-y-auto flex-1 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                <span className="text-[10px] font-extrabold text-primary uppercase">Recent Call Logs</span>
                <button
                  type="button"
                  onClick={loadRecentCalls}
                  disabled={loadingLogs}
                  className="text-[10px] text-emerald-700 font-bold hover:underline flex items-center gap-1"
                >
                  <RotateCcw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {loadingLogs ? (
                <div className="py-12 text-center text-primary/60">
                  <RotateCcw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                  <p className="text-xs font-semibold">Loading calls...</p>
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="py-12 text-center text-primary/60">
                  <Phone className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold">No recent call records</p>
                </div>
              ) : (
                recentLogs.map((log: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1 hover:border-emerald-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-primary text-xs">
                        {log.customer_name || 'Customer'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800">
                        {log.call_outcome || 'Completed'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-primary/70 font-mono">
                      <span>📱 {log.customer_mobile || log.mobile_number || '—'}</span>
                      <span>📅 {log.call_date} {log.call_time}</span>
                    </div>

                    {log.remarks && (
                      <p className="text-[10px] text-primary/80 italic line-clamp-1 border-t border-emerald-100/60 pt-0.5">
                        "{log.remarks}"
                      </p>
                    )}

                    <div className="pt-1 flex items-center justify-end">
                      <a
                        href={`tel:${String(log.customer_mobile || log.mobile_number || '').replace(/[^0-9+]/g, '')}`}
                        className="text-[10px] text-emerald-700 font-extrabold hover:underline flex items-center gap-1"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>Redial</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
