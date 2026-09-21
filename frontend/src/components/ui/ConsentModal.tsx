import React, { useState, useRef, useEffect } from 'react';
import { X, ShieldCheck, FileText, ChevronDown, Lock } from 'lucide-react';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import TermsAndConditionsModal from './TermsAndConditionsModal';
import { API } from '../../services/api';

interface ConsentModalProps {
  isOpen: boolean;
  onConsentComplete: () => void;
}

type ConsentStep = 'initial' | 'privacy' | 'terms' | 'confirm';

export default function ConsentModal({ isOpen, onConsentComplete }: ConsentModalProps) {
  const [step, setStep] = useState<ConsentStep>('initial');
  const [privacyRead, setPrivacyRead] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPrivacyFull, setShowPrivacyFull] = useState(false);
  const [showTermsFull, setShowTermsFull] = useState(false);
  const [policyVersions, setPolicyVersions] = useState({ privacyPolicy: { version: '1.0' }, terms: { version: '1.0' } });
  const [scrolledPrivacy, setScrolledPrivacy] = useState(false);
  const [scrolledTerms, setScrolledTerms] = useState(false);

  const privacyScrollRef = useRef<HTMLDivElement>(null);
  const termsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      API.getPolicyVersions().then((res: any) => {
        if (res?.data) setPolicyVersions(res.data);
      }).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setStep('initial');
      setPrivacyRead(false);
      setTermsRead(false);
      setPrivacyAccepted(false);
      setTermsAccepted(false);
      setShowPrivacyFull(false);
      setShowTermsFull(false);
      setScrolledPrivacy(false);
      setScrolledTerms(false);
    }
  }, [isOpen]);

  const handlePrivacyScroll = () => {
    const el = privacyScrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      setScrolledPrivacy(true);
    }
  };

  const handleTermsScroll = () => {
    const el = termsScrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      setScrolledTerms(true);
    }
  };

  const handleAccept = async () => {
    if (!privacyAccepted || !termsAccepted) return;
    setLoading(true);
    try {
      const res = await API.acceptConsent(true, true);
      if (res?.success) {
        onConsentComplete();
      }
    } catch (err: any) {
      console.error('[ConsentModal] Accept failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const canProceed = privacyAccepted && termsAccepted;

  if (!isOpen) return null;

  // Full-screen Privacy Policy / Terms viewer
  if (showPrivacyFull) {
    return (
      <PrivacyPolicyModal
        isOpen={true}
        onClose={() => setShowPrivacyFull(false)}
        onAccept={() => { setPrivacyRead(true); setShowPrivacyFull(false); }}
      />
    );
  }
  if (showTermsFull) {
    return (
      <TermsAndConditionsModal
        isOpen={true}
        onClose={() => setShowTermsFull(false)}
        onAccept={() => { setTermsRead(true); setShowTermsFull(false); }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-primary/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-accent-soft w-full max-w-lg max-h-[90vh] flex flex-col animate-scale-in overflow-hidden">

        {/* Header */}
        <div className="bg-primary px-6 py-4 flex items-center justify-between border-b border-accent/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">Required Consent</h2>
              <p className="text-[10px] text-accent font-bold uppercase tracking-widest">BSC Textiles Pvt Ltd</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <p className="text-xs text-primary font-medium leading-relaxed">
            Before continuing, please review and accept both our Privacy Policy and Terms & Conditions. You must read each document in full before accepting.
          </p>

          {/* Privacy Policy Card */}
          <div className={`rounded-2xl border-2 transition-all ${privacyAccepted ? 'border-emerald-400 bg-emerald-50/50' : 'border-accent-soft bg-white'}`}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-primary">Privacy Policy</h3>
                    <p className="text-[10px] text-primary/50 font-bold">Version {policyVersions.privacyPolicy.version}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${privacyAccepted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {privacyAccepted ? 'Accepted' : 'Required'}
                </span>
              </div>

              {!privacyRead ? (
                <div className="mt-3 space-y-2">
                  <div ref={privacyScrollRef} className="max-h-32 overflow-y-auto rounded-xl bg-background border border-accent-soft p-3 text-[10.5px] text-primary/70 leading-relaxed space-y-2">
                    <p>This Privacy Policy explains how BSC Textiles Pvt Ltd collects, uses, protects, and handles your personal data when you use our platform.</p>
                    <p><strong>Key points:</strong> We collect your name, contact details, order information, and device data. We use this to provide services, process orders, and improve your experience. We do not sell your data. You have rights to access, correct, and delete your data.</p>
                    <p>By accepting, you consent to the collection, use, and processing of your personal data as described in the full Privacy Policy.</p>
                    <p className="text-accent font-bold">Click "Read Full Policy" to review the complete document.</p>
                  </div>
                  <button
                    onClick={() => setShowPrivacyFull(true)}
                    className="w-full py-2 rounded-xl border border-accent-soft bg-white text-primary text-xs font-bold hover:bg-background transition-colors"
                  >
                    Read Full Privacy Policy
                  </button>
                  {!scrolledPrivacy && (
                    <p className="text-[10px] text-primary/40 font-medium flex items-center gap-1">
                      <ChevronDown className="w-3 h-3 animate-bounce" />
                      Scroll to bottom to enable acceptance
                    </p>
                  )}
                </div>
              ) : (
                <label className="mt-3 flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-accent-soft text-primary focus:ring-accent/30 accent-primary"
                  />
                  <span className="text-[11px] font-semibold text-primary leading-snug">
                    I have read and agree to the <span className="font-black">Privacy Policy</span> (v{policyVersions.privacyPolicy.version}). I consent to the collection, use, and processing of my personal data.
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Terms Card */}
          <div className={`rounded-2xl border-2 transition-all ${termsAccepted ? 'border-emerald-400 bg-emerald-50/50' : 'border-accent-soft bg-white'}`}>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-primary">Terms & Conditions</h3>
                    <p className="text-[10px] text-primary/50 font-bold">Version {policyVersions.terms.version}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${termsAccepted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {termsAccepted ? 'Accepted' : 'Required'}
                </span>
              </div>

              {!termsRead ? (
                <div className="mt-3 space-y-2">
                  <div ref={termsScrollRef} className="max-h-32 overflow-y-auto rounded-xl bg-background border border-accent-soft p-3 text-[10.5px] text-primary/70 leading-relaxed space-y-2">
                    <p>These Terms govern your use of the BSC Textiles platform, including browsing, account creation, orders, payments, and services.</p>
                    <p><strong>Key points:</strong> You agree to provide accurate information, keep your account secure, and follow applicable laws. We are not liable for third-party services. Intellectual property belongs to BSC Textiles. Disputes are governed by Indian law.</p>
                    <p>By accepting, you agree to be bound by these Terms and Conditions in their entirety.</p>
                    <p className="text-accent font-bold">Click "Read Full Terms" to review the complete document.</p>
                  </div>
                  <button
                    onClick={() => setShowTermsFull(true)}
                    className="w-full py-2 rounded-xl border border-accent-soft bg-white text-primary text-xs font-bold hover:bg-background transition-colors"
                  >
                    Read Full Terms & Conditions
                  </button>
                  {!scrolledTerms && (
                    <p className="text-[10px] text-primary/40 font-medium flex items-center gap-1">
                      <ChevronDown className="w-3 h-3 animate-bounce" />
                      Scroll to bottom to enable acceptance
                    </p>
                  )}
                </div>
              ) : (
                <label className="mt-3 flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-accent-soft text-primary focus:ring-accent/30 accent-primary"
                  />
                  <span className="text-[11px] font-semibold text-primary leading-snug">
                    I have read and agree to the <span className="font-black">Terms & Conditions</span> (v{policyVersions.terms.version}). I agree to be bound by these terms.
                  </span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-accent-soft px-6 py-4 bg-background/50 flex-shrink-0">
          <button
            onClick={handleAccept}
            disabled={!canProceed || loading}
            className="w-full py-3.5 rounded-xl bg-primary text-white font-extrabold text-xs tracking-wide hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Saving consent...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>I Agree & Continue</span>
              </>
            )}
          </button>
          {!canProceed && (
            <p className="text-[10px] text-primary/40 font-medium text-center mt-2">
              You must read and accept both documents to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
