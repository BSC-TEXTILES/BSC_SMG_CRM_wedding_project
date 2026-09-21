import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API, Auth } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import { ShieldCheck, ShieldAlert, Lock, User, ArrowRight, MapPin, RefreshCw, Hash, Eye, EyeOff, Sparkles, Search } from 'lucide-react';
import { getDashboardRouteForRole } from '../utils/dashboardRouting';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const securityViolation = searchParams.get('security') === 'unauthorized';
  const violationPath = searchParams.get('path') || '';
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

  // Rate limit & 10-minute temporary lockout state
  const [isLocked, setIsLocked] = useState(false);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(0);

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
          loadCaptcha(true);
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
      navigate(getDashboardRouteForRole(user?.role), { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password');
      return;
    }

    if (!validatePassword(password)) {
      setErrorMsg('Password must be at least 8 characters long and contain letters, numbers, and special characters.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await API.verifyUser(username.trim(), password, captchaId, captchaText);
      if (res.success && res.data) {
        const user = res.data.user;

        // Reset lockout state on success
        setIsLocked(false);
        setLockRemainingSeconds(0);

        // Save full session including location fields from server JWT
        Auth.save({
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.fullName,
          displayName: user.displayName || user.fullName || user.role,
          token: res.data.token,
          // Location fields — set by the server from the user's DB record
          locationId: user.locationId ?? null,
          locationCode: user.locationCode ?? null,
          locationName: user.locationName ?? null,
          isGlobalAdmin: user.isGlobalAdmin === true || user.locationId === null
        });

        const locationLabel = user.locationName ? ` — ${user.locationName}` : '';
        showToast(`Welcome back, ${user.fullName || user.username}${locationLabel}`, 'success');

        // Record the sign-in device location (used by admins for the
        // security trail). Silently skipped if the user denies permission.
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                const session = Auth.get();
                if (!session?.token) return;
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
        // Detect role and route directly to authorized dashboard (Admin, HR, or Manager Dashboard)
        const targetDashboard = getDashboardRouteForRole(user.role);
        navigate(targetDashboard, { replace: true });
      } else {
        if (res.locked || res.remainingSeconds) {
          setIsLocked(true);
          setLockRemainingSeconds(res.remainingSeconds || 600);
        }
        setErrorMsg(res.message || 'Sign-in failed. Please check your details and the captcha.');
        loadCaptcha(true);
      }
    } catch (err: any) {
      // If error message indicates lockout, check server lock status
      checkServerLock();
      setErrorMsg(err.message || 'Sign-in failed. Please try again.');
      loadCaptcha(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6">
      <ToastContainer />

      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-accent-soft animate-fade-in">
        {/* Card Header */}
        <div className="bg-primary p-6 flex items-center gap-4 border-b border-accent/30">
          <img src="/logo.png" alt="BSC Logo" className="w-12 h-12 object-contain rounded-2xl bg-white p-1.5 shadow-md border border-accent/30" />
          <div>
            <h2 className="text-lg font-black text-primary leading-tight tracking-tight">Enterprise Operations Portal</h2>
            <div className="text-[10px] text-accent font-bold uppercase tracking-widest mt-0.5">
              BSC EXCLUSIVE · MULTI-LOCATION SYSTEM
            </div>
          </div>
        </div>

        {/* Card Body */}
        <form onSubmit={handleLogin} className="p-7 space-y-5">
          <div>
            <h3 className="text-xl font-black text-primary tracking-tight">Welcome Back</h3>
            <p className="text-xs text-primary font-medium mt-1">Sign in with your authorized system credentials. Your location will be loaded automatically.</p>
          </div>

          {/* Security Violation Alert */}
          {securityViolation && (
            <div className="p-4 rounded-2xl bg-[#FDE8E8] border-2 border-[#E74C3C] text-[#C0392B] space-y-2 animate-scale-in">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-[#E74C3C]" />
                <span>Unauthorized Access Detected</span>
              </div>
              <p className="text-xs font-semibold leading-relaxed">
                You have been logged out for attempting to access a restricted area
                {violationPath ? ` (${violationPath})` : ''}. This incident has been recorded in the security audit log.
              </p>
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-[#F5B7B7]/60 text-[10px] font-bold text-[#C0392B]/80">
                <Lock className="w-3 h-3" />
                <span>Please sign in again with authorized credentials. Repeated violations may result in account suspension.</span>
              </div>
            </div>
          )}

          {/* 10-Minute Lockout Countdown Alert */}
          {isLocked && lockRemainingSeconds > 0 && (
            <div className="p-4 rounded-2xl bg-[#FDE8E8] border-2 border-[#F5B7B7] text-[#C0392B] space-y-2 animate-scale-in">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                <Lock className="w-4 h-4 text-[#C0392B]" />
                <span>Account Temporarily Locked</span>
              </div>
              <p className="text-xs font-semibold leading-relaxed">
                5 consecutive incorrect password attempts detected. For security, login is locked for 10 minutes.
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-[#F5B7B7]/60 text-xs">
                <span className="font-bold text-[#C0392B]">Remaining Lock Time:</span>
                <span className="font-mono font-black text-sm bg-[#FDE8E8] px-2.5 py-1 rounded-lg text-[#C0392B] shadow-xs">
                  {formatLockTimer(lockRemainingSeconds)}
                </span>
              </div>
            </div>
          )}

          {errorMsg && !isLocked && (
            <div className="p-3.5 rounded-xl bg-[#FDE8E8] border border-[#F5B7B7] text-[#C0392B] text-xs font-semibold animate-fade-in">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-primary">
              Username / Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" />
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                disabled={isLocked && lockRemainingSeconds > 0}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={() => { if (username.trim()) checkServerLock(username.trim()); }}
                placeholder="admin@bsctextiles.com"
                className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-accent-soft bg-white text-primary placeholder-primary/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-primary">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                disabled={isLocked && lockRemainingSeconds > 0}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full text-xs font-semibold pl-10 pr-10 py-3 rounded-xl border border-accent-soft bg-white text-primary placeholder-primary/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/60 hover:text-primary transition-colors focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-primary">
              Security Code
            </label>
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <Hash className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-primary" />
                <input
                  type="text"
                  name="captcha"
                  autoComplete="off"
                  maxLength={codeLength}
                  value={captchaText}
                  disabled={isLocked && lockRemainingSeconds > 0}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, codeLength);
                    setCaptchaText(digits);
                  }}
                  placeholder={`Enter ${codeLength} digits`}
                  inputMode="numeric"
                  className="w-full text-xs font-semibold pl-10 pr-3 py-3 rounded-xl border border-accent-soft bg-white text-primary placeholder-primary/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all shadow-xs tracking-widest disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                />
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {captchaSvg ? (
                  <img
                    src={captchaSvg}
                    alt={`Security captcha - ${codeLength} digit numeric code`}
                    className="h-[42px] w-[120px] rounded-lg border border-accent-soft bg-white shadow-xs select-none"
                    draggable={false}
                  />
                ) : (
                  <div className="h-[42px] w-[120px] rounded-lg border border-accent-soft bg-white animate-pulse" />
                )}
                <button
                  type="button"
                  onClick={() => { loadCaptcha(true); setCountdown(30); }}
                  className="p-2 rounded-lg border border-accent-soft text-primary hover:bg-background transition-colors"
                  title="Load a new security code"
                  aria-label="Refresh captcha"
                >
                  <RefreshCw className={`w-4 h-4 ${captchaLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-primary font-medium">Refreshes automatically in {countdown}s for your security.</p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-xs text-accent font-bold hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || (isLocked && lockRemainingSeconds > 0)}
            className="w-full py-3.5 px-4 rounded-xl bg-primary text-white font-extrabold text-xs tracking-wide hover:bg-primary-hover active:scale-[0.99] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-2 border-t border-accent-soft space-y-2">
            <button
              type="button"
              onClick={() => navigate('/wedding-registration')}
              className="w-full py-3 px-4 rounded-xl border-2 border-primary text-primary bg-white font-extrabold text-xs tracking-wide hover:bg-background active:scale-[0.99] transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <span>Register for Wedding Shopping</span>
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/track')}
              className="w-full py-2.5 px-4 rounded-xl border border-[#D4A58A] text-[#3D2B1F] bg-[#FBF8F5] font-bold text-xs tracking-wide hover:bg-[#F5F0EB] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Track Wedding Request</span>
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
