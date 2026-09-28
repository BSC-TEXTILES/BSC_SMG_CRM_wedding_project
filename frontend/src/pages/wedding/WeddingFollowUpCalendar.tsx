import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import WeddingNav from './WeddingNav';
import { getStatusBadge } from './weddingTypes';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye, CalendarDays } from 'lucide-react';

export default function WeddingFollowUpCalendar() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());

  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');

  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Filters - initialized from persistent selection
  const [locationFilter, setLocationFilter] = useState<number | ''>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    return saved && saved !== 'ALL' ? Number(saved) : '';
  });

  // Listen to global location changes (e.g. from Topbar)
  useEffect(() => {
    const handleLocationChange = (e: any) => {
      const newLoc = e?.detail?.locationId;
      const parsed = newLoc && newLoc !== 'ALL' ? Number(newLoc) : '';
      setLocationFilter(parsed);
    };
    window.addEventListener('bsc_location_changed', handleLocationChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocationChange);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      const calRes = await API.getWeddingCalendar({
        month: monthStr,
        location_id: locationFilter !== '' ? locationFilter : undefined
      });

      const rawDays = Array.isArray(calRes?.calendarDays)
        ? calRes.calendarDays
        : Array.isArray(calRes?.days)
        ? calRes.days
        : [];

      const allCusts = Array.isArray(calRes?.customers) ? calRes.customers : [];
      const custMap: Record<string, any[]> = {};
      allCusts.forEach((c: any) => {
        const d = c.follow_up_date ? String(c.follow_up_date).slice(0, 10) : null;
        if (d) {
          if (!custMap[d]) custMap[d] = [];
          custMap[d].push(c);
        }
      });

      const days = rawDays.map((d: any) => {
        const dStr = d.date ? String(d.date).slice(0, 10) : '';
        const dayCusts = d.customers && d.customers.length > 0 ? d.customers : (custMap[dStr] || []);
        return {
          ...d,
          date: dStr,
          count: Number(d.count || d.total || dayCusts.length || 0),
          customers: dayCusts
        };
      });

      setCalendarEvents(days);

      // Default select today or keep selected date
      const todayStr = new Date().toISOString().slice(0, 10);
      const activeDate = selectedDateStr || todayStr;
      const targetDay = days.find((d: any) => d.date === activeDate);
      if (targetDay) {
        setSelectedDateStr(activeDate);
        setSelectedDayEvents(targetDay.customers || []);
      } else if (days.length > 0) {
        setSelectedDateStr(days[0].date);
        setSelectedDayEvents(days[0].customers || []);
      }
    } catch (err: any) {
      showToast('Error loading follow-up calendar: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [year, month, locationFilter, selectedDateStr]);

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
    <DashboardLayout
      title="Follow-up Calendar"
      breadcrumbs={[{ label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, { label: 'Calendar' }]}
    >
      <PageContainer maxWidth="full">
        <div className="space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Follow-up Calendar"
            actions={
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <LocationFilterSelect
                  value={locationFilter}
                  onChange={(val) => setLocationFilter(val)}
                />
                <div className="flex items-center bg-[#FFFDFC] rounded-xl border border-[#E8D9D4] p-1 text-xs font-bold shadow-xs">
                  <button
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      viewMode === 'month' ? 'bg-[#B76E79] text-white shadow-xs' : 'text-[#6F5963] hover:text-[#4A173A]'
                    }`}
                  >
                    Month View
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      viewMode === 'list' ? 'bg-[#B76E79] text-white shadow-xs' : 'text-[#6F5963] hover:text-[#4A173A]'
                    }`}
                  >
                    List View
                  </button>
                </div>
              </div>
            }
          />

          {/* Calendar Header Navigator */}
          <div className="bg-[#FFFDFC] p-4 sm:p-5 rounded-2xl border border-[#E8D9D4] shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4A173A] text-[#B76E79] flex items-center justify-center font-black shadow-xs">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#4A173A]">
                  {monthNames[month]} {year}
                </h2>
                <div className="text-xs text-[#6F5963] font-semibold">
                  Follow-up Calls & Expected Shopping Appointments
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-[#FFF7F2] hover:bg-[#E8D9D4] text-[#4A173A] border border-[#E8D9D4] transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 rounded-xl bg-[#FFF7F2] hover:bg-[#E8D9D4] text-xs font-bold text-[#4A173A] border border-[#E8D9D4] transition-colors"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-[#FFF7F2] hover:bg-[#E8D9D4] text-[#4A173A] border border-[#E8D9D4] transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Grid: Calendar on Left, Selected Day Details on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar Grid (2 Cols) */}
            <div className="lg:col-span-2 bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 space-y-4">
              {/* Day of Week Labels */}
              <div className="grid grid-cols-7 gap-1 text-center font-black text-[11px] uppercase tracking-wider text-[#6F5963] border-b border-[#E8D9D4] pb-2">
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
                  <div key={`blank-${b}`} className="min-h-[70px] sm:min-h-[85px] bg-[#FFF7F2]/60 rounded-xl border border-dashed border-[#E8D9D4]/50" />
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
                          ? 'border-[#B76E79] bg-[#4A173A] text-white shadow-md'
                          : isToday
                          ? 'border-[#B76E79] bg-[#F6E2E5]/50'
                          : 'border-[#E8D9D4] bg-[#FFFAF7] hover:bg-white hover:border-[#B76E79]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black ${isSelected ? 'text-[#E8C7A8]' : isToday ? 'text-[#B76E79]' : 'text-[#2B1722]'}`}>
                          {dayNum}
                        </span>
                        {isToday && (
                          <span className="text-[8px] bg-[#B76E79] text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                            Today
                          </span>
                        )}
                      </div>

                      {count > 0 && (
                        <div className="mt-1">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-lg text-[9px] font-black ${
                              isSelected
                                ? 'bg-[#B76E79] text-white'
                                : 'bg-[#F6E2E5] text-[#4A173A] border border-[#E8D9D4]'
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
            <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-5 space-y-4">
              <div className="border-b border-[#E8D9D4] pb-3">
                <h3 className="text-sm font-black text-[#4A173A] uppercase tracking-wider">
                  Follow-ups for {selectedDateStr ? new Date(selectedDateStr).toLocaleDateString() : 'Selected Day'}
                </h3>
                <div className="text-xs text-[#6F5963]">
                  {selectedDayEvents.length} scheduled customer calls
                </div>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-12 text-[#6F5963] text-xs">
                  <CalendarIcon className="w-8 h-8 text-[#B76E79] mx-auto mb-2 opacity-80" />
                  <div className="font-bold text-sm text-[#4A173A]">No follow-ups for this date</div>
                  <div className="text-xs text-[#6F5963] mt-0.5">Select another date on the calendar to view scheduled follow-ups.</div>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {selectedDayEvents.map((cust: any) => {
                    const badge = getStatusBadge(cust.customer_status);
                    return (
                      <div
                        key={cust.id}
                        className="p-3.5 rounded-2xl bg-[#FFFAF7] border border-[#E8D9D4] hover:border-[#B76E79] text-xs space-y-2 transition-all shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/wedding-crm/customers/${cust.id}`}
                            className="font-black text-[#4A173A] hover:text-[#6A2853] hover:underline"
                          >
                            {cust.customer_name}
                          </Link>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                            {cust.customer_status}
                          </span>
                        </div>

                        <div className="text-[#6F5963] space-y-1 text-[11px]">
                          <div className="flex items-center gap-1.5 font-semibold text-[#2B1722]">
                            <span>📱 {cust.mobile_number}</span>
                            <span>·</span>
                            <span>📍 {cust.location_name || 'Store'}</span>
                          </div>
                          <div className="text-[#4A173A] font-bold">
                            Assigned: {cust.assigned_telecaller || 'Unassigned'}
                          </div>
                          {cust.preferred_call_time && (
                            <div className="text-[#C58A18] font-bold">
                              Window: {cust.preferred_call_time}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#E8D9D4]">
                          <a
                            href={`https://wa.me/91${cust.mobile_number?.replace(/\D/g, '')}?text=Namaste%20${encodeURIComponent(cust.customer_name)}%2C%20greetings%20from%20BSC%20Exclusive!`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-[#198754] hover:underline"
                          >
                            WhatsApp
                          </a>

                          <Link
                            to={`/wedding-crm/customers/${cust.id}`}
                            className="px-2.5 py-1 bg-[#4A173A] hover:bg-[#6A2853] text-white rounded-lg text-[10px] font-bold shadow-xs flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-3 h-3 text-[#B76E79]" /> View Record
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
