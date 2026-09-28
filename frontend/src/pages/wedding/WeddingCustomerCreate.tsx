import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
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
  CircleCheck,
  Clock,
  UserCheck,
  FileText,
  CircleAlert,
  Save,
  Info
} from 'lucide-react';

export default function WeddingCustomerCreate() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());

  const [locations, setLocations] = useState<any[]>([]);
  const [telecallers, setTelecallers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [existingCustomerInfo, setExistingCustomerInfo] = useState<any | null>(null);
  const [allowMultipleRegistration, setAllowMultipleRegistration] = useState(false);

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
    // For mobile fields, allow only digits and cap at 10
    if (field === 'mobile_number' || field === 'alternate_mobile') {
      const clean = String(value).replace(/\D/g, '').slice(0, 10);
      setForm((prev) => ({ ...prev, [field]: clean }));
      if (field === 'mobile_number') {
        if (clean.length === 10) {
          checkDuplicateMobile(clean);
        } else {
          setExistingCustomerInfo(null);
          setAllowMultipleRegistration(false);
        }
      }
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const checkDuplicateMobile = async (mobile: string) => {
    const clean = mobile.replace(/\D/g, '');
    if (clean.length < 10) return;
    setCheckingDuplicate(true);
    try {
      const res = await API.checkWeddingCustomerDuplicate({ mobile });
      if (res?.exists) {
        const cust = res.customer || res.existingCustomer;
        setExistingCustomerInfo(cust);
      } else {
        setExistingCustomerInfo(null);
        setAllowMultipleRegistration(false);
      }
    } catch {
      // Ignore background check errors
    } finally {
      setCheckingDuplicate(false);
    }
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
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      showToast('Please enter a valid email address (e.g. name@example.com)', 'error');
      return;
    }

    setSaving(true);
    try {
      // Match telecaller by ID for reliability
      const callerObj = telecallers.find(
        (t: any) => String(t.id) === String(form.assigned_telecaller)
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
        assigned_telecaller: callerObj ? (callerObj.full_name || callerObj.name) : undefined,
        assigned_telecaller_id: callerObj ? callerObj.id : undefined,
        force_create_new_registration: allowMultipleRegistration,
        link_to_existing: allowMultipleRegistration,
        existing_customer_id: allowMultipleRegistration && existingCustomerInfo ? existingCustomerInfo.customer_code : undefined
      };

      const res = await API.createWeddingCustomer(payload);
      // Backend successRes wraps data → spread via apiFetch, so 'customer' lives at top level
      const newCust = res?.customer || res?.data?.customer || res;

      showToast(`Customer "${form.customer_name}" created successfully.`, 'success');

      if (redirectTarget === 'detail' && (newCust?.id || res?.id)) {
        navigate(`/wedding-crm/customers/${newCust?.id || res?.id}`);
      } else if (redirectTarget === 'desk') {
        navigate('/telecaller/desk');
      } else {
        navigate('/wedding-crm/customers');
      }
    } catch (err: any) {
      showToast('Unable to register customer. ' + (err.message || 'Please try again.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Wedding Customer Registration"
      breadcrumbs={[
        { label: 'Wedding CRM', href: '/wedding-crm/dashboard' },
        { label: 'Customer Register', href: '/wedding-crm/customers' },
        { label: 'Register Customer' }
      ]}
    >
      <PageContainer maxWidth="6xl">
        <div className="space-y-6">
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
                className="px-3.5 py-2 bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] rounded-xl text-xs font-semibold text-[#4A173A] flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Customer Register</span>
              </Link>
            }
          />

          <div className="bg-[#FFFDFC] rounded-3xl border border-[#E8D9D4] shadow-xs p-6 sm:p-8 space-y-8">
            {/* Form Introduction Header */}
            <div>
              <h2 className="text-xl font-bold text-[#4A173A] tracking-tight">
                New Wedding Customer Form
              </h2>
              <p className="text-xs text-[#6F5963] mt-1">
                Enter wedding client details, expected shopping timeline, bridal & family requirements, and telecaller assignment.
              </p>
            </div>

            {/* SECTION 1: CUSTOMER DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E8D9D4]">
                <User className="w-4 h-4 text-[#B76E79]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A173A]">
                  Section 1 — Customer Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Customer / Bride Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ananya Hegde"
                    value={form.customer_name}
                    onChange={(e) => handleChange('customer_name', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-[#6F5963]">
                      Mobile Number *
                    </label>
                    {checkingDuplicate && (
                      <span className="text-[10px] text-[#C58A18] font-bold animate-pulse">
                        Checking existing records...
                      </span>
                    )}
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    pattern="[0-9]{10}"
                    inputMode="numeric"
                    placeholder="10-digit number"
                    value={form.mobile_number}
                    onBlur={() => checkDuplicateMobile(form.mobile_number)}
                    onChange={(e) => handleChange('mobile_number', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>

                {existingCustomerInfo && (
                  <div className="col-span-full p-3.5 bg-[#FFF4D6] border border-[#E8D9D4] rounded-2xl text-xs space-y-2 text-[#C58A18] animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-[#4A173A]">
                        <Info className="w-4 h-4 text-[#C58A18] flex-shrink-0" />
                        <span>Existing customer found with this mobile number!</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFFAF7] text-[#4A173A] border border-[#E8D9D4]">
                        {existingCustomerInfo.customer_code}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6F5963]">
                      <strong className="text-[#4A173A]">{existingCustomerInfo.customer_name}</strong> was registered at <strong>{existingCustomerInfo.location_name || 'Store'}</strong> on {new Date(existingCustomerInfo.created_at).toLocaleDateString()}. (Status: {existingCustomerInfo.customer_status})
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAllowMultipleRegistration(!allowMultipleRegistration);
                          if (!allowMultipleRegistration) {
                            showToast('New wedding will be linked to this customer account.', 'info');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all ${
                          allowMultipleRegistration
                            ? 'bg-[#4A173A] text-white'
                            : 'bg-[#FFFDFC] border border-[#E8D9D4] hover:bg-[#FFF7F2] text-[#4A173A]'
                        }`}
                      >
                        <CircleCheck className="w-3.5 h-3.5" />
                        <span>{allowMultipleRegistration ? 'Linked to Existing Customer ✓' : 'Link New Wedding Request to This Customer'}</span>
                      </button>
                      <Link
                        to={`/wedding-crm/customers/${existingCustomerInfo.id}`}
                        target="_blank"
                        className="px-3 py-1.5 rounded-xl bg-[#FFFDFC] border border-[#E8D9D4] hover:bg-[#FFF7F2] text-[#4A173A] font-semibold text-xs flex items-center gap-1"
                      >
                        <span>View Existing Customer</span>
                      </Link>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Alternate Mobile
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    inputMode="numeric"
                    placeholder="Parent / Spouse phone"
                    value={form.alternate_mobile}
                    onChange={(e) => handleChange('alternate_mobile', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: STORE DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E8D9D4]">
                <MapPin className="w-4 h-4 text-[#B76E79]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A173A]">
                  Section 2 — Store & Ingestion Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Store Location *
                  </label>
                  <select
                    value={form.location_id}
                    disabled={!session?.isGlobalAdmin}
                    onChange={(e) => handleChange('location_id', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
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
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Registration Date
                  </label>
                  <input
                    type="date"
                    value={form.registration_date}
                    onChange={(e) => handleChange('registration_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Lead Source
                  </label>
                  <select
                    value={form.lead_source}
                    onChange={(e) => handleChange('lead_source', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  >
                    <option value="In-store Walkin">In-store Walkin</option>
                    <option value="Referral by Friend/Family">Referral by Friend/Family</option>
                    <option value="Social Media (Instagram/FB)">Social Media (Instagram/FB)</option>
                    <option value="Wedding Fair / Exhibition">Wedding Fair / Exhibition</option>
                    <option value="Phone Inquiry">Phone Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    How Did Customer Find Us?
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hoarding / Relative referral"
                    value={form.discovery_channel}
                    onChange={(e) => handleChange('discovery_channel', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: WEDDING DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E8D9D4]">
                <Heart className="w-4 h-4 text-[#B76E79]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A173A]">
                  Section 3 — Wedding & Shopping Timeline
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Wedding / Muhurtham Date
                  </label>
                  <input
                    type="date"
                    value={form.wedding_date}
                    onChange={(e) => handleChange('wedding_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Expected Shopping Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.expected_shopping_date}
                    onChange={(e) => handleChange('expected_shopping_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Shopping Category
                  </label>
                  <select
                    value={form.preferred_shopping_category}
                    onChange={(e) => handleChange('preferred_shopping_category', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Estimated Family Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.estimated_family_size}
                    onChange={(e) => handleChange('estimated_family_size', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 4: REQUIREMENTS & BUDGET */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E8D9D4]">
                <ShoppingBag className="w-4 h-4 text-[#B76E79]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A173A]">
                  Section 4 — Shopping Requirements & Budget
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Budget Range
                  </label>
                  <select
                    value={form.budget}
                    onChange={(e) => handleChange('budget', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  >
                    {BUDGET_RANGES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Customer Preferences (Colors, Fabrics, Styles)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Royal Blue & Crimson red Kanjeevaram pure silk"
                    value={form.customer_preferences}
                    onChange={(e) => handleChange('customer_preferences', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Special Requirements & Internal Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Special requests, VIP family notes, specific stylist requested..."
                    value={form.customer_notes}
                    onChange={(e) => handleChange('customer_notes', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] placeholder-[#9A858D] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 5: FOLLOW-UP & TELECALLER */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E8D9D4]">
                <Clock className="w-4 h-4 text-[#B76E79]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#4A173A]">
                  Section 5 — Follow-up & Telecaller Assignment
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Preferred Call Time
                  </label>
                  <select
                    value={form.preferred_call_time}
                    onChange={(e) => handleChange('preferred_call_time', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-medium text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  >
                    {CALL_TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Initial Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={form.follow_up_date}
                    onChange={(e) => handleChange('follow_up_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Assign Telecaller
                  </label>
                  <select
                    value={form.assigned_telecaller}
                    onChange={(e) => handleChange('assigned_telecaller', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
                  >
                    <option value="">-- Select Telecaller --</option>
                    {telecallers.map((t: any) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.full_name || t.name || t.username} — {t.employee_id || `EMP-${t.id}`} ({t.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#6F5963] mb-1">
                    Priority Level
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => handleChange('priority', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#FFFAF7] border border-[#E8D9D4] rounded-xl font-semibold text-[#2B1722] focus:outline-none focus:border-[#B76E79]"
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#E8D9D4]">
              <Link
                to="/wedding-crm/customers"
                className="text-xs font-semibold text-[#6F5963] hover:text-[#4A173A] transition-colors"
              >
                Cancel and discard
              </Link>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit('register')}
                  className="px-5 py-2.5 rounded-xl bg-[#FFFDFC] hover:bg-[#FFF7F2] border border-[#E8D9D4] font-semibold text-xs text-[#4A173A] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-[#E8D9D4] border-t-[#4A173A] rounded-full animate-spin" />}
                  {saving ? 'Saving...' : 'Save to Register'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit('desk')}
                  className="px-5 py-2.5 rounded-xl bg-[#F6E2E5] hover:bg-[#D89AA3]/30 border border-[#E8D9D4] font-semibold text-xs text-[#4A173A] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-[#E8D9D4] border-t-[#B76E79] rounded-full animate-spin" />}
                  {saving ? 'Saving...' : 'Save & Assign to Desk'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit('detail')}
                  className="px-6 py-2.5 rounded-xl bg-[#4A173A] hover:bg-[#6A2853] text-white font-semibold text-xs shadow-xs border border-[#B76E79]/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-[#E8C7A8]/30 border-t-[#E8C7A8] rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 text-[#E8C7A8]" />
                  )}
                  <span>{saving ? 'Registering Customer...' : 'Save & Open Profile'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}
