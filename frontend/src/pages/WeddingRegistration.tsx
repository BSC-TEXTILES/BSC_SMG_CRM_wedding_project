import React, { useState, useEffect } from 'react';
import { API } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import {
  User, Phone, Mail, MapPin, Calendar, Heart,
  ShoppingBag, Building2, CircleCheck,
  ArrowRight, ArrowLeft, Star, Clock, DollarSign,
  CreditCard, Sparkles, Building, Home, Package,
  Search, X, ChevronDown, Check, CircleAlert, Loader2
} from 'lucide-react';

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const WEDDING_TYPES = ['Hindu Wedding', 'Muslim Wedding', 'Christian Wedding', 'Jain Wedding', 'Sikh Wedding', 'Other'];
const DATE_FLEXIBILITY = ['Fixed Date', 'Flexible Date', 'Not Decided'];
const WEDDING_FUNCTIONS = [
  { id: 'engagement', label: 'Engagement' },
  { id: 'haldi', label: 'Haldi' },
  { id: 'mehendi', label: 'Mehendi' },
  { id: 'sangeet', label: 'Sangeet' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'reception', label: 'Reception' },
  { id: 'other', label: 'Other' }
];
const BUDGET_RANGES = [
  'Below ₹25,000',
  '₹25,000 – ₹50,000',
  '₹50,000 – ₹1,00,000',
  '₹1,00,000 – ₹2,00,000',
  '₹2,00,000 – ₹5,00,000',
  'Above ₹5,00,000',
  'Not Decided'
];
const SHOPPING_CATEGORIES = [
  { category: 'Women', items: ['Silk Sarees', 'Wedding Sarees', 'Designer Sarees', 'Reception Sarees', 'Party Wear', 'Ladies Wear', 'Kids Wear'] },
  { category: 'Men', items: ['Suit', 'Sherwani', 'Kurta', 'Shirt', 'Trousers', "Men's Traditional Wear"] },
  { category: 'Family', items: ['Family Shopping', "Bride's Family", "Groom's Family", 'Relatives', 'Kids'] },
];
const SHOPPING_TIMES = ['Morning', 'Afternoon', 'Evening', 'Flexible'];
const CONTACT_METHODS = ['Phone Call', 'WhatsApp', 'SMS', 'Email'];
const FOLLOWUP_TIMES = ['9 AM – 12 PM', '12 PM – 3 PM', '3 PM – 6 PM', '6 PM – 9 PM', 'Any Time'];
const EXISTING_CUSTOMER = ['Yes', 'No'];

const initialForm = {
  // Step 1: Store Location
  location_id: '',
  // Step 2: Customer Details
  customer_name: '',
  mobile: '',
  alternate_mobile: '',
  email: '',
  gender: '',
  age: '',
  address: '',
  area: '',
  city: '',
  pincode: '',
  // Step 3: Wedding Details
  wedding_date: '',
  wedding_date_flexibility: '',
  wedding_venue: '',
  wedding_city: '',
  wedding_type: '',
  wedding_functions: [] as string[],
  guest_count: '',
  family_size: '',
  // Step 4: Bride & Groom Details
  bride_name: '',
  bride_age: '',
  bride_contact: '',
  bride_shopping_required: true,
  groom_name: '',
  groom_age: '',
  groom_contact: '',
  groom_shopping_required: true,
  // Step 5: Shopping Requirements
  shopping_requirements: {} as Record<string, string[]>,
  budget_range: '',
  // Step 6: Visit & Follow-up Preferences
  preferred_shopping_date: '',
  preferred_shopping_time: '',
  expected_visitors: '',
  existing_customer: '',
  existing_customer_id: '',
  previous_store: '',
  preferred_contact_method: '',
  preferred_followup_time: '',
  // Step 7: Additional Information
  additional_notes: '',
  // Step 8: Consent
  consent: false
};

export default function WeddingRegistrationPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Submitting Registration...');
  const [successRegId, setSuccessRegId] = useState('');
  const [successTrackId, setSuccessTrackId] = useState('');
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [dupWarn, setDupWarn] = useState('');
  const [locations, setLocations] = useState<Array<{
    id: number;
    location_name: string;
    location_code: string;
    store_name?: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    status?: string | null;
  }>>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState('');

  const loadLocations = async () => {
    setLocationsLoading(true);
    setLocationsError('');
    try {
      const res = await API.getPublicLocations();
      const locList = Array.isArray(res?.locations)
        ? res.locations
        : (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
      if (locList && locList.length > 0) {
        const active = locList.filter((l: any) => !l.status || l.status.toLowerCase() === 'active');
        setLocations(active);
      } else {
        setLocations([]);
      }
    } catch (err: any) {
      console.error('Failed to load locations:', err);
      setLocationsError('Unable to load store locations. Please try again.');
    } finally {
      setLocationsLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNum === 1) {
      if (!form.location_id) newErrors.location_id = 'Please select a BSC store location';
    }
    else if (stepNum === 2) {
      if (!form.customer_name?.trim() || form.customer_name.trim().length < 2) newErrors.customer_name = 'Full name is required (minimum 2 characters)';
      if (!form.mobile?.trim()) newErrors.mobile = 'Mobile number is required';
      else if (!/^[6-9]\d{9}$/.test(form.mobile.replace(/\D/g, ''))) newErrors.mobile = 'Enter a valid 10-digit Indian mobile number';
      if (form.alternate_mobile && !/^[6-9]\d{9}$/.test(form.alternate_mobile.replace(/\D/g, ''))) newErrors.alternate_mobile = 'Enter a valid 10-digit mobile number';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Enter a valid email address';
    }
    else if (stepNum === 3) {
      if (!form.wedding_date) newErrors.wedding_date = 'Wedding date is required';
      else {
        const weddingDate = new Date(form.wedding_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (weddingDate < today) newErrors.wedding_date = 'Wedding date cannot be in the past';
      }
      if (!form.wedding_date_flexibility) newErrors.wedding_date_flexibility = 'Please select wedding date flexibility';
      if (!form.wedding_functions?.length) newErrors.wedding_functions = 'Select at least one wedding function';
    }
    else if (stepNum === 4) {
      const hasSelections = form.shopping_requirements && Object.values(form.shopping_requirements).some(arr => arr.length > 0);
      if (!hasSelections) newErrors.shopping_requirements = 'Select at least one shopping requirement';
    }
    else if (stepNum === 5) {
      if (!form.preferred_shopping_date) newErrors.preferred_shopping_date = 'Preferred shopping date is required';
      else {
        const shopDate = new Date(form.preferred_shopping_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (shopDate < today) newErrors.preferred_shopping_date = 'Preferred shopping date cannot be in the past';
      }
      if (!form.preferred_shopping_time) newErrors.preferred_shopping_time = 'Please select preferred shopping time';
      if (!form.preferred_contact_method) newErrors.preferred_contact_method = 'Please select preferred contact method';
      if (!form.preferred_followup_time) newErrors.preferred_followup_time = 'Please select preferred follow-up time';
      if (form.existing_customer === 'Yes') {
        if (!form.existing_customer_id?.trim()) newErrors.existing_customer_id = 'Please enter existing Emp ID';
      }
    }
    else if (stepNum === 6) {
      // Optional step
    }
    else if (stepNum === 7) {
      if (!form.consent) newErrors.consent = 'You must agree to the consent before submitting';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleMultiSelect = (category: string, item: string) => {
    setForm(prev => {
      const current = prev.shopping_requirements[category] || [];
      const updated = current.includes(item)
        ? current.filter(i => i !== item)
        : [...current, item];
      return { ...prev, shopping_requirements: { ...prev.shopping_requirements, [category]: updated } };
    });
  };

  const handleWeddingFunctionToggle = (funcId: string) => {
    setForm(prev => {
      const current = prev.wedding_functions || [];
      const updated = current.includes(funcId)
        ? current.filter(f => f !== funcId)
        : [...current, funcId];
      return { ...prev, wedding_functions: updated };
    });
  };

  const checkDuplicate = async () => {
    if (!form.mobile || form.mobile.length < 10) {
      setDupWarn('');
      return;
    }
    try {
      const res = await API.checkWeddingRegistrationDuplicate(form.mobile);
      if (res && res.exists) {
        setDupWarn(`ℹ️ We found an existing wedding registration for this number (${res.existingRegistration?.customer_name || 'Customer'} — ${res.existingRegistration?.registration_id}). Submitting will register this new wedding under your account.`);
      } else {
        setDupWarn('');
      }
    } catch (e) {
      setDupWarn('');
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step === 1) checkDuplicate();
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else {
      showToast('Please fill all required fields correctly', 'error');
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (!validateStep(7)) {
      showToast('Please fix the errors before submitting', 'error');
      return;
    }

    setLoading(true);
    setLoadingText('Submitting Registration...');

    try {
      const payload = {
        ...form,
        mobile: `+91${form.mobile.replace(/\D/g, '')}`,
        alternate_mobile: form.alternate_mobile ? `+91${form.alternate_mobile.replace(/\D/g, '')}` : null,
        age: form.age ? parseInt(form.age, 10) : null,
        guest_count: form.guest_count ? parseInt(form.guest_count, 10) : null,
        family_size: form.family_size ? parseInt(form.family_size, 10) : null,
        bride_age: form.bride_age ? parseInt(form.bride_age, 10) : null,
        groom_age: form.groom_age ? parseInt(form.groom_age, 10) : null,
        expected_visitors: form.expected_visitors ? parseInt(form.expected_visitors, 10) : null,
        force_create_new_registration: true,
        allow_duplicate: true
      };

      const res = await API.createWeddingRegistration({ data: payload });

      if (res && res.success) {
        const reg = res.data?.registration || res.registration || {};
        const regId = reg.registration_id || res.data?.registration_id || res.registration_id || res.data?.customer_id || res.customer_id || '';
        const trackId = reg.tracking_id || res.data?.tracking_id || res.tracking_id || regId;
        setSuccessRegId(regId);
        setSuccessTrackId(trackId);
        showToast('Wedding registration submitted successfully.', 'success');
        setRegistrationData({
          registration_id: regId,
          tracking_id: trackId,
          customer_name: reg.customer_name || form.customer_name,
          mobile: reg.mobile || `+91${form.mobile}`,
          location_name: reg.location_name || getSelectedStore()?.location_name || '',
          location_code: reg.location_code || getSelectedStore()?.location_code || '',
          store_name: reg.store_name || getSelectedStore()?.store_name || '',
          wedding_date: reg.wedding_date || form.wedding_date,
          preferred_shopping_date: reg.preferred_shopping_date || form.preferred_shopping_date,
          preferred_contact_method: reg.preferred_contact_method || form.preferred_contact_method,
          preferred_followup_time: reg.preferred_followup_time || form.preferred_followup_time,
          status: reg.status || 'New',
          submitted_at: reg.submitted_at || new Date().toISOString()
        });
        setStep(8);
        window.scrollTo(0, 0);

        setTimeout(() => {
          setStep(9);
        }, 1500);
      } else {
        const errMsg = res?.message || res?.error || 'Failed to submit registration';
        showToast(errMsg, 'error');
      }
    } catch (err: any) {
      console.error('[WeddingRegistration Submit Error]', err);
      const status = err?.status || err?.statusCode;
      const fieldErrors = err?.errors;
      if (status === 409) {
        showToast(err?.message || 'A registration with this mobile number already exists at this store. Please contact the store directly.', 'error');
      } else if (status === 400 && Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        showToast(fieldErrors[0], 'error');
      } else {
        const errMsg = err?.message || 'Error submitting registration. Please try again.';
        showToast(errMsg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setErrors({});
    setStep(1);
    setSuccessRegId('');
    setSuccessTrackId('');
    setRegistrationData(null);
    setDupWarn('');
    window.scrollTo(0, 0);
  };

  const getSelectedStore = () => {
    if (!form.location_id) return null;
    return locations.find(l => l.id === parseInt(form.location_id)) || null;
  };

  const steps = [
    { num: 1, label: 'Store Location', short: 'Location' },
    { num: 2, label: 'Customer Details', short: 'Customer' },
    { num: 3, label: 'Wedding Details', short: 'Wedding' },
    { num: 4, label: 'Shopping Needs', short: 'Shopping' },
    { num: 5, label: 'Visit & Follow-up', short: 'Follow-up' },
    { num: 6, label: 'Additional Info', short: 'Notes' },
    { num: 7, label: 'Review & Submit', short: 'Review' }
  ];

  return (
    <div className="min-h-screen bg-background pb-12">
      <ToastContainer />

      {/* Header */}
      <header className="bg-primary p-4 sm:p-5 text-white shadow-lg sticky top-0 z-30 border-b border-accent/30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="BSC Logo" className="w-11 h-11 object-contain rounded-xl bg-white p-1 shadow-md border border-black/20" />
            <div>
              <h1 className="font-extrabold text-base sm:text-lg leading-tight tracking-tight">BSC Wedding Registration</h1>
              <div className="text-[10px] text-accent font-bold uppercase tracking-widest mt-0.5">
                Register your wedding shopping requirements with BSC Textiles
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-bold bg-black/10 px-3 py-1.5 rounded-full border border-black/10">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>Official Wedding Portal</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Progress Stepper */}
        {step <= 7 && (
          <div className="card-glass p-4 text-xs font-extrabold space-y-2">
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {steps.map((s, idx) => (
                <div key={s.num} className={`flex items-center gap-2 transition-all ${idx < steps.length - 1 ? 'pr-4' : ''}`}>
                  <div className={`flex items-center gap-1.5 ${step === s.num ? 'text-primary' : step > s.num ? 'text-emerald-700' : 'text-[#6B5D50]'}`}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${step === s.num ? 'bg-primary text-white shadow-md ring-2 ring-accent' : step > s.num ? 'bg-emerald-600 text-white' : 'bg-background border border-accent-soft'}`}>
                      {step > s.num ? '✓' : s.num}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{s.short}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`h-1.5 flex-1 bg-accent-soft rounded-full overflow-hidden hidden sm:block ${step > s.num + 1 ? 'bg-gradient-to-r from-primary to-accent' : ''}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="h-1.5 w-full bg-accent-soft rounded-full overflow-hidden sm:hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
                style={{ width: `${(step - 1) / 6 * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* STEP 1: STORE LOCATION */}
        {step === 1 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 1: Select Your BSC Store Location</h2>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-primary font-medium">Choose your preferred BSC Textiles store for wedding shopping</p>

              {locationsLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 bg-background/50 rounded-2xl border border-accent-soft">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  <p className="text-sm font-bold text-primary">Loading store locations...</p>
                </div>
              ) : locationsError ? (
                <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center space-y-3">
                  <CircleAlert className="w-8 h-8 text-red-600 mx-auto" />
                  <p className="text-sm font-bold text-red-900">{locationsError}</p>
                  <button
                    type="button"
                    onClick={loadLocations}
                    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <span>Retry</span>
                  </button>
                </div>
              ) : locations.length === 0 ? (
                <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-2">
                  <CircleAlert className="w-8 h-8 text-amber-600 mx-auto" />
                  <p className="text-sm font-bold text-amber-900">No active BSC store locations are currently available.</p>
                  <p className="text-xs text-amber-700">Please check back later or contact customer support.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {locations.map(loc => {
                    const isSelected = form.location_id === String(loc.id);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleChange('location_id', String(loc.id))}
                        className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-lg shadow-primary/10'
                            : 'border-accent-soft bg-background hover:border-primary/50 hover:bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`p-2 rounded-xl transition-colors ${isSelected ? 'bg-primary text-white' : 'bg-white text-accent border border-accent-soft'}`}>
                                <Building2 className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className="font-extrabold text-base text-primary leading-snug">
                                  {loc.location_name}
                                </h3>
                                <p className="text-[10.5px] font-bold text-accent uppercase tracking-wider">
                                  {loc.store_name || 'BSC Textiles Pvt Ltd'} {loc.location_code ? `(${loc.location_code})` : ''}
                                </p>
                              </div>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-green-100 text-green-800 border border-green-200">
                              {loc.status || 'Active'}
                            </span>
                          </div>

                          {loc.address && (
                            <div className="mt-3 flex items-start gap-1.5 text-xs text-primary/85 font-medium leading-relaxed">
                              <MapPin className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                              <p className="line-clamp-3">{loc.address}</p>
                            </div>
                          )}

                          {loc.phone && (
                            <p className="text-[11px] text-primary/75 font-semibold mt-2.5 flex items-center gap-1.5">
                              <span>📞</span>
                              <span>{loc.phone}</span>
                            </p>
                          )}
                          {loc.email && (
                            <p className="text-[11px] text-primary/65 font-medium mt-1 flex items-center gap-1.5">
                              <span>✉️</span>
                              <span className="truncate">{loc.email}</span>
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-accent-soft/70 flex items-center justify-between">
                          <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-primary/60'}`}>
                            {isSelected ? 'Store Selected' : 'Click to Select'}
                          </span>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-primary border-primary text-white shadow-xs'
                              : 'border-accent-soft bg-white text-transparent'
                          }`}>
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {errors.location_id && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <CircleAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{errors.location_id}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-accent-soft">
              <button
                type="button"
                onClick={handleNext}
                disabled={locationsLoading || locations.length === 0}
                className="btn-primary flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Continue to Customer Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CUSTOMER DETAILS */}
        {step === 2 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 2: Customer Personal Details</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={e => handleChange('customer_name', e.target.value.trim())}
                    placeholder="Enter full name as per Aadhaar"
                    className={`input-modern ${errors.customer_name ? 'border-red-400' : ''}`}
                  />
                  {errors.customer_name && <p className="text-red-500 text-xs mt-1">{errors.customer_name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Mobile Number <span className="text-red-500">*</span></label>
                  <div className="flex">
                    <span className="p-2.5 bg-accent-soft/50 border border-r-0 border-accent-soft rounded-l-xl font-extrabold text-xs text-[#5D4E42] flex items-center">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={form.mobile}
                      onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); handleChange('mobile', v); }}
                      placeholder="10-digit mobile number"
                      className={`input-modern rounded-l-none ${errors.mobile ? 'border-red-400' : ''}`}
                      onBlur={checkDuplicate}
                    />
                  </div>
                  {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
                  {dupWarn && <p className="text-amber-700 text-xs mt-1 bg-amber-50 p-2 rounded">{dupWarn}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Alternate Mobile</label>
                  <div className="flex">
                    <span className="p-2.5 bg-accent-soft/50 border border-r-0 border-accent-soft rounded-l-xl font-extrabold text-xs text-[#5D4E42] flex items-center">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={form.alternate_mobile}
                      onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); handleChange('alternate_mobile', v); }}
                      placeholder="Optional 10-digit number"
                      className={`input-modern rounded-l-none ${errors.alternate_mobile ? 'border-red-400' : ''}`}
                    />
                  </div>
                  {errors.alternate_mobile && <p className="text-red-500 text-xs mt-1">{errors.alternate_mobile}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => handleChange('email', e.target.value)}
                    placeholder="name@example.com"
                    className={`input-modern ${errors.email ? 'border-red-400' : ''}`}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Continue to Wedding Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: WEDDING DETAILS */}
        {step === 3 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 3: Wedding Details</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Wedding Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.wedding_date}
                    onChange={e => handleChange('wedding_date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={`input-modern ${errors.wedding_date ? 'border-red-400' : ''}`}
                  />
                  {errors.wedding_date && <p className="text-red-500 text-xs mt-1">{errors.wedding_date}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Date Flexibility <span className="text-red-500">*</span></label>
                  <select value={form.wedding_date_flexibility} onChange={e => handleChange('wedding_date_flexibility', e.target.value)} className={`select-modern ${errors.wedding_date_flexibility ? 'border-red-400' : ''}`}>
                    <option value="">Select flexibility</option>
                    {DATE_FLEXIBILITY.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.wedding_date_flexibility && <p className="text-red-500 text-xs mt-1">{errors.wedding_date_flexibility}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-2">Wedding Functions <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {WEDDING_FUNCTIONS.map(f => (
                    <label key={f.id} className="flex items-center gap-1.5 bg-background border border-accent-soft px-3.5 py-2 rounded-xl cursor-pointer font-semibold text-xs text-primary hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={form.wedding_functions.includes(f.id)}
                        onChange={() => handleWeddingFunctionToggle(f.id)}
                        className="rounded accent-primary"
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
                {errors.wedding_functions && <p className="text-red-500 text-xs mt-1">{errors.wedding_functions}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Continue to Shopping Requirements</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SHOPPING REQUIREMENTS */}
        {step === 4 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 5: Wedding Shopping Requirements</h2>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-primary">Select all categories you plan to shop for (multiple selection allowed)</p>

              {SHOPPING_CATEGORIES.map(cat => (
                <div key={cat.category} className="p-4 rounded-2xl border border-accent-soft bg-background/50">
                  <h4 className="font-bold text-sm text-primary mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4 text-accent" />
                    {cat.category}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {cat.items.map(item => (
                      <label key={item} className="flex items-center gap-1.5 bg-white border border-accent-soft px-3 py-2 rounded-xl cursor-pointer font-medium text-xs text-primary hover:bg-primary hover:text-white hover:border-primary transition-colors">
                        <input
                          type="checkbox"
                          checked={form.shopping_requirements[cat.category]?.includes(item) || false}
                          onChange={() => handleMultiSelect(cat.category, item)}
                          className="rounded accent-primary"
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {errors.shopping_requirements && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold flex items-center gap-2">
                  <CircleAlert className="w-4 h-4" />
                  {errors.shopping_requirements}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Continue to Visit & Follow-up</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: VISIT & FOLLOW-UP PREFERENCES */}
        {step === 5 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 6: Preferred Visit & Follow-up</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Preferred Shopping Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.preferred_shopping_date}
                    onChange={e => handleChange('preferred_shopping_date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={`input-modern ${errors.preferred_shopping_date ? 'border-red-400' : ''}`}
                  />
                  {errors.preferred_shopping_date && <p className="text-red-500 text-xs mt-1">{errors.preferred_shopping_date}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Preferred Shopping Time <span className="text-red-500">*</span></label>
                  <select value={form.preferred_shopping_time} onChange={e => handleChange('preferred_shopping_time', e.target.value)} className={`select-modern ${errors.preferred_shopping_time ? 'border-red-400' : ''}`}>
                    <option value="">Select time</option>
                    {SHOPPING_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.preferred_shopping_time && <p className="text-red-500 text-xs mt-1">{errors.preferred_shopping_time}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-primary mb-1">Are you an existing BSC emp? <span className="text-red-500">*</span></label>
                  <select value={form.existing_customer} onChange={e => handleChange('existing_customer', e.target.value)} className={`select-modern ${errors.existing_customer ? 'border-red-400' : ''}`}>
                    <option value="">Select</option>
                    {EXISTING_CUSTOMER.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                  {errors.existing_customer && <p className="text-red-500 text-xs mt-1">{errors.existing_customer}</p>}
                </div>

                {form.existing_customer === 'Yes' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-primary mb-1">Existing Emp ID <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={form.existing_customer_id}
                        onChange={e => handleChange('existing_customer_id', e.target.value)}
                        placeholder="Your BSC emp ID"
                        className={`input-modern ${errors.existing_customer_id ? 'border-red-400' : ''}`}
                      />
                      {errors.existing_customer_id && <p className="text-red-500 text-xs mt-1">{errors.existing_customer_id}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-primary mb-1">Previous BSC Store</label>
                      <input
                        type="text"
                        value={form.previous_store}
                        onChange={e => handleChange('previous_store', e.target.value)}
                        placeholder="Store where you previously shopped"
                        className="input-modern"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-4 border-t border-accent-soft">
                <h4 className="font-bold text-sm text-primary mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-accent" />
                  Communication Preferences
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-primary mb-1">Preferred Contact Method <span className="text-red-500">*</span></label>
                    <select value={form.preferred_contact_method} onChange={e => handleChange('preferred_contact_method', e.target.value)} className={`select-modern ${errors.preferred_contact_method ? 'border-red-400' : ''}`}>
                      <option value="">Select method</option>
                      {CONTACT_METHODS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {errors.preferred_contact_method && <p className="text-red-500 text-xs mt-1">{errors.preferred_contact_method}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-primary mb-1">Preferred Follow-up Time <span className="text-red-500">*</span></label>
                    <select value={form.preferred_followup_time} onChange={e => handleChange('preferred_followup_time', e.target.value)} className={`select-modern ${errors.preferred_followup_time ? 'border-red-400' : ''}`}>
                      <option value="">Select time slot</option>
                      {FOLLOWUP_TIMES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    {errors.preferred_followup_time && <p className="text-red-500 text-xs mt-1">{errors.preferred_followup_time}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Continue to Additional Information</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: ADDITIONAL INFORMATION */}
        {step === 6 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 7: Additional Requirements</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-primary mb-1">Additional Requirements / Notes</label>
                <textarea
                  rows={5}
                  value={form.additional_notes}
                  onChange={e => handleChange('additional_notes', e.target.value)}
                  placeholder="Tell us about your wedding shopping requirements, preferred products, family requirements, special requests, etc."
                  className="textarea-modern"
                  maxLength={1000}
                />
                <p className="text-xs text-primary/50 mt-1 text-right">{form.additional_notes.length}/1000 characters</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button type="button" onClick={handleNext} className="btn-primary flex items-center gap-2 shadow-md">
                <span>Review & Submit</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 8: REVIEW & SUBMIT */}
        {step === 7 && (
          <div className="card-glass p-6 sm:p-8 space-y-6 animate-fade-in shadow-xl">
            <div className="border-b border-accent-soft pb-3 flex items-center gap-2">
              <CircleCheck className="w-5 h-5 text-accent" />
              <h2 className="text-sm font-extrabold uppercase text-primary tracking-wider">Step 8: Review & Submit</h2>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-primary">Please review all details before submitting. You can edit any section by clicking the Edit button.</p>

              {/* Store Info */}
              {(() => {
                const store = getSelectedStore();
                return store && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-accent" />
                      <span>Selected Store Location</span>
                    </h4>
                    <div className="text-xs text-primary space-y-1">
                      <p className="font-extrabold text-sm text-primary">
                        {store.location_name} {store.location_code ? `(${store.location_code})` : ''}
                      </p>
                      <p className="font-semibold text-accent">{store.store_name || 'BSC Textiles Pvt Ltd'}</p>
                      {store.address && <p className="text-primary/80">{store.address}</p>}
                      {store.phone && <p className="text-primary/70">📞 {store.phone}</p>}
                      {store.email && <p className="text-primary/70">✉️ {store.email}</p>}
                    </div>
                  </div>
                );
              })()}

              {/* Customer Details */}
              <div className="p-4 rounded-xl bg-background border border-accent-soft">
                <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer Details
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-primary">
                  <p><strong>Name:</strong> {form.customer_name}</p>
                  <p><strong>Mobile:</strong> +91 {form.mobile}</p>
                  {form.alternate_mobile && <p><strong>Alt Mobile:</strong> +91 {form.alternate_mobile}</p>}
                  <p><strong>Email:</strong> {form.email || '—'}</p>
                  {form.gender && <p><strong>Gender:</strong> {form.gender}</p>}
                  {form.age && <p><strong>Age:</strong> {form.age}</p>}
                  {(form.address || form.area || form.city) && (
                    <p className="col-span-2 sm:col-span-3"><strong>Address:</strong> {[form.address, form.area, form.city, form.pincode].filter(Boolean).join(', ')}</p>
                  )}
                </div>
              </div>

              {/* Wedding Details */}
              <div className="p-4 rounded-xl bg-background border border-accent-soft">
                <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Wedding Details
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-primary">
                  <p><strong>Wedding Date:</strong> {form.wedding_date ? new Date(form.wedding_date).toLocaleDateString('en-IN') : '—'}</p>
                  <p><strong>Flexibility:</strong> {form.wedding_date_flexibility || '—'}</p>
                  {form.wedding_type && <p><strong>Type:</strong> {form.wedding_type}</p>}
                  {form.wedding_venue && <p><strong>Venue:</strong> {form.wedding_venue}</p>}
                  {form.wedding_city && <p><strong>Wedding City:</strong> {form.wedding_city}</p>}
                  {form.guest_count && <p><strong>Guests:</strong> {form.guest_count}</p>}
                  {form.family_size && <p><strong>Family Size:</strong> {form.family_size}</p>}
                  {form.wedding_functions.length > 0 && (
                    <p className="col-span-2 sm:col-span-3"><strong>Functions:</strong> {form.wedding_functions.map(f => WEDDING_FUNCTIONS.find(x => x.id === f)?.label).filter(Boolean).join(', ')}</p>
                  )}
                </div>
              </div>

              {/* Bride & Groom Details */}
              {(form.bride_name || form.groom_name) && (
                <div className="p-4 rounded-xl bg-background border border-accent-soft">
                  <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Bride & Groom Details
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-primary">
                    {form.bride_name && <p><strong>Bride:</strong> {form.bride_name}{form.bride_age ? ` (${form.bride_age} yrs)` : ''}</p>}
                    {form.bride_contact && <p><strong>Bride Contact:</strong> {form.bride_contact}</p>}
                    {form.bride_name && <p><strong>Bride Shopping:</strong> {form.bride_shopping_required ? 'Yes' : 'No'}</p>}
                    {form.groom_name && <p><strong>Groom:</strong> {form.groom_name}{form.groom_age ? ` (${form.groom_age} yrs)` : ''}</p>}
                    {form.groom_contact && <p><strong>Groom Contact:</strong> {form.groom_contact}</p>}
                    {form.groom_name && <p><strong>Groom Shopping:</strong> {form.groom_shopping_required ? 'Yes' : 'No'}</p>}
                  </div>
                </div>
              )}

              {/* Shopping Requirements */}
              <div className="p-4 rounded-xl bg-background border border-accent-soft">
                <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  Shopping Requirements
                </h4>
                <div className="text-xs text-primary space-y-1">
                  {Object.entries(form.shopping_requirements).map(([cat, items]) => (
                    items.length > 0 && (
                      <p key={cat}><strong>{cat}:</strong> {items.join(', ')}</p>
                    )
                  ))}
                  {Object.values(form.shopping_requirements).every(items => items.length === 0) && (
                    <p className="text-primary/50 italic">No specific items selected</p>
                  )}
                  {form.budget_range && <p className="mt-1"><strong>Budget:</strong> {form.budget_range}</p>}
                </div>
              </div>

              {/* Visit & Follow-up */}
              <div className="p-4 rounded-xl bg-background border border-accent-soft">
                <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Visit & Follow-up
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-primary">
                  <p><strong>Preferred Date:</strong> {form.preferred_shopping_date ? new Date(form.preferred_shopping_date).toLocaleDateString('en-IN') : '—'}</p>
                  <p><strong>Preferred Time:</strong> {form.preferred_shopping_time || '—'}</p>
                  <p><strong>Contact Method:</strong> {form.preferred_contact_method || '—'}</p>
                  <p><strong>Follow-up Time:</strong> {form.preferred_followup_time || '—'}</p>
                  {form.expected_visitors && <p><strong>Expected Visitors:</strong> {form.expected_visitors}</p>}
                  {form.existing_customer && <p><strong>Existing Customer:</strong> {form.existing_customer}</p>}
                  {form.previous_store && <p><strong>Previous Store:</strong> {form.previous_store}</p>}
                </div>
              </div>

              {/* Additional Notes */}
              {form.additional_notes && (
                <div className="p-4 rounded-xl bg-background border border-accent-soft">
                  <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                    <CircleAlert className="w-4 h-4" />
                    Additional Notes
                  </h4>
                  <p className="text-xs text-primary whitespace-pre-wrap">{form.additional_notes}</p>
                </div>
              )}

              {/* Consent */}
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer text-xs font-semibold text-primary">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={e => handleChange('consent', e.target.checked)}
                    className="mt-0.5 rounded accent-primary"
                  />
                  <span>
                    I confirm that the information provided by me is accurate and I agree
                    to be contacted by BSC Textiles regarding my wedding shopping requirements.
                  </span>
                </label>
                {errors.consent && <p className="text-red-500 text-xs ml-6">{errors.consent}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-accent-soft">
              <button type="button" onClick={handleBack} className="px-4 py-2 rounded-xl border border-accent-soft text-xs font-bold text-primary hover:bg-background flex items-center gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Edit</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="btn-gold flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{loadingText}</span>
                  </>
                ) : (
                  <>
                    <span>Submit Wedding Registration</span>
                    <CircleCheck className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 8: PROCESSING / SENDING EMAIL */}
        {step === 8 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/70 backdrop-blur-md animate-modal-backdrop overflow-y-auto">
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-accent/30 overflow-hidden animate-pop-in">
              <div className="bg-gradient-to-r from-primary to-primary px-6 py-8 text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 border-4 border-accent/40 text-accent flex items-center justify-center mx-auto shadow-lg animate-pulse-ring">
                  <Loader2 className="w-10 h-10 animate-spin" />
                </div>
                <h2 className="text-xl font-black text-accent tracking-tight mt-4 animate-fade-up-step" style={{ animationDelay: '0.2s' }}>
                  Submitting Your Request
                </h2>
                <p className="text-xs text-white/80 font-medium mt-2 animate-fade-up-step" style={{ animationDelay: '0.4s' }}>
                  Saving to database and sending confirmation email with your Tracking ID...
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-xl bg-background border border-accent-soft p-4 text-center animate-fade-up-step">
                  <div className="w-full h-2 bg-accent-soft rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-accent animate-loading-bar" style={{ width: '100%' }} />
                  </div>
                  <p className="text-xs text-primary/60 font-medium mt-2">This usually takes a few seconds</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 9: SUCCESS CONFIRMATION */}
        {step === 9 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/70 backdrop-blur-md animate-modal-backdrop overflow-y-auto">
            {/* Elegant confetti particles */}
            {(() => {
              const colors = ['#D4A58A', '#3D2B1F', '#E8DDD4', '#f59e0b', '#10b981', '#3b82f6'];
              return Array.from({ length: 22 }).map((_, i) => {
                const color = colors[i % colors.length];
                const left = `${(i * 4.5 + 3) % 96}%`;
                const delay = `${(i % 8) * 0.12}s`;
                const duration = `${2.4 + (i % 5) * 0.4}s`;
                const rotation = `${i * 17}deg`;
                return (
                  <span
                    key={i}
                    className="wedding-confetti"
                    style={{
                      left,
                      background: color,
                      animationDelay: delay,
                      animationDuration: duration,
                      transform: `rotate(${rotation})`
                    }}
                  />
                );
              });
            })()}

            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-accent/30 overflow-hidden animate-pop-in">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary to-primary px-6 py-6 text-center">
                <div className="w-18 h-18 rounded-full bg-emerald-100 border-4 border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto shadow-lg animate-check-pop" style={{ width: '72px', height: '72px' }}>
                  <CircleCheck className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-black text-accent tracking-tight mt-3 animate-fade-up-step" style={{ animationDelay: '0.35s' }}>
                  Wedding Registration Submitted Successfully
                </h2>
                <p className="text-xs text-white/80 font-medium mt-2 animate-fade-up-step" style={{ animationDelay: '0.5s' }}>
                  Thank you! Your wedding shopping request has been registered with BSC Textiles.
                </p>
              </div>

              <div className="p-6 space-y-5">
                {/* Registration ID */}
                <div className="rounded-2xl border-2 border-accent/40 bg-amber-50/60 p-4 text-center animate-tracking-highlight">
                  <span className="text-[10px] uppercase font-black text-primary block">Registration ID</span>
                  <span className="text-xl font-mono font-black text-primary tracking-wider break-all mt-1 block">
                    {registrationData?.registration_id || successRegId}
                  </span>
                  <span className="text-[11px] text-primary/60 font-medium block mt-1.5">
                    Keep this ID to track your registration status
                  </span>
                </div>

                {/* Registration Details */}
                <div className="rounded-xl bg-background border border-accent-soft p-4 space-y-3 animate-fade-up-step" style={{ animationDelay: '0.7s' }}>
                  <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                    <CircleCheck className="w-4 h-4 text-accent" />
                    Registration Details
                  </h4>
                  <div className="text-xs text-primary space-y-2.5">
                    <div className="flex justify-between items-center py-1.5 border-b border-accent-soft/50">
                      <span className="text-primary/60 font-medium">Status</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] border border-emerald-200">
                        {registrationData?.status || 'New'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-accent-soft/50">
                      <span className="text-primary/60 font-medium">Customer</span>
                      <strong className="text-primary">{registrationData?.customer_name || form.customer_name}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-accent-soft/50">
                      <span className="text-primary/60 font-medium">Store</span>
                      <strong className="text-primary">{registrationData?.location_name || getSelectedStore()?.location_name || '—'}{registrationData?.location_code ? ` (${registrationData.location_code})` : ''}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-accent-soft/50">
                      <span className="text-primary/60 font-medium">Wedding Date</span>
                      <strong className="text-primary">{registrationData?.wedding_date ? new Date(registrationData.wedding_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-accent-soft/50">
                      <span className="text-primary/60 font-medium">Preferred Shopping Date</span>
                      <strong className="text-primary">{registrationData?.preferred_shopping_date ? new Date(registrationData.preferred_shopping_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-accent-soft/50">
                      <span className="text-primary/60 font-medium">Preferred Contact</span>
                      <strong className="text-primary">{registrationData?.preferred_contact_method || '—'}</strong>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-primary/60 font-medium">Submitted On</span>
                      <strong className="text-primary">{registrationData?.submitted_at ? new Date(registrationData.submitted_at).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</strong>
                    </div>
                  </div>
                </div>

                {/* Message */}
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center animate-fade-up-step" style={{ animationDelay: '0.8s' }}>
                  <p className="text-xs text-blue-900 font-bold">
                    Our BSC Textiles team will contact you regarding your wedding shopping requirements.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2.5 animate-fade-up-step" style={{ animationDelay: '0.9s' }}>
                  <button
                    onClick={() => { navigator.clipboard.writeText(registrationData?.registration_id || successRegId); showToast('Registration ID copied to clipboard!', 'success'); }}
                    className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm hover:bg-primary-hover transition-colors"
                  >
                    Copy Registration ID
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      onClick={() => {
                        const regId = registrationData?.registration_id || successRegId;
                        window.open(`/wedding-crm/registration/${regId}`, '_blank');
                      }}
                      className="py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition-colors"
                    >
                      <Search className="w-3.5 h-3.5" />
                      View Registration
                    </button>
                    <button
                      onClick={() => window.location.href = '/wedding-crm'}
                      className="py-2.5 rounded-xl bg-background border border-accent-soft text-primary text-xs font-black flex items-center justify-center gap-1.5 hover:bg-white transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      Back to Wedding CRM
                    </button>
                    <button
                      onClick={resetForm}
                      className="py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-black flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-colors"
                    >
                      <span className="text-base">+</span>
                      New Registration
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
