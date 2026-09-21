import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import { ArrowLeft, Mail, ShieldCheck, MapPin } from 'lucide-react';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await API.requestPasswordReset(email.trim());
      if (res.success) {
        setSuccess(true);
        showToast('Password reset instructions have been sent to your email', 'success');
      } else {
        setErrorMsg(res.message || 'Failed to send reset instructions. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send reset instructions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6">
        <ToastContainer />
        <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-accent-soft animate-fade-in">
          <div className="bg-primary p-6 flex items-center gap-4 border-b border-accent/30">
            <img src="/logo.png" alt="BSC Logo" className="w-12 h-12 object-contain rounded-2xl bg-white p-1.5 shadow-md border border-accent/30" />
            <div>
              <h2 className="text-lg font-black text-primary leading-tight tracking-tight">Password Reset</h2>
              <div className="text-[10px] text-accent font-bold uppercase tracking-widest mt-0.5">
                BSC EXCLUSIVE · MULTI-LOCATION SYSTEM
              </div>
            </div>
          </div>

          <div className="p-7 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-5">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-black text-primary tracking-tight mb-2">Check Your Email</h3>
            <p className="text-sm text-primary font-medium leading-relaxed mb-6">
              If an account exists with the email address you provided, password reset instructions have been sent. 
              The link will expire in 1 hour for security.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 px-4 rounded-xl bg-primary text-white font-extrabold text-xs tracking-wide hover:bg-primary-hover active:scale-[0.99] transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Login</span>
            </button>
          </div>

          <div className="bg-background px-7 py-3.5 border-t border-accent-soft flex items-center justify-between text-[10px] text-primary font-semibold">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span>Authorized access only · Location auto-assigned</span>
            </span>
            <span className="font-black text-primary">BSC v3.0</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6">
      <ToastContainer />

      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-accent-soft animate-fade-in">
        {/* Card Header */}
        <div className="bg-[#101C36] p-6 flex items-center gap-4 border-b border-[#C9A45C]/30 shadow-sm">
          <img src="/logo.png" alt="BSC Logo" className="w-12 h-12 object-contain rounded-2xl bg-white p-1.5 shadow-md border border-[#C9A45C]/30" />
          <div>
            <h2 className="text-lg font-black text-white leading-tight tracking-tight">Password Reset</h2>
            <div className="text-[11px] text-[#E5C378] font-extrabold uppercase tracking-wider mt-0.5">
              BSC EXCLUSIVE · MULTI-LOCATION SYSTEM
            </div>
          </div>
        </div>

        {/* Card Body */}
        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <h3 className="text-xl font-black text-primary tracking-tight">Forgot Password</h3>
            <p className="text-xs text-primary font-medium mt-1">
              Enter your registered email address and we'll send you a secure link to reset your password.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#FDE8E8] border border-[#F5B7B7] text-[#C0392B] text-xs font-semibold animate-fade-in">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-primary">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" />
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@bsctextiles.com"
                className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-accent-soft bg-white text-primary placeholder-primary/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-xs"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-extrabold text-xs tracking-wide hover:bg-primary-hover active:scale-[0.99] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Sending Reset Link…</span>
              </>
            ) : (
              <>
                <span>Send Password Reset Link</span>
                <Mail className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-primary font-medium">
            <ArrowLeft className="w-3 h-3" />
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="hover:underline"
            >
              Remember your password? Sign in
            </button>
          </div>
        </form>

        {/* Card Footer */}
        <div className="bg-background px-7 py-3.5 border-t border-accent-soft flex items-center justify-between text-[10px] text-primary font-semibold">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>Authorized access only · Location auto-assigned</span>
          </span>
          <span className="font-black text-primary">BSC v3.0</span>
        </div>
      </div>

      {/* Location Info Note */}
      <div className="mt-4 flex items-center gap-1.5 text-[10px] text-primary font-medium">
        <MapPin className="w-3 h-3 text-accent" />
        <span>Your location (Belagavi / Davanagere / Shivamogga) is assigned by the System Admin</span>
      </div>
    </div>
  );
}
