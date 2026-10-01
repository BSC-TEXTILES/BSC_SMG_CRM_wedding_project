import React, { useState } from 'react';
import { 
  X, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import { API, UserSession } from '../../services/api';
import { showToast } from '../Toast';
import ModalPortal from './ModalPortal';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession | null;
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
  session
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Password strength calculation
  const getStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-gray-200' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-amber-500' };
    if (score <= 4) return { score: 2, label: 'Medium', color: 'bg-blue-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getStrength(newPassword);
  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      const res = await API.changePassword(currentPassword, newPassword, confirmPassword);
      if (res?.success) {
        setSuccess('Password updated successfully!');
        showToast('Password updated successfully!', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res?.error || res?.message || 'Failed to update password. Please check your current password.');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while updating your password.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    if (loading) return;
    setError(null);
    setSuccess(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <ModalPortal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Update Password"
    >
      <div 
        className="w-full max-w-md max-h-[90vh] max-h-[90dvh] flex flex-col bg-[#FFFFFF] rounded-3xl shadow-2xl border border-[#E1DDD3] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#123C35] px-6 py-5 text-white flex items-center justify-between border-b border-[#C9A45C]/25 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-[#E4CB92] border border-[#C9A45C]/30 shadow-inner">
              <KeyRound className="w-5 h-5 text-[#E4CB92]" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white leading-tight">
                Update Password
              </h3>
              <p className="text-[11px] text-[#E4CB92] font-bold uppercase tracking-wider mt-0.5">
                {session?.fullName || session?.username} · {session?.role || 'User'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            disabled={loading}
            className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Current Password */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-primary">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
              <input
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                disabled={loading}
                required
                className="input-modern w-full !pl-10 !pr-10 text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-primary">
              New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
              <input
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                disabled={loading}
                required
                className="input-modern w-full !pl-10 !pr-10 text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength indicator */}
            {newPassword.length > 0 && (
              <div className="pt-1 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-text-secondary">Password Strength:</span>
                  <span className={strength.score === 3 ? 'text-emerald-600' : strength.score === 2 ? 'text-blue-600' : 'text-amber-600'}>
                    {strength.label}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex gap-1">
                  <div className={`h-full flex-1 rounded-full transition-all ${strength.score >= 1 ? strength.color : 'bg-gray-200'}`} />
                  <div className={`h-full flex-1 rounded-full transition-all ${strength.score >= 2 ? strength.color : 'bg-gray-200'}`} />
                  <div className={`h-full flex-1 rounded-full transition-all ${strength.score >= 3 ? strength.color : 'bg-gray-200'}`} />
                </div>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-primary">
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
              <input
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type your new password"
                disabled={loading}
                required
                className="input-modern w-full !pl-10 !pr-10 text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {passwordsMatch && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Passwords match</span>
              </div>
            )}
            {passwordsMismatch && (
              <div className="flex items-center gap-1.5 text-[11px] text-rose-500 font-bold mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Passwords do not match</span>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-[#EDF3F0] border border-[#C9A45C]/20 text-[11px] text-[#65716C] space-y-1">
            <div className="font-bold text-[#123C35] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span>Password Security Rules:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1 text-[10.5px]">
              <li>Must be at least 6 characters in length</li>
              <li>Must differ from your current password</li>
              <li>Takes effect immediately on all devices</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleModalClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-[#E1DDD3] text-[#65716C] hover:bg-[#EDF3F0] font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="px-5 py-2.5 rounded-xl bg-[#123C35] text-white hover:bg-[#082821] font-black text-xs tracking-wide transition-all shadow-md shadow-[#123C35]/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#E4CB92]" />
                  <span>Updating…</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 text-[#E4CB92]" />
                  <span>Save New Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
