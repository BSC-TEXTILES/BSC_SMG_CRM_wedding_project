import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { API, Auth } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import { ShieldCheck, Lock, User, ArrowRight, ArrowLeft, MapPin, RefreshCw, Hash, Eye, EyeOff, Sparkles, Search, Home } from 'lucide-react';
import PrivacyPolicyModal from '../components/ui/PrivacyPolicyModal';
import TermsAndConditionsModal from '../components/ui/TermsAndConditionsModal';
import { resolvePostLoginRoute } from '../utils/moduleRegistry';
import { permissionsCache } from '../context/PermissionsCache';

/**
 * Infrastructure failures reach the UI as raw browser/CORS/server text. Those are
 * diagnostics, not instructions, so they are logged for devtools and replaced with
 * something a user can act on. Genuine auth responses (bad credentials, wrong
 * security code, lockout) are already human-readable and pass through untouched.
 */
const INFRA_ERROR_COPY: Array<[RegExp, string]> = [
  [/cross-origin|cors|security policy/i, 'Unable to reach the authentication service. Please check your connection and try again.'],
  [/failed to fetch|networkerror|load failed|err_connection|err_network/i, 'Unable to connect. Please check your internet connection and try again.'],
  [/temporarily unavailable|service unavailable|econnrefused|gateway/i, 'The authentication service is temporarily unavailable. Please try again shortly.'],
  [/timeout|timed out|abort/i, 'The request timed out. Please try again.']
];

function describeSignInFailure(raw?: string): string {
  const text = (raw || '').trim();
  const match = INFRA_ERROR_COPY.find(([re]) => re.test(text));
  if (match) {
    console.warn('[Login] infrastructure failure:', text);
    return match[1];
  }
  return text || 'Sign-in failed. Please check your details and the security code.';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaText, setCaptchaText] = useState('');
  const captchaTextRef = React.useRef(captchaText);
  captchaTextRef.current = captchaText;
  const [codeLength, setCodeLength] = useState(4);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [showPassword, setShowPassword] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Rate limit & 10-minute temporary lockout state
  const [isLocked, setIsLocked] = useState(false);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);

  // 2FA state
  const [show2fa, setShow2fa] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [partialAuth, setPartialAuth] = useState<any>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  // Validate password utility - basic client-side check
  // Server-side validation is the primary security check
  const validatePassword = (pwd: string) => {
    const hasLength = pwd.length >= 4; // Minimum 4 characters
    return hasLength;
  };

  // Check lock status with the backend (persists across page refresh, multi-tab, etc.)
  const checkServerLock = React.useCallback(async (userToCheck?: string) => {
    try {
      const uname = userToCheck !== undefined ? userToCheck : username;
      const res = await API.getLockStatus(uname.trim());
      if (res && res.data) {
        if (res.data.isLocked && res.data.remainingSeconds > 0) {
          setIsLocked(true);
          setLockRemainingSeconds(res.data.remainingSeconds);
        } else {
          setIsLocked(false);
          setLockRemainingSeconds(0);
        }
      }
    } catch {
      // Ignore network errors on check
    }
  }, [username]);

  // Initial check on mount
  useEffect(() => {
    checkServerLock();
    try {
      const logoutReason = localStorage.getItem('bsc_logout_reason');
      if (logoutReason) {
        localStorage.removeItem('bsc_logout_reason');
        showToast(logoutReason, 'info');
      }
    } catch (e) {}
  }, [checkServerLock]);

  // 1-second countdown interval for the 10-minute lockout timer
  useEffect(() => {
    if (!isLocked || lockRemainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsLocked(false);
          clearInterval(timer);
          // Re-verify with server that lock has expired
          checkServerLock();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLocked, lockRemainingSeconds, checkServerLock]);

  const formatLockTimer = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── Numeric captcha: fetched from the server, auto-refreshed every 30 s,
  // and reloaded automatically after any failed sign-in attempt. ──
  const loadCaptcha = React.useCallback(async (force = false) => {
    // Don't refresh if user is currently typing in captcha (unless forced)
    if (!force && captchaTextRef.current && captchaTextRef.current.length > 0) {
      return;
    }
    setCaptchaLoading(true);
    try {
      const res = await API.getCaptcha();
      if (res?.data?.svg) {
        // Use URI-encoded SVG for reliable rendering in <img>
        // btoa can fail with certain characters; encodeURIComponent is more reliable
        setCaptchaSvg('data:image/svg+xml,' + encodeURIComponent(res.data.svg));
        setCaptchaId(res.data.captchaId);
        if (typeof res.data.codeLength === 'number' && res.data.codeLength > 0) {
          setCodeLength(res.data.codeLength);
        }
      }
    } catch (err: any) {
      console.warn('[LoadCaptcha Error]', err.message);
      setCaptchaSvg('');
    } finally {
      setCaptchaLoading(false);
      if (force) setCaptchaText('');
    }
  }, []);

  useEffect(() => {
    loadCaptcha(true);
    setCountdown(30);
    const t = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadCaptcha(false);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [loadCaptcha]);

  useEffect(() => {
    if (Auth.check()) {
      const user = Auth.get();
      resolvePostLoginRoute(user).then((route) => {
        navigate(route, { replace: true });
      }).catch(() => {
        navigate('/no-access', { replace: true });
      });
    }
  }, [navigate]);

  // Clear any residual notices on mount
  useEffect(() => {
    sessionStorage.removeItem('bsc_login_notice');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await API.login(username.trim(), password, captchaId, captchaText);

      if (res.success && res.data) {
        // Check if 2FA is required
        if (res.requires2fa) {
          // Show 2FA verification step
          setPartialAuth(res.partialAuth || { userId: res.data?.userId });
          setShow2fa(true);
          setOtpDigits(['', '', '', '', '', '']);
          setOtp('');
          setOtpError('');
          setResendCooldown(0);
          showToast(res.message || 'A verification code has been sent to your email.', 'info');
          setLoading(false);
          return;
        }

        // No 2FA required - complete login directly
        const user = res.data.user;

        // Reset lockout state on success
        setIsLocked(false);
        setLockRemainingSeconds(0);

        // Save full session including location fields, allowed modules, and token
        const authToken = res.data?.token || res.token || null;
        const refreshToken = res.data?.refreshToken || res.refreshToken || null;
        Auth.save({
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.fullName,
          displayName: user.displayName || user.fullName || user.role,
          employeeId: user.employeeId ?? null,
          // Location fields — set by the server from the user's DB record
          locationId: user.locationId ?? null,
          locationCode: user.locationCode ?? null,
          locationName: user.locationName ?? null,
          allowedLocations: user.allowedLocations || [],
          isGlobalAdmin: user.isGlobalAdmin === true || user.locationId === null,
          modules: user.modules || [],
          token: authToken
        }, authToken, refreshToken);

        const locationLabel = user.locationName ? ` — ${user.locationName}` : '';
        showToast(`Welcome back, ${user.fullName || user.username}${locationLabel}`, 'success');

        // Record the sign-in device location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                // Token is in HttpOnly cookie, sent automatically
                await API.logSecurityEvent('GPS_PING', {
                  lat: Number(pos.coords.latitude.toFixed(5)),
                  lng: Number(pos.coords.longitude.toFixed(5)),
                  accuracyM: Math.round(pos.coords.accuracy),
                  at: new Date().toISOString()
                });
              } catch {
                // Silently fail
              }
            },
            () => { /* permission denied / unavailable — skip silently */ },
            { timeout: 8000, maximumAge: 300000 }
          );
        }
        // Clear cached permissions
        permissionsCache.clear();

        // Check for any intended return path
        const locState = location.state as { from?: string | { pathname: string } } | undefined;
        let intendedRoute: string | null = null;
        if (locState?.from) {
          intendedRoute = typeof locState.from === 'string' ? locState.from : (locState.from.pathname || null);
        }

        // Resolve exact authorized default landing route
        const targetRoute = await resolvePostLoginRoute(user, intendedRoute);
        navigate(targetRoute, { replace: true });
      } else {
        if (res.locked || res.remainingSeconds) {
          setIsLocked(true);
          setLockRemainingSeconds(res.remainingSeconds || 600);
        }
        setErrorMsg(describeSignInFailure(res.message));
        loadCaptcha(true);
      }
    } catch (err: any) {
      // If error message indicates lockout, check server lock status
      checkServerLock();
      setErrorMsg(describeSignInFailure(err.message));
      loadCaptcha(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setOtpError('Please enter the 6-digit code');
      return;
    }

    setOtpLoading(true);
    setOtpError('');

    try {
      const res = await API.verify2fa(partialAuth?.userId, otp, partialAuth);

      if (res.success && res.data) {
        const user = res.data.user;

        // Save full session
        const authToken = res.data?.token || res.token || null;
        const refreshToken = res.data?.refreshToken || res.refreshToken || null;
        Auth.save({
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.fullName,
          displayName: user.displayName || user.fullName || user.role,
          employeeId: user.employeeId ?? null,
          locationId: user.locationId ?? null,
          locationCode: user.locationCode ?? null,
          locationName: user.locationName ?? null,
          allowedLocations: user.allowedLocations || [],
          isGlobalAdmin: user.isGlobalAdmin === true || user.locationId === null,
          modules: user.modules || [],
          token: authToken
        }, authToken, refreshToken);

        // Clear 2FA state
        setShow2fa(false);
        setPartialAuth(null);
        setOtpDigits(['', '', '', '', '', '']);
        setOtp('');

        const locationLabel = user.locationName ? ` — ${user.locationName}` : '';
        showToast(res.securityWarning ? `${res.securityWarning} Welcome back, ${user.fullName || user.username}${locationLabel}` : `Welcome back, ${user.fullName || user.username}${locationLabel}`, 'success');

        // Record sign-in location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                // Token is in HttpOnly cookie, sent automatically
                await API.logSecurityEvent('GPS_PING', {
                  lat: Number(pos.coords.latitude.toFixed(5)),
                  lng: Number(pos.coords.longitude.toFixed(5)),
                  accuracyM: Math.round(pos.coords.accuracy),
                  at: new Date().toISOString()
                });
              } catch {}
            },
            () => {},
            { timeout: 8000, maximumAge: 300000 }
          );
        }
        permissionsCache.clear();

        const locState = location.state as { from?: string | { pathname: string } } | undefined;
        let intendedRoute: string | null = null;
        if (locState?.from) {
          intendedRoute = typeof locState.from === 'string' ? locState.from : (locState.from.pathname || null);
        }
        const targetRoute = await resolvePostLoginRoute(user, intendedRoute);
        navigate(targetRoute, { replace: true });
      } else {
        setOtpError(res.message || 'Invalid verification code');
        setOtpDigits(['', '', '', '', '', '']);
        setOtp('');
        loadCaptcha(true);
      }
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed. Please try again.');
      setOtpDigits(['', '', '', '', '', '']);
      setOtp('');
      loadCaptcha(true);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend2fa = async () => {
    if (resendCooldown > 0) return;

    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    try {
      const res = await API.resend2fa(partialAuth?.userId);
      if (res.success) {
        showToast(res.message || 'A new verification code has been sent.', 'success');
      } else {
        setOtpError(res.message || 'Failed to resend code');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend code');
    }
  };

  const handleBackToLogin = () => {
    setShow2fa(false);
    setPartialAuth(null);
    setOtpDigits(['', '', '', '', '', '']);
    setOtp('');
    setOtpError('');
    loadCaptcha(true);
  };


  return (
    <div className="login-shell relative h-dvh overflow-y-auto overscroll-contain bg-[#F7F5F0] flex flex-col items-center px-4 py-5 sm:px-6 sm:py-7">
      <ToastContainer />

      {/* Top Left Section: Back to Home Page — in flow so it can never overlap the card */}
      <div className="self-start shrink-0">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E1DDD3] shadow-xs hover:shadow-md text-[#17201D] hover:text-[#123C35] hover:border-[#C9A45C] text-xs font-bold transition-all active:scale-95 group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#65716C] group-hover:-translate-x-0.5 transition-transform" />
          <Home className="w-3.5 h-3.5 text-[#C9A45C]" />
          <span>Back to Home</span>
        </button>
      </div>

      <div className="login-card my-auto shrink-0 w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-[#E1DDD3] animate-fade-in">
        {/* Card Header */}
        <div className="login-card-header bg-[#123C35] p-5 sm:p-6 flex items-center gap-3.5 border-b border-[#C9A45C]/30 shadow-sm">
          <div className="w-14 h-12 rounded-2xl bg-white p-1 shadow-md border border-[#C9A45C]/30 flex items-center justify-center flex-shrink-0">
            <img src="/logo.png" alt="BSC Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-white leading-tight tracking-tight truncate">Enterprise Operations Portal</h2>
            <div className="text-[11px] text-[#E4CB92] font-extrabold uppercase tracking-wider mt-0.5 truncate">
              BSC Textiles · MULTI-LOCATION SYSTEM
            </div>
          </div>
        </div>

        {/* Card Body */}
        {!show2fa ? (
          <form onSubmit={handleLogin} className="login-form p-6 sm:p-7 space-y-4 sm:space-y-5">
          <div>
            <h3 className="text-xl font-black text-[#123C35] tracking-tight">Welcome Back</h3>
            <p className="text-xs text-[#65716C] font-medium mt-1">Sign in with your authorized system credentials. Your location will be loaded automatically.</p>
          </div>


          {/* 10-Minute Lockout Countdown Alert */}
          {isLocked && lockRemainingSeconds > 0 && (
            <div className="p-4 rounded-2xl bg-[#FDE8E8] border-2 border-[#F5B7B7] text-[#C83B4A] space-y-2 animate-scale-in">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                <Lock className="w-4 h-4 text-[#C83B4A]" />
                <span>Account Temporarily Locked</span>
              </div>
              <p className="text-xs font-semibold leading-relaxed">
                5 consecutive incorrect password attempts detected. For security, login is locked for 10 minutes.
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-[#F5B7B7]/60 text-xs">
                <span className="font-bold text-[#C83B4A]">Remaining Lock Time:</span>
                <span className="font-mono font-black text-sm bg-[#FDE8E8] px-2.5 py-1 rounded-lg text-[#C83B4A] shadow-xs">
                  {formatLockTimer(lockRemainingSeconds)}
                </span>
              </div>
            </div>
          )}

          {errorMsg && !isLocked && (
            <div className="p-3.5 rounded-xl bg-[#FDE8E8] border border-[#F5B7B7] text-[#C83B4A] text-xs font-semibold animate-fade-in">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#17201D]">
              Username / Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65716C] pointer-events-none" />
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                disabled={isLocked && lockRemainingSeconds > 0}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={() => { if (username.trim()) checkServerLock(username.trim()); }}
                placeholder="Enter your username or email"
                className="input-modern w-full !pl-10 pr-4 text-xs font-semibold"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#17201D]">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65716C] pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                disabled={isLocked && lockRemainingSeconds > 0}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="input-modern w-full !pl-10 !pr-10 text-xs font-semibold"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#65716C] hover:text-[#17201D] transition-colors focus:outline-none cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#17201D]">
              Security Code
            </label>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="relative flex-1 min-w-0">
                <Hash className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65716C] pointer-events-none" />
                <input
                  type="text"
                  name="captcha"
                  autoComplete="off"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={codeLength}
                  value={captchaText}
                  disabled={isLocked && lockRemainingSeconds > 0}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, codeLength);
                    setCaptchaText(digits);
                  }}
                  placeholder={`Enter ${codeLength} digits`}
                  aria-describedby="captcha-hint"
                  className="input-modern w-full !h-11 !pl-10 !pr-3 text-sm font-bold tracking-[0.3em]"
                  required
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {captchaSvg ? (
                  <img
                    src={captchaSvg}
                    alt={`Security captcha - ${codeLength} digit numeric code`}
                    className="h-11 w-[150px] rounded-lg border border-[#E1DDD3] bg-white object-contain shadow-xs select-none"
                    draggable={false}
                  />
                ) : (
                  <div className="h-11 w-[150px] rounded-lg border border-[#E1DDD3] bg-white animate-pulse" />
                )}
                <button
                  type="button"
                  onClick={() => { loadCaptcha(true); setCountdown(30); }}
                  className="btn-secondary !h-11 !w-11 shrink-0 grid place-items-center p-0 hover:border-[#C9A45C]"
                  title="Load a new security code"
                  aria-label="Load a new security code"
                >
                  <RefreshCw className={`w-4 h-4 ${captchaLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <p id="captcha-hint" className="text-[11px] text-[#65716C] font-medium">Refreshes automatically in {countdown}s for your security.</p>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPrivacyPolicy(true)}
                className="text-xs text-[#65716C] hover:text-[#123C35] font-bold hover:underline"
              >
                Privacy Policy
              </button>
              <span className="text-xs text-[#E1DDD3]">•</span>
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-xs text-[#65716C] hover:text-[#123C35] font-bold hover:underline"
              >
                Terms
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-xs text-[#65716C] hover:text-[#123C35] font-bold hover:underline"
            >
              Forgot password?
            </button>
          </div>


          <button
            type="submit"
            disabled={loading || (isLocked && lockRemainingSeconds > 0)}
            className="w-full py-3.5 px-4 rounded-xl bg-[#123C35] text-white font-extrabold text-xs tracking-wide hover:bg-[#082821] active:scale-[0.99] transition-all shadow-lg shadow-[#123C35]/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <span className="spinner" />
                <span>Authenticating Credentials…</span>
              </>
            ) : isLocked && lockRemainingSeconds > 0 ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Locked ({formatLockTimer(lockRemainingSeconds)})</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4 text-[#C9A45C]" />
              </>
            )}
          </button>

          <div className="pt-2 border-t border-[#E1DDD3] space-y-2">
            <button
              type="button"
              onClick={() => navigate('/wedding/customer-registration')}
              className="w-full py-2.5 px-4 rounded-xl bg-white border border-[#E1DDD3] hover:bg-[#EDF3F0] hover:border-[#C9A45C] text-[#123C35] font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer"
            >
              <span>Register for Wedding Shopping</span>
              <Sparkles className="w-4 h-4 text-[#C9A45C]" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/track')}
              className="w-full py-2.5 px-4 rounded-xl bg-white border border-[#E1DDD3] hover:bg-[#EDF3F0] hover:border-[#123C35] text-[#123C35] font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-[#65716C]" />
              <span>Track Wedding Request</span>
            </button>
          </div>
        </form>
        ) : (
          /* 2FA Verification Step */
          <div className="p-7 space-y-5 animate-fade-in" role="alert" aria-live="polite">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#EDF3F0] border border-[#E1DDD3]">
              <div className="w-10 h-10 rounded-xl bg-[#123C35]/10 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-[#123C35]" />
              </div>
              <div>
                <h3 className="font-black text-sm text-[#123C35]">Verify Your Identity</h3>
                <p className="text-xs text-[#65716C] mt-0.5">
                  A 6-digit verification code has been sent to <span className="font-semibold text-[#123C35]">{partialAuth?.email || 'your registered email'}</span>.
                  Enter the code below to complete sign-in.
                </p>
              </div>
            </div>

            {otpError && (
              <div className="p-3 rounded-xl bg-[#FDE8E8] border border-[#F5B7B7] text-[#C83B4A] text-xs font-semibold animate-shake">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerify2fa} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#17201D] mb-2">
                  6-Digit Verification Code
                </label>
                <div className="flex items-center justify-center gap-2">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        const newDigits = [...otpDigits];
                        newDigits[index] = value;
                        setOtpDigits(newDigits);
                        const joined = newDigits.join('');
                        setOtp(joined);
                        // Auto-focus next input
                        if (value && index < 5) {
                          const nextInput = e.target.parentElement?.children[index + 1] as HTMLInputElement;
                          nextInput?.focus();
                        }
                        // Auto-submit when all 6 digits entered
                        if (joined.length === 6) {
                          setOtp(joined);
                          // Small delay to allow state update
                          setTimeout(() => {
                            const form = document.querySelector('form[onSubmit]') as HTMLFormElement;
                            form?.requestSubmit();
                          }, 50);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digit && index > 0) {
                          const parent = (e.target as HTMLInputElement).parentElement;
                          const prevInput = parent?.children[index - 1] as HTMLInputElement;
                          prevInput?.focus();
                        }
                      }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      disabled={otpLoading}
                      className="w-10 h-12 text-center text-base font-bold rounded-xl border-2 border-[#E1DDD3] bg-white text-[#17201D] focus:border-[#C9A45C] focus:ring-2 focus:ring-[#C9A45C]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-[#65716C] font-medium mt-2 text-center">
                  Enter the 6-digit code sent to your email. Code expires in 10 minutes.
                </p>
              </div>

              <button
                type="submit"
                disabled={otpLoading || otp.length !== 6}
                className="w-full py-3.5 px-4 rounded-xl bg-[#123C35] text-white font-extrabold text-xs tracking-wide hover:bg-[#082821] active:scale-[0.99] transition-all shadow-lg shadow-[#123C35]/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {otpLoading ? (
                  <>
                    <span className="spinner" />
                    <span>Verifying Code…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-[#C9A45C]" />
                    <span>Verify & Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-[#E1DDD3] space-y-3">
              <button
                type="button"
                onClick={handleResend2fa}
                disabled={resendCooldown > 0}
                className="w-full py-2.5 px-4 rounded-xl border border-[#E1DDD3] bg-white text-[#123C35] font-bold text-xs hover:bg-[#EDF3F0] hover:border-[#C9A45C] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {resendCooldown > 0 ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#C9A45C]" />
                    <span>Resend Code ({resendCooldown}s)</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-[#C9A45C]" />
                    <span>Didn't receive the code? Resend</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                className="w-full py-2.5 px-4 rounded-xl bg-[#F7F5F0] text-[#65716C] font-bold text-xs hover:bg-[#E1DDD3] hover:text-[#123C35] transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 inline mr-1 text-[#C9A45C]" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </div>
        )}

        <div className="bg-[#F7F5F0] px-7 py-3.5 border-t border-[#E1DDD3] flex items-center justify-between text-xs text-[#65716C] font-semibold">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#16805C]" />
            <span>Authorized access only · Location auto-assigned</span>
          </span>
          <span className="font-bold text-[#123C35]">BSC v3.0</span>
        </div>
      </div>

      {/* Location Info Note */}
      <div className="mt-4 flex items-center gap-1.5 text-xs text-[#65716C] font-medium">
        <MapPin className="w-3.5 h-3.5 text-[#123C35]" />
        <span>Your location (Belagavi / Davanagere / Shivamogga) is assigned by the System Admin</span>
      </div>

      <PrivacyPolicyModal
        isOpen={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
        onAccept={() => setShowPrivacyPolicy(false)}
      />

      <TermsAndConditionsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setShowTermsModal(false)}
      />
    </div>
  );
}
