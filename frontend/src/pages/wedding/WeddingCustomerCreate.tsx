import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { getSidebarCollapsed, subscribeSidebarCollapsed } from '../../utils/sidebarState';
import WeddingNav from './WeddingNav';
import {
  CATEGORY_OPTIONS,
  BUDGET_RANGES,
  CALL_TIME_OPTIONS
} from './weddingTypes';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Heart,
  ShoppingBag,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Clock,
  UserCheck,
  FileText,
  AlertCircle,
  Save
} from 'lucide-react';

export default function WeddingCustomerCreate() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(getSidebarCollapsed());

  useEffect(() => {
    return subscribeSidebarCollapsed(setCollapsed);
  }, []);

  const [locations, setLocations] = useState<any[]>([]);
  const [telecallers, setTelecallers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState({
    // Section 1: Customer Details
    customer_name: '',
    mobile_number: '',
    email: '',
    alternate_mobile: '',

    // Section 2: Store Details
    location_id: '',
    registration_date: new Date().toISOString().slice(0, 10),
    lead_source: 'In-store Walkin',
    discovery_channel: 'Walkin Footfall',

    // Section 3: Wedding Details
    wedding_date: '',
    expected_shopping_date: '',
    preferred_shopping_category: 'Pure Silk Sarees',
    estimated_family_size: 2,

    // Section 4: Requirements
    customer_preferences: '',
    budget: '₹50,000 – ₹1,00,000',
    special_requirements: '',
    customer_notes: '',

    // Section 5: Follow-up & Telecaller
    preferred_call_time: 'Morning (10 AM - 1 PM)',
    // Default follow-up to 7 days from today
    follow_up_date: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().slice(0, 10);
    })(),
    assigned_telecaller: '',
    assigned_telecaller_id: '',
    priority: 'Medium'
  });

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);

    if (sess?.locationId) {
      setForm((prev) => ({ ...prev, location_id: String(sess.locationId) }));
    }

    Promise.all([
      API.getLocations().catch(() => ({ locations: [] })),
      API.getWeddingTelecallers().catch(() => ({ telecallers: [] }))
    ]).then(([locsRes, callersRes]) => {
      if (locsRes?.locations) setLocations(locsRes.locations);
      if (callersRes?.telecallers) setTelecallers(callersRes.telecallers);
    });
  }, [navigate]);

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (redirectTarget: 'register' | 'desk' | 'detail') => {
    if (!form.customer_name.trim()) {
      showToast('Customer Name is required', 'error');
      return;
    }
    if (!form.mobile_number.trim() || form.mobile_number.replace(/\D/g, '').length < 10) {
      showToast('Valid 10-digit mobile number is required', 'error');
      return;
    }
    if (!form.location_id) {
      showToast('Store Location is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const callerObj = telecallers.find(
        (t) => t.name === form.assigned_telecaller || String(t.id) === form.assigned_telecaller
      );

      // Default follow_up_date: 7 days from today if user left it blank
      const defaultFollowUp = new Date();
      defaultFollowUp.setDate(defaultFollowUp.getDate() + 7);
      const resolvedFollowUp = form.follow_up_date || defaultFollowUp.toISOString().slice(0, 10);

      const payload = {
        customer_name: form.customer_name.trim(),
        mobile_number: form.mobile_number.trim(),
        phone: form.mobile_number.trim(),
        alternate_mobile: form.alternate_mobile.trim() || undefined,
        email: form.email.trim() || undefined,
        location_id: Number(form.location_id),
        wedding_date: form.wedding_date || undefined,
        expected_shopping_date:
          form.expected_shopping_date ||
          form.wedding_date ||
          new Date().toISOString().slice(0, 10),
        preferred_shopping_category: form.preferred_shopping_category,
        estimated_family_size: Number(form.estimated_family_size) || 1,
        budget: form.budget,
        lead_source: form.lead_source,
        priority: form.priority,
        customer_notes: [
          form.customer_preferences ? `Preferences: ${form.customer_preferences}` : '',
          form.special_requirements ? `Special: ${form.special_requirements}` : '',
          form.customer_notes ? `Notes: ${form.customer_notes}` : ''
        ]
          .filter(Boolean)
          .join(' | ') || undefined,
        follow_up_date: resolvedFollowUp,
        preferred_call_time: form.preferred_call_time,
        assigned_telecaller: callerObj ? callerObj.name : form.assigned_telecaller || undefined,
        assigned_telecaller_id: callerObj ? callerObj.id : undefined
      };

      const res = await API.createWeddingCustomer(payload);
      // Backend successRes wraps data → spread via apiFetch, so 'customer' lives at top level
      const newCust = res?.customer || res?.data?.customer || res;

      showToast(`Wedding Customer "${form.customer_name}" registered successfully!`, 'success');

      if (redirectTarget === 'detail' && (newCust?.id || res?.id)) {
        navigate(`/wedding-crm/customers/${newCust?.id || res?.id}`);
      } else if (redirectTarget === 'desk') {
        navigate('/telecaller/desk');
      } else {
        navigate('/wedding-crm/customers');
      }
    } catch (err: any) {
      showToast('Error registering customer: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F4EF] flex text-[#182033]">
      <Sidebar
        session={session}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <Topbar
          title="Wedding Customer Registration"
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1200px] w-full mx-auto space-y-6">
          <ToastContainer />

          <WeddingNav
            currentPageTitle="Wedding Customer Registration"
            breadcrumbs={[
              { label: 'Customer Register', href: '/wedding-crm/customers' },
              { label: 'New Customer' }
            ]}
            actions={
              <Link
                to="/wedding-crm/customers"
                className="px-3.5 py-2 bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl text-xs font-bold text-[#182033] flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Customer Register</span>
              </Link>
            }
          />

          <div className="bg-white rounded-3xl border border-[#DFDDD7] shadow-xs p-6 sm:p-8 space-y-8">
            {/* Form Introduction Header */}
            <div>
              <h2 className="text-xl font-black text-[#182033] tracking-tight">
                New Wedding Customer Form
              </h2>
              <p className="text-xs text-muted mt-1">
                Enter wedding client details, expected shopping timeline, bridal & family requirements, and telecaller assignment.
              </p>
            </div>

            {/* SECTION 1: CUSTOMER DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#DFDDD7]">
                <User className="w-4 h-4 text-[#C9A45C]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#182033]">
                  Section 1 — Customer Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-muted mb-1">
                    Customer / Bride Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ananya Hegde"
                    value={form.customer_name}
                    onChange={(e) => handleChange('customer_name', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit number"
                    value={form.mobile_number}
                    onChange={(e) => handleChange('mobile_number', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Alternate Mobile
                  </label>
                  <input
                    type="tel"
                    placeholder="Parent / Spouse phone"
                    value={form.alternate_mobile}
                    onChange={(e) => handleChange('alternate_mobile', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium text-[#182033] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium text-[#182033] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: STORE DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#DFDDD7]">
                <MapPin className="w-4 h-4 text-[#C9A45C]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#182033]">
                  Section 2 — Store & Ingestion Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-muted mb-1">
                    Store Location *
                  </label>
                  <select
                    value={form.location_id}
                    disabled={!session?.isGlobalAdmin}
                    onChange={(e) => handleChange('location_id', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033] focus:outline-none focus:border-[#C9A45C]"
                  >
                    <option value="">-- Choose Store --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        📍 {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Registration Date
                  </label>
                  <input
                    type="date"
                    value={form.registration_date}
                    onChange={(e) => handleChange('registration_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium text-[#182033]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Lead Source
                  </label>
                  <select
                    value={form.lead_source}
                    onChange={(e) => handleChange('lead_source', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium text-[#182033]"
                  >
                    <option value="In-store Walkin">In-store Walkin</option>
                    <option value="Referral by Friend/Family">Referral by Friend/Family</option>
                    <option value="Social Media (Instagram/FB)">Social Media (Instagram/FB)</option>
                    <option value="Wedding Fair / Exhibition">Wedding Fair / Exhibition</option>
                    <option value="Phone Inquiry">Phone Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    How Did Customer Find Us?
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hoarding / Relative referral"
                    value={form.discovery_channel}
                    onChange={(e) => handleChange('discovery_channel', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium text-[#182033]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: WEDDING DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#DFDDD7]">
                <Heart className="w-4 h-4 text-pink-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#182033]">
                  Section 3 — Wedding & Shopping Timeline
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-muted mb-1">
                    Wedding / Muhurtham Date
                  </label>
                  <input
                    type="date"
                    value={form.wedding_date}
                    onChange={(e) => handleChange('wedding_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Expected Shopping Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.expected_shopping_date}
                    onChange={(e) => handleChange('expected_shopping_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Shopping Category
                  </label>
                  <select
                    value={form.preferred_shopping_category}
                    onChange={(e) => handleChange('preferred_shopping_category', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033]"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Estimated Family Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.estimated_family_size}
                    onChange={(e) => handleChange('estimated_family_size', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: REQUIREMENTS & BUDGET */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#DFDDD7]">
                <ShoppingBag className="w-4 h-4 text-[#C9A45C]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#182033]">
                  Section 4 — Shopping Requirements & Budget
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-muted mb-1">
                    Budget Range
                  </label>
                  <select
                    value={form.budget}
                    onChange={(e) => handleChange('budget', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033]"
                  >
                    {BUDGET_RANGES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Customer Preferences (Colors, Fabrics, Styles)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Royal Blue & Crimson red Kanjeevaram pure silk"
                    value={form.customer_preferences}
                    onChange={(e) => handleChange('customer_preferences', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium text-[#182033]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-muted mb-1">
                    Special Requirements & Internal Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Special requests, VIP family notes, specific stylist requested..."
                    value={form.customer_notes}
                    onChange={(e) => handleChange('customer_notes', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium text-[#182033]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 5: FOLLOW-UP & TELECALLER */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#DFDDD7]">
                <Clock className="w-4 h-4 text-[#C98218]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#182033]">
                  Section 5 — Follow-up & Telecaller Assignment
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-muted mb-1">
                    Preferred Call Time
                  </label>
                  <select
                    value={form.preferred_call_time}
                    onChange={(e) => handleChange('preferred_call_time', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-medium text-[#182033]"
                  >
                    {CALL_TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Initial Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={form.follow_up_date}
                    onChange={(e) => handleChange('follow_up_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Assign Telecaller
                  </label>
                  <select
                    value={form.assigned_telecaller}
                    onChange={(e) => handleChange('assigned_telecaller', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033]"
                  >
                    <option value="">-- Assign Telecaller --</option>
                    {telecallers.map((t) => (
                      <option key={t.id} value={t.name}>
                        👤 {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-muted mb-1">
                    Priority Level
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => handleChange('priority', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F6F4EF] border border-[#DFDDD7] rounded-xl font-bold text-[#182033]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent / VIP</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Form Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#DFDDD7]">
              <Link
                to="/wedding-crm/customers"
                className="text-xs font-bold text-muted hover:text-primary transition-colors"
              >
                Cancel and discard
              </Link>

              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit('register')}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-[#F6F4EF] border border-[#DFDDD7] font-bold text-xs text-[#182033] transition-all"
                >
                  Save to Register
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit('desk')}
                  className="px-5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 font-bold text-xs text-amber-900 transition-all"
                >
                  Save & Assign to Desk
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit('detail')}
                  className="px-6 py-2.5 rounded-xl bg-[#101C36] hover:bg-[#07101F] text-[#C9A45C] font-black text-xs shadow-md border border-[#C9A45C]/30 flex items-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Registering...' : 'Save & Open Profile'}</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
