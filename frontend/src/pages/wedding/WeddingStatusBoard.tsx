import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { parseDate, formatDateDisplay } from '../../utils/dateUtils';
import WeddingNav from './WeddingNav';
import LocationFilterSelect from '../../components/ui/LocationFilterSelect';
import {
  MapPin,
  Heart,
  RefreshCw,
  Plus,
  Eye,
  CircleAlert,
  Star
} from 'lucide-react';

/**
 * WeddingStatusBoard — Kanban-style pipeline view.
 * Fetches real customer cards per status column using getWeddingCustomers.
 * (getWeddingPipeline only returns counts — not suitable for card views.)
 */

// Kanban columns — each maps to one or more customer_status values
const COLUMNS = [
  {
    key: 'new',
    label: '1. New Leads',
    statuses: ['New', 'New Lead', 'Contact Pending'],
    color: 'border-[#E8D9D4]',
    headerBg: 'bg-[#FFFAF7]',
    countBadge: 'bg-[#EDE7F6] text-[#6A2853]'
  },
  {
    key: 'contacted',
    label: '2. Contacted',
    statuses: ['Contacted'],
    color: 'border-[#E8C7A8]',
    headerBg: 'bg-[#FFF4D6]',
    countBadge: 'bg-[#C58A18] text-white'
  },
  {
    key: 'followUp',
    label: '3. Follow-up',
    statuses: ['Follow-up Scheduled', 'Follow-up', 'Callback'],
    color: 'border-[#D89AA3]',
    headerBg: 'bg-[#F6E2E5]',
    countBadge: 'bg-[#4A173A] text-white'
  },
  {
    key: 'confirmed',
    label: '4. Shopping Planned',
    statuses: ['Shopping Planned', 'Shopping Confirmed', 'Visit Scheduled'],
    color: 'border-[#B76E79]',
    headerBg: 'bg-[#FFF7F2]',
    countBadge: 'bg-[#B76E79] text-white'
  },
  {
    key: 'visited',
    label: '5. Visited Store',
    statuses: ['Visited', 'Visited Store'],
    color: 'border-[#E8C7A8]',
    headerBg: 'bg-[#FFFAF7]',
    countBadge: 'bg-[#6A2853] text-white'
  },
  {
    key: 'won',
    label: '6. Won / Converted',
    // 'Wedding Process Completed' is the terminal journey step: it lands here and
    // simultaneously moves the record into the permanent Old Customers archive.
    statuses: ['Won', 'Converted', 'Wedding Process Completed'],
    color: 'border-[#198754]/40',
    headerBg: 'bg-[#E8F5EE]',
    countBadge: 'bg-[#198754] text-white'
  }
];

export default function WeddingStatusBoard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());


  const [loading, setLoading] = useState(true);
  const [columnData, setColumnData] = useState<Record<string, any[]>>({});
  const [locationFilter, setLocationFilter] = useState<number | ''>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('bsc_selected_location') : null;
    return saved && saved !== 'ALL' ? Number(saved) : '';
  });
  const [locations, setLocations] = useState<any[]>([]);

  // Listen to global location changes (e.g. from Topbar)
  useEffect(() => {
    const handleLocChange = (e: any) => {
      const locId = e?.detail?.locationId;
      const parsed = locId && locId !== 'ALL' ? Number(locId) : '';
      setLocationFilter(parsed);
    };
    window.addEventListener('bsc_location_changed', handleLocChange);
    return () => window.removeEventListener('bsc_location_changed', handleLocChange);
  }, []);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      // Build params: fetch all non-deleted customers scoped to location
      const params: Record<string, any> = { limit: 500 };
      if (locationFilter !== '') params.location_id = locationFilter;

      const [customersRes, locsRes] = await Promise.all([
        API.getWeddingCustomers(params).catch(() => ({ customers: [] })),
        API.getLocations().catch(() => ({ locations: [] }))
      ]);

      if (locsRes?.locations) setLocations(locsRes.locations);

      const allCustomers: any[] = customersRes?.customers || customersRes?.data || [];

      // Group customers into columns by matching their customer_status
      const grouped: Record<string, any[]> = {};
      for (const col of COLUMNS) {
        grouped[col.key] = allCustomers.filter((c: any) =>
          col.statuses.some(
            (s) => (c.customer_status || '').toLowerCase() === s.toLowerCase()
          )
        );
      }

      setColumnData(grouped);
    } catch (err: any) {
      showToast('Error loading status board: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [locationFilter]);

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
  }, [navigate]);

  // Trigger load whenever locationFilter changes (after session is set)
  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const isOverdue = (followUpDate?: string) => {
    const due = parseDate(followUpDate);
    if (!due) return false;
    return due < new Date(new Date().toDateString());
  };

  const isDueToday = (followUpDate?: string) => {
    const due = parseDate(followUpDate);
    if (!due) return false;
    return due.toDateString() === new Date().toDateString();
  };

  return (
    <DashboardLayout
      title="Wedding Status Pipeline"
      breadcrumbs={[{ label: 'Wedding CRM', href: '/wedding-crm/dashboard' }, { label: 'Status Pipeline' }]}
    >
      <PageContainer maxWidth="full">
        <div className="space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Wedding Status Pipeline"
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <LocationFilterSelect
                  value={locationFilter}
                  onChange={(val) => setLocationFilter(val)}
                />
                <button
                  onClick={loadBoard}
                  disabled={loading}
                  className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-bold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#B76E79]' : 'text-[#B76E79]'}`}
                  />
                  <span>Refresh</span>
                </button>
                <Link
                  to="/wedding/customer-registration"
                  className="px-4 py-2 bg-[#4A173A] hover:bg-[#6A2853] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs border border-[#4A173A] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#E8C7A8]" />
                  <span>Add Customer</span>
                </Link>
              </div>
            }
          />

          {/* Summary bar */}
          <div className="flex gap-3 flex-wrap">
            {COLUMNS.map((col) => {
              const count = columnData[col.key]?.length ?? 0;
              return (
                <div
                  key={col.key}
                  className="flex items-center gap-2 bg-[#FFFDFC] border border-[#E8D9D4] rounded-2xl px-4 py-2 shadow-2xs"
                >
                  <span className="text-[10px] font-black text-[#6F5963] uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${col.countBadge}`}
                  >
                    {loading ? '…' : count}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Kanban Board Container */}
          <div className="overflow-x-auto pb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
            <div className="flex xl:grid xl:grid-cols-6 gap-4 min-w-[1080px] xl:min-w-0">
              {COLUMNS.map((col) => {
                const cards = columnData[col.key] || [];

                return (
                  <div
                    key={col.key}
                    className={`bg-[#FFFDFC] rounded-3xl border ${col.color} shadow-xs flex flex-col min-h-[520px] max-h-[76vh] w-[270px] xl:w-auto shrink-0 xl:shrink`}
                  >
                  {/* Column Header */}
                  <div
                    className={`flex items-center justify-between px-4 py-3 border-b border-[#E8D9D4] ${col.headerBg} rounded-t-3xl`}
                  >
                    <h3 className="text-[11px] font-black text-[#4A173A] uppercase tracking-wider leading-tight">
                      {col.label}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${col.countBadge}`}
                    >
                      {cards.length}
                    </span>
                  </div>

                  {/* Cards List */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 p-3">
                    {loading ? (
                      <div className="py-10 text-center text-xs text-[#6F5963]">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#B76E79] mx-auto mb-1" />
                        Loading...
                      </div>
                    ) : cards.length === 0 ? (
                      <div className="py-12 text-center text-[11px] text-[#6F5963]">
                        No customers
                      </div>
                    ) : (
                      cards.map((cust: any) => {
                        const overdue = isOverdue(cust.follow_up_date);
                        const dueToday = isDueToday(cust.follow_up_date);
                        const isHighPriority =
                          cust.priority === 'High' || cust.priority === 'Urgent';

                        return (
                          <div
                            key={cust.id}
                            className={`p-3 rounded-2xl border transition-all group space-y-1.5 shadow-2xs ${
                              overdue
                                ? 'bg-[#FDE8E7] border-[#B42318]/40 hover:border-[#B42318]'
                                : dueToday
                                ? 'bg-[#FFF4D6] border-[#C58A18]/40 hover:border-[#C58A18]'
                                : 'bg-[#FFFAF7] border-[#E8D9D4] hover:border-[#B76E79] hover:bg-[#FFFDFC]'
                            }`}
                          >
                            {/* Name + priority flag */}
                            <div className="flex items-start justify-between gap-1">
                              <Link
                                to={`/wedding-crm/customers/${cust.id}`}
                                className="font-black text-[12px] text-[#2B1722] group-hover:text-[#4A173A] transition-colors leading-tight"
                              >
                                {cust.customer_name}
                              </Link>
                              {isHighPriority && (
                                <Star className="w-3 h-3 text-[#B76E79] shrink-0 mt-0.5 fill-[#B76E79]" />
                              )}
                            </div>

                            {/* Code */}
                            <div className="text-[9px] text-[#6F5963] font-bold tracking-wide">
                              {cust.customer_code}
                            </div>

                            {/* Location */}
                            <div className="flex items-center gap-1 text-[10px] text-[#6F5963]">
                              <MapPin className="w-2.5 h-2.5 text-[#B76E79]" />
                              <span>{cust.location_name || 'Store'}</span>
                            </div>

                            {/* Wedding date */}
                            {parseDate(cust.wedding_date) && (
                              <div className="text-[10px] text-[#6A2853] font-bold flex items-center gap-1">
                                <Heart className="w-2.5 h-2.5 text-[#B76E79] fill-[#B76E79]/20" />
                                <span>
                                  {formatDateDisplay(cust.wedding_date, '', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            )}

                            {/* Follow-up date with urgency */}
                            {parseDate(cust.follow_up_date) && (
                              <div
                                className={`flex items-center gap-1 text-[10px] font-bold ${
                                  overdue
                                    ? 'text-[#B42318]'
                                    : dueToday
                                    ? 'text-[#C58A18]'
                                    : 'text-[#6F5963]'
                                }`}
                              >
                                {overdue && <CircleAlert className="w-2.5 h-2.5" />}
                                <span>
                                  {overdue
                                    ? 'Overdue: '
                                    : dueToday
                                    ? 'Today: '
                                    : 'Follow-up: '}
                                  {formatDateDisplay(cust.follow_up_date, '', {
                                    day: '2-digit',
                                    month: 'short'
                                  })}
                                </span>
                              </div>
                            )}

                            {/* Telecaller + view button */}
                            <div className="flex items-center justify-between pt-1 border-t border-[#E8D9D4]">
                              <span className="text-[9px] text-[#6F5963] font-semibold truncate max-w-[80px]">
                                👤 {cust.assigned_telecaller || 'Unassigned'}
                              </span>
                              <Link
                                to={`/wedding-crm/customers/${cust.id}`}
                                className="p-1 rounded-lg bg-[#FFFDFC] border border-[#E8D9D4] hover:bg-[#FFF7F2] text-[#4A173A] transition-colors"
                                title="View Customer Profile"
                              >
                                <Eye className="w-3 h-3 text-[#B76E79]" />
                              </Link>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
