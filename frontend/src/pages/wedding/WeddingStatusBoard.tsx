import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
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
    color: 'border-border',
    headerBg: 'bg-background',
    countBadge: 'bg-primary-soft text-primary'
  },
  {
    key: 'contacted',
    label: '2. Contacted',
    statuses: ['Contacted'],
    color: 'border-amber-300',
    headerBg: 'bg-amber-50',
    countBadge: 'bg-amber-200 text-amber-900'
  },
  {
    key: 'followUp',
    label: '3. Follow-up',
    statuses: ['Follow-up Scheduled', 'Follow-up', 'Callback'],
    color: 'border-[#C9A45C]/50',
    headerBg: 'bg-amber-50',
    countBadge: 'bg-[#C9A45C] text-[#101C36]'
  },
  {
    key: 'confirmed',
    label: '4. Shopping Planned',
    statuses: ['Shopping Planned', 'Shopping Confirmed', 'Visit Scheduled'],
    color: 'border-blue-300',
    headerBg: 'bg-blue-50',
    countBadge: 'bg-blue-200 text-blue-900'
  },
  {
    key: 'visited',
    label: '5. Visited Store',
    statuses: ['Visited', 'Visited Store'],
    color: 'border-indigo-300',
    headerBg: 'bg-indigo-50',
    countBadge: 'bg-indigo-200 text-indigo-900'
  },
  {
    key: 'won',
    label: '6. Won / Converted',
    statuses: ['Won', 'Converted'],
    color: 'border-emerald-300',
    headerBg: 'bg-emerald-50',
    countBadge: 'bg-emerald-200 text-emerald-900'
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
    if (!followUpDate) return false;
    return new Date(followUpDate) < new Date(new Date().toDateString());
  };

  const isDueToday = (followUpDate?: string) => {
    if (!followUpDate) return false;
    return new Date(followUpDate).toDateString() === new Date().toDateString();
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
                  className="px-3.5 py-2 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C9A45C]' : ''}`}
                  />
                  <span>Refresh</span>
                </button>
                <Link
                  to="/wedding/customer-registration"
                  className="px-4 py-2 bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md border border-[#C9A45C]/30"
                >
                  <Plus className="w-3.5 h-3.5" />
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
                  className="flex items-center gap-2 bg-white border border-[#DFDDD7] rounded-2xl px-4 py-2 shadow-xs"
                >
                  <span className="text-[10px] font-black text-muted uppercase tracking-wider">
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
                    className={`bg-white rounded-3xl border-2 ${col.color} shadow-xs flex flex-col min-h-[520px] max-h-[76vh] w-[270px] xl:w-auto shrink-0 xl:shrink`}
                  >
                  {/* Column Header */}
                  <div
                    className={`flex items-center justify-between px-4 py-3 border-b border-[#DFDDD7] ${col.headerBg} rounded-t-3xl`}
                  >
                    <h3 className="text-[10px] font-black text-[#182033] uppercase tracking-wider leading-tight">
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
                      <div className="py-10 text-center text-xs text-muted">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#C9A45C] mx-auto mb-1" />
                        Loading...
                      </div>
                    ) : cards.length === 0 ? (
                      <div className="py-12 text-center text-[11px] text-muted">
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
                            className={`p-3 rounded-2xl border transition-all group space-y-1.5 ${
                              overdue
                                ? 'bg-rose-50 border-rose-300 hover:border-rose-400'
                                : dueToday
                                ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                                : 'bg-[#F6F4EF] border-[#DFDDD7] hover:border-[#C9A45C]'
                            }`}
                          >
                            {/* Name + priority flag */}
                            <div className="flex items-start justify-between gap-1">
                              <Link
                                to={`/wedding-crm/customers/${cust.id}`}
                                className="font-black text-[11px] text-[#182033] group-hover:text-[#C98218] transition-colors leading-tight"
                              >
                                {cust.customer_name}
                              </Link>
                              {isHighPriority && (
                                <Star className="w-3 h-3 text-[#C9A45C] shrink-0 mt-0.5" />
                              )}
                            </div>

                            {/* Code */}
                            <div className="text-[9px] text-muted font-bold tracking-wide">
                              {cust.customer_code}
                            </div>

                            {/* Location */}
                            <div className="flex items-center gap-1 text-[10px] text-muted">
                              <MapPin className="w-2.5 h-2.5 text-[#C9A45C]" />
                              <span>{cust.location_name || 'Store'}</span>
                            </div>

                            {/* Wedding date */}
                            {cust.wedding_date && (
                              <div className="text-[10px] text-pink-700 font-bold flex items-center gap-1">
                                <Heart className="w-2.5 h-2.5 text-pink-600" />
                                <span>
                                  {new Date(cust.wedding_date).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </span>
                              </div>
                            )}

                            {/* Follow-up date with urgency */}
                            {cust.follow_up_date && (
                              <div
                                className={`flex items-center gap-1 text-[10px] font-bold ${
                                  overdue
                                    ? 'text-rose-700'
                                    : dueToday
                                    ? 'text-amber-800'
                                    : 'text-muted'
                                }`}
                              >
                                {overdue && <CircleAlert className="w-2.5 h-2.5" />}
                                <span>
                                  {overdue
                                    ? 'Overdue: '
                                    : dueToday
                                    ? 'Today: '
                                    : 'Follow-up: '}
                                  {new Date(cust.follow_up_date).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short'
                                  })}
                                </span>
                              </div>
                            )}

                            {/* Telecaller + view button */}
                            <div className="flex items-center justify-between pt-1 border-t border-[#DFDDD7]/60">
                              <span className="text-[9px] text-muted font-semibold truncate max-w-[80px]">
                                👤 {cust.assigned_telecaller || 'Unassigned'}
                              </span>
                              <Link
                                to={`/wedding-crm/customers/${cust.id}`}
                                className="p-1 rounded-lg bg-white hover:bg-[#DFDDD7] text-primary"
                                title="View Customer Profile"
                              >
                                <Eye className="w-3 h-3" />
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
