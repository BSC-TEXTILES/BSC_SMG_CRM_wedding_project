import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import WeddingNav from './WeddingNav';
import { WeddingCustomer, getStatusBadge } from './weddingTypes';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Clock,
  User,
  PhoneCall,
  Eye,
  RefreshCw,
  Sparkles,
  CalendarDays
} from 'lucide-react';

export default function WeddingFollowUpCalendar() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');

  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Filters
  const [locationFilter, setLocationFilter] = useState<number | ''>('');
  const [locations, setLocations] = useState<any[]>([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      const [calRes, locsRes] = await Promise.all([
        API.getWeddingCalendar({
          month: monthStr,
          location_id: locationFilter !== '' ? locationFilter : undefined
        }),
        API.getLocations().catch(() => ({ locations: [] }))
      ]);

      if (locsRes?.locations) setLocations(locsRes.locations);

      const days = Array.isArray(calRes?.calendarDays)
        ? calRes.calendarDays
        : Array.isArray(calRes?.days)
        ? calRes.days
        : [];

      setCalendarEvents(days);

      // Default select today
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayEvts = days.find((d: any) => d.date === todayStr);
      if (todayEvts && Array.isArray(todayEvts.customers)) {
        setSelectedDateStr(todayStr);
        setSelectedDayEvents(todayEvts.customers);
      }
    } catch (err: any) {
      showToast('Error loading follow-up calendar: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [year, month, locationFilter]);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
    if (sess?.locationId && !sess.isGlobalAdmin) {
      setLocationFilter(sess.locationId);
    }
    loadCalendar();
  }, [loadCalendar, navigate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Generate days in month
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  const getDayData = (dayNumber: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    return calendarEvents.find((d: any) => d.date === dateStr);
  };

  return (
    <div className="min-h-screen bg-[#F6F4EF] flex text-[#182033]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'
        }`}
      >
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Follow-up Calendar"
            actions={
              <div className="flex items-center gap-2">
                {session?.isGlobalAdmin && (
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value ? Number(e.target.value) : '')}
                    className="px-3 py-2 bg-white border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033]"
                  >
                    <option value="">🌐 All Locations</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        📍 {loc.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex items-center bg-white rounded-xl border border-[#DFDDD7] p-1 text-xs font-bold">
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      viewMode === 'month' ? 'bg-[#101C36] text-[#C9A45C]' : 'text-muted'
                    }`}
                  >
                    Month View
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      viewMode === 'list' ? 'bg-[#101C36] text-[#C9A45C]' : 'text-muted'
                    }`}
                  >
                    List View
                  </button>
                </div>
              </div>
            }
          />

          {/* Calendar Header Navigator */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#DFDDD7] shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#101C36] text-[#C9A45C] flex items-center justify-center font-black">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#182033]">
                  {monthNames[month]} {year}
                </h2>
                <div className="text-xs text-muted font-semibold">
                  Follow-up Calls & Expected Shopping Appointments
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-[#F6F4EF] hover:bg-[#DFDDD7] text-primary transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 rounded-xl bg-[#F6F4EF] hover:bg-[#DFDDD7] text-xs font-bold text-primary transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-[#F6F4EF] hover:bg-[#DFDDD7] text-primary transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Grid: Calendar on Left, Selected Day Details on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar Grid (2 Cols) */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-[#DFDDD7] shadow-xs p-5 space-y-4">
              {/* Day of Week Labels */}
              <div className="grid grid-cols-7 gap-1 text-center font-black text-[11px] uppercase tracking-wider text-muted border-b border-[#DFDDD7] pb-2">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Day Grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {blanks.map((b) => (
                  <div key={`blank-${b}`} className="min-h-[70px] sm:min-h-[85px] bg-[#F6F4EF]/30 rounded-xl" />
                ))}

                {daysArray.map((dayNum) => {
                  const dayData = getDayData(dayNum);
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isSelected = selectedDateStr === dateStr;
                  const isToday = new Date().toISOString().slice(0, 10) === dateStr;
                  const count = dayData?.count || (Array.isArray(dayData?.customers) ? dayData.customers.length : 0);

                  return (
                    <div
                      key={dayNum}
                      onClick={() => {
                        setSelectedDateStr(dateStr);
                        setSelectedDayEvents(dayData?.customers || []);
                      }}
                      className={`min-h-[70px] sm:min-h-[85px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#C9A45C] bg-[#101C36] text-white shadow-md'
                          : isToday
                          ? 'border-blue-400 bg-blue-50/50'
                          : 'border-[#DFDDD7] bg-[#F6F4EF]/50 hover:bg-white hover:border-[#C9A45C]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black ${isSelected ? 'text-[#C9A45C]' : isToday ? 'text-blue-700' : 'text-[#182033]'}`}>
                          {dayNum}
                        </span>
                        {isToday && (
                          <span className="text-[8px] bg-blue-600 text-white px-1 py-0.2 rounded-full font-black uppercase">
                            Today
                          </span>
                        )}
                      </div>

                      {count > 0 && (
                        <div className="mt-1">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-lg text-[9px] font-black ${
                              isSelected
                                ? 'bg-[#C9A45C] text-[#101C36]'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {count} call{count > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Customers Detail Panel (1 Col) */}
            <div className="bg-white rounded-3xl border border-[#DFDDD7] shadow-xs p-5 space-y-4">
              <div className="border-b border-[#DFDDD7] pb-3">
                <h3 className="text-sm font-black text-[#182033] uppercase tracking-wider">
                  Follow-ups for {selectedDateStr ? new Date(selectedDateStr).toLocaleDateString() : 'Selected Day'}
                </h3>
                <div className="text-xs text-muted">
                  {selectedDayEvents.length} scheduled customer calls
                </div>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-12 text-muted text-xs">
                  <CalendarIcon className="w-8 h-8 text-muted mx-auto mb-2" />
                  <div className="font-bold text-sm text-[#182033]">No follow-ups for this date</div>
                  <div className="text-xs text-muted mt-0.5">Select another date on the calendar to view scheduled follow-ups.</div>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {selectedDayEvents.map((cust: any) => {
                    const badge = getStatusBadge(cust.customer_status);
                    return (
                      <div
                        key={cust.id}
                        className="p-3.5 rounded-2xl bg-[#F6F4EF] border border-[#DFDDD7] hover:border-[#C9A45C] text-xs space-y-2 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/wedding-crm/customers/${cust.id}`}
                            className="font-black text-primary hover:text-[#C98218] hover:underline"
                          >
                            {cust.customer_name}
                          </Link>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${badge.bg}`}>
                            {cust.customer_status}
                          </span>
                        </div>

                        <div className="text-muted space-y-1 text-[11px]">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span>📱 {cust.mobile_number}</span>
                            <span>·</span>
                            <span>📍 {cust.location_name || 'Store'}</span>
                          </div>
                          <div className="text-primary font-bold">
                            Assigned: {cust.assigned_telecaller || 'Unassigned'}
                          </div>
                          {cust.preferred_call_time && (
                            <div className="text-amber-800 font-bold">
                              Window: {cust.preferred_call_time}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#DFDDD7]">
                          <a
                            href={`https://wa.me/91${cust.mobile_number?.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(cust.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive!`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-green-700 hover:underline"
                          >
                            WhatsApp
                          </a>

                          <Link
                            to={`/wedding-crm/customers/${cust.id}`}
                            className="px-2.5 py-1 bg-[#101C36] text-[#C9A45C] rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> View Record
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
