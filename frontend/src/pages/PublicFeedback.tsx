import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  MapPin,
  Star,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Check,
  Clock,
  Store,
  User,
  Mail,
  Phone,
  QrCode,
  Download,
  Copy,
  Maximize2,
  X,
  Receipt,
  Layers,
  Sparkles,
  Heart,
  ShoppingBag,
  MessageSquare,
  ThumbsUp,
  Smile
} from 'lucide-react';
import { API } from '../services/api';
import { showToast } from '../components/Toast';
import StoreSelectionPanel from '../components/feedback/StoreSelectionPanel';
import {
  CENTRAL_STORE_LOCATIONS,
  resolveStoreLocation,
  CentralStoreLocation
} from '../config/storeLocations';
import './publicFeedback.css';

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

const STEPS = [
  { short: 'Store', name: 'Store & Customer Details' },
  { short: 'Visit', name: 'Overall Shopping Experience' },
  { short: 'Service', name: 'Staff Service & Hospitality' },
  { short: 'Products', name: 'Collection & Ambience' },
  { short: 'Review', name: 'Review & Final Comments' }
];

const RATING_LABELS: Record<number, string> = {
  5: 'Excellent',
  4: 'Good',
  3: 'Average',
  2: 'Fair',
  1: 'Poor'
};

const LIKED_CHIPS = [
  'Great service',
  'Product variety',
  'Staff helpfulness',
  'Store ambience',
  'Easy shopping',
  'Value for money'
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type StepOneErrors = { name?: string; mobile?: string; email?: string };

function validateStepOne(values: { name: string; mobile: string; email: string }): StepOneErrors {
  const errors: StepOneErrors = {};
  if (!values.name.trim()) errors.name = 'Please enter your name.';
  const digits = values.mobile.replace(/\D/g, '');
  if (values.mobile.trim() && digits.length !== 10) {
    errors.mobile = 'Enter all 10 digits of your mobile number.';
  }
  if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Check the email address — it should look like name@example.com.';
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface StarRatingProps {
  value: number;
  onChange: (v: number) => void;
  labelId: string;
  size?: 'normal' | 'mini';
}

function StarRating({ value, onChange, labelId, size = 'normal' }: StarRatingProps) {
  const btnClass = size === 'mini' ? 'bfx-star-mini' : 'bfx-star-btn';
  return (
    <div className="bfx-star-group" role="group" aria-labelledby={labelId}>
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onChange(score)}
          className={btnClass}
          data-on={score <= value}
          aria-pressed={score <= value}
          aria-label={`${score} out of 5`}
        >
          <Star aria-hidden="true" fill={score <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
      {size === 'normal' && (
        <span className="bfx-rating-note" aria-live="polite">
          {value}/5 · {RATING_LABELS[value]}
        </span>
      )}
    </div>
  );
}

interface OptionCardProps {
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  twoCol?: boolean;
  labelId?: string;
}

function OptionCards({ options, selected, onSelect, twoCol, labelId }: OptionCardProps) {
  return (
    <div
      className={`bfx-options${twoCol ? ' bfx-options--2col' : ''}`}
      role="group"
      aria-labelledby={labelId}
    >
      {options.map((opt) => {
        const isSelected = selected === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className="bfx-option"
            aria-pressed={isSelected}
          >
            <span>{opt}</span>
            <span className="bfx-option-check" aria-hidden="true">
              {isSelected && <Check size={12} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function PublicFeedback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const qrCodeId = searchParams.get('qr') || '';
  const urlLocation = searchParams.get('location') || searchParams.get('loc') || '';

  const initialStore = useMemo(() => {
    return resolveStoreLocation(urlLocation || qrCodeId);
  }, [urlLocation, qrCodeId]);

  const [selectedStore, setSelectedStore] = useState<CentralStoreLocation | null>(initialStore);
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form Fields — all preserved exactly as original
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

  // Selected chips (liked most quick-select)
  const [selectedChips, setSelectedChips] = useState<string[]>([]);

  const [submissionRef] = useState<string>(() => {
    return `SUB-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`.toUpperCase();
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [refNo, setRefNo] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<StepOneErrors>({});

  // Load custom questions if configured on backend — logic preserved
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

  // Track QR scan on mount — logic preserved
  useEffect(() => {
    if (selectedStore?.code) {
      API.trackQrScanByLocation(selectedStore.code, 'feedback_form').catch(() => {});
    } else if (qrCodeId) {
      API.trackQrScan(qrCodeId, 'feedback_form').catch(() => {});
    }
  }, [selectedStore?.code, qrCodeId]);

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
    const mapRating: Record<number, string> = {
      5: 'Very satisfied',
      4: 'Satisfied',
      3: 'Neutral',
      2: 'Dissatisfied',
      1: 'Very dissatisfied'
    };
    setAnswers((prev) => ({ ...prev, q1: mapRating[score] || 'Very satisfied' }));
  };

  const validateField = (field: keyof StepOneErrors) => {
    const all = validateStepOne({ name: customerName, mobile, email });
    setFieldErrors(prev => ({ ...prev, [field]: all[field] }));
  };

  const handleNextStep = () => {
    setErrorMessage('');
    if (currentStep === 1) {
      const errors = validateStepOne({ name: customerName, mobile, email });
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        setErrorMessage('Please check the highlighted details before continuing.');
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

  const handleChipToggle = (chip: string) => {
    setSelectedChips(prev => {
      const next = prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip];
      // Sync liked-most text from chips
      if (next.length > 0) {
        setLikedMost(next.join(', '));
      }
      return next;
    });
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
    setSelectedChips([]);
    setErrorMessage('');
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 1. SUCCESS CONFIRMATION SCREEN
  // ──────────────────────────────────────────────────────────────────────────
  if (submitted && selectedStore) {
    return (
      <div className="bfx-page">
        <div className="bfx-shell">
          {/* Header */}
          <header className="bfx-header">
            <div className="bfx-brand">
              <picture className="bfx-logo">
                <source srcSet="/logo.webp" type="image/webp" />
                <img src="/logo.png" alt="BSC Textiles" width={360} height={270} loading="eager" decoding="async" />
              </picture>
              <div className="bfx-brand-text">
                <span className="bfx-brand-name">BSC Textiles</span>
                <span className="bfx-brand-sub">Customer Experience</span>
              </div>
            </div>
          </header>

          {/* Success body */}
          <section className="bfx-success" aria-label="Feedback submitted successfully">
            <span className="bfx-success-check" aria-hidden="true">
              <CheckCircle2 />
            </span>
            <span className="bfx-success-store">{selectedStore.storeName}</span>
            <h1 className="bfx-success-title">Thank you!</h1>
            <p className="bfx-success-note">
              Your feedback has been saved directly to the {selectedStore.city} store management team.
              Your voice truly matters to us.
            </p>

            {/* Stars */}
            <div className="bfx-success-stars" aria-hidden="true">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className="bfx-success-star" />
              ))}
            </div>

            {/* Ref number */}
            <div className="bfx-ref-box">
              <span className="bfx-ref-label">Feedback Reference</span>
              <span className="bfx-ref-value">{refNo}</span>
            </div>

            {/* Summary details */}
            <dl className="bfx-success-details">
              <div className="bfx-success-detail-item">
                <dt>Customer</dt>
                <dd>{customerName}</dd>
              </div>
              <div className="bfx-success-detail-item">
                <dt>Section</dt>
                <dd>{sectionId}</dd>
              </div>
              {mobile && (
                <div className="bfx-success-detail-item">
                  <dt>Mobile</dt>
                  <dd className="bfx-mono">+91 {mobile}</dd>
                </div>
              )}
              {billNo && (
                <div className="bfx-success-detail-item">
                  <dt>Bill / memo no</dt>
                  <dd className="bfx-mono">{billNo}</dd>
                </div>
              )}
            </dl>

            {/* QR share */}
            <div className="bfx-success-share">
              <span className="bfx-success-share-title">
                <QrCode aria-hidden="true" />
                <span>{selectedStore.city} feedback QR code</span>
              </span>
              <div className="bfx-success-qr-box">
                <img
                  src={getStoreQrUrl(selectedStore.code, 240)}
                  alt={`${selectedStore.city} Feedback QR`}
                  width={140}
                  height={140}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <p className="bfx-success-share-note">
                Share this code at the counter so other customers can complete the same survey.
              </p>
              <div className="bfx-success-share-btns">
                <button type="button" className="bfx-qr-btn" onClick={handleDownloadStoreQr}>
                  <Download aria-hidden="true" />
                  <span>Save QR</span>
                </button>
                <button type="button" className="bfx-qr-btn" onClick={handleCopyStoreLink}>
                  {qrModalCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  <span>{qrModalCopied ? 'Copied!' : 'Copy link'}</span>
                </button>
              </div>
            </div>

            {/* CTA */}
            <div className="bfx-success-actions">
              <button type="button" onClick={() => navigate('/')} className="bfx-btn-primary">
                <span>Back to BSC Textiles</span>
                <ArrowRight aria-hidden="true" />
              </button>
              <button type="button" onClick={handleReset} className="bfx-btn-secondary">
                <span>Submit another response</span>
              </button>
            </div>
          </section>

          <footer className="bfx-footer">
            <span>BSC Textiles · Customer Experience</span>
            <span>{selectedStore.storeName} · {selectedStore.phone}</span>
          </footer>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. STORE SELECTION SCREEN
  // ──────────────────────────────────────────────────────────────────────────
  if (!selectedStore) {
    return <StoreSelectionPanel onSelect={handleStoreSelect} />;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. STEPPED FEEDBACK FORM — premium redesign
  // ──────────────────────────────────────────────────────────────────────────
  const isLastStep = currentStep === 5;
  const isFirstStep = currentStep === 1;

  return (
    <div className="bfx-page">
      <div className="bfx-shell">

        {/* ── Sticky header ─────────────────────────────────────────── */}
        <header className="bfx-header">
          <div className="bfx-brand">
            <picture className="bfx-logo">
              <source srcSet="/logo.webp" type="image/webp" />
              <img src="/logo.png" alt="BSC Textiles" width={360} height={270} loading="eager" decoding="async" />
            </picture>
            <div className="bfx-brand-text">
              <span className="bfx-brand-name">BSC Textiles</span>
              <span className="bfx-brand-sub">Customer Experience</span>
            </div>
          </div>
          <button
            type="button"
            className="bfx-change-store"
            onClick={() => setSelectedStore(null)}
            aria-label="Change store"
          >
            <MapPin aria-hidden="true" />
            <span>Change store</span>
          </button>
        </header>

        {/* ── Hero section ───────────────────────────────────────────── */}
        <div className="bfx-hero">
          <span className="bfx-hero-icon" aria-hidden="true">
            <Sparkles />
          </span>
          <h1 className="bfx-hero-title">How was your BSC experience?</h1>
          <p className="bfx-hero-subtitle">
            Your feedback helps us make every visit better, every time.
          </p>
          <span className="bfx-hero-badge">
            <Clock aria-hidden="true" />
            Only 1 minute · 5 simple steps
          </span>
        </div>

        {/* ── Progress ───────────────────────────────────────────────── */}
        <nav className="bfx-progress" aria-label="Survey progress">
          <div className="bfx-progress-meta">
            <span className="bfx-step-count">Step {currentStep} of {STEPS.length}</span>
            <span className="bfx-step-label">{STEPS[currentStep - 1].name}</span>
          </div>
          <div className="bfx-progress-rail" aria-hidden="true">
            {STEPS.map((step, i) => (
              <span
                key={step.short}
                className="bfx-progress-seg"
                data-state={i + 1 < currentStep ? 'done' : i + 1 === currentStep ? 'current' : 'todo'}
              />
            ))}
          </div>
          <ol className="bfx-step-dots" aria-label="Steps">
            {STEPS.map((step, i) => {
              const state = i + 1 < currentStep ? 'done' : i + 1 === currentStep ? 'current' : 'todo';
              return (
                <li key={step.short} className="bfx-step-dot-item" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
                  <span className="bfx-dot">
                    {state === 'done' ? <Check aria-hidden="true" /> : (i + 1)}
                  </span>
                  <span className="bfx-dot-label">{step.short}</span>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* ── Error notice ───────────────────────────────────────────── */}
        {errorMessage && (
          <div className="bfx-notice" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── Main form card ─────────────────────────────────────────── */}
        <div className="bfx-card">
          <form onSubmit={(e) => e.preventDefault()} noValidate>

            {/* STEP 1 ─ Store confirmation + Customer details */}
            {currentStep === 1 && (
              <>
                <div className="bfx-step-heading">
                  <span className="bfx-step-eyebrow">
                    <Store aria-hidden="true" />
                    Step 1 of 5
                  </span>
                  <h2 className="bfx-step-title">Let's confirm your store</h2>
                  <p className="bfx-step-subtitle">Tell us a little about you and your visit today.</p>
                </div>

                <div className="bfx-step-body">
                  <div className="bfx-step-sections">

                    {/* Store card */}
                    <div className="bfx-store-card" aria-label={`Store visited: BSC Textiles ${selectedStore.city}`}>
                      <div className="bfx-store-icon">
                        <MapPin aria-hidden="true" />
                      </div>
                      <div className="bfx-store-info">
                        <span className="bfx-store-eyebrow">Store visited</span>
                        <p className="bfx-store-name">BSC Textiles — {selectedStore.city}</p>
                        <p className="bfx-store-address">{selectedStore.address}</p>
                        <div className="bfx-store-meta">
                          <span className="bfx-store-meta-item">
                            <Clock aria-hidden="true" />
                            {selectedStore.hours}
                          </span>
                          <span className="bfx-store-meta-item">
                            <Phone aria-hidden="true" />
                            {selectedStore.phone}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Customer details */}
                    <div>
                      <div className="bfx-section-head">
                        <span className="bfx-section-icon"><User aria-hidden="true" /></span>
                        <h3 className="bfx-section-title">Your details</h3>
                      </div>

                      <div className="bfx-fields">
                        {/* Name */}
                        <div className="bfx-field" data-invalid={Boolean(fieldErrors.name)}>
                          <label className="bfx-label" htmlFor="bfx-name">
                            Customer name
                            <span className="bfx-required" aria-hidden="true">*</span>
                            <span className="sr-only">(required)</span>
                          </label>
                          <div className="bfx-control bfx-has-icon">
                            <User className="bfx-input-icon" aria-hidden="true" />
                            <input
                              id="bfx-name"
                              name="customerName"
                              type="text"
                              autoComplete="name"
                              required
                              aria-required="true"
                              aria-invalid={Boolean(fieldErrors.name)}
                              aria-describedby={fieldErrors.name ? 'bfx-name-error' : undefined}
                              placeholder="Enter your full name"
                              value={customerName}
                              onChange={(e) => {
                                const value = e.target.value;
                                setCustomerName(value);
                                if (fieldErrors.name) {
                                  setFieldErrors(prev => ({ ...prev, name: validateStepOne({ name: value, mobile, email }).name }));
                                }
                              }}
                              onBlur={() => validateField('name')}
                              className="bfx-input"
                            />
                          </div>
                          {fieldErrors.name && (
                            <p className="bfx-error-msg" id="bfx-name-error" role="alert">
                              <AlertCircle aria-hidden="true" />
                              <span>{fieldErrors.name}</span>
                            </p>
                          )}
                        </div>

                        {/* Mobile + Email side by side on desktop */}
                        <div className="bfx-field-grid">
                          <div className="bfx-field" data-invalid={Boolean(fieldErrors.mobile)}>
                            <div className="bfx-label-row">
                              <label className="bfx-label" htmlFor="bfx-mobile">Mobile number</label>
                              <span className="bfx-optional">Optional</span>
                            </div>
                            <div className="bfx-control">
                              <span className="bfx-prefix" aria-hidden="true">+91</span>
                              <input
                                id="bfx-mobile"
                                name="mobile"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel-national"
                                maxLength={10}
                                aria-invalid={Boolean(fieldErrors.mobile)}
                                aria-describedby="bfx-mobile-help bfx-mobile-error"
                                placeholder="10-digit number"
                                value={mobile}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                  setMobile(value);
                                  if (fieldErrors.mobile) {
                                    setFieldErrors(prev => ({ ...prev, mobile: validateStepOne({ name: customerName, mobile: value, email }).mobile }));
                                  }
                                }}
                                onBlur={() => validateField('mobile')}
                                className="bfx-input"
                              />
                            </div>
                            <p className="bfx-help" id="bfx-mobile-help">Used only if the store needs to follow up.</p>
                            {fieldErrors.mobile && (
                              <p className="bfx-error-msg" id="bfx-mobile-error" role="alert">
                                <AlertCircle aria-hidden="true" />
                                <span>{fieldErrors.mobile}</span>
                              </p>
                            )}
                          </div>

                          <div className="bfx-field" data-invalid={Boolean(fieldErrors.email)}>
                            <div className="bfx-label-row">
                              <label className="bfx-label" htmlFor="bfx-email">Email address</label>
                              <span className="bfx-optional">Optional</span>
                            </div>
                            <div className="bfx-control bfx-has-icon">
                              <Mail className="bfx-input-icon" aria-hidden="true" />
                              <input
                                id="bfx-email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                aria-invalid={Boolean(fieldErrors.email)}
                                aria-describedby="bfx-email-error"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setEmail(value);
                                  if (fieldErrors.email) {
                                    setFieldErrors(prev => ({ ...prev, email: validateStepOne({ name: customerName, mobile, email: value }).email }));
                                  }
                                }}
                                onBlur={() => validateField('email')}
                                className="bfx-input"
                              />
                            </div>
                            {fieldErrors.email && (
                              <p className="bfx-error-msg" id="bfx-email-error" role="alert">
                                <AlertCircle aria-hidden="true" />
                                <span>{fieldErrors.email}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Section + Bill side by side on desktop */}
                        <div className="bfx-field-grid">
                          <div className="bfx-field">
                            <label className="bfx-label" htmlFor="bfx-section">Section visited</label>
                            <div className="bfx-control bfx-has-icon">
                              <Layers className="bfx-input-icon" aria-hidden="true" />
                              <select
                                id="bfx-section"
                                name="sectionId"
                                value={sectionId}
                                onChange={(e) => setSectionId(e.target.value)}
                                className="bfx-input bfx-select"
                              >
                                <option value="Sarees &amp; Silk Section">Sarees &amp; Silk Section</option>
                                <option value="Bridal Studio &amp; Wedding Trousseau">Bridal Studio &amp; Wedding Trousseau</option>
                                <option value="Menswear &amp; Ethnic Suiting">Menswear &amp; Ethnic Suiting</option>
                                <option value="Kids &amp; Family Wear">Kids &amp; Family Wear</option>
                                <option value="Ground Floor - Main Counter">Ground Floor - Main Counter</option>
                                <option value="Billing &amp; Cash Counter">Billing &amp; Cash Counter</option>
                                <option value="General Store Visit">General Store Visit</option>
                              </select>
                            </div>
                          </div>

                          <div className="bfx-field">
                            <div className="bfx-label-row">
                              <label className="bfx-label" htmlFor="bfx-bill">Bill / memo number</label>
                              <span className="bfx-optional">Optional</span>
                            </div>
                            <div className="bfx-control bfx-has-icon">
                              <Receipt className="bfx-input-icon" aria-hidden="true" />
                              <input
                                id="bfx-bill"
                                name="billNo"
                                type="text"
                                maxLength={40}
                                aria-describedby="bfx-bill-help"
                                placeholder="e.g. INV-10842"
                                value={billNo}
                                onChange={(e) => setBillNo(e.target.value)}
                                className="bfx-input"
                              />
                            </div>
                            <p className="bfx-help" id="bfx-bill-help">Helps us find your purchase details faster.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* STEP 2 ─ Overall Experience */}
            {currentStep === 2 && (
              <>
                <div className="bfx-step-heading">
                  <span className="bfx-step-eyebrow">
                    <Heart aria-hidden="true" />
                    Step 2 of 5
                  </span>
                  <h2 className="bfx-step-title">How did you feel about your visit?</h2>
                  <p className="bfx-step-subtitle">Your overall experience matters most to us.</p>
                </div>

                <div className="bfx-step-body">
                  <div className="bfx-step-sections">
                    {/* Overall star rating */}
                    <div className="bfx-q">
                      <p className="bfx-q-title" id="bfx-overall-label">Overall experience rating</p>
                      <StarRating
                        value={overallRating}
                        onChange={handleRatingChange}
                        labelId="bfx-overall-label"
                      />
                    </div>

                    {/* Satisfaction options */}
                    <div className="bfx-q">
                      <p className="bfx-q-title" id="bfx-q1-label">How satisfied were you today?</p>
                      <OptionCards
                        options={['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied']}
                        selected={answers['q1']}
                        onSelect={(opt) => setAnswers({ ...answers, q1: opt })}
                        labelId="bfx-q1-label"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* STEP 3 ─ Staff Service */}
            {currentStep === 3 && (
              <>
                <div className="bfx-step-heading">
                  <span className="bfx-step-eyebrow">
                    <ThumbsUp aria-hidden="true" />
                    Step 3 of 5
                  </span>
                  <h2 className="bfx-step-title">How was our team's service?</h2>
                  <p className="bfx-step-subtitle">Tell us about the people who helped you today.</p>
                </div>

                <div className="bfx-step-body">
                  <div className="bfx-step-sections">
                    {/* Staff star rating */}
                    <div className="bfx-q">
                      <p className="bfx-q-title" id="bfx-staff-label">Staff service rating</p>
                      <StarRating value={staffRating} onChange={setStaffRating} labelId="bfx-staff-label" />
                    </div>

                    {/* Staff helpfulness options */}
                    <div className="bfx-q">
                      <p className="bfx-q-title" id="bfx-q4-label">How would you describe our staff?</p>
                      <OptionCards
                        options={['Extremely helpful', 'Helpful', 'Average', 'Needs improvement']}
                        selected={answers['q4']}
                        onSelect={(opt) => setAnswers({ ...answers, q4: opt })}
                        twoCol
                        labelId="bfx-q4-label"
                      />
                    </div>

                    {/* Recommendation */}
                    <div className="bfx-q">
                      <p className="bfx-q-title" id="bfx-q5-label">Would you recommend BSC Textiles?</p>
                      <OptionCards
                        options={['Definitely recommend', 'Probably recommend', 'Neutral', 'Not recommend']}
                        selected={answers['q5']}
                        onSelect={(opt) => setAnswers({ ...answers, q5: opt })}
                        twoCol
                        labelId="bfx-q5-label"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* STEP 4 ─ Products & Store */}
            {currentStep === 4 && (
              <>
                <div className="bfx-step-heading">
                  <span className="bfx-step-eyebrow">
                    <ShoppingBag aria-hidden="true" />
                    Step 4 of 5
                  </span>
                  <h2 className="bfx-step-title">How did you like our collection?</h2>
                  <p className="bfx-step-subtitle">Rate our products, store, and ambience.</p>
                </div>

                <div className="bfx-step-body">
                  <div className="bfx-step-sections">
                    {/* Product rating */}
                    <div className="bfx-q">
                      <p className="bfx-q-title" id="bfx-product-label">Product &amp; fabric collection rating</p>
                      <StarRating value={productRating} onChange={setProductRating} labelId="bfx-product-label" />
                    </div>

                    {/* Cleanliness + Ambience sub-cards */}
                    <div className="bfx-subcard-grid">
                      <div className="bfx-subcard">
                        <span className="bfx-subcard-label" id="bfx-clean-label">
                          <Star aria-hidden="true" />
                          Store cleanliness
                        </span>
                        <span className="bfx-subcard-score">{cleanlinessRating} / 5</span>
                        <div className="bfx-star-group" role="group" aria-labelledby="bfx-clean-label">
                          {[1,2,3,4,5].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setCleanlinessRating(s)}
                              className="bfx-star-mini"
                              data-on={s <= cleanlinessRating}
                              aria-pressed={s <= cleanlinessRating}
                              aria-label={`${s} out of 5`}
                            >
                              <Star aria-hidden="true" fill={s <= cleanlinessRating ? 'currentColor' : 'none'} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bfx-subcard">
                        <span className="bfx-subcard-label" id="bfx-ambience-label">
                          <Star aria-hidden="true" />
                          Store ambience
                        </span>
                        <span className="bfx-subcard-score">{ambienceRating} / 5</span>
                        <div className="bfx-star-group" role="group" aria-labelledby="bfx-ambience-label">
                          {[1,2,3,4,5].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setAmbienceRating(s)}
                              className="bfx-star-mini"
                              data-on={s <= ambienceRating}
                              aria-pressed={s <= ambienceRating}
                              aria-label={`${s} out of 5`}
                            >
                              <Star aria-hidden="true" fill={s <= ambienceRating ? 'currentColor' : 'none'} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Product availability */}
                    <div className="bfx-q">
                      <p className="bfx-q-title" id="bfx-q2-label">Did you find what you were looking for?</p>
                      <OptionCards
                        options={['Yes, exactly what I wanted', 'Yes, with assistance', 'Partially', 'No']}
                        selected={answers['q2']}
                        onSelect={(opt) => setAnswers({ ...answers, q2: opt })}
                        twoCol
                        labelId="bfx-q2-label"
                      />
                    </div>

                    {/* Quality & variety */}
                    <div className="bfx-q">
                      <p className="bfx-q-title" id="bfx-q3-label">How would you rate our quality and variety?</p>
                      <OptionCards
                        options={['Excellent', 'Good', 'Average', 'Poor']}
                        selected={answers['q3']}
                        onSelect={(opt) => setAnswers({ ...answers, q3: opt })}
                        twoCol
                        labelId="bfx-q3-label"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* STEP 5 ─ Final Feedback & Review */}
            {currentStep === 5 && (
              <>
                <div className="bfx-step-heading">
                  <span className="bfx-step-eyebrow">
                    <MessageSquare aria-hidden="true" />
                    One last thing...
                  </span>
                  <h2 className="bfx-step-title">What could we do better?</h2>
                  <p className="bfx-step-subtitle">Your honest opinion makes all the difference.</p>
                </div>

                <div className="bfx-step-body">
                  <div className="bfx-step-sections">

                    {/* Visit review summary */}
                    <section aria-label="Review your responses">
                      <dl className="bfx-review-card">
                        <div className="bfx-review-head">
                          <div className="bfx-review-head-left">
                            <Sparkles aria-hidden="true" />
                            <p className="bfx-review-head-title">Your visit summary</p>
                          </div>
                          <span className="bfx-review-code">{selectedStore.code}</span>
                        </div>
                        <div className="bfx-review-grid">
                          <div className="bfx-review-item">
                            <dt>Customer</dt>
                            <dd>{customerName}</dd>
                          </div>
                          <div className="bfx-review-item">
                            <dt>Mobile</dt>
                            <dd className="bfx-mono">{mobile ? `+91 ${mobile}` : 'Not provided'}</dd>
                          </div>
                          <div className="bfx-review-item">
                            <dt>Section</dt>
                            <dd>{sectionId}</dd>
                          </div>
                          <div className="bfx-review-item">
                            <dt>Bill / memo no</dt>
                            <dd className="bfx-mono">{billNo || 'Not provided'}</dd>
                          </div>
                          <div className="bfx-review-item">
                            <dt>Store rating</dt>
                            <dd>
                              <span className="bfx-review-score">
                                <Star aria-hidden="true" />
                                {overallRating} / 5
                              </span>
                            </dd>
                          </div>
                          <div className="bfx-review-item">
                            <dt>Staff service</dt>
                            <dd>
                              <span className="bfx-review-score">
                                <Star aria-hidden="true" />
                                {staffRating} / 5
                              </span>
                            </dd>
                          </div>
                        </div>
                      </dl>
                    </section>

                    {/* What did you enjoy most — chips */}
                    <div className="bfx-q">
                      <p className="bfx-q-title">What did you enjoy most?</p>
                      <p className="bfx-q-sub">Select all that apply</p>
                      <div className="bfx-chips" role="group" aria-label="What you enjoyed most">
                        {LIKED_CHIPS.map(chip => (
                          <button
                            key={chip}
                            type="button"
                            className="bfx-chip"
                            aria-pressed={selectedChips.includes(chip)}
                            onClick={() => handleChipToggle(chip)}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Improve textarea */}
                    <div className="bfx-field">
                      <label className="bfx-label" htmlFor="bfx-improve">What could we improve?</label>
                      <textarea
                        id="bfx-improve"
                        rows={3}
                        placeholder="Tell us anything you'd like us to know..."
                        value={canImprove}
                        onChange={(e) => setCanImprove(e.target.value)}
                        className="bfx-textarea"
                      />
                    </div>

                    {/* Additional comments */}
                    <div className="bfx-field">
                      <div className="bfx-label-row">
                        <label className="bfx-label" htmlFor="bfx-comments">Any additional comments?</label>
                        <span className="bfx-optional">Optional</span>
                      </div>
                      <textarea
                        id="bfx-comments"
                        rows={3}
                        placeholder="Compliments, suggestions, or anything else for our team..."
                        value={additionalComments}
                        onChange={(e) => setAdditionalComments(e.target.value)}
                        className="bfx-textarea"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Desktop in-card navigation ──────────────────────────── */}
            <div className="bfx-nav" data-single={isFirstStep}>
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={submitting}
                  className="bfx-btn-ghost"
                >
                  <ArrowLeft aria-hidden="true" />
                  <span>Back</span>
                </button>
              )}

              {!isLastStep ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="bfx-btn-primary"
                >
                  <span>Continue</span>
                  <ArrowRight aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={submitting}
                  className="bfx-btn-primary"
                >
                  {submitting ? (
                    <>
                      <span className="bfx-spinner" aria-hidden="true" />
                      <span>Saving your feedback...</span>
                    </>
                  ) : (
                    <>
                      <span>Share My Feedback</span>
                      <ArrowRight aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ── QR panel — desktop only ────────────────────────────────── */}
        <div className="bfx-qr-panel" aria-label="Share feedback QR code">
          <button
            type="button"
            className="bfx-qr-thumb"
            onClick={() => setShowQrModal(true)}
            title={`Enlarge ${selectedStore.city} feedback QR code`}
            aria-label={`Enlarge ${selectedStore.city} feedback QR code`}
          >
            <img
              src={getStoreQrUrl(selectedStore.code, 160)}
              alt={`${selectedStore.city} feedback QR code`}
              width={64}
              height={64}
              loading="lazy"
              decoding="async"
            />
          </button>
          <div className="bfx-qr-info">
            <p className="bfx-qr-info-title">
              <QrCode aria-hidden="true" />
              Store QR · {selectedStore.code}
            </p>
            <p className="bfx-qr-note">
              Customers can scan to complete the same survey on their phone.
            </p>
          </div>
          <div className="bfx-qr-actions">
            <button type="button" className="bfx-qr-btn" onClick={() => setShowQrModal(true)}>
              <Maximize2 aria-hidden="true" />
              <span>Enlarge</span>
            </button>
            <button type="button" className="bfx-qr-btn" onClick={handleCopyStoreLink}>
              {qrModalCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              <span>{qrModalCopied ? 'Copied!' : 'Copy link'}</span>
            </button>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="bfx-footer">
          <span>BSC Textiles · Customer Experience</span>
          <span>Shared with {selectedStore.storeName} management.</span>
        </footer>
      </div>

      {/* ── Mobile sticky bottom navigation ─────────────────────────── */}
      <div className="bfx-sticky-nav" data-single={isFirstStep}>
        {!isFirstStep && (
          <button
            type="button"
            onClick={handlePrevStep}
            disabled={submitting}
            className="bfx-btn-ghost"
          >
            <ArrowLeft aria-hidden="true" />
            <span>Back</span>
          </button>
        )}
        {!isLastStep ? (
          <button
            type="button"
            onClick={handleNextStep}
            className="bfx-btn-primary bfx-btn-primary--full"
          >
            <span>Continue</span>
            <ArrowRight aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={submitting}
            className="bfx-btn-primary bfx-btn-primary--full"
          >
            {submitting ? (
              <>
                <span className="bfx-spinner" aria-hidden="true" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>Share My Feedback</span>
                <ArrowRight aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>

      {/* ── QR Enlarge Modal ────────────────────────────────────────── */}
      {showQrModal && selectedStore && (
        <div
          className="bfx-modal-backdrop"
          onClick={() => setShowQrModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedStore.city} feedback QR code`}
        >
          <div className="bfx-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="bfx-modal-close"
              onClick={() => setShowQrModal(false)}
              aria-label="Close modal"
            >
              <X size={16} aria-hidden="true" />
            </button>

            <span className="bfx-modal-badge">
              Store Feedback QR · {selectedStore.code}
            </span>
            <h3 className="bfx-modal-title">BSC Textiles — {selectedStore.city}</h3>
            <p className="bfx-modal-sub">{selectedStore.storeName}</p>

            <div className="bfx-modal-qr-wrap">
              <img
                src={getStoreQrUrl(selectedStore.code, 480)}
                alt={`${selectedStore.city} Feedback QR`}
                width={200}
                height={200}
                loading="lazy"
                decoding="async"
              />
            </div>

            <p className="bfx-modal-url">{getStoreTargetUrl(selectedStore.code)}</p>

            <div className="bfx-modal-actions">
              <button
                type="button"
                className="bfx-btn-primary"
                style={{ fontSize: '0.8125rem', minHeight: '2.625rem' }}
                onClick={handleDownloadStoreQr}
              >
                <Download size={14} aria-hidden="true" />
                <span>Download PNG</span>
              </button>
              <button
                type="button"
                className="bfx-btn-secondary"
                style={{ fontSize: '0.8125rem', minHeight: '2.625rem' }}
                onClick={handleCopyStoreLink}
              >
                {qrModalCopied ? (
                  <>
                    <Check size={14} aria-hidden="true" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} aria-hidden="true" />
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
