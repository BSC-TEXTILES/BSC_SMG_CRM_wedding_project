import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '../services/api';
import { ShieldCheck, ShieldAlert, Mail, ArrowLeft, RefreshCw, CheckCircle, AlertCircle, Loader2, Home, Sparkles } from 'lucide-react';
import { showToast } from '../components/Toast';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'resending'>('loading');
  const [message, setMessage] = useState('');
  const [emailAddress, setEmailAddress] = useState(email || '');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (token) {
      verifyToken();
    } else if (email) {
      setStatus('loading');
      setMessage('Sending verification link...');
      sendVerificationLink();
    }
  }, [token, email]);

  const verifyToken = async () => {
    try {
      const res = await API.verifyEmail(token!);
      if (res.success) {
        setStatus('success');
        setMessage(res.message || 'Email verified successfully! You can now log in.');
        showToast('Email verified successfully! You can now log in.', 'success');
      } else {
        setStatus('error');
        setMessage(res.message || 'Invalid or expired verification link.');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Verification failed. Please try again.');
    }
  };

  const sendVerificationLink = async () => {
    if (!emailAddress.trim()) return;
    try {
      setStatus('loading');
      setMessage('Sending verification link...');
      const res = await API.sendEmailVerification(emailAddress.trim());
      if (res.success) {
        setStatus('loading');
        setMessage(`Verification link sent to ${emailAddress}. Check your inbox.`);
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setStatus('error');
        setMessage(res.message || 'Failed to send verification link.');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to send verification link.');
    }
  };

  const handleResend = () => {
    setCountdown(60);
    sendVerificationLink();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-border shadow-md hover:shadow-lg text-text-primary hover:text-[#101C36] text-xs font-bold transition-all active:scale-95 group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-text-secondary group-hover:-translate-x-0.5 transition-transform" />
          <Home className="w-3.5 h-3.5 text-[#C9A45C]" />
          <span>Back to Home</span>
        </button>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-accent-soft animate-fade-in">
        {/* Card Header */}
        <div className="bg-[#101C36] p-5 sm:p-6 flex items-center gap-3.5 border-b border-[#C9A45C]/30 shadow-sm">
          <div className="w-14 h-12 rounded-2xl bg-white p-1 shadow-md border border-[#C9A45C]/30 flex items-center justify-center flex-shrink-0">
            <img src="/logo.png" alt="BSC Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-white leading-tight tracking-tight truncate">Enterprise Operations Portal</h2>
            <div className="text-[11px] text-[#E5C378] font-extrabold uppercase tracking-wider mt-0.5 truncate">
              BSC Textiles · MULTI-LOCATION SYSTEM
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-7 space-y-5">
          <div className="text-center space-y-3">
            {status === 'loading' && (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-[#F6F4EF] flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-[#C9A45C] animate-spin" />
                </div>
                <h3 className="text-lg font-black text-text-primary">Verifying Your Email</h3>
                <p className="text-xs text-text-secondary font-medium">{message}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-black text-text-primary">Email Verified!</h3>
                <p className="text-xs text-text-secondary font-medium leading-relaxed">{message}</p>
                <div className="mt-6 pt-4 border-t border-border">
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full py-3 px-4 rounded-xl bg-[#101C36] text-white font-extrabold text-xs tracking-wide hover:bg-[#07101F] transition-all shadow-lg shadow-[#101C36]/20 flex items-center justify-center gap-2"
                  >
                    <span>Go to Sign In</span>
                    <Sparkles className="w-4 h-4 text-amber-600" />
                  </button>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-rose-600" />
                </div>
                <h3 className="text-lg font-black text-text-primary">Verification Failed</h3>
                <p className="text-xs text-text-secondary font-medium leading-relaxed">{message}</p>
                <div className="mt-4 space-y-3">
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full py-3 px-4 rounded-xl bg-[#101C36] text-white font-extrabold text-xs tracking-wide hover:bg-[#07101F] transition-all shadow-lg shadow-[#101C36]/20 flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Sign In</span>
                  </button>
                  <button
                    onClick={() => navigate('/login?sendVerification=true')}
                    className="w-full py-3 px-4 rounded-xl border border-[#DFDDD7] bg-white text-[#182033] font-extrabold text-xs hover:bg-[#F6F4EF] transition-all"
                  >
                    <Mail className="w-4 h-4 inline mr-1" />
                    <span>Request New Verification Link</span>
                  </button>
                </div>
              </>
            )}

            {status === 'resending' && (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-[#F6F4EF] flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-[#C9A45C]" />
                </div>
                <h3 className="text-lg font-black text-text-primary">Verification Link Sent</h3>
                <p className="text-xs text-text-secondary font-medium leading-relaxed">
                  A new verification link has been sent to <span className="font-semibold text-[#101C36]">{emailAddress}</span>.
                  Please check your inbox (and spam folder).
                </p>
                <div className="mt-4 p-4 rounded-xl bg-[#F6F4EF] border border-[#DFDDD7] text-center">
                  <p className="text-xs text-text-secondary font-medium">
                    You can request another link in <span className="font-mono font-black text-[#C9A45C]">{formatTime(countdown)}</span>
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  <button
                    onClick={handleResend}
                    disabled={countdown > 0}
                    className="w-full py-3 px-4 rounded-xl bg-[#101C36] text-white font-extrabold text-xs tracking-wide hover:bg-[#07101F] transition-all shadow-lg shadow-[#101C36]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {countdown > 0 ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Resend Link ({formatTime(countdown)})</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Resend Verification Link</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-border text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-xs text-text-secondary hover:text-text-primary font-bold hover:underline flex items-center justify-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </div>

        {/* Card Footer */}
        <div className="bg-background px-7 py-3.5 border-t border-border flex items-center justify-between text-xs text-text-secondary font-semibold">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Authorized access only · Location auto-assigned</span>
          </span>
          <span className="font-bold text-text-primary">BSC v3.0</span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-text-secondary font-medium">
        <Home className="w-3.5 h-3.5 text-text-secondary" />
        <span>Your location (Belagavi / Davanagere / Shivamogga) is assigned by the System Admin</span>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}