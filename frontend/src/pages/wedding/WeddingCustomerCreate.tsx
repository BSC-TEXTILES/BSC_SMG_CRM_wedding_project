import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import PageContainer from '../../components/ui/PageContainer';
import ToastContainer, { showToast } from '../../components/Toast';
import { API, Auth, UserSession } from '../../services/api';
import { useLocationContext } from '../../context/LocationContext';
import { formatDateDisplay } from '../../utils/dateUtils';
import WeddingNav from './WeddingNav';
import {
  CATEGORY_OPTIONS,
  BUDGET_RANGES,
  CALL_TIME_OPTIONS
} from './weddingTypes';
import { User, MapPin, Heart, ShoppingBag, ArrowLeft, CircleCheck, Clock, Save, Info, Lock } from 'lucide-react';

export default function WeddingCustomerCreate() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(() => Auth.get());
  const {
    activeLocation,
    currentLocation,
    availableLocations,
    canSwitch,
    isGlobalAdmin
  } = useLocationContext();

  const [locations, setLocations] = useState<any[]>([]);
  const [telecallers, setTelecallers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [existingCustomerInfo, setExistingCustomerInfo] = useState<any | null>(null);
  const [allowMultipleRegistration, setAllowMultipleRegistration] = useState(false);

  // Filter strictly to locations this user is authorized to access
  const displayLocations = useMemo(() => {
    if (availableLocations && availableLocations.length > 0) {
      return availableLocations.map((l) => ({
        id: Number(l.id),
        name: l.name || l.location_name || (l.id === 1 ? 'Belagavi' : l.id === 2 ? 'Davanagere' : 'Shivamogga'),
        storeName: l.storeName || `BSC Textiles ${l.name || 'Store'}`,
        code: l.code || l.location_code || ''
      }));
    }
    if (session?.locationId) {
      const locId = Number(session.locationId);
      const name = session.locationName || (locId === 1 ? 'Belagavi' : locId === 2 ? 'Davanagere' : 'Shivamogga');
      return [{ id: locId, name, storeName: `BSC Textiles ${name}`, code: session.locationCode || '' }];
    }
    return (Array.isArray(locations) ? locations : []).map((l: any) => ({
      id: Number(l.id),
      name: l.location_name || l.name || (l.id === 1 ? 'Belagavi' : l.id === 2 ? 'Davanagere' : 'Shivamogga'),
      storeName: l.storeName || (l.store_name && l.store_name !== 'BSC Textiles Pvt Ltd' ? l.store_name : `BSC Textiles ${l.location_name || ''}`),
      code: l.location_code || ''
    }));
  }, [availableLocations, session, locations]);

  // Determine effective assigned or default store location ID
  const effectiveLocationId = useMemo(() => {
    if (availableLocations.length === 1) {
      return String(availableLocations[0].id);
    }
    if (currentLocation && currentLocation !== 'ALL') {
      return String(currentLocation);
    }
    if (session?.locationId) {
      return String(session.locationId);
    }
    if (activeLocation?.id && activeLocation.id !== 'ALL') {
      return String(activeLocation.id);
    }
    return displayLocations[0]?.id ? String(displayLocations[0].id) : '';
  }, [availableLocations, currentLocation, session, activeLocation, displayLocations]);

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
    expected_shopping_date: '',
    preferred_shopping_category: 'Pure Silk Sarees',

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

    API.getLocations()
      .then((locsRes: any) => {
        const locList = Array.isArray(locsRes?.locations) ? locsRes.locations : [];
        if (locList.length > 0) setLocations(locList);
      })
      .catch(() => {});
  }, [navigate]);

  // Auto-sync form location_id with effectiveLocationId
  useEffect(() => {
    if (effectiveLocationId) {
      setForm((prev) => {
        if (!prev.location_id || !displayLocations.some((l) => String(l.id) === String(prev.location_id))) {
          return { ...prev, location_id: effectiveLocationId };
        }
        return prev;
      });
    }
  }, [effectiveLocationId, displayLocations]);

  // Load telecallers scoped to active store location
  useEffect(() => {
    const locToFetch = form.location_id || effectiveLocationId;
    API.getWeddingTelecallers(locToFetch || undefined)
      .then((callersRes: any) => {
        if (callersRes?.telecallers && Array.isArray(callersRes.telecallers)) {
          setTelecallers(callersRes.telecallers);
        }
      })
      .catch(() => {});
  }, [form.location_id, effectiveLocationId]);

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
    const resolvedLocId = Number(form.location_id || effectiveLocationId);
    if (!resolvedLocId) {
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
        location_id: resolvedLocId,
        expected_shopping_date: form.expected_shopping_date ? form.expected_shopping_date : undefined,
        preferred_shopping_category: form.preferred_shopping_category,
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
                className="px-3.5 py-2 bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] rounded-xl text-xs font-semibold text-[#123C35] flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Customer Register</span>
              </Link>
            }
          />

          <div className="bg-[#FFFFFF] rounded-3xl border border-[#E1DDD3] shadow-xs p-6 sm:p-8 space-y-8">
            {/* Form Introduction Header */}
            <div>
              <h2 className="text-xl font-bold text-[#123C35] tracking-tight">
                New Wedding Customer Form
              </h2>
              <p className="text-xs text-[#65716C] mt-1">
                Enter wedding client details, expected shopping timeline, bridal & family requirements, and telecaller assignment.
              </p>
            </div>

            {/* SECTION 1: CUSTOMER DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E1DDD3]">
                <User className="w-4 h-4 text-[#C9A45C]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#123C35]">
                  Section 1 — Customer Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Customer / Bride Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ananya Hegde"
                    value={form.customer_name}
                    onChange={(e) => handleChange('customer_name', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-semibold text-[#17201D] placeholder-[#9A858D] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-[#65716C]">
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
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-semibold text-[#17201D] placeholder-[#9A858D] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                {existingCustomerInfo && (
                  <div className="col-span-full p-3.5 bg-[#FFF4D6] border border-[#E1DDD3] rounded-2xl text-xs space-y-2 text-[#C58A18] animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-[#123C35]">
                        <Info className="w-4 h-4 text-[#C58A18] flex-shrink-0" />
                        <span>Existing customer found with this mobile number!</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F7F5F0] text-[#123C35] border border-[#E1DDD3]">
                        {existingCustomerInfo.customer_code}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#65716C]">
                      <strong className="text-[#123C35]">{existingCustomerInfo.customer_name}</strong> was registered at <strong>{existingCustomerInfo.location_name || 'Store'}</strong> on {formatDateDisplay(existingCustomerInfo.created_at, 'N/A')}. (Status: {existingCustomerInfo.customer_status})
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
                            ? 'bg-[#123C35] text-white'
                            : 'bg-[#FFFFFF] border border-[#E1DDD3] hover:bg-[#EDF3F0] text-[#123C35]'
                        }`}
                      >
                        <CircleCheck className="w-3.5 h-3.5" />
                        <span>{allowMultipleRegistration ? 'Linked to Existing Customer ✓' : 'Link New Wedding Request to This Customer'}</span>
                      </button>
                      <Link
                        to={`/wedding-crm/customers/${existingCustomerInfo.id}`}
                        target="_blank"
                        className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E1DDD3] hover:bg-[#EDF3F0] text-[#123C35] font-semibold text-xs flex items-center gap-1"
                      >
                        <span>View Existing Customer</span>
                      </Link>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
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
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-medium text-[#17201D] placeholder-[#9A858D] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-medium text-[#17201D] placeholder-[#9A858D] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: STORE DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E1DDD3]">
                <MapPin className="w-4 h-4 text-[#C9A45C]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#123C35]">
                  Section 2 — Store & Ingestion Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Store Location *
                  </label>
                  {!canSwitch && displayLocations.length <= 1 ? (
                    <div className="relative">
                      <div className="flex items-center justify-between w-full px-3.5 py-2.5 bg-[#EDF3F0] border border-[#E1DDD3] rounded-xl font-bold text-xs text-[#123C35] shadow-2xs select-none">
                        <span className="flex items-center gap-2 truncate">
                          <MapPin className="w-3.5 h-3.5 text-[#C9A45C] shrink-0" />
                          <span className="truncate">
                            📍 {displayLocations[0]?.name || activeLocation.name || 'Store'}
                            <span className="text-[#65716C] font-normal ml-1">
                              ({displayLocations[0]?.storeName || 'BSC Textiles'})
                            </span>
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#E1DDD3] text-[10px] text-[#123C35] font-black shrink-0 shadow-2xs">
                          <Lock className="w-3 h-3 text-[#C9A45C]" />
                          <span>Assigned Store</span>
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-[#65716C] mt-1">
                        Your account is strictly scoped to {displayLocations[0]?.name || activeLocation.name || 'this showroom'}.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <select
                        value={form.location_id || effectiveLocationId}
                        onChange={(e) => handleChange('location_id', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-bold text-xs text-[#17201D] focus:outline-none focus:border-[#C9A45C] shadow-2xs"
                      >
                        <option value="">-- Choose Store Location --</option>
                        {displayLocations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            📍 {loc.name} ({loc.storeName || 'BSC Textiles'})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] font-semibold text-[#65716C] mt-1">
                        Showing accessible store locations only.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Registration Date
                  </label>
                  <input
                    type="date"
                    value={form.registration_date}
                    onChange={(e) => handleChange('registration_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-medium text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Lead Source
                  </label>
                  <select
                    value={form.lead_source}
                    onChange={(e) => handleChange('lead_source', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-medium text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                  >
                    <option value="In-store Walkin">In-store Walkin</option>
                    <option value="Referral by Friend/Family">Referral by Friend/Family</option>
                    <option value="Social Media (Instagram/FB)">Social Media (Instagram/FB)</option>
                    <option value="Wedding Fair / Exhibition">Wedding Fair / Exhibition</option>
                    <option value="Phone Inquiry">Phone Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    How Did Customer Find Us?
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hoarding / Relative referral"
                    value={form.discovery_channel}
                    onChange={(e) => handleChange('discovery_channel', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-medium text-[#17201D] placeholder-[#9A858D] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: WEDDING DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E1DDD3]">
                <Heart className="w-4 h-4 text-[#C9A45C]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#123C35]">
                  Section 3 — Wedding & Shopping Timeline
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Expected Shopping Date
                  </label>
                  <input
                    type="date"
                    value={form.expected_shopping_date}
                    onChange={(e) => handleChange('expected_shopping_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-semibold text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Shopping Category
                  </label>
                  <select
                    value={form.preferred_shopping_category}
                    onChange={(e) => handleChange('preferred_shopping_category', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-semibold text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 4: REQUIREMENTS & BUDGET */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E1DDD3]">
                <ShoppingBag className="w-4 h-4 text-[#C9A45C]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#123C35]">
                  Section 4 — Shopping Requirements & Budget
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Budget Range
                  </label>
                  <select
                    value={form.budget}
                    onChange={(e) => handleChange('budget', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-semibold text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                  >
                    {BUDGET_RANGES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Customer Preferences (Colors, Fabrics, Styles)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Royal Blue & Crimson red Kanjeevaram pure silk"
                    value={form.customer_preferences}
                    onChange={(e) => handleChange('customer_preferences', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-medium text-[#17201D] placeholder-[#9A858D] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Special Requirements & Internal Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Special requests, VIP family notes, specific stylist requested..."
                    value={form.customer_notes}
                    onChange={(e) => handleChange('customer_notes', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-medium text-[#17201D] placeholder-[#9A858D] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 5: FOLLOW-UP & TELECALLER */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#E1DDD3]">
                <Clock className="w-4 h-4 text-[#C9A45C]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#123C35]">
                  Section 5 — Follow-up & Telecaller Assignment
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Preferred Call Time
                  </label>
                  <select
                    value={form.preferred_call_time}
                    onChange={(e) => handleChange('preferred_call_time', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-medium text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                  >
                    {CALL_TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Initial Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={form.follow_up_date}
                    onChange={(e) => handleChange('follow_up_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-semibold text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Assign Telecaller
                  </label>
                  <select
                    value={form.assigned_telecaller}
                    onChange={(e) => handleChange('assigned_telecaller', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-semibold text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
                  >
                    <option value="">-- Select Telecaller --</option>
                    {(Array.isArray(telecallers) ? telecallers : []).map((t: any) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.full_name || t.name || t.username} — {t.employee_id || `EMP-${t.id}`} ({t.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#65716C] mb-1">
                    Priority Level
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => handleChange('priority', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F7F5F0] border border-[#E1DDD3] rounded-xl font-semibold text-[#17201D] focus:outline-none focus:border-[#C9A45C]"
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#E1DDD3]">
              <Link
                to="/wedding-crm/customers"
                className="text-xs font-semibold text-[#65716C] hover:text-[#123C35] transition-colors"
              >
                Cancel and discard
              </Link>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit('register')}
                  className="px-5 py-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#EDF3F0] border border-[#E1DDD3] font-semibold text-xs text-[#123C35] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-[#E1DDD3] border-t-[#123C35] rounded-full animate-spin" />}
                  {saving ? 'Saving...' : 'Save to Register'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit('desk')}
                  className="px-5 py-2.5 rounded-xl bg-[#EDF3F0] hover:bg-[#D89AA3]/30 border border-[#E1DDD3] font-semibold text-xs text-[#123C35] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-[#E1DDD3] border-t-[#C9A45C] rounded-full animate-spin" />}
                  {saving ? 'Saving...' : 'Save & Assign to Desk'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit('detail')}
                  className="px-6 py-2.5 rounded-xl bg-[#123C35] hover:bg-[#082821] text-white font-semibold text-xs shadow-xs border border-[#C9A45C]/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-[#E4CB92]/30 border-t-[#E4CB92] rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 text-[#E4CB92]" />
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
