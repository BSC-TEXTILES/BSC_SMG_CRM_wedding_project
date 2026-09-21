import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { API, Auth, UserSession } from '../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../utils/sidebarState';
import { 
  Users, CircleCheck, CircleAlert, Building2, TrendingUp, Sparkles, PhoneCall,
  Search, Bell, Plus, Calendar, MapPin, ChevronDown, Check, Activity, Target,
  X, Filter, FileText, Settings, Heart, Star, RefreshCw, Menu
} from 'lucide-react';

export default function MainCrmDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Mock CRM data matching the user's uploaded 3rd screenshot exactly
  const mockCustomers = [
    {
      id: 'REG-2024-DVG-089',
      isVip: true,
      brideGroom: 'Lakshmi Venkatesh & Dr. Ashwin',
      family: 'Father: Venkatesh Murthy (Industrialist)',
      mobile: '+91 98450 22104',
      location: 'Davanagere Urban',
      muhurthamDate: '18 Nov 2024',
      muhurthamTime: 'Muhurtham 07:45 AM',
      collection: 'Pure Kanjeevaram (Real Gold Zari)',
      budget: '₹8,50,000',
      stylist: 'Padma Raghavan',
      stylistInitials: 'PR',
      stylistColor: 'bg-amber-100 text-amber-800'
    },
    {
      id: 'REG-2024-BLG-142',
      isVip: false,
      brideGroom: 'Pooja Belagavi & Rohan Patil',
      family: 'Uncle: M. R. Patil (Patil Agro Ltd.)',
      mobile: '+91 94481 77309',
      location: 'Belagum Tilakwadi',
      muhurthamDate: '02 Dec 2024',
      muhurthamTime: 'Muhurtham 10:15 AM',
      collection: 'Heritage Paithani & Banarasi',
      budget: '₹4,20,000',
      stylist: 'Ramesh Katti',
      stylistInitials: 'RK',
      stylistColor: 'bg-slate-800 text-white'
    },
    {
      id: 'REG-2024-SHV-057',
      isVip: false,
      brideGroom: 'Ananya Hegde & Vinay Rao',
      family: 'Arecanut Planters Family',
      mobile: '+91 97312 44580',
      location: 'Thirthahalli Route',
      muhurthamDate: '28 Nov 2024',
      muhurthamTime: 'Evening Reception',
      collection: 'Mysore Crepe Silk & Custom Pallu',
      budget: '₹2,80,000',
      stylist: 'Shweta Joshi',
      stylistInitials: 'SJ',
      stylistColor: 'bg-rose-100 text-rose-800'
    },
    {
      id: 'REG-2024-DVG-095',
      isVip: true,
      isAlert: true,
      brideGroom: 'Dr. Keerthi Rao & Karthik Somanna',
      family: 'JJMMC Hospital Faculty',
      mobile: '+91 98801 11294',
      location: 'Davanagere MCC B-Block',
      muhurthamDate: '14 Nov 2024',
      muhurthamTime: '16 Days Remaining',
      collection: 'Custom Zari Weave & Velvets',
      budget: '₹5,75,000',
      stylist: 'Anand Deshpande',
      stylistInitials: 'AD',
      stylistColor: 'bg-amber-500 text-white'
    },
    {
      id: 'REG-2024-BLG-189',
      isVip: true,
      brideGroom: 'Sahana Kulkarni & Varun Deshmukh',
      family: 'Kulkarni Sugar Mills Group',
      mobile: '+91 99002 88471',
      location: 'Belagum Camp',
      muhurthamDate: '12 Jan 2025',
      muhurthamTime: 'Muhurtham 09:00 AM',
      collection: 'Royal Kanjeevaram (Triple Border)',
      budget: '₹7,10,000',
      stylist: 'Padma Raghavan',
      stylistInitials: 'PR',
      stylistColor: 'bg-amber-100 text-amber-800'
    },
    {
      id: 'REG-2024-DVG-102',
      isVip: false,
      brideGroom: 'Megha Channagiri & Chethan Gowda',
      family: 'Channagiri Agro Exports',
      mobile: '+91 90115 00392',
      location: 'Davanagere Hadadi Road',
      muhurthamDate: '19 Dec 2024',
      muhurthamTime: 'Muhurtham 11:30 AM',
      collection: 'Pure Tissue & Dharmavaram',
      budget: '₹3,40,000',
      stylist: 'Shweta Joshi',
      stylistInitials: 'SJ',
      stylistColor: 'bg-rose-100 text-rose-800'
    }
  ];

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
  }, [navigate]);

  return (
    <div className="flex h-screen bg-[#F6F4EF] font-sans">
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* Custom Top Header matches the mockup */}
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
               <button className="px-3 py-1.5 bg-[#C9A45C]/20 text-[#07101F] rounded-lg shadow-2xs font-extrabold">Davanagere</button>
               <button className="px-3 py-1.5 hover:bg-white rounded-md transition-colors cursor-pointer">Belagum</button>
               <button className="px-3 py-1.5 hover:bg-white rounded-md transition-colors cursor-pointer">Shivamogga</button>
             </div>
             <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#687080]" />
                <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold w-64 focus:ring-1 focus:ring-[#C9A45C] focus:border-[#C9A45C] focus:outline-none text-[#182033]" />
              </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-xs font-bold text-[#687080] bg-[#F6F4EF] px-4 py-2 rounded-xl border border-[#DFDDD7]">
               <Calendar className="w-3.5 h-3.5 text-[#C9A45C]" /> 14 Oct 2024 | 11:42 AM IST
             </div>
             <button className="px-4 py-2 bg-[#101C36] text-white rounded-xl text-xs font-bold shadow-sm hover:bg-[#07101F] transition-colors flex items-center gap-1.5 cursor-pointer">
               <Plus className="w-3.5 h-3.5 text-[#C9A45C]" /> New Record
             </button>
             <button className="p-2 relative text-[#687080] hover:bg-[#F6F4EF] rounded-full transition-colors cursor-pointer">
               <Bell className="w-5 h-5" />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#C7374A] rounded-full border border-white"></span>
             </button>
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-full bg-[#101C36] text-white flex items-center justify-center font-bold text-sm border border-[#C9A45C]/30">
                 {session?.fullName?.charAt(0) || 'S'}
               </div>
               <div className="hidden md:block text-left leading-tight">
                 <div className="text-[11px] font-bold text-[#182033]">{session?.fullName || 'Suresh Patil'}</div>
                 <div className="text-[10px] text-[#687080] font-semibold">Davanagere Flagship</div>
               </div>
             </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 scroll-smooth bg-[#F6F4EF]">
          <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
            
            {/* Filter Bar */}
            <div className="bg-white p-3 border border-[#DFDDD7] rounded-xl flex items-center gap-4 shadow-sm">
               <div className="flex-1 grid grid-cols-4 gap-4">
                 <div>
                   <label className="block text-[9px] uppercase font-bold text-[#687080] mb-1">Showroom Location</label>
                   <button className="w-full text-left text-xs font-bold text-[#182033] border-b border-[#DFDDD7] pb-1 flex justify-between items-center cursor-pointer">
                     Davanagere Flags... <ChevronDown className="w-3.5 h-3.5 text-[#C9A45C]" />
                   </button>
                 </div>
                 <div>
                   <label className="block text-[9px] uppercase font-bold text-[#687080] mb-1">Muhurtham Date Window</label>
                   <button className="w-full text-left text-xs font-bold text-[#182033] border-b border-[#DFDDD7] pb-1 flex justify-between items-center cursor-pointer">
                     <Calendar className="w-3 h-3 text-[#C9A45C] mr-1 inline-block" /> Oct 2024 - Feb 2... <ChevronDown className="w-3.5 h-3.5 text-[#C9A45C]" />
                   </button>
                 </div>
                 <div>
                   <label className="block text-[9px] uppercase font-bold text-[#687080] mb-1">Trousseau Budget Tier</label>
                   <button className="w-full text-left text-xs font-bold text-[#182033] border-b border-[#DFDDD7] pb-1 flex justify-between items-center cursor-pointer">
                     All Value Tiers <ChevronDown className="w-3.5 h-3.5 text-[#C9A45C]" />
                   </button>
                 </div>
                 <div>
                   <label className="block text-[9px] uppercase font-bold text-[#687080] mb-1">Family Concierge / Draper</label>
                   <button className="w-full text-left text-xs font-bold text-[#182033] border-b border-[#DFDDD7] pb-1 flex justify-between items-center cursor-pointer">
                     All Stylists & Curat... <ChevronDown className="w-3.5 h-3.5 text-[#C9A45C]" />
                   </button>
                 </div>
               </div>
               <div className="flex flex-col gap-2 pl-4 border-l border-[#DFDDD7]">
                 <div>
                   <label className="block text-[9px] uppercase font-bold text-[#687080] mb-1">Stage Filter</label>
                   <button className="w-24 text-left text-xs font-bold text-[#182033] border-b border-[#DFDDD7] pb-1 flex justify-between items-center cursor-pointer">
                     All Follow <ChevronDown className="w-3.5 h-3.5 text-[#C9A45C]" />
                   </button>
                 </div>
               </div>
               <button className="p-2 bg-[#F6F4EF] text-[#687080] hover:bg-[#DFDDD7] rounded-lg transition-colors ml-2 cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {/* Search and Table Count */}
            <div className="flex justify-between items-center bg-white px-5 py-3 border border-[#DFDDD7] rounded-xl shadow-sm">
               <div className="flex items-center gap-2 w-96 relative">
                 <Search className="w-4 h-4 text-[#687080] absolute left-3" />
                 <input type="text" placeholder="Search by Bride/Groom Name, Family Mobile, Invitation Code..." className="w-full text-xs font-medium text-[#182033] pl-9 pr-4 py-2 border border-[#DFDDD7] rounded-xl focus:ring-1 focus:ring-[#C9A45C] focus:border-[#C9A45C] focus:outline-none" />
               </div>
               <div className="flex items-center gap-4">
                 <span className="text-[11px] font-bold text-[#687080]">Showing 6 of 214 high-value wedding parties</span>
                 <button className="text-[11px] font-bold text-[#182033] flex items-center gap-1.5 hover:text-[#C9A45C] transition-colors cursor-pointer"><FileText className="w-3.5 h-3.5 text-[#C9A45C]" /> Export CSV</button>
               </div>
            </div>

            {/* Main CRM Table */}
            <div className="bg-white rounded-xl shadow-sm border border-[#DFDDD7] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#101C36] text-white">
                    <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-wider">Registration ID</th>
                    <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-wider">Bride & Groom Family</th>
                    <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-wider">Contact Details</th>
                    <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-wider">Muhurtham Date</th>
                    <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-wider">Preferred Textile Collection</th>
                    <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-wider">Est. Budget</th>
                    <th className="py-3 px-5 text-[10px] font-bold uppercase tracking-wider">Dedicated Stylist</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFDDD7]">
                  {mockCustomers.map(c => (
                    <tr key={c.id} className="hover:bg-[#F6F4EF] cursor-pointer transition-colors" onClick={() => { setSelectedCustomer(c); setDetailModalOpen(true); }}>
                      <td className="py-4 px-5">
                        <div className="text-[11px] font-black text-[#182033] leading-tight flex items-start gap-1">
                          {c.isAlert && <CircleAlert className="w-3.5 h-3.5 text-[#C7374A] shrink-0" />}
                          {!c.isAlert && c.isVip && <Star className="w-3.5 h-3.5 text-[#C9A45C] shrink-0" />}
                          {!c.isAlert && !c.isVip && <div className="w-3.5 h-3.5 shrink-0" />}
                          {c.id.split('-').join('-\n')}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-xs font-extrabold text-[#182033]">{c.brideGroom}</div>
                        <div className="text-[10px] text-[#687080] font-semibold mt-0.5">{c.family}</div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-[11px] font-bold text-[#182033]">{c.mobile}</div>
                        <div className="text-[10px] text-[#687080] font-semibold mt-0.5">{c.location}</div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-[11px] font-bold text-[#182033] flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5 text-[#C9A45C]" /> {c.muhurthamDate}
                        </div>
                        <div className="text-[10px] text-[#687080] font-bold mt-0.5 ml-5">{c.muhurthamTime}</div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-[10px] font-bold text-[#101C36] bg-[#101C36]/5 border border-[#101C36]/15 px-2 py-1.5 rounded-md inline-block max-w-[130px] leading-tight">
                          {c.collection}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="text-xs font-black text-[#182033]">{c.budget}</div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${c.stylistColor}`}>
                            {c.stylistInitials}
                          </div>
                          <div className="text-[11px] font-bold text-[#182033]">{c.stylist}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 bg-white border-t border-[#DFDDD7] flex justify-between items-center text-[10px] font-bold text-[#687080]">
                 <span>Rows per page: 10 • Showing Page 1 of 22</span>
                 <div className="flex gap-1">
                   <button className="px-2 py-1 hover:bg-[#F6F4EF] rounded cursor-pointer">&lt;</button>
                   <button className="px-2 py-1 bg-[#101C36] text-white rounded cursor-pointer">1</button>
                   <button className="px-2 py-1 hover:bg-[#F6F4EF] rounded cursor-pointer">2</button>
                   <button className="px-2 py-1 hover:bg-[#F6F4EF] rounded cursor-pointer">3</button>
                   <span className="px-2 py-1">...</span>
                   <button className="px-2 py-1 hover:bg-[#F6F4EF] rounded cursor-pointer">22</button>
                   <button className="px-2 py-1 hover:bg-[#F6F4EF] rounded cursor-pointer">&gt;</button>
                 </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* VIP Tracker Modal exactly as depicted */}
      {detailModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07101F]/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[850px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#101C36] flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#C9A45C] rounded-xl flex items-center justify-center text-[#07101F] shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-widest text-[#E4CB92] uppercase">{selectedCustomer.id}</span>
                    <span className="bg-[#C9A45C] text-[#07101F] text-[9px] font-black px-1.5 py-0.5 rounded uppercase">VIP Confirmed</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-white">{selectedCustomer.brideGroom}</h2>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 bg-[#07101F] border border-[#C9A45C]/40 text-white px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-[#101C36] hover:border-[#C9A45C] transition-all cursor-pointer">
                  <FileText className="w-3.5 h-3.5 text-[#C9A45C]" /> Print Loom Slip
                </button>
                <button onClick={() => setDetailModalOpen(false)} className="p-2 text-white/70 hover:bg-white/10 hover:text-white rounded-full transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6 bg-[#F6F4EF] overflow-auto max-h-[85vh] space-y-6">
              
              {/* Summary Metrics */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-[#687080] mb-1">Showroom Flagship</div>
                  <div className="text-sm font-extrabold text-[#182033]">Davanagere Flagship</div>
                  <div className="text-[10px] font-semibold text-[#687080] mt-0.5">Curator: Padma Raghavan</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-[#687080] mb-1">Muhurtham & Lagna</div>
                  <div className="text-sm font-extrabold text-[#182033]">18 Nov 2024</div>
                  <div className="text-[10px] font-semibold text-[#687080] mt-0.5">Dhanu Lagnam (07:45 AM)</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-[#687080] mb-1">Total Trousseau Budget</div>
                  <div className="text-sm font-extrabold text-[#182033]">₹8,50,000</div>
                  <div className="text-[10px] font-semibold text-[#687080] mt-0.5">Advance: ₹3,00,000 Recvd</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-[#687080] mb-1">Active Saree Ensemble</div>
                  <div className="text-sm font-extrabold text-[#182033]">Pure Kanjeevaram</div>
                  <div className="text-[10px] font-semibold text-[#687080] mt-0.5">Real Gold Korvai Border</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                
                {/* Left Column: Zari Tracker & Spec */}
                <div className="col-span-2 space-y-6">
                  {/* Tracker Component */}
                  <div className="bg-white rounded-xl border border-[#DFDDD7] p-5 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                       <h3 className="text-sm font-extrabold text-[#182033] flex items-center gap-2">
                         <Target className="w-4 h-4 text-[#C9A45C]" /> Custom Zari Border Order Tracker
                       </h3>
                       <span className="bg-[#C9A45C]/20 text-[#07101F] text-[10px] font-black px-2 py-0.5 rounded border border-[#C9A45C]/30">Loom ID: KNC-L-412</span>
                    </div>

                    <div className="relative flex justify-between items-start pt-2">
                      <div className="absolute top-2 left-4 right-4 h-1 bg-[#F6F4EF] -z-10 rounded-full"></div>
                      <div className="absolute top-2 left-4 w-[60%] h-1 bg-[#16805B] -z-10 rounded-full"></div>
                      
                      <div className="flex flex-col items-center">
                        <div className="w-5 h-5 bg-[#16805B] rounded-full border-4 border-white mb-2 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>
                        <div className="text-[10px] font-bold text-[#182033]">Silk Dyeing</div>
                        <div className="text-[9px] text-[#687080]">Crimson Marigold</div>
                      </div>
                      
                      <div className="flex flex-col items-center">
                        <div className="w-5 h-5 bg-[#16805B] rounded-full border-4 border-white mb-2 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>
                        <div className="text-[10px] font-bold text-[#182033]">Zari Spooling</div>
                        <div className="text-[9px] text-[#687080]">Surat Gold Hallmarked</div>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="w-5 h-5 bg-[#C9A45C] rounded-full border-4 border-white mb-2 animate-pulse shadow-[0_0_0_2px_rgba(201,164,92,0.3)]"></div>
                        <div className="text-[10px] font-extrabold text-[#07101F]">Active Korvai Loom</div>
                        <div className="text-[9px] font-bold text-[#182033]">4.8 / 6.2 Metres</div>
                      </div>

                      <div className="flex flex-col items-center opacity-50">
                        <div className="w-5 h-5 bg-[#DFDDD7] rounded-full border-4 border-white mb-2"></div>
                        <div className="text-[10px] font-bold text-[#687080]">Bridal Finishing</div>
                        <div className="text-[9px] text-[#687080]">Fall, Pico, Tassels</div>
                      </div>

                      <div className="flex flex-col items-center opacity-50">
                        <div className="w-5 h-5 bg-[#DFDDD7] rounded-full border-4 border-white mb-2"></div>
                        <div className="text-[10px] font-bold text-[#687080]">Salon Dispatch</div>
                        <div className="text-[9px] text-[#687080]">Box Delivery</div>
                      </div>
                    </div>
                  </div>

                  {/* Spec Text */}
                  <div className="bg-white rounded-xl border border-[#DFDDD7] p-4 shadow-sm">
                     <div className="flex justify-between items-center mb-3 text-[10px] font-bold uppercase tracking-wide text-[#687080]">
                       <span>Master Artisan / Pit Loom Spec</span>
                       <span>Inspected By: M. Chinnaswamy</span>
                     </div>
                     <p className="text-xs text-[#182033] leading-relaxed mb-4 font-medium">
                       Weaving 6.2m pure silk Kanjeevaram bridal saree with double-sided Mayil (peacock) and Rudraksh gold motifs. Pallu includes personalized hand-embroidered monogram ("L & A - Nov 18") woven directly in Surat certified zari threads.
                     </p>
                     <div className="flex gap-4 border-t border-[#DFDDD7] pt-3 text-[10px] font-bold text-[#101C36]">
                       <span className="bg-[#F6F4EF] px-2 py-1 rounded border border-[#DFDDD7]">Warp: 3-Ply Mulberry Silk</span>
                       <span className="bg-[#F6F4EF] px-2 py-1 rounded border border-[#DFDDD7]">Zari Split: 0.6% Pure Gold / 57% Silver</span>
                       <span className="bg-[#F6F4EF] px-2 py-1 rounded border border-[#DFDDD7]">Target Cut Date: 28 Oct 2024</span>
                     </div>
                  </div>
                </div>

                
              </div>

              {/* Bottom Row */}
              <div className="grid grid-cols-2 gap-6">
                 
                 {/* Call Logs */}
                 <div className="bg-white rounded-xl border border-[#DFDDD7] shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-[#DFDDD7] flex justify-between items-center bg-[#F6F4EF]">
                      <h3 className="text-xs font-extrabold text-[#182033] flex items-center gap-2">
                        <PhoneCall className="w-3.5 h-3.5 text-[#C9A45C]" /> Consultation & Call Logs
                      </h3>
                      <button className="text-[10px] font-bold text-[#C9A45C] hover:underline flex items-center gap-1 cursor-pointer"><Plus className="w-3 h-3"/> Add Call Log</button>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="pb-3 border-b border-[#DFDDD7] last:border-0 last:pb-0">
                        <div className="flex justify-between items-start mb-1">
                          <div className="text-[11px] font-bold text-[#182033]">Padma Raghavan (In-Person Showroom Trial)</div>
                          <div className="text-[10px] text-[#687080] font-semibold">14 Oct 2024, 04:30 PM</div>
                        </div>
                        <p className="text-[10px] text-[#687080] leading-relaxed">Bride visited with mother and maternal aunt. Shortlisted 2 Kanjeevaram pieces and 1 Banarasi georgette. Confirmed blouse sleeve embroidery pattern.</p>
                      </div>
                      <div className="pb-3 border-b border-[#DFDDD7] last:border-0 last:pb-0">
                        <div className="flex justify-between items-start mb-1">
                          <div className="text-[11px] font-bold text-[#182033]">Phone Consultation (Outbound)</div>
                          <div className="text-[10px] text-[#687080] font-semibold">10 Oct 2024, 11:15 AM</div>
                        </div>
                        <p className="text-[10px] text-[#687080] leading-relaxed">Father approved advance payment of ₹3,00,000 via RTGS. Loom activation triggered.</p>
                      </div>
                    </div>
                 </div>

                 {/* Trousseau Breakdown */}
                 <div className="bg-white rounded-xl border border-[#DFDDD7] shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-[#DFDDD7] flex justify-between items-center bg-[#F6F4EF]">
                      <h3 className="text-xs font-extrabold text-[#182033] flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-[#C9A45C]" /> Trousseau Ensemble Breakdown
                      </h3>
                      <span className="text-[10px] font-bold text-[#101C36] bg-[#101C36]/5 px-2 py-0.5 rounded border border-[#101C36]/15">5 Ensembles Total</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-[#DFDDD7]">
                        <div className="flex items-center gap-2">
                          <CircleCheck className="w-3.5 h-3.5 text-[#16805B]" />
                          <div>
                            <div className="text-[11px] font-bold text-[#182033]">Muhurtham Bridal Saree (Lakshmi)</div>
                          </div>
                        </div>
                        <div className="text-xs font-black text-[#182033]">₹2,85,000</div>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-[#DFDDD7]">
                        <div className="flex items-center gap-2">
                          <CircleCheck className="w-3.5 h-3.5 text-[#16805B]" />
                          <div>
                            <div className="text-[11px] font-bold text-[#182033]">Reception Outfit (Bride)</div>
                            <div className="text-[9px] text-[#687080] font-medium">Handloom Banarasi Katan Silk with Meenakari</div>
                          </div>
                        </div>
                        <div className="text-xs font-black text-[#182033]">₹1,45,000</div>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-[#DFDDD7]">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-[#DFDDD7] rounded-full"></div>
                          <div>
                            <div className="text-[11px] font-bold text-[#182033]">Mother of Bride Special (Girija V.)</div>
                            <div className="text-[9px] text-[#687080] font-medium">Mysore Silk Crepe</div>
                          </div>
                        </div>
                        <div className="text-xs font-black text-[#182033]">₹75,000</div>
                      </div>
                    </div>
                 </div>

              </div>

            </div>
            
            {/* Modal Bottom Actions */}
            <div className="px-6 py-4 bg-white border-t border-[#DFDDD7] flex justify-between items-center">
              <div className="text-[10px] font-semibold text-[#687080] flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-[#16805B]" /> Last automated WhatsApp sync: Today, 09:15 AM
              </div>
              <div className="flex gap-3">
                 <button className="text-[10px] font-bold text-[#182033] hover:bg-[#F6F4EF] px-4 py-2 rounded-xl transition-colors border border-[#DFDDD7] cursor-pointer">Log Discussion</button>
                 <button className="text-[10px] font-bold text-[#C7374A] bg-[#C7374A]/10 hover:bg-[#C7374A]/15 px-4 py-2 rounded-xl transition-colors border border-[#C7374A]/20 cursor-pointer">Generate Bridal Estimate</button>
                 <button className="text-[10px] font-bold text-white bg-[#101C36] hover:bg-[#07101F] px-5 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer">
                   Send WhatsApp Muhurtham Wishes
                 </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
