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

/**
 * The five steps. `short` labels belong to the progress rail so it fits a phone,
 * `name` is the heading the customer sees for the step they are on — the flow and
 * its wording are unchanged, only how far along it is communicated.
 */
const STEPS = [
  { short: 'Store', name: 'Store & Customer Details' },
  { short: 'Visit', name: 'Overall Shopping Experience' },
  { short: 'Service', name: 'Staff Service & Hospitality' },
  { short: 'Products', name: 'Collection & Ambience' },
  { short: 'Review', name: 'Review & Final Comments' }
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type StepOneErrors = { name?: string; mobile?: string; email?: string };

/**
 * Step 1 validation in one place, so Continue and Submit can never disagree about
 * what counts as a usable answer. Mobile stays optional — a wrong number is worse
 * than none, because management would call it.
 */
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
  // Per-field messages, so a customer is told which box to fix rather than being
  // shown a banner above the form.
  const [fieldErrors, setFieldErrors] = useState<StepOneErrors>({});

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

  /** Re-check a single field once the customer leaves it. */
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
      <div className="bsc-ed-page">
        <div className="bsc-fx-shell">
          <header className="bsc-fx-head">
            <div className="bsc-fx-brand">
              <picture className="bsc-fx-logo">
                <source srcSet="/logo.webp" type="image/webp" />
                <img
                  src="/logo.png"
                  alt="BSC Textiles"
                  width={360}
                  height={270}
                  loading="eager"
                  decoding="async"
                />
              </picture>
              <div className="bsc-fx-brand-text">
                <span className="bsc-fx-eyebrow">BSC Textiles</span>
                <h1 className="bsc-fx-title">Customer Feedback</h1>
              </div>
            </div>
          </header>

          <section className="bsc-fx-success">
            <span className="bsc-fx-success-mark">
              <CheckCircle2 aria-hidden="true" />
            </span>
            <span className="bsc-fx-eyebrow">{selectedStore.storeName}</span>
            <h2 className="bsc-fx-success-title">Thank you</h2>
            <p className="bsc-fx-success-note">
              Your feedback has been saved directly to the {selectedStore.city} store management team.
            </p>

            <div className="bsc-fx-ref">
              <span className="bsc-fx-ref-key">Feedback reference</span>
              <span className="bsc-fx-ref-value">{refNo}</span>
            </div>

            <dl className="bsc-fx-review-grid bsc-fx-success-details">
              <div className="bsc-fx-review-item">
                <dt>Customer</dt>
                <dd>{customerName}</dd>
              </div>
              <div className="bsc-fx-review-item">
                <dt>Section</dt>
                <dd>{sectionId}</dd>
              </div>
              {mobile && (
                <div className="bsc-fx-review-item">
                  <dt>Mobile</dt>
                  <dd className="bsc-fx-mono">+91 {mobile}</dd>
                </div>
              )}
              {billNo && (
                <div className="bsc-fx-review-item">
                  <dt>Bill / memo no</dt>
                  <dd className="bsc-fx-mono">{billNo}</dd>
                </div>
              )}
            </dl>

            <div className="bsc-fx-share">
              <span className="bsc-fx-share-label">
                <QrCode aria-hidden="true" />
                <span>{selectedStore.city} feedback QR code</span>
              </span>
              <div className="bsc-fx-share-thumb">
                <img
                  src={getStoreQrUrl(selectedStore.code, 240)}
                  alt={`${selectedStore.city} Feedback QR`}
                  width={140}
                  height={140}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <p className="bsc-fx-share-note">
                Share this code at the counter so other customers can answer the same survey.
              </p>
              <div className="bsc-fx-share-actions">
                <button type="button" className="bsc-fx-qr-btn" onClick={handleDownloadStoreQr}>
                  <Download aria-hidden="true" />
                  <span>Save QR</span>
                </button>
                <button type="button" className="bsc-fx-qr-btn" onClick={handleCopyStoreLink}>
                  {qrModalCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  <span>{qrModalCopied ? 'Copied' : 'Copy link'}</span>
                </button>
              </div>
            </div>

            <div className="bsc-fx-success-actions">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="bsc-fx-btn-primary"
              >
                <span>Back to BSC Textiles</span>
                <ArrowRight aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="bsc-fx-btn-secondary"
              >
                <span>Submit another response</span>
              </button>
            </div>
          </section>

          <footer className="bsc-fx-foot">
            <span>BSC Textiles · Customer Experience</span>
            <span>{selectedStore.storeName} · {selectedStore.phone}</span>
          </footer>
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
    <div className="bsc-ed-page">
      <div className="bsc-fx-shell">
        {/* Store feedback QR — a sharing tool for staff, deliberately quiet so it
            never competes with the questions a customer is answering. */}
        <div className="bsc-fx-qr">
          <button
            type="button"
            className="bsc-fx-qr-thumb"
            onClick={() => setShowQrModal(true)}
            title={`Enlarge the ${selectedStore.city} feedback QR code`}
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
          <div className="bsc-fx-qr-copy">
            <span className="bsc-fx-qr-label">
              <QrCode aria-hidden="true" />
              Store feedback QR · {selectedStore.code}
            </span>
            <p className="bsc-fx-qr-note">
              Customers can scan this to answer the same survey on their own phone.
            </p>
          </div>
          <div className="bsc-fx-qr-actions">
            <button type="button" className="bsc-fx-qr-btn" onClick={() => setShowQrModal(true)}>
              <Maximize2 aria-hidden="true" />
              <span>Enlarge</span>
            </button>
            <button type="button" className="bsc-fx-qr-btn" onClick={handleCopyStoreLink}>
              {qrModalCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              <span>{qrModalCopied ? 'Copied' : 'Copy link'}</span>
            </button>
          </div>
        </div>

        {/* Header: the brand first, the survey second, the store switch last. */}
        <header className="bsc-fx-head">
          <div className="bsc-fx-brand">
            <picture className="bsc-fx-logo">
              <source srcSet="/logo.webp" type="image/webp" />
              <img
                src="/logo.png"
                alt="BSC Textiles"
                width={360}
                height={270}
                loading="eager"
                decoding="async"
              />
            </picture>
            <div className="bsc-fx-brand-text">
              <span className="bsc-fx-eyebrow">BSC Textiles</span>
              <h1 className="bsc-fx-title">Customer Feedback</h1>
            </div>
          </div>

          <button
            type="button"
            className="bsc-fx-change"
            onClick={() => setSelectedStore(null)}
          >
            <MapPin aria-hidden="true" />
            <span>Change store</span>
          </button>
        </header>

        <p className="bsc-fx-lede">
          We value your experience. Tell us how your visit went — it takes about a
          minute, and the store team reads every response.
        </p>

        {/* Progress */}
        <div className="bsc-fx-progress">
          <div className="bsc-fx-progress-meta">
            <span className="bsc-fx-step-count">Step {currentStep} of {STEPS.length}</span>
            <span className="bsc-fx-step-name">{STEPS[currentStep - 1].name}</span>
          </div>
          <div className="bsc-fx-rail" aria-hidden="true">
            {STEPS.map((step, index) => (
              <span
                key={step.short}
                className="bsc-fx-seg"
                data-state={index + 1 < currentStep ? 'done' : index + 1 === currentStep ? 'current' : 'todo'}
              />
            ))}
          </div>
          <ol className="bsc-fx-steps" aria-label="Survey steps">
            {STEPS.map((step, index) => {
              const state = index + 1 < currentStep ? 'done' : index + 1 === currentStep ? 'current' : 'todo';
              return (
                <li key={step.short} className="bsc-fx-step" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
                  <span className="bsc-fx-step-dot">
                    {state === 'done' ? <Check aria-hidden="true" /> : null}
                  </span>
                  <span className="bsc-fx-step-label">{step.short}</span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="bsc-fx-notice" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Content */}
        <div className="bsc-fx-card">
          <form onSubmit={(e) => e.preventDefault()}>
            {/* STEP 1: Store Confirmation, Customer Info, Section & Bill Details */}
            {currentStep === 1 && (
              <div className="bsc-fx-step-body">
                <section className="bsc-fx-storecard" aria-labelledby="fx-store-heading">
                  <div className="bsc-fx-storecard-head">
                    <span className="bsc-fx-storecard-mark" aria-hidden="true">
                      <Store />
                    </span>
                    <div className="bsc-fx-storecard-body">
                      <span className="bsc-fx-eyebrow">Store visited</span>
                      <p className="bsc-fx-store-name" id="fx-store-heading">
                        BSC Textiles — {selectedStore.city}
                      </p>
                      <p className="bsc-fx-store-address">{selectedStore.address}</p>
                    </div>
                  </div>
                  <div className="bsc-fx-store-meta">
                    <span>
                      <Clock aria-hidden="true" />
                      <span>{selectedStore.hours}</span>
                    </span>
                    <span>
                      <Phone aria-hidden="true" />
                      <span>{selectedStore.phone}</span>
                    </span>
                  </div>
                </section>

                <section className="bsc-fx-section">
                  <h2 className="bsc-fx-section-title">Your details</h2>
                  <p className="bsc-fx-section-note">
                    Please enter your details so we can connect with you if needed.
                  </p>

                  <div className="bsc-fx-fields">
                    <div className="bsc-fx-field" data-invalid={Boolean(fieldErrors.name)}>
                      <label className="bsc-fx-label" htmlFor="fx-name">
                        Customer name
                        <span className="bsc-fx-required" aria-hidden="true">*</span>
                        <span className="sr-only">(required)</span>
                      </label>
                      <div className="bsc-fx-control bsc-fx-has-icon">
                        <User className="bsc-fx-icon" aria-hidden="true" />
                        <input
                          id="fx-name"
                          name="customerName"
                          type="text"
                          autoComplete="name"
                          required
                          aria-required="true"
                          aria-invalid={Boolean(fieldErrors.name)}
                          aria-describedby={fieldErrors.name ? 'fx-name-error' : undefined}
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
                          className="bsc-fx-input"
                        />
                      </div>
                      {fieldErrors.name && (
                        <p className="bsc-fx-error" id="fx-name-error" role="alert">
                          <AlertCircle aria-hidden="true" />
                          <span>{fieldErrors.name}</span>
                        </p>
                      )}
                    </div>

                    <div className="bsc-fx-grid">
                      <div className="bsc-fx-field" data-invalid={Boolean(fieldErrors.mobile)}>
                        <div className="bsc-fx-label-row">
                          <label className="bsc-fx-label" htmlFor="fx-mobile">Mobile number</label>
                          <span className="bsc-fx-optional">Optional</span>
                        </div>
                        <div className="bsc-fx-control">
                          <span className="bsc-fx-prefix" aria-hidden="true">+91</span>
                          <input
                            id="fx-mobile"
                            name="mobile"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            maxLength={10}
                            aria-invalid={Boolean(fieldErrors.mobile)}
                            aria-describedby="fx-mobile-help fx-mobile-error"
                            placeholder="10-digit mobile number"
                            value={mobile}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                              setMobile(value);
                              if (fieldErrors.mobile) {
                                setFieldErrors(prev => ({ ...prev, mobile: validateStepOne({ name: customerName, mobile: value, email }).mobile }));
                              }
                            }}
                            onBlur={() => validateField('mobile')}
                            className="bsc-fx-input"
                          />
                        </div>
                        <p className="bsc-fx-help" id="fx-mobile-help">
                          Used only if store management needs to follow up on your feedback.
                        </p>
                        {fieldErrors.mobile && (
                          <p className="bsc-fx-error" id="fx-mobile-error" role="alert">
                            <AlertCircle aria-hidden="true" />
                            <span>{fieldErrors.mobile}</span>
                          </p>
                        )}
                      </div>

                      <div className="bsc-fx-field" data-invalid={Boolean(fieldErrors.email)}>
                        <div className="bsc-fx-label-row">
                          <label className="bsc-fx-label" htmlFor="fx-email">Email address</label>
                          <span className="bsc-fx-optional">Optional</span>
                        </div>
                        <div className="bsc-fx-control bsc-fx-has-icon">
                          <Mail className="bsc-fx-icon" aria-hidden="true" />
                          <input
                            id="fx-email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            aria-invalid={Boolean(fieldErrors.email)}
                            aria-describedby="fx-email-error"
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
                            className="bsc-fx-input"
                          />
                        </div>
                        {fieldErrors.email && (
                          <p className="bsc-fx-error" id="fx-email-error" role="alert">
                            <AlertCircle aria-hidden="true" />
                            <span>{fieldErrors.email}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="bsc-fx-grid">
                      <div className="bsc-fx-field">
                        <label className="bsc-fx-label" htmlFor="fx-section">
                          Section or department visited
                        </label>
                        <div className="bsc-fx-control bsc-fx-has-icon">
                          <Layers className="bsc-fx-icon" aria-hidden="true" />
                          <select
                            id="fx-section"
                            name="sectionId"
                            value={sectionId}
                            onChange={(e) => setSectionId(e.target.value)}
                            className="bsc-fx-input bsc-fx-select"
                          >
                            <option value="Sarees & Silk Section">Sarees &amp; Silk Section</option>
                            <option value="Bridal Studio & Wedding Trousseau">Bridal Studio &amp; Wedding Trousseau</option>
                            <option value="Menswear & Ethnic Suiting">Menswear &amp; Ethnic Suiting</option>
                            <option value="Kids & Family Wear">Kids &amp; Family Wear</option>
                            <option value="Ground Floor - Main Counter">Ground Floor - Main Counter</option>
                            <option value="Billing & Cash Counter">Billing &amp; Cash Counter</option>
                            <option value="General Store Visit">General Store Visit</option>
                          </select>
                        </div>
                      </div>

                      <div className="bsc-fx-field">
                        <div className="bsc-fx-label-row">
                          <label className="bsc-fx-label" htmlFor="fx-bill">Bill / cash memo number</label>
                          <span className="bsc-fx-optional">Optional</span>
                        </div>
                        <div className="bsc-fx-control bsc-fx-has-icon">
                          <Receipt className="bsc-fx-icon" aria-hidden="true" />
                          <input
                            id="fx-bill"
                            name="billNo"
                            type="text"
                            maxLength={40}
                            aria-describedby="fx-bill-help"
                            placeholder="e.g. INV-10842 or Bill No."
                            value={billNo}
                            onChange={(e) => setBillNo(e.target.value)}
                            className="bsc-fx-input"
                          />
                        </div>
                        <p className="bsc-fx-help" id="fx-bill-help">
                          Helps store management find your purchase details faster.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* STEP 2: Overall Shopping Experience */}
            {currentStep === 2 && (
              <div className="bsc-fx-step-body">
                <div className="bsc-fx-questions">
                  <div className="bsc-fx-q">
                    <p className="bsc-fx-q-title" id="fx-overall-label">
                      Overall experience rating
                    </p>
                    <div className="bsc-fx-stars" role="group" aria-labelledby="fx-overall-label">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => handleRatingChange(score)}
                          className="bsc-fx-star"
                          data-on={score <= overallRating}
                          aria-pressed={score <= overallRating}
                          aria-label={`${score} out of 5`}
                        >
                          <Star aria-hidden="true" fill={score <= overallRating ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                      <span className="bsc-fx-rating-note">
                        {overallRating === 5 && 'Excellent (5/5)'}
                        {overallRating === 4 && 'Good (4/5)'}
                        {overallRating === 3 && 'Average (3/5)'}
                        {overallRating === 2 && 'Fair (2/5)'}
                        {overallRating === 1 && 'Poor (1/5)'}
                      </span>
                    </div>
                  </div>

                  <div className="bsc-fx-q">
                    <p className="bsc-fx-q-title" id="fx-q1-label">
                      How satisfied are you with your shopping experience today?
                    </p>
                    <div className="bsc-fx-options" role="group" aria-labelledby="fx-q1-label">
                      {['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied'].map(
                        (opt) => {
                          const isSelected = answers['q1'] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setAnswers({ ...answers, q1: opt })}
                              className="bsc-fx-option"
                              aria-pressed={isSelected}
                            >
                              <span>{opt}</span>
                              {isSelected && <Check aria-hidden="true" />}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Service & Staff */}
            {currentStep === 3 && (
              <div className="bsc-fx-step-body">
                <div className="bsc-fx-questions">
                  <div className="bsc-fx-q">
                    <p className="bsc-fx-q-title" id="fx-staff-label">
                      Staff service rating
                    </p>
                    <div className="bsc-fx-stars" role="group" aria-labelledby="fx-staff-label">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setStaffRating(score)}
                          className="bsc-fx-star"
                          data-on={score <= staffRating}
                          aria-pressed={score <= staffRating}
                          aria-label={`${score} out of 5`}
                        >
                          <Star aria-hidden="true" fill={score <= staffRating ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                      <span className="bsc-fx-rating-note">{staffRating}/5</span>
                    </div>
                  </div>

                  <div className="bsc-fx-q">
                    <p className="bsc-fx-q-title" id="fx-q4-label">
                      How would you rate the service and helpfulness of our staff?
                    </p>
                    <div className="bsc-fx-options" role="group" aria-labelledby="fx-q4-label">
                      {['Extremely helpful', 'Helpful', 'Average', 'Needs improvement'].map((opt) => {
                        const isSelected = answers['q4'] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswers({ ...answers, q4: opt })}
                            className="bsc-fx-option"
                            aria-pressed={isSelected}
                          >
                            <span>{opt}</span>
                            {isSelected && <Check aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bsc-fx-q">
                    <p className="bsc-fx-q-title" id="fx-q5-label">
                      How likely are you to recommend BSC Textiles to others?
                    </p>
                    <div className="bsc-fx-options" role="group" aria-labelledby="fx-q5-label">
                      {['Definitely recommend', 'Probably recommend', 'Neutral', 'Not recommend'].map(
                        (opt) => {
                          const isSelected = answers['q5'] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setAnswers({ ...answers, q5: opt })}
                              className="bsc-fx-option"
                              aria-pressed={isSelected}
                            >
                              <span>{opt}</span>
                              {isSelected && <Check aria-hidden="true" />}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Products & Store */}
            {currentStep === 4 && (
              <div className="bsc-fx-step-body">
                <div className="bsc-fx-questions">
                  <div className="bsc-fx-q">
                    <p className="bsc-fx-q-title" id="fx-product-label">
                      Product &amp; fabric collection rating
                    </p>
                    <div className="bsc-fx-stars" role="group" aria-labelledby="fx-product-label">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setProductRating(score)}
                          className="bsc-fx-star"
                          data-on={score <= productRating}
                          aria-pressed={score <= productRating}
                          aria-label={`${score} out of 5`}
                        >
                          <Star aria-hidden="true" fill={score <= productRating ? 'currentColor' : 'none'} />
                        </button>
                      ))}
                      <span className="bsc-fx-rating-note">{productRating}/5</span>
                    </div>
                  </div>

                  <div className="bsc-fx-q">
                    <p className="bsc-fx-q-title" id="fx-q2-label">
                      Did you find the products and fabrics you were looking for?
                    </p>
                    <div className="bsc-fx-options" role="group" aria-labelledby="fx-q2-label">
                      {['Yes, exactly what I wanted', 'Yes, with assistance', 'Partially', 'No'].map(
                        (opt) => {
                          const isSelected = answers['q2'] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setAnswers({ ...answers, q2: opt })}
                              className="bsc-fx-option"
                              aria-pressed={isSelected}
                            >
                              <span>{opt}</span>
                              {isSelected && <Check aria-hidden="true" />}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  <div className="bsc-fx-q">
                    <p className="bsc-fx-q-title" id="fx-q3-label">
                      How would you rate the quality and variety of our collections?
                    </p>
                    <div className="bsc-fx-options" role="group" aria-labelledby="fx-q3-label">
                      {['Excellent', 'Good', 'Average', 'Poor'].map((opt) => {
                        const isSelected = answers['q3'] === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswers({ ...answers, q3: opt })}
                            className="bsc-fx-option"
                            aria-pressed={isSelected}
                          >
                            <span>{opt}</span>
                            {isSelected && <Check aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bsc-fx-grid">
                    <div className="bsc-fx-subcard">
                      <span className="bsc-fx-label" id="fx-cleanliness-label">
                        Store cleanliness ({cleanlinessRating}/5)
                      </span>
                      <div className="bsc-fx-stars" role="group" aria-labelledby="fx-cleanliness-label">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setCleanlinessRating(s)}
                            className="bsc-fx-star-mini"
                            data-on={s <= cleanlinessRating}
                            aria-pressed={s <= cleanlinessRating}
                            aria-label={`${s} out of 5`}
                          >
                            <Star aria-hidden="true" fill={s <= cleanlinessRating ? 'currentColor' : 'none'} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bsc-fx-subcard">
                      <span className="bsc-fx-label" id="fx-ambience-label">
                        Store ambience ({ambienceRating}/5)
                      </span>
                      <div className="bsc-fx-stars" role="group" aria-labelledby="fx-ambience-label">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setAmbienceRating(s)}
                            className="bsc-fx-star-mini"
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
                </div>
              </div>
            )}

            {/* STEP 5: Review Summary & Additional Comments */}
            {currentStep === 5 && (
              <div className="bsc-fx-step-body">
                <div className="bsc-fx-questions">
                  <section className="bsc-fx-review" aria-label="Review your visit details">
                    <div className="bsc-fx-review-head">
                      <span className="bsc-fx-review-title">
                        <Sparkles aria-hidden="true" />
                        <span>Review your visit</span>
                      </span>
                      <span className="bsc-fx-review-code">{selectedStore.code}</span>
                    </div>

                    <dl className="bsc-fx-review-grid">
                      <div className="bsc-fx-review-item">
                        <dt>Customer</dt>
                        <dd>{customerName}</dd>
                      </div>
                      <div className="bsc-fx-review-item">
                        <dt>Mobile</dt>
                        <dd className="bsc-fx-mono">{mobile ? `+91 ${mobile}` : 'Not provided'}</dd>
                      </div>
                      <div className="bsc-fx-review-item">
                        <dt>Section</dt>
                        <dd>{sectionId}</dd>
                      </div>
                      <div className="bsc-fx-review-item">
                        <dt>Bill / memo no</dt>
                        <dd className="bsc-fx-mono">{billNo || 'Not provided'}</dd>
                      </div>
                      <div className="bsc-fx-review-item">
                        <dt>Store rating</dt>
                        <dd className="bsc-fx-review-score">
                          <Star aria-hidden="true" fill="currentColor" />
                          <span>{overallRating} / 5</span>
                        </dd>
                      </div>
                      <div className="bsc-fx-review-item">
                        <dt>Staff service</dt>
                        <dd className="bsc-fx-review-score">
                          <Star aria-hidden="true" fill="currentColor" />
                          <span>{staffRating} / 5</span>
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <div className="bsc-fx-field">
                    <label className="bsc-fx-label" htmlFor="fx-liked">
                      What did you like most about your visit today?
                    </label>
                    <textarea
                      id="fx-liked"
                      rows={3}
                      placeholder="Tell us what stood out positively..."
                      value={likedMost}
                      onChange={(e) => setLikedMost(e.target.value)}
                      className="bsc-fx-textarea"
                    />
                  </div>

                  <div className="bsc-fx-field">
                    <label className="bsc-fx-label" htmlFor="fx-improve">
                      What can we improve to serve you better?
                    </label>
                    <textarea
                      id="fx-improve"
                      rows={3}
                      placeholder="Share any suggestions or areas for improvement..."
                      value={canImprove}
                      onChange={(e) => setCanImprove(e.target.value)}
                      className="bsc-fx-textarea"
                    />
                  </div>

                  <div className="bsc-fx-field">
                    <label className="bsc-fx-label" htmlFor="fx-comments">
                      Any additional comments or compliments?
                      <span className="bsc-fx-optional">Optional</span>
                    </label>
                    <textarea
                      id="fx-comments"
                      rows={3}
                      placeholder="Optional additional notes for store management..."
                      value={additionalComments}
                      onChange={(e) => setAdditionalComments(e.target.value)}
                      className="bsc-fx-textarea"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation & Submit Controls */}
            <div className="bsc-fx-actions" data-single={currentStep === 1}>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={submitting}
                  className="bsc-fx-btn-ghost"
                >
                  <ArrowLeft aria-hidden="true" />
                  <span>Back</span>
                </button>
              )}

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="bsc-fx-btn-primary bsc-fx-submit"
                >
                  <span>Continue</span>
                  <ArrowRight aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={submitting}
                  className="bsc-fx-btn-primary bsc-fx-submit"
                >
                  {submitting ? (
                    <>
                      <span className="bsc-fx-spinner" aria-hidden="true" />
                      <span>Saving your feedback...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit feedback</span>
                      <Check aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        <footer className="bsc-fx-foot">
          <span>BSC Textiles · Customer Experience</span>
          <span>Shared with {selectedStore.storeName} management.</span>
        </footer>
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
