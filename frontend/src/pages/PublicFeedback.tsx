import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Star,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Check,
  Store,
  User,
  Mail,
  RotateCcw,
  QrCode,
  Download,
  Copy,
  Maximize2,
  X,
  Receipt,
  Layers,
  Sparkles
} from 'lucide-react';
import { API } from '../services/api';
import { showToast } from '../components/Toast';
import StoreSelectionPanel from '../components/feedback/StoreSelectionPanel';
import {
  CENTRAL_STORE_LOCATIONS,
  resolveStoreLocation,
  CentralStoreLocation
} from '../config/storeLocations';
import './landing/editorial/editorial.css';

// Default structured survey questions matching the 3 stores
const DEFAULT_QUESTIONS = [
  {
    id: 'q1',
    category: 'Overall Experience',
    title: 'How satisfied are you with your overall shopping experience today?',
    options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied']
  },
  {
    id: 'q2',
    category: 'Product Availability',
    title: 'Did you find the products and fabrics you were looking for?',
    options: ['Yes, exactly what I wanted', 'Yes, with assistance', 'Partially', 'No']
  },
  {
    id: 'q3',
    category: 'Collection Quality',
    title: 'How would you rate the quality and variety of our collections?',
    options: ['Excellent', 'Good', 'Average', 'Poor']
  },
  {
    id: 'q4',
    category: 'Staff Service',
    title: 'How would you rate the service and helpfulness of our staff?',
    options: ['Extremely helpful', 'Helpful', 'Average', 'Needs improvement']
  },
  {
    id: 'q5',
    category: 'Recommendation',
    title: 'How likely are you to recommend BSC Textiles to family and friends?',
    options: ['Definitely recommend', 'Probably recommend', 'Neutral', 'Not recommend']
  }
];

export default function PublicFeedback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const qrCodeId = searchParams.get('qr') || '';
  const urlLocation = searchParams.get('location') || searchParams.get('loc') || '';

  // Resolve store from URL parameter (e.g. ?location=BEL) or QR code
  const initialStore = useMemo(() => {
    return resolveStoreLocation(urlLocation || qrCodeId);
  }, [urlLocation, qrCodeId]);

  const [selectedStore, setSelectedStore] = useState<CentralStoreLocation | null>(initialStore);
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form Fields
  const [customerName, setCustomerName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('Sarees & Silk Section');
  const [billNo, setBillNo] = useState<string>('');
  const [overallRating, setOverallRating] = useState<number>(5);
  const [staffRating, setStaffRating] = useState<number>(5);
  const [productRating, setProductRating] = useState<number>(5);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(5);
  const [ambienceRating, setAmbienceRating] = useState<number>(5);

  const [answers, setAnswers] = useState<Record<string, string>>({
    q1: 'Very satisfied',
    q2: 'Yes, exactly what I wanted',
    q3: 'Excellent',
    q4: 'Extremely helpful',
    q5: 'Definitely recommend'
  });

  const [likedMost, setLikedMost] = useState<string>('');
  const [canImprove, setCanImprove] = useState<string>('');
  const [additionalComments, setAdditionalComments] = useState<string>('');

  // QR Modal States
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [qrModalCopied, setQrModalCopied] = useState<boolean>(false);

  // Idempotency token to prevent double-submissions
  const [submissionRef] = useState<string>(() => {
    return `SUB-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [refNo, setRefNo] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Track QR scan on mount if location code is provided
  useEffect(() => {
    if (selectedStore?.code) {
      API.trackQrScanByLocation(selectedStore.code, 'feedback_form').catch(() => {});
    } else if (qrCodeId) {
      API.trackQrScan(qrCodeId, 'feedback_form').catch(() => {});
    }
  }, [selectedStore?.code, qrCodeId]);

  // Load custom questions if configured on backend
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  useEffect(() => {
    API.getFeedbackQuestions()
      .then((res: any) => {
        if (res && Array.isArray(res.questions) && res.questions.length > 0) {
          setQuestions(res.questions);
        }
      })
      .catch(() => {});
  }, []);

  const getStoreTargetUrl = (code: string) => `https://bsctextiles.in/feedback-public?location=${code}`;

  const getStoreQrUrl = (code: string, size = 400) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(getStoreTargetUrl(code))}`;

  const handleCopyStoreLink = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedStore) return;
    const url = getStoreTargetUrl(selectedStore.code);
    navigator.clipboard.writeText(url);
    setQrModalCopied(true);
    showToast(`${selectedStore.city} feedback link copied!`, 'success');
    setTimeout(() => setQrModalCopied(false), 2200);
  };

  const handleDownloadStoreQr = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedStore) return;
    try {
      const qrUrl = getStoreQrUrl(selectedStore.code, 600);
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `BSC_Feedback_QR_${selectedStore.code}_${selectedStore.city}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast(`${selectedStore.city} QR Code downloaded.`, 'success');
    } catch {
      window.open(getStoreQrUrl(selectedStore.code, 600), '_blank');
      showToast(`${selectedStore.city} QR Code opened for download.`, 'info');
    }
  };

  const handleStoreSelect = (store: CentralStoreLocation) => {
    setSelectedStore(store);
    setErrorMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRatingChange = (score: number) => {
    setOverallRating(score);
    // Align question 1 answer with star rating
    const mapRating: Record<number, string> = {
      5: 'Very satisfied',
      4: 'Satisfied',
      3: 'Neutral',
      2: 'Dissatisfied',
      1: 'Very dissatisfied'
    };
    setAnswers((prev) => ({ ...prev, q1: mapRating[score] || 'Very satisfied' }));
  };

  const handleNextStep = () => {
    setErrorMessage('');
    if (currentStep === 1) {
      if (!customerName.trim()) {
        setErrorMessage('Please complete the required fields (Name is required).');
        return;
      }
      const digits = mobile.replace(/\D/g, '');
      if (mobile && digits.length !== 10) {
        setErrorMessage('Please enter a valid 10-digit mobile number.');
        return;
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, 5));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    setErrorMessage('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedStore) {
      setErrorMessage('Please select a store to continue.');
      return;
    }

    if (!customerName.trim()) {
      setCurrentStep(1);
      setErrorMessage('Please complete the required fields (Name is required).');
      return;
    }

    const cleanMobile = mobile.replace(/\D/g, '');
    if (mobile.trim() && cleanMobile.length !== 10) {
      setCurrentStep(1);
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const normalizedMobile = cleanMobile ? `+91${cleanMobile}` : '';
      const payload = {
        customerName: customerName.trim(),
        custName: customerName.trim(),
        mobile: normalizedMobile,
        custMobile: normalizedMobile,
        email: email.trim(),
        custEmail: email.trim(),
        locationCode: selectedStore.code,
        storeLocation: selectedStore.storeName,
        locationName: selectedStore.city,
        locationId: selectedStore.id,
        location_id: selectedStore.id,
        sectionId: sectionId,
        area: sectionId,
        category: sectionId,
        billNo: billNo.trim(),
        invoiceNo: billNo.trim(),
        receiptNo: billNo.trim(),
        overallRating,
        storeExperienceRating: overallRating,
        staffServiceRating: staffRating,
        productRating,
        cleanlinessRating,
        ambienceRating,
        recommendationRating: answers['q5']?.includes('Definitely') ? 5 : answers['q5']?.includes('Probably') ? 4 : 3,
        answers: {
          ...answers,
          section: sectionId,
          billNo: billNo.trim() || undefined,
          staffRating,
          productRating,
          cleanlinessRating,
          ambienceRating
        },
        q1: answers['q1'] || 'Very satisfied',
        q2: answers['q2'] || 'Yes, exactly what I wanted',
        q3: answers['q3'] || 'Excellent',
        q4: answers['q4'] || 'Extremely helpful',
        q5: answers['q5'] || 'Definitely recommend',
        likedMost: likedMost.trim(),
        canImprove: canImprove.trim(),
        additionalComments: additionalComments.trim(),
        source: qrCodeId ? 'qr' : 'web',
        qrCodeId: qrCodeId || undefined,
        submissionRef
      };

      const res: any = await API.submitFeedback(payload);

      const generatedId = res?.id || res?.refNo || `FB-${Math.floor(1000 + Math.random() * 9000)}`;
      setRefNo(generatedId);
      setSubmitted(true);
      showToast('Your feedback has been submitted successfully.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('[Feedback Submit Error]', err);
      setErrorMessage('Something went wrong while saving your feedback. Please try again.');
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setSelectedStore(null);
    setCurrentStep(1);
    setCustomerName('');
    setMobile('');
    setEmail('');
    setSectionId('Sarees & Silk Section');
    setBillNo('');
    setOverallRating(5);
    setStaffRating(5);
    setProductRating(5);
    setCleanlinessRating(5);
    setAmbienceRating(5);
    setAnswers({
      q1: 'Very satisfied',
      q2: 'Yes, exactly what I wanted',
      q3: 'Excellent',
      q4: 'Extremely helpful',
      q5: 'Definitely recommend'
    });
    setLikedMost('');
    setCanImprove('');
    setAdditionalComments('');
    setErrorMessage('');
  };

  // ─────────────────────────────────────────────────────────────
  // 1. SUCCESS CONFIRMATION SCREEN
  // ─────────────────────────────────────────────────────────────
  if (submitted && selectedStore) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center shadow-sm">
          {/* Subtle Success Icon */}
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          {/* Store Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-3">
            <Store className="w-3.5 h-3.5 text-slate-500" />
            <span>{selectedStore.storeName}</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Thank You</h2>
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            Your feedback has been saved directly to {selectedStore.city} store management.
          </p>

          {/* Reference & Customer Details */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-5 text-xs text-left space-y-1.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Feedback Reference
              </span>
              <span className="font-mono text-sm font-bold text-slate-900">{refNo}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 pt-0.5">
              <span>Customer:</span>
              <span className="font-semibold text-slate-900">{customerName}</span>
            </div>
            {mobile && (
              <div className="flex items-center justify-between text-slate-600">
                <span>Mobile:</span>
                <span className="font-mono font-medium text-slate-800">+91 {mobile}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-slate-600">
              <span>Section:</span>
              <span className="font-semibold text-slate-900">{sectionId}</span>
            </div>
            {billNo && (
              <div className="flex items-center justify-between text-slate-600">
                <span>Bill / Memo No:</span>
                <span className="font-mono font-bold text-slate-800">{billNo}</span>
              </div>
            )}
          </div>

          {/* Store Feedback QR Share Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
              <QrCode className="w-4 h-4 text-amber-600" />
              <span>{selectedStore.city} Feedback QR Code</span>
            </div>
            <div className="w-36 h-36 mx-auto bg-white p-2 rounded-xl border border-slate-200 shadow-xs mb-2.5">
              <img
                src={getStoreQrUrl(selectedStore.code, 240)}
                alt={`${selectedStore.city} Feedback QR`}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleDownloadStoreQr}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save QR</span>
              </button>
              <button
                type="button"
                onClick={handleCopyStoreLink}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                {qrModalCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Back to BSC Textiles</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="w-full h-11 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Submit Another Response
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. STORE SELECTION SCREEN (Public website editorial design)
  // ─────────────────────────────────────────────────────────────
  if (!selectedStore) {
    return <StoreSelectionPanel onSelect={handleStoreSelect} />;
  }

  // ─────────────────────────────────────────────────────────────
  // 3. STEPPED FEEDBACK FORM UI (Mobile-First, Clean, Professional)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 py-6 sm:py-10 px-4 sm:px-6 font-sans">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Interactive Store Feedback QR Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 text-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div
              onClick={() => setShowQrModal(true)}
              className="w-16 h-16 sm:w-18 sm:h-18 bg-white rounded-xl p-1.5 cursor-pointer shadow-md shrink-0 hover:scale-105 transition-transform"
              title={`Click to enlarge ${selectedStore.city} Feedback QR Code`}
            >
              <img
                src={getStoreQrUrl(selectedStore.code, 160)}
                alt={`${selectedStore.city} Feedback QR`}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-semibold uppercase tracking-wider">
                <QrCode className="w-3 h-3 text-amber-400" />
                <span>Store Feedback QR · {selectedStore.code}</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Customer Mobile Scan Available
              </h3>
              <p className="text-xs text-slate-300">
                Customers can point their smartphone camera to open this survey on their phone.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="flex-1 sm:flex-initial h-10 px-3.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Enlarge QR</span>
            </button>
            <button
              type="button"
              onClick={handleCopyStoreLink}
              className="flex-1 sm:flex-initial h-10 px-3.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {qrModalCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          {/* Header */}
          <div className="border-b border-slate-100 pb-5 mb-6">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                BSC Customer Feedback QR
              </span>
              <button
                type="button"
                onClick={() => setSelectedStore(null)}
                className="text-xs text-slate-500 hover:text-slate-900 underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Change Store</span>
              </button>
            </div>

            {/* Store Indicator */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-600 shrink-0" />
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                BSC Textiles — {selectedStore.city}
              </h2>
            </div>
          </div>

          {/* Clean Stepper Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
              <span>Step {currentStep} of 5</span>
              <span>
                {currentStep === 1 && 'Store & Customer Details'}
                {currentStep === 2 && 'Overall Shopping Experience'}
                {currentStep === 3 && 'Staff Service & Hospitality'}
                {currentStep === 4 && 'Collection & Ambience'}
                {currentStep === 5 && 'Review & Final Comments'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 5) * 100}%` }}
              />
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={(e) => e.preventDefault()}>
            {/* STEP 1: Store Confirmation, Customer Info, Section & Bill Details */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <div className="text-xs text-slate-500 mb-0.5">Selected Store:</div>
                  <div className="text-sm font-bold text-slate-900">{selectedStore.storeName}</div>
                  <div className="text-xs text-slate-500 mt-1">{selectedStore.address}</div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      placeholder="Enter your full name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Mobile Number
                  </label>
                  <div className="flex h-12 border border-slate-200 rounded-xl overflow-hidden focus-within:border-slate-900 bg-white">
                    <span className="flex items-center px-3.5 bg-slate-50 border-r border-slate-200 text-xs font-mono font-semibold text-slate-600 select-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="flex-1 px-3 text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Optional. Used only if store management needs to follow up on your feedback.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Address (Optional)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Section / Department Visited */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Section / Department Visited
                  </label>
                  <div className="relative">
                    <Layers className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={sectionId}
                      onChange={(e) => setSectionId(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-slate-900 cursor-pointer"
                    >
                      <option value="Sarees & Silk Section">Sarees & Silk Section</option>
                      <option value="Bridal Studio & Wedding Trousseau">Bridal Studio & Wedding Trousseau</option>
                      <option value="Menswear & Ethnic Suiting">Menswear & Ethnic Suiting</option>
                      <option value="Kids & Family Wear">Kids & Family Wear</option>
                      <option value="Ground Floor - Main Counter">Ground Floor - Main Counter</option>
                      <option value="Billing & Cash Counter">Billing & Cash Counter</option>
                      <option value="General Store Visit">General Store Visit</option>
                    </select>
                  </div>
                </div>

                {/* Bill / Invoice Number */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Bill / Cash Memo Number (Optional)
                  </label>
                  <div className="relative">
                    <Receipt className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. INV-10842 or Bill No."
                      value={billNo}
                      onChange={(e) => setBillNo(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Attaching your bill number helps store management locate your purchase details quickly.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 2: Overall Shopping Experience */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Overall Experience Rating
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleRatingChange(score)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                          score <= overallRating
                            ? 'bg-amber-50 border-amber-300 text-amber-500'
                            : 'bg-white border-slate-200 text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <Star
                          className="w-6 h-6"
                          fill={score <= overallRating ? 'currentColor' : 'none'}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs font-semibold text-slate-600">
                      {overallRating === 5 && 'Excellent (5/5)'}
                      {overallRating === 4 && 'Good (4/5)'}
                      {overallRating === 3 && 'Average (3/5)'}
                      {overallRating === 2 && 'Fair (2/5)'}
                      {overallRating === 1 && 'Poor (1/5)'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    How satisfied are you with your shopping experience today?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied'].map(
                      (opt) => {
                        const isSelected = answers['q1'] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswers({ ...answers, q1: opt })}
                            className={`p-3.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span>{opt}</span>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Service & Staff */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Staff Service Rating
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setStaffRating(score)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                          score <= staffRating
                            ? 'bg-amber-50 border-amber-300 text-amber-500'
                            : 'bg-white border-slate-200 text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <Star
                          className="w-5 h-5"
                          fill={score <= staffRating ? 'currentColor' : 'none'}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs font-semibold text-slate-600">
                      {staffRating}/5
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    How would you rate the service and helpfulness of our staff?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {['Extremely helpful', 'Helpful', 'Average', 'Needs improvement'].map((opt) => {
                      const isSelected = answers['q4'] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setAnswers({ ...answers, q4: opt })}
                          className={`p-3.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    How likely are you to recommend BSC Textiles to others?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {['Definitely recommend', 'Probably recommend', 'Neutral', 'Not recommend'].map(
                      (opt) => {
                        const isSelected = answers['q5'] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswers({ ...answers, q5: opt })}
                            className={`p-3.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span>{opt}</span>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Products & Store */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Product & Fabric Collection Rating
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => setProductRating(score)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                          score <= productRating
                            ? 'bg-amber-50 border-amber-300 text-amber-500'
                            : 'bg-white border-slate-200 text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <Star
                          className="w-5 h-5"
                          fill={score <= productRating ? 'currentColor' : 'none'}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-xs font-semibold text-slate-600">
                      {productRating}/5
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    Did you find the products and fabrics you were looking for?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {['Yes, exactly what I wanted', 'Yes, with assistance', 'Partially', 'No'].map(
                      (opt) => {
                        const isSelected = answers['q2'] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswers({ ...answers, q2: opt })}
                            className={`p-3.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <span>{opt}</span>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    How would you rate the quality and variety of our collections?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {['Excellent', 'Good', 'Average', 'Poor'].map((opt) => {
                      const isSelected = answers['q3'] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setAnswers({ ...answers, q3: opt })}
                          className={`p-3.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cleanliness & Ambience Ratings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                    <label className="block text-xs font-bold text-slate-800 mb-2">
                      Store Cleanliness ({cleanlinessRating}/5)
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCleanlinessRating(s)}
                          className="p-1 text-amber-500 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Star
                            className="w-5 h-5"
                            fill={s <= cleanlinessRating ? 'currentColor' : 'none'}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                    <label className="block text-xs font-bold text-slate-800 mb-2">
                      Store Ambience ({ambienceRating}/5)
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setAmbienceRating(s)}
                          className="p-1 text-amber-500 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Star
                            className="w-5 h-5"
                            fill={s <= ambienceRating ? 'currentColor' : 'none'}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Review Summary & Additional Comments */}
            {currentStep === 5 && (
              <div className="space-y-5">
                {/* Details Summary Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-900 border-b border-slate-200 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Review Your Visit Details</span>
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono">
                      {selectedStore.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Customer</span>
                      <span className="font-semibold text-slate-900">{customerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Mobile</span>
                      <span className="font-mono text-slate-900">{mobile ? `+91 ${mobile}` : 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Section</span>
                      <span className="font-semibold text-slate-900">{sectionId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Bill / Memo No</span>
                      <span className="font-mono text-slate-900">{billNo || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Store Rating</span>
                      <span className="font-bold text-amber-600">★ {overallRating} / 5</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Staff Service</span>
                      <span className="font-bold text-amber-600">★ {staffRating} / 5</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    What did you like most about your visit today?
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tell us what stood out positively..."
                    value={likedMost}
                    onChange={(e) => setLikedMost(e.target.value)}
                    className="w-full p-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    What can we improve to serve you better?
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Share any suggestions or areas for improvement..."
                    value={canImprove}
                    onChange={(e) => setCanImprove(e.target.value)}
                    className="w-full p-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Any additional comments or compliments?
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Optional additional notes for store management..."
                    value={additionalComments}
                    onChange={(e) => setAdditionalComments(e.target.value)}
                    className="w-full p-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            {/* Navigation & Submit Controls */}
            <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={submitting}
                  className="h-12 px-5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              ) : (
                <div />
              )}

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="h-12 px-6 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ml-auto"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={submitting}
                  className="h-12 px-7 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer ml-auto"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving & Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Feedback</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400">
          BSC Textiles · Customer Experience Service
        </div>
      </div>

      {/* Enlarge QR Modal for Mobile Scanning / Counter Display */}
      {showQrModal && selectedStore && (
        <div className="bsc-fb-modal-backdrop" onClick={() => setShowQrModal(false)}>
          <div className="bsc-fb-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="bsc-fb-modal-close"
              onClick={() => setShowQrModal(false)}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <span className="bsc-fb-badge bsc-fb-badge--active" style={{ marginBottom: '0.5rem' }}>
              Store Feedback QR · {selectedStore.code}
            </span>
            <h3 className="bsc-ed-serif" style={{ margin: '0.25rem 0', fontSize: '1.5rem', color: 'var(--ed-ink)' }}>
              BSC Textiles — {selectedStore.city}
            </h3>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--ed-ink-soft)' }}>
              {selectedStore.storeName}
            </p>

            <div className="bsc-fb-modal-qr-wrap">
              <img
                src={getStoreQrUrl(selectedStore.code, 480)}
                alt={`${selectedStore.city} Feedback QR`}
                className="bsc-fb-modal-qr-img"
              />
            </div>

            <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ed-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Point phone camera to open feedback survey
            </p>

            <div className="bsc-fb-qr-url-pill" style={{ margin: '0 auto 1.25rem', maxWidth: '320px' }}>
              {getStoreTargetUrl(selectedStore.code)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                className="bsc-fb-tool-btn"
                style={{ padding: '0.625rem 0.5rem', fontSize: '0.75rem' }}
                onClick={handleDownloadStoreQr}
              >
                <Download size={14} />
                <span>Download PNG</span>
              </button>

              <button
                type="button"
                className="bsc-fb-tool-btn"
                style={{ padding: '0.625rem 0.5rem', fontSize: '0.75rem' }}
                onClick={handleCopyStoreLink}
              >
                {qrModalCopied ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span className="text-emerald-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
