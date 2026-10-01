import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  Store,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Tv,
  Sparkles
} from 'lucide-react';
import { API } from '../../services/api';
import { saveKioskSession } from './kioskSession';
import type { KioskLocation } from './kioskTypes';

export interface KioskAccessScreenProps {
  onUnlocked: () => void;
  initialLocationId?: number | null;
}

interface StoreOption {
  id: number;
  code: string;
  name: string;
  storeName?: string;
  address?: string;
}

const DEFAULT_STORES: StoreOption[] = [
  {
    id: 1,
    code: 'BEL',
    name: 'Belagavi',
    storeName: 'BSC Textiles Belagavi Showroom',
    address: '1st Gate Road, Tilakwadi, Belagavi'
  },
  {
    id: 2,
    code: 'DAV',
    name: 'Davanagere',
    storeName: 'BSC Textiles Davanagere Showroom',
    address: 'MCC B Block, Kuvempu Nagar, Davanagere'
  },
  {
    id: 3,
    code: 'SHI',
    name: 'Shivamogga',
    storeName: 'BSC Textiles Shivamogga Showroom',
    address: 'Parekh Vinayak Mall, Durgigudi, Shivamogga'
  }
];

export default function KioskAccessScreen({ onUnlocked, initialLocationId }: KioskAccessScreenProps) {
  const [stores, setStores] = useState<StoreOption[]>(DEFAULT_STORES);
  const [isLoadingStores, setIsLoadingStores] = useState<boolean>(true);
  const [storeLoadError, setStoreLoadError] = useState<string | null>(null);

  // Selected store is strictly required before unlocking
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    return initialLocationId ? String(initialLocationId) : '';
  });

  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch real locations from backend
  const loadLocations = useCallback(async () => {
    setIsLoadingStores(true);
    setStoreLoadError(null);
    try {
      const res = await API.getLocations();
      if (!isMountedRef.current) return;
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.locations)
        ? res.locations
        : Array.isArray(res?.data)
        ? res.data
        : [];

      if (list.length > 0) {
        const mapped: StoreOption[] = list.map((loc: any) => ({
          id: Number(loc.id),
          code: String(loc.code || loc.location_code || '').toUpperCase(),
          name: String(loc.name || loc.location_name || ''),
          storeName: loc.store_name || loc.name,
          address: loc.address || ''
        }));
        setStores(mapped);
      } else {
        setStores(DEFAULT_STORES);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      // Graceful fallback to verified company store locations
      setStores(DEFAULT_STORES);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingStores(false);
      }
    }
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Selected Store Object
  const selectedStore = stores.find((s) => String(s.id) === String(selectedStoreId)) || null;

  // Handle store change
  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (storeId) {
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 50);
    }
  };

  // Submit Password Verification
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedStoreId || !selectedStore) {
      setErrorMessage('Please select a store location before unlocking.');
      return;
    }

    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      setErrorMessage('Please enter the kiosk password.');
      passwordInputRef.current?.focus();
      return;
    }

    setIsVerifying(true);

    try {
      const res = await API.verifyPin({
        type: 'tv',
        pin: trimmedPassword,
        locationId: Number(selectedStore.id)
      });

      if (!isMountedRef.current) return;

      if (res && res.success && res.token) {
        const kioskLoc: KioskLocation = {
          id: Number(res.location?.id || selectedStore.id),
          code: res.location?.code || selectedStore.code,
          name: res.location?.name || selectedStore.name
        };

        const expiresAt = Number(res.expiresAt) || Date.now() + 8 * 60 * 60 * 1000;

        saveKioskSession({
          token: res.token,
          expiresAt,
          location: kioskLoc
        });

        setSuccessMessage('Live TV Kiosk unlocked.');
        setPassword('');

        setTimeout(() => {
          if (isMountedRef.current) {
            onUnlocked();
          }
        }, 600);
      } else {
        setErrorMessage('Incorrect kiosk password. Please try again.');
        setPassword('');
        passwordInputRef.current?.focus();
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setErrorMessage('Incorrect kiosk password. Please try again.');
      setPassword('');
      passwordInputRef.current?.focus();
    } finally {
      if (isMountedRef.current) {
        setIsVerifying(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#082821] bg-gradient-to-br from-[#082821] via-[#123C35] to-[#082821] text-white flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-[#C9A45C] selection:text-[#123C35]">
      <div className="w-full max-w-xl mx-auto">
        {/* Main Kiosk Access Terminal Card */}
        <div className="bg-[#123C35]/95 border border-[#C9A45C]/30 backdrop-blur-2xl rounded-3xl p-6 sm:p-9 shadow-[0_25px_60px_rgba(0,0,0,0.65)] relative overflow-hidden">
          {/* Subtle Ambient Accent Header */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-[#C9A45C] to-transparent" />

          {/* Top Brand & Title */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-16 sm:w-24 sm:h-18 bg-white p-2 rounded-2xl border border-[#C9A45C]/40 shadow-xl flex items-center justify-center">
              <img
                src="/logo.png"
                alt="BSC Textiles"
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C9A45C]/15 border border-[#C9A45C]/35 text-[#C9A45C] text-xs font-black uppercase tracking-[0.2em] mb-1.5 shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-[#C9A45C]" />
                LIVE STORE OPERATIONS
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                BSC Textiles Showroom Display
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                Live TV Operations Kiosk & Real-time Metrics Broadcast
              </p>
            </div>
          </div>

          {/* Verification Form */}
          <form onSubmit={handleUnlock} className="mt-8 space-y-6">
            {/* Step 1: Location Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                {selectedStore && (
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Store Selected
                  </span>
                )}
              </div>

              {/* Main Professional Select Dropdown */}
              <div className="relative">
                <select
                  id="kiosk-store-select"
                  value={selectedStoreId}
                  onChange={(e) => handleStoreChange(e.target.value)}
                  disabled={isVerifying}
                  className="w-full bg-[#182645] border border-[#C9A45C]/40 rounded-2xl px-4 py-3.5 text-sm sm:text-base font-bold text-white focus:outline-none focus:border-[#C9A45C] focus:ring-2 focus:ring-[#C9A45C]/30 transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled className="bg-[#123C35] text-slate-400">
                    -- Select Store Location --
                  </option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id} className="bg-[#123C35] text-white py-2">
                      {store.name} ({store.code})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#C9A45C] font-bold text-sm">
                  ▼
                </div>
              </div>

              {/* Quick Select Location Cards */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {stores.map((s) => {
                  const isSelected = String(s.id) === String(selectedStoreId);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleStoreChange(String(s.id))}
                      disabled={isVerifying}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#C9A45C]/20 border-[#C9A45C] ring-2 ring-[#C9A45C]/40 shadow-lg text-white'
                          : 'bg-[#182645]/60 border-white/10 hover:border-[#C9A45C]/40 hover:bg-[#182645] text-slate-300'
                      }`}
                    >
                      <Store className={`w-4 h-4 mx-auto mb-1 ${isSelected ? 'text-[#C9A45C]' : 'text-slate-400'}`} />
                      <div className="text-xs font-black leading-tight">{s.name}</div>
                      <div className={`text-[10px] font-extrabold uppercase tracking-wider ${isSelected ? 'text-[#E3C88E]' : 'text-slate-400'}`}>
                        {s.code}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Kiosk Password Input */}
            <div className="space-y-2">
              <label
                htmlFor="kiosk-password-input"
                className="text-xs font-black uppercase tracking-wider text-[#E3C88E] flex items-center gap-1.5"
              >
                <Lock className="w-4 h-4 text-[#C9A45C]" />
                KIOSK PASSWORD <span className="text-rose-400">*</span>
              </label>

              <div className="relative">
                <input
                  id="kiosk-password-input"
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  disabled={isVerifying}
                  placeholder={selectedStore ? `Enter password for ${selectedStore.name}` : 'Select store location first'}
                  autoComplete="current-password"
                  className="w-full bg-[#182645] border border-[#C9A45C]/40 rounded-2xl px-4 py-3.5 pr-12 text-sm sm:text-base font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-[#C9A45C] focus:ring-2 focus:ring-[#C9A45C]/30 transition-all"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isVerifying}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
                <span>Showroom security verification</span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#C9A45C] hover:underline font-bold cursor-pointer"
                >
                  {showPassword ? 'Hide Password' : 'Show Password'}
                </button>
              </div>
            </div>

            {/* Error Notification */}
            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/70 text-rose-200 text-xs sm:text-sm font-bold flex items-center gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Notification */}
            {successMessage && (
              <div
                role="status"
                className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/70 text-emerald-200 text-xs sm:text-sm font-black flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Unlock Button */}
            <button
              type="submit"
              disabled={isVerifying || !selectedStoreId}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-200 shadow-xl flex items-center justify-center gap-2.5 cursor-pointer ${
                !selectedStoreId
                  ? 'bg-slate-700/50 text-slate-400 border border-white/5 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#C9A45C] via-[#D4AF37] to-[#B78E40] text-[#123C35] hover:opacity-95 active:scale-[0.99] border border-[#C9A45C]/60 shadow-[0_10px_25px_rgba(201,164,92,0.3)]'
              }`}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying Access...</span>
                </>
              ) : (
                <>
                  <Tv className="w-5 h-5" />
                  <span>Unlock Live TV</span>
                </>
              )}
            </button>
          </form>

          {/* Professional Footer Notice */}
          <div className="mt-8 pt-5 border-t border-[#C9A45C]/15 flex items-center justify-center gap-2 text-xs text-slate-400 font-semibold text-center">
            <ShieldCheck className="w-4 h-4 text-[#C9A45C] shrink-0" />
            <span>Authorized store kiosk access only.</span>
          </div>
        </div>

        {/* Small Sub-footer */}
        <div className="text-center text-[11px] text-slate-500 font-medium mt-4">
          BSC Textiles Retail Operations Display · Continuous Kiosk Mode
        </div>
      </div>
    </div>
  );
}
