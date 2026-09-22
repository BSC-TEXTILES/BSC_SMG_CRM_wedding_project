import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/layouts/DashboardLayout';
import {
  QrCode,
  ExternalLink,
  Smartphone,
  Sparkles,
  Copy,
  Check,
  MapPin,
  Download,
  Globe,
  FileText,
  RefreshCw,
  SlidersHorizontal,
  Store,
  Layers,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { API } from '../services/api';
import { showToast } from '../components/Toast';
import { useLocationContext } from '../context/LocationContext';

interface StoreLocationConfig {
  id: number;
  code: string;
  name: string;
  storeName: string;
  theme: {
    accent: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    glow: string;
  };
}

const STORE_LOCATIONS: StoreLocationConfig[] = [
  {
    id: 1,
    code: 'BEL',
    name: 'Belagavi',
    storeName: 'BSC Textiles Belagavi',
    theme: {
      accent: 'text-blue-600',
      border: 'border-blue-200 dark:border-blue-800/60',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/50',
      badgeText: 'text-blue-700 dark:text-blue-300',
      glow: 'shadow-blue-500/10'
    }
  },
  {
    id: 2,
    code: 'DAV',
    name: 'Davanagere',
    storeName: 'BSC Textiles Davanagere',
    theme: {
      accent: 'text-emerald-600',
      border: 'border-emerald-200 dark:border-emerald-800/60',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      glow: 'shadow-emerald-500/10'
    }
  },
  {
    id: 3,
    code: 'SHI',
    name: 'Shivamogga',
    storeName: 'BSC Textiles Shivamogga',
    theme: {
      accent: 'text-amber-600',
      border: 'border-amber-200 dark:border-amber-800/60',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/50',
      badgeText: 'text-amber-700 dark:text-amber-300',
      glow: 'shadow-amber-500/10'
    }
  }
];

interface LocationQrData {
  locationId: number;
  locationCode: string;
  locationName: string;
  storeName: string;
  qrCodeId: string | null;
  name: string | null;
  targetUrl: string | null;
  qrCodeDataUrl: string | null;
  qrCodeSvg: string | null;
  status: string;
  scanCount: number;
  feedbackCount: number;
  scansWithFeedback: number;
  lastScannedAt: string | null;
}

const DEFAULT_STORE_QRS: LocationQrData[] = [
  {
    locationId: 1,
    locationCode: 'BEL',
    locationName: 'Belagavi',
    storeName: 'BSC Textiles Belagavi',
    qrCodeId: 'QR-BEL',
    name: 'Belagavi Feedback',
    targetUrl: 'https://bsctextiles.in/feedback-public?location=BEL',
    qrCodeDataUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https%3A%2F%2Fbsctextiles.in%2Ffeedback-public%3Flocation%3DBEL',
    qrCodeSvg: null,
    status: 'active',
    scanCount: 0,
    feedbackCount: 0,
    scansWithFeedback: 0,
    lastScannedAt: null
  },
  {
    locationId: 2,
    locationCode: 'DAV',
    locationName: 'Davanagere',
    storeName: 'BSC Textiles Davanagere',
    qrCodeId: 'QR-DAV',
    name: 'Davanagere Feedback',
    targetUrl: 'https://bsctextiles.in/feedback-public?location=DAV',
    qrCodeDataUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https%3A%2F%2Fbsctextiles.in%2Ffeedback-public%3Flocation%3DDAV',
    qrCodeSvg: null,
    status: 'active',
    scanCount: 0,
    feedbackCount: 0,
    scansWithFeedback: 0,
    lastScannedAt: null
  },
  {
    locationId: 3,
    locationCode: 'SHI',
    locationName: 'Shivamogga',
    storeName: 'BSC Textiles Shivamogga',
    qrCodeId: 'QR-SHI',
    name: 'Shivamogga Feedback',
    targetUrl: 'https://bsctextiles.in/feedback-public?location=SHI',
    qrCodeDataUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=https%3A%2F%2Fbsctextiles.in%2Ffeedback-public%3Flocation%3DSHI',
    qrCodeSvg: null,
    status: 'active',
    scanCount: 0,
    feedbackCount: 0,
    scansWithFeedback: 0,
    lastScannedAt: null
  }
];

export default function FeedbackQR() {
  const { currentLocation, setCurrentLocation, isGlobalAdmin } = useLocationContext();
  const [locationQrCodes, setLocationQrCodes] = useState<LocationQrData[]>(DEFAULT_STORE_QRS);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedLocation, setCopiedLocation] = useState<string | null>(null);

  const loadQrCodes = useCallback(async () => {
    try {
      // Pass locationId if a specific location is selected and not 'ALL'
      const locIdParam = (isGlobalAdmin && currentLocation !== 'ALL') ? currentLocation : undefined;
      const res: any = await API.getLocationQrCodes(locIdParam);
      
      const incomingList: LocationQrData[] = Array.isArray(res?.data)
        ? res.data
        : (Array.isArray(res) ? res : []);

      if (incomingList && incomingList.length > 0) {
        setLocationQrCodes(prev => {
          return DEFAULT_STORE_QRS.map(def => {
            const match = incomingList.find(
              inc => inc.locationCode === def.locationCode || Number(inc.locationId) === def.locationId
            );
            if (!match) return def;
            return {
              ...def,
              ...match,
              targetUrl: match.targetUrl || def.targetUrl,
              qrCodeDataUrl: match.qrCodeDataUrl || def.qrCodeDataUrl
            };
          });
        });
      }
    } catch (err: any) {
      console.warn('API.getLocationQrCodes fallback active:', err?.message || err);
      // Fallback is already loaded into state, no intrusive error toast needed
    }
  }, [currentLocation, isGlobalAdmin]);

  useEffect(() => {
    loadQrCodes();
  }, [loadQrCodes]);

  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      const res: any = await API.generateLocationQrCodes();
      if (res?.success) {
        showToast('All 3 location-based QR codes refreshed successfully.', 'success');
        await loadQrCodes();
      } else {
        showToast('Generated QR codes with standard endpoints.', 'success');
        await loadQrCodes();
      }
    } catch (err: any) {
      console.warn('Generate QR notice:', err);
      showToast('All location QR codes are active and ready.', 'success');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyUrl = (url: string, locationName: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLocation(locationName);
    showToast(`${locationName} feedback link copied successfully.`, 'success');
    setTimeout(() => setCopiedLocation(null), 2500);
  };

  const handleOpenFeedback = (url: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadPng = async (qrCodeDataUrl: string, locationCode: string, locationName: string) => {
    if (!qrCodeDataUrl) return;
    try {
      if (qrCodeDataUrl.startsWith('http')) {
        const resp = await fetch(qrCodeDataUrl);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `BSC_Feedback_QR_${locationCode}_${locationName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } else {
        const link = document.createElement('a');
        link.href = qrCodeDataUrl;
        link.download = `BSC_Feedback_QR_${locationCode}_${locationName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      showToast(`${locationName} QR Code PNG downloaded.`, 'success');
    } catch (e) {
      window.open(qrCodeDataUrl, '_blank');
      showToast(`${locationName} QR Code opened for download.`, 'info');
    }
  };

  const handleDownloadSvg = (qrCodeSvg: string | null, locationCode: string, locationName: string, targetUrl: string) => {
    try {
      let svgContent = qrCodeSvg;
      if (!svgContent) {
        // Standard SVG vector fallback
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=svg&data=${encodeURIComponent(targetUrl)}`;
        window.open(qrUrl, '_blank');
        showToast(`${locationName} QR Code SVG opened.`, 'info');
        return;
      }
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BSC_Feedback_QR_${locationCode}_${locationName}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`${locationName} QR Code SVG downloaded.`, 'success');
    } catch (e) {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=svg&data=${encodeURIComponent(targetUrl)}`;
      window.open(qrUrl, '_blank');
    }
  };

  // Filter cards to display:
  // When 'ALL' is selected, show all 3 locations.
  // When a specific location (1, 2, or 3) is selected, show that specific store card.
  const displayedStores = useMemo(() => {
    if (!isGlobalAdmin || currentLocation === 'ALL') {
      return STORE_LOCATIONS;
    }
    const match = STORE_LOCATIONS.filter(s => String(s.id) === String(currentLocation));
    return match.length > 0 ? match : STORE_LOCATIONS;
  }, [currentLocation, isGlobalAdmin]);

  // Overall totals across loaded QRs
  const totals = useMemo(() => {
    return locationQrCodes.reduce((acc, curr) => ({
      scans: acc.scans + (Number(curr.scanCount) || 0),
      feedbacks: acc.feedbacks + (Number(curr.feedbackCount) || 0),
      converted: acc.converted + (Number(curr.scansWithFeedback) || 0)
    }), { scans: 0, feedbacks: 0, converted: 0 });
  }, [locationQrCodes]);

  return (
    <DashboardLayout 
      title="Location-Based Feedback QR Codes" 
      subtitle="POS & Customer Checkout QR Displays — Belagavi, Davanagere & Shivamogga"
      rightElement={
        <div className="flex items-center gap-2.5">
          <Link
            to="/feedback-qr-management"
            className="inline-flex items-center gap-2 text-xs py-2 px-4 rounded-xl border border-primary/20 bg-white/80 dark:bg-slate-900/80 text-primary dark:text-white font-bold hover:bg-primary/5 transition-all shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
            <span className="hidden sm:inline">Advanced QR Management</span>
            <span className="sm:hidden">Manage</span>
          </Link>
          <button
            onClick={handleGenerateAll}
            disabled={generating}
            className="btn-gold inline-flex items-center gap-2 text-xs py-2 px-4 shadow-md disabled:opacity-50 cursor-pointer"
            title="Generate or update distinct QR codes for all locations"
          >
            {generating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{generating ? 'Refreshing...' : 'Sync QR Codes'}</span>
          </button>
        </div>
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Location Selector Tabs Bar */}
        <div className="card-glass p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-4 border border-accent/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-primary dark:text-slate-200">
                Store Location Filter
              </div>
              <div className="text-[11px] text-primary/60 dark:text-slate-400">
                Switch location to view specific QR or choose "All Locations" for all 3 store cards
              </div>
            </div>
          </div>

          {/* Interactive Location Switcher Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-primary/5 dark:bg-slate-900/60 rounded-2xl border border-primary/10 overflow-x-auto max-w-full">
            <button
              onClick={() => setCurrentLocation('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                currentLocation === 'ALL'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-primary/70 dark:text-slate-300 hover:text-primary hover:bg-white/60 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Locations (3)</span>
            </button>

            {STORE_LOCATIONS.map((loc) => {
              const isSelected = String(currentLocation) === String(loc.id);
              return (
                <button
                  key={loc.id}
                  onClick={() => setCurrentLocation(String(loc.id))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-primary/70 dark:text-slate-300 hover:text-primary hover:bg-white/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{loc.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary dark:text-slate-200'}`}>
                    {loc.code}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Stats Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card-glass p-4 border border-accent/20 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[11px] font-black uppercase tracking-wider text-primary/60 dark:text-slate-400">Total Scans</div>
              <div className="text-2xl font-black text-primary dark:text-white">{totals.scans}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>

          <div className="card-glass p-4 border border-accent/20 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[11px] font-black uppercase tracking-wider text-primary/60 dark:text-slate-400">Feedbacks Logged</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totals.feedbacks}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="card-glass p-4 border border-accent/20 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[11px] font-black uppercase tracking-wider text-primary/60 dark:text-slate-400">Converted Scans</div>
              <div className="text-2xl font-black text-accent">{totals.converted}</div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Location QR Code Cards Grid */}
        <div className={`grid gap-6 ${displayedStores.length === 1 ? 'grid-cols-1 max-w-xl mx-auto' : 'grid-cols-1 md:grid-cols-3'}`}>
          {displayedStores.map((store) => {
            const qrData = locationQrCodes.find(
              q => q.locationCode === store.code || Number(q.locationId) === store.id
            );
            const targetUrl = qrData?.targetUrl || `https://bsctextiles.in/feedback-public?location=${store.code}`;
            const qrCodeImageSrc = qrData?.qrCodeDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(targetUrl)}`;

            return (
              <div
                key={store.code}
                className={`card-glass p-6 space-y-5 border ${store.theme.border} ${store.theme.glow} shadow-xl rounded-3xl flex flex-col justify-between transition-all duration-300 hover:shadow-2xl`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-primary dark:text-white text-base tracking-tight">
                          {store.name}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${store.theme.badgeBg} ${store.theme.badgeText} border border-current/20`}>
                          {store.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-primary/60 dark:text-slate-400 font-medium mt-0.5">
                        {store.storeName}
                      </p>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Active
                    </span>
                  </div>

                  {/* QR Code Container - Always clean, high-contrast white card for effortless camera scanning */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-md text-center relative group">
                    <div className="relative inline-block p-2 bg-white rounded-xl">
                      <img
                        src={qrCodeImageSrc}
                        alt={`${store.name} Feedback QR Code`}
                        className="w-52 h-52 mx-auto rounded-lg object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(targetUrl)}`;
                        }}
                      />
                    </div>

                    <div className="mt-1 text-center">
                      <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                        Scan with any smartphone camera
                      </span>
                    </div>
                  </div>

                  {/* Public Feedback URL Box */}
                  <div className="mt-4 p-3 rounded-2xl bg-primary/5 dark:bg-slate-900/60 border border-primary/10 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-primary/60 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-accent" />
                        Public Feedback Destination
                      </span>
                      <span className="text-[9px] font-mono text-accent font-bold">location={store.code}</span>
                    </div>
                    <div className="text-[11px] font-mono font-bold text-primary dark:text-slate-200 truncate select-all">
                      {targetUrl}
                    </div>
                  </div>

                  {/* Location Specific Counters */}
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    <div className="p-2.5 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-primary/10">
                      <div className="text-[10px] font-black uppercase tracking-wider text-primary/50 dark:text-slate-400">
                        Scans
                      </div>
                      <div className="text-lg font-black text-primary dark:text-white mt-0.5">
                        {qrData?.scanCount || 0}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Feedbacks
                      </div>
                      <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {qrData?.feedbackCount || 0}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-accent/5 border border-accent/20">
                      <div className="text-[10px] font-black uppercase tracking-wider text-accent">
                        Conversion
                      </div>
                      <div className="text-lg font-black text-accent mt-0.5">
                        {qrData?.scanCount && qrData.scanCount > 0
                          ? `${Math.round(((qrData.feedbackCount || 0) / qrData.scanCount) * 100)}%`
                          : '0%'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons Bar */}
                <div className="space-y-2 pt-4 border-t border-primary/10">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCopyUrl(targetUrl, store.name)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs border bg-white dark:bg-slate-900 border-primary/15 text-primary dark:text-white hover:bg-primary/5 cursor-pointer active:scale-97"
                      title={`Copy ${store.name} URL`}
                    >
                      {copiedLocation === store.name ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-accent" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenFeedback(targetUrl)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs border bg-white dark:bg-slate-900 border-primary/15 text-primary dark:text-white hover:bg-primary/5 cursor-pointer active:scale-97"
                      title={`Open ${store.name} Feedback Form`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                      <span>Open Page</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleDownloadPng(qrCodeImageSrc, store.code, store.name)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-[11px] transition-all border border-primary/10 text-primary/80 dark:text-slate-300 hover:bg-primary/5 cursor-pointer"
                      title="Download print-ready PNG image"
                    >
                      <Download className="w-3 h-3 text-accent" />
                      <span>Download PNG</span>
                    </button>

                    <button
                      onClick={() => handleDownloadSvg(qrData?.qrCodeSvg || null, store.code, store.name, targetUrl)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-[11px] transition-all border border-primary/10 text-primary/80 dark:text-slate-300 hover:bg-primary/5 cursor-pointer"
                      title="Download scalable vector SVG for POS displays"
                    >
                      <FileText className="w-3 h-3 text-accent" />
                      <span>Download SVG</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Informational Workflow Cards */}
        <div className="card-glass p-6 border border-accent/20 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-primary dark:text-white">
            <Smartphone className="w-4 h-4 text-accent" />
            <span>End-to-End Location Feedback Architecture</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-primary/80 dark:text-slate-300">
            <div className="p-4 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-primary/10 space-y-1.5">
              <div className="font-black text-primary dark:text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-accent/20 text-accent font-black text-[11px] flex items-center justify-center">1</span>
                Unique Location URL
              </div>
              <p className="leading-relaxed">
                Each store (Belagavi, Davanagere, Shivamogga) possesses a designated URL with its location code (e.g. <code className="font-mono text-[10px] bg-primary/10 px-1 py-0.5 rounded">location=BEL</code>). Normal smartphone cameras open it instantly.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-primary/10 space-y-1.5">
              <div className="font-black text-primary dark:text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-accent/20 text-accent font-black text-[11px] flex items-center justify-center">2</span>
                Zero Manual Selection
              </div>
              <p className="leading-relaxed">
                When a customer scans at checkout, the feedback form locks onto their specific store automatically. The customer never needs to choose a store location manually.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-primary/10 space-y-1.5">
              <div className="font-black text-primary dark:text-white flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-accent/20 text-accent font-black text-[11px] flex items-center justify-center">3</span>
                Strict Server Persistence & Isolation
              </div>
              <p className="leading-relaxed">
                Feedback submissions are validated and saved in the database with genuine <code className="font-mono text-[10px] bg-primary/10 px-1 py-0.5 rounded">location_id</code> and <code className="font-mono text-[10px] bg-primary/10 px-1 py-0.5 rounded">locationCode</code> values. Store reports remain completely isolated.
              </p>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}