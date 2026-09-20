import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import { isDateInRange } from '../utils/dateUtils';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import { 
  Phone, PhoneCall, Clock, Calendar, Users, Heart, CheckCircle, 
  MapPin, Edit3, Eye, Search, Filter, MessageCircle, X, Save,
  AlertCircle, PhoneOff, BookOpen, Star, RefreshCw, ChevronRight, User,
  Plus, Bell, ChevronDown, FileText, Sparkles, Target, Check, CheckCircle2, Activity, Menu
} from 'lucide-react';

interface WeddingCustomer {
  id: number;
  registrationId?: string;
  customerName: string;
  mobile: string;
  email?: string;
  locationId?: number;
  locationName?: string;
  weddingDate?: string;
  dateFlexibility?: string;
  functions?: string;
  shoppingCategory?: string;
  preferredShoppingDate?: string;
  preferredTime?: string;
  contactMethod?: string;
  status: string;
  callStatus?: string;
  totalCalls?: number;
  lastCallDate?: string;
  lastCallResult?: string;
  familySize?: string;
  visitStatus?: string;
  shoppingStatus?: string;
  nextFollowUp?: string;
  assignedTelecallerName?: string;
  assignedTelecallerId?: number;
  registrationDate?: string;
  remarks?: string;
}

export default function TelecallerDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    const unsub = subscribeSidebarCollapsed((c) => setCollapsed(c));
    return unsub;
  }, []);

  const [deskStats, setDeskStats] = useState<any>({});
  const [customers, setCustomers] = useState<WeddingCustomer[]>([]);
  const [filtered, setFiltered] = useState<WeddingCustomer[]>([]);
  
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'My Queue');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Date Range Filter
  const [activeRange, setActiveRange] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [detailCustomer, setDetailCustomer] = useState<WeddingCustomer | null>(null);
  const [logCallModalOpen, setLogCallModalOpen] = useState(false);
  
  // Call Log State
  const [callLogForm, setCallLogForm] = useState({
    callResult: 'Connected',
    nextFollowUpDate: '',
    nextFollowUpTime: '',
    customerResponse: '',
    remarks: '',
    newStatus: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [deskRes, custRes] = await Promise.all([
        API.getWeddingCallingDesk(),
        API.getWeddingCustomers({ limit: 5000 })
      ]);
      
      if (deskRes?.data) setDeskStats(deskRes.data);
      if (custRes?.customers) {
        const mapped = custRes.customers.map((c: any) => ({
          id: c.id,
          registrationId: c.customer_code,
          customerName: c.customer_name,
          mobile: c.mobile_number,
          email: c.email,
          locationId: c.location_id,
          locationName: c.location_name,
          weddingDate: c.wedding_date,
          dateFlexibility: c.date_flexibility,
          functions: c.functions,
          shoppingCategory: c.preferred_shopping_category,
          preferredShoppingDate: c.expected_shopping_date,
          preferredTime: c.preferred_call_time,
          contactMethod: c.contact_method,
          status: c.customer_status,
          callStatus: c.call_status,
          totalCalls: c.total_calls_count,
          lastCallDate: c.last_call_date,
          lastCallResult: c.last_call_outcome,
          familySize: c.estimated_family_size,
          nextFollowUp: c.follow_up_date,
          assignedTelecallerName: c.assigned_telecaller,
          assignedTelecallerId: c.assigned_telecaller_id,
          registrationDate: c.created_at,
          remarks: c.customer_notes,
        }));
        setCustomers(mapped);
      }
    } catch (err: any) {
      showToast('Error loading telecaller data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const currentSession = Auth.get();
    setSession(currentSession);
    loadData();
  }, [navigate, loadData]);

  useEffect(() => {
    let list = [...customers];

    if (session?.role !== 'Admin' && session?.role !== 'Super Admin') {
      list = list.filter(c => c.assignedTelecallerId === session?.id || c.assignedTelecallerName === session?.fullName);
    }

    if (activeRange !== 'all') {
      list = list.filter(c => {
        const d = c.nextFollowUp || c.registrationDate || new Date().toISOString();
        return isDateInRange(new Date(d), activeRange, fromDate, toDate);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        (c.customerName && String(c.customerName).toLowerCase().includes(q)) || 
        (c.mobile && String(c.mobile).toLowerCase().includes(q)) || 
        (c.registrationId && String(c.registrationId).toLowerCase().includes(q)) ||
        (c.locationName && String(c.locationName).toLowerCase().includes(q))
      );
    }
    
    setFiltered(list);
  }, [customers, activeTab, searchQuery, activeRange, fromDate, toDate, session]);

  const handleLogCall = async () => {
    if (!detailCustomer || saving) return;
    setSaving(true);
    try {
      const payload = {
        customerId: detailCustomer.id,
        callStatus: callLogForm.callResult,
        remarks: callLogForm.remarks,
        response: callLogForm.customerResponse,
        nextFollowUpDate: callLogForm.nextFollowUpDate,
        nextFollowUpTime: callLogForm.nextFollowUpTime,
        status: callLogForm.newStatus || detailCustomer.status
      };
      
      await API.logWeddingCall(payload);
      
      if (callLogForm.newStatus && callLogForm.newStatus !== detailCustomer.status) {
         await API.updateWeddingCustomer(detailCustomer.id, { status: callLogForm.newStatus });
      }
      
      showToast('Call logged successfully', 'success');
      setLogCallModalOpen(false);
      setCallLogForm({
        callResult: 'Connected',
        nextFollowUpDate: '',
        nextFollowUpTime: '',
        customerResponse: '',
        remarks: '',
        newStatus: ''
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error logging call', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F6F4EF] font-sans">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <header className="h-16 bg-white flex items-center justify-between px-6 shrink-0 border-b border-[#DFDDD7]">
          <div className="flex items-center gap-3">
             <button
               onClick={() => setSidebarOpen(true)}
               className="lg:hidden p-2 rounded-xl text-[#182033] hover:bg-[#F6F4EF] transition-colors cursor-pointer"
               title="Open Menu"
             >
               <Menu className="w-5 h-5" />
             </button>
             <div className="flex items-center gap-2 bg-[#F6F4EF] rounded-xl p-1 text-xs font-bold text-[#182033] border border-[#DFDDD7]">
               <button className="px-3 py-1.5 bg-[#C9A45C]/20 text-[#07101F] rounded-lg shadow-2xs font-extrabold">Telecaller Queue</button>
             </div>
             <div className="relative">
               <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#687080]" />
               <input 
                 type="text" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Search customers..." 
                 className="pl-9 pr-4 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold w-64 focus:ring-1 focus:ring-[#C9A45C] focus:border-[#C9A45C] focus:outline-none text-[#182033]" 
               />
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-xs font-bold text-[#687080] bg-[#F6F4EF] border border-[#DFDDD7] px-4 py-2 rounded-xl">
               <Calendar className="w-3.5 h-3.5 text-[#C9A45C]" /> {new Date().toLocaleDateString()}
             </div>
             <button onClick={() => loadData()} className="p-2 relative text-[#687080] hover:bg-[#F6F4EF] rounded-full transition-colors cursor-pointer">
               <RefreshCw className="w-5 h-5" />
             </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#101C36] text-white flex items-center justify-center font-bold text-sm border border-[#C9A45C]/30">
                  {String(session?.fullName || 'U').charAt(0)}
                </div>
                <div className="hidden md:block text-left leading-tight">
                  <div className="text-[11px] font-bold text-[#182033]">{session?.fullName || 'User'}</div>
                  <div className="text-[10px] text-[#687080] font-semibold">{session?.role}</div>
                </div>
              </div>
           </div>
         </header>

         <main className="flex-1 overflow-auto p-6 scroll-smooth bg-[#F6F4EF]">
          <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
            
            <div className="bg-white p-3 border border-[#DFDDD7] rounded-xl flex items-center gap-4 shadow-sm">
                <div className="flex-1 grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-[#687080] mb-1">Showroom Location</label>
                    <button className="w-full text-left text-xs font-bold text-[#182033] border-b border-[#DFDDD7] pb-1 flex justify-between items-center cursor-pointer">
                      All Locations <ChevronDown className="w-3.5 h-3.5 text-[#C9A45C]" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-[#687080] mb-1">Follow-up Window</label>
                    <button className="w-full text-left text-xs font-bold text-[#182033] border-b border-[#DFDDD7] pb-1 flex justify-between items-center cursor-pointer">
                      <Calendar className="w-3 h-3 text-[#C9A45C] mr-1 inline-block" /> All Upcoming <ChevronDown className="w-3.5 h-3.5 text-[#C9A45C]" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-[#687080] mb-1">Call Priority</label>
                    <button className="w-full text-left text-xs font-bold text-[#182033] border-b border-[#DFDDD7] pb-1 flex justify-between items-center cursor-pointer">
                      All Priorities <ChevronDown className="w-3.5 h-3.5 text-[#C9A45C]" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-[#687080] mb-1">Assigned Telecaller</label>
                    <button className="w-full text-left text-xs font-bold text-[#182033] border-b border-[#DFDDD7] pb-1 flex justify-between items-center cursor-pointer">
                      My Queue <ChevronDown className="w-3.5 h-3.5 text-[#C9A45C]" />
                    </button>
                  </div>
                </div>
            </div>

            <div className="flex justify-between items-center bg-white px-5 py-3 border border-[#DFDDD7] rounded-xl shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold text-[#182033]">
                  Showing {filtered.length} high-value wedding parties
                </div>
                <button className="flex items-center gap-1.5 text-[10px] font-bold text-[#687080] hover:bg-[#F6F4EF] hover:text-[#182033] px-3 py-1.5 rounded transition-colors cursor-pointer border border-[#DFDDD7]">
                  <FileText className="w-3.5 h-3.5 text-[#C9A45C]" /> Export CSV
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#DFDDD7] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#101C36] text-white text-[9px] font-black tracking-widest uppercase">
                    <th className="py-3 px-5 w-24">Registration ID</th>
                    <th className="py-3 px-5">Customer Family</th>
                    <th className="py-3 px-5">Contact Details</th>
                    <th className="py-3 px-5">Wedding Date</th>
                    <th className="py-3 px-5">Preferred Collection</th>
                    <th className="py-3 px-5">Call Activity</th>
                    <th className="py-3 px-5">Dedicated Telecaller</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFDDD7]">
                  {loading ? (
                    <tr><td colSpan={7} className="py-12 text-center text-[#687080]"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#101C36]" />Loading Queue...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-[#687080] font-bold">No customers found in this queue.</td></tr>
                  ) : (
                    filtered.map(c => (
                      <tr key={c.id} className="hover:bg-[#F6F4EF] transition-colors group">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[9px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#F6F4EF] text-[#182033] border border-[#DFDDD7]`}>
                              {c.registrationId || (c.id ? String(c.id) : '')}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="text-sm font-extrabold text-[#182033] group-hover:text-[#C9A45C] transition-colors cursor-pointer" onClick={() => setDetailCustomer(c)}>
                            {c.customerName}
                          </div>
                          <div className="text-[10px] text-[#687080] font-semibold mt-0.5">{c.familySize ? c.familySize + ' members' : 'Family Details N/A'}</div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="text-[11px] font-bold text-[#182033]">{c.mobile}</div>
                          <div className="text-[10px] text-[#687080] font-semibold mt-0.5">{c.locationName || 'N/A'}</div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="text-[11px] font-bold text-[#182033] flex items-center gap-1.5">
                            <Heart className="w-3.5 h-3.5 text-[#C9A45C]" /> {(c.weddingDate ? new Date(c.weddingDate).toLocaleDateString() : 'TBD')}
                          </div>
                          <div className="text-[10px] text-[#687080] font-bold mt-0.5 ml-5">{c.preferredTime || 'Anytime'}</div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="text-[10px] font-bold text-[#101C36] bg-[#101C36]/5 border border-[#101C36]/15 px-2 py-1.5 rounded-md inline-block max-w-[130px] leading-tight">
                            {c.shoppingCategory || 'Unspecified'}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="text-xs font-black text-[#182033]">{c.totalCalls || 0} Calls</div>
                          <div className="text-[10px] font-medium text-[#687080] mt-0.5">{c.callStatus || 'Pending'}</div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold bg-[#C9A45C]/20 text-[#07101F]`}>
                              {String(c.assignedTelecallerName || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="text-[11px] font-bold text-[#182033]">{c.assignedTelecallerName || 'Unassigned'}</div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {detailCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07101F]/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[850px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 bg-[#101C36] flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#C9A45C] rounded-xl flex items-center justify-center text-[#07101F] shadow-sm">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-widest text-[#E4CB92] uppercase">{detailCustomer.registrationId || detailCustomer.id}</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-white">{detailCustomer.customerName}</h2>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setLogCallModalOpen(true)} className="flex items-center gap-2 bg-[#07101F] border border-[#C9A45C]/40 text-white px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-[#101C36] hover:border-[#C9A45C] transition-all cursor-pointer">
                  <Plus className="w-3.5 h-3.5 text-[#C9A45C]" /> Log Interaction
                </button>
                <button onClick={() => setDetailCustomer(null)} className="p-2 text-white/70 hover:bg-white/10 hover:text-white rounded-full transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6 bg-[#F6F4EF] overflow-auto max-h-[85vh] space-y-6">
              
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-[#687080] mb-1">Customer Location</div>
                  <div className="text-sm font-extrabold text-[#182033]">{detailCustomer.locationName || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-[#687080] mb-1">Wedding Date</div>
                  <div className="text-sm font-extrabold text-[#182033]">{detailCustomer.weddingDate ? new Date(detailCustomer.weddingDate).toLocaleDateString() : 'TBD'}</div>
                  <div className="text-[10px] font-semibold text-[#687080] mt-0.5">{detailCustomer.preferredTime || 'Anytime'}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-[#687080] mb-1">Total Calls</div>
                  <div className="text-sm font-extrabold text-[#182033]">{detailCustomer.totalCalls || 0}</div>
                  <div className="text-[10px] font-semibold text-[#687080] mt-0.5">Status: {detailCustomer.callStatus || 'Pending'}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-[#687080] mb-1">Preferred Ensemble</div>
                  <div className="text-sm font-extrabold text-[#182033]">{detailCustomer.shoppingCategory || 'Unspecified'}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                
                <div className="col-span-2 space-y-6">
                  <div className="bg-white rounded-xl border border-[#DFDDD7] p-5 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                       <h3 className="text-sm font-extrabold text-[#182033] flex items-center gap-2">
                         <User className="w-4 h-4 text-[#C9A45C]" /> Complete Customer Profile
                       </h3>
                       <span className="bg-[#F6F4EF] text-[#687080] text-[10px] font-black px-2 py-0.5 rounded border border-[#DFDDD7]">Registered: {detailCustomer.registrationDate ? new Date(detailCustomer.registrationDate).toLocaleDateString() : 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] font-bold text-[#687080] uppercase mb-1">Mobile Number</div>
                        <div className="text-sm font-bold text-[#182033]">{detailCustomer.mobile}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-[#687080] uppercase mb-1">Email Address</div>
                        <div className="text-sm font-bold text-[#182033]">{detailCustomer.email || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-[#687080] uppercase mb-1">Family Size</div>
                        <div className="text-sm font-bold text-[#182033]">{detailCustomer.familySize || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-[#687080] uppercase mb-1">Preferred Shopping Date</div>
                        <div className="text-sm font-bold text-[#182033]">{detailCustomer.preferredShoppingDate ? new Date(detailCustomer.preferredShoppingDate).toLocaleDateString() : 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-[#DFDDD7] p-4 shadow-sm">
                     <div className="flex justify-between items-center mb-3 text-[10px] font-bold uppercase tracking-wide text-[#687080]">
                       <span>Wedding Requirements & Remarks</span>
                     </div>
                     <p className="text-xs text-[#182033] leading-relaxed mb-4 font-medium">
                       {detailCustomer.remarks || 'No specific remarks or requirements provided.'}
                     </p>
                     <div className="flex gap-4 border-t border-[#DFDDD7] pt-3 text-[10px] font-bold text-[#101C36]">
                       <span className="bg-[#F6F4EF] px-2 py-1 rounded border border-[#DFDDD7]">Status: {detailCustomer.status}</span>
                       <span className="bg-[#F6F4EF] px-2 py-1 rounded border border-[#DFDDD7]">Functions: {detailCustomer.functions || 'N/A'}</span>
                     </div>
                  </div>
                </div>

                <div className="col-span-1 space-y-4">
                   <div className="bg-white rounded-xl border border-[#DFDDD7] p-4 shadow-sm h-full flex flex-col">
                     <div className="flex justify-between items-center mb-3">
                       <h3 className="text-xs font-extrabold text-[#182033] uppercase tracking-wide">Call History</h3>
                     </div>
                     <div className="space-y-3 mb-4 flex-1">
                        <div className="flex justify-between border-b border-[#DFDDD7] pb-2">
                          <span className="text-[10px] font-bold text-[#687080]">Assigned To</span>
                          <span className="text-xs font-bold text-[#182033]">{detailCustomer.assignedTelecallerName || 'Unassigned'}</span>
                        </div>
                        <div className="flex justify-between border-b border-[#DFDDD7] pb-2">
                          <span className="text-[10px] font-bold text-[#687080]">Last Call</span>
                          <span className="text-xs font-bold text-[#182033]">{detailCustomer.lastCallDate ? new Date(detailCustomer.lastCallDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-[#DFDDD7] pb-2">
                          <span className="text-[10px] font-bold text-[#687080]">Last Result</span>
                          <span className="text-xs font-bold text-[#182033]">{detailCustomer.lastCallResult || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[10px] font-bold text-[#687080]">Next Follow-up</span>
                          <span className="text-xs font-bold text-[#C7374A]">{detailCustomer.nextFollowUp ? new Date(detailCustomer.nextFollowUp).toLocaleDateString() : 'None'}</span>
                        </div>
                     </div>
                     <button onClick={() => setLogCallModalOpen(true)} className="w-full py-3 bg-[#101C36] rounded-xl text-xs font-bold text-white hover:bg-[#07101F] transition-colors flex justify-center items-center gap-2 cursor-pointer shadow-sm">
                       <Plus className="w-4 h-4 text-[#C9A45C]" /> Add Call Log
                     </button>
                   </div>
                </div>
              </div>

            </div>
            
          </div>
        </div>
      )}

      {logCallModalOpen && detailCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-accent" /> Log Call & Follow-up
              </h2>
              <button onClick={() => setLogCallModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-5 bg-white">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm font-medium text-blue-900">
                <User className="w-5 h-5 text-blue-500" /> Calling: {detailCustomer.customerName} ({detailCustomer.mobile})
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Call Result <span className="text-rose-500">*</span></label>
                <select 
                  value={callLogForm.callResult} 
                  onChange={e => setCallLogForm({...callLogForm, callResult: e.target.value})}
                  className="w-full text-sm border-slate-300 rounded-xl shadow-sm focus:ring-accent focus:border-accent py-2.5 px-3 border"
                >
                  <option value="Connected">Connected</option>
                  <option value="No Answer">No Answer</option>
                  <option value="Busy">Busy</option>
                  <option value="Call Back Requested">Call Back Requested</option>
                  <option value="Not Reachable">Not Reachable</option>
                  <option value="Number Invalid">Number Invalid</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Next Follow-up Date</label>
                  <input 
                    type="date" 
                    value={callLogForm.nextFollowUpDate}
                    onChange={e => setCallLogForm({...callLogForm, nextFollowUpDate: e.target.value})}
                    className="w-full text-sm border-slate-300 rounded-xl shadow-sm py-2.5 px-3 border"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Next Follow-up Time</label>
                  <input 
                    type="time" 
                    value={callLogForm.nextFollowUpTime}
                    onChange={e => setCallLogForm({...callLogForm, nextFollowUpTime: e.target.value})}
                    className="w-full text-sm border-slate-300 rounded-xl shadow-sm py-2.5 px-3 border"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Customer Feedback / Remarks <span className="text-rose-500">*</span></label>
                <textarea 
                  rows={3}
                  value={callLogForm.remarks}
                  onChange={e => setCallLogForm({...callLogForm, remarks: e.target.value})}
                  placeholder="Enter detailed notes from the conversation..."
                  className="w-full text-sm border-slate-300 rounded-xl shadow-sm py-2.5 px-3 border resize-none"
                ></textarea>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Update Customer Status (Optional)</label>
                <select 
                  value={callLogForm.newStatus} 
                  onChange={e => setCallLogForm({...callLogForm, newStatus: e.target.value})}
                  className="w-full text-sm border-slate-300 rounded-xl shadow-sm focus:ring-accent focus:border-accent py-2.5 px-3 border"
                >
                  <option value="">-- Keep Current Status ({detailCustomer.status}) --</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Visit Planned">Visit Planned</option>
                  <option value="Shopping Confirmed">Shopping Confirmed</option>
                  <option value="Completed">Completed</option>
                  <option value="Not Interested">Not Interested</option>
                </select>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setLogCallModalOpen(false)}
                className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                onClick={handleLogCall}
                disabled={saving || !callLogForm.remarks}
                className="px-5 py-2.5 text-sm font-bold text-white bg-accent hover:bg-accent/90 rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Call Log'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
