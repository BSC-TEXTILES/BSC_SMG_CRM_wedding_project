import React, { useState } from 'react';
import { API } from '../services/api';
import ToastContainer, { showToast } from '../components/Toast';
import {
  Search, MapPin, Calendar, Clock, CircleCheck,
  CircleAlert, ArrowRight, Heart, Sparkles, Phone
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  'Registration Received': 'bg-blue-100 text-blue-800 border-blue-200',
  'Contact Pending': 'bg-amber-100 text-amber-800 border-amber-200',
  'Contacted': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Follow-up Scheduled': 'bg-purple-100 text-purple-800 border-purple-200',
  'Shopping Date Confirmed': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Visit Scheduled': 'bg-teal-100 text-teal-800 border-teal-200',
  'Visit Completed': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Purchase Processing': 'bg-orange-100 text-orange-800 border-orange-200',
  'Purchase Completed': 'bg-green-100 text-green-800 border-green-200',
  'Completed': 'bg-green-100 text-green-800 border-green-200',
  'Cancelled': 'bg-red-100 text-red-800 border-red-200'
};

export default function WeddingTracking() {
  const [regId, setRegId] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleTrack = async () => {
    if (loading) return; // prevent duplicate simultaneous submissions

    const cleanId = regId.trim().toUpperCase().replace(/\s+/g, '');
    const cleanMobile = mobile.replace(/\D/g, '');
    if (!cleanId) {
      showToast('Please enter your Wedding Request ID and registered mobile number.', 'error');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      showToast('Please enter a valid 10-digit Indian mobile number', 'error');
      return;
    }

    setLoading(true);
    setResult(null);
    setNotFound(false);
    setServerError(null);

    try {
      const res = await API.trackWeddingRegistration(cleanId, cleanMobile);
      if (res && res.success !== false && res.registration_id) {
        setResult(res);
      } else {
        setNotFound(true);
      }
    } catch (err: any) {
      // Distinguish the real failure instead of showing "Not Found" for everything.
      if (err?.status === 404) {
        setNotFound(true);
      } else if (err?.status === 400) {
        showToast(err?.message || 'Please enter your Wedding Request ID and registered mobile number.', 'error');
      } else if (err?.status === 429) {
        showToast(err?.message || 'Too many tracking attempts. Please try again later.', 'error');
      } else if (err?.status !== undefined && err.status >= 500) {
        setServerError("We couldn't check your request right now. Please try again.");
      } else {
        setServerError('Unable to connect to the server. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FBF8F5] via-[#F5F0EB] to-[#FBF8F5]">
      <ToastContainer />

      {/* Header */}
      <header className="bg-[#3D2B1F] p-4 sm:p-5 shadow-lg border-b border-[#D4A58A]/30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="BSC Logo" className="w-11 h-11 object-contain rounded-xl bg-white p-1 shadow-md" />
            <div>
              <h1 className="font-extrabold text-base sm:text-lg text-white leading-tight">BSC Wedding Tracking</h1>
              <div className="text-[10px] text-[#D4A58A] font-bold uppercase tracking-widest mt-0.5">
                Track your wedding shopping request
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Tracking Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-6 border border-[#E8DDD4]">
          <div className="border-b border-[#E8DDD4] pb-4">
            <h2 className="text-lg font-extrabold text-[#3D2B1F] flex items-center gap-2">
              <Search className="w-5 h-5 text-[#D4A58A]" />
              Track Wedding Request
            </h2>
            <p className="text-sm text-[#6B5D50] mt-1">Enter your Wedding Request ID and registered mobile number to check your status.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#3D2B1F] mb-1.5">Wedding Request ID <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={regId}
                onChange={e => setRegId(e.target.value.toUpperCase())}
                placeholder="e.g. BSC-WED-DAV-2026-000001"
                className="w-full px-4 py-3 rounded-xl border-2 border-[#E8DDD4] focus:border-[#3D2B1F] focus:ring-2 focus:ring-[#3D2B1F]/10 outline-none transition-all text-sm font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3D2B1F] mb-1.5">Registered Mobile Number <span className="text-red-500">*</span></label>
              <div className="flex">
                <span className="px-3 py-3 bg-[#F5F0EB] border-2 border-r-0 border-[#E8DDD4] rounded-l-xl font-extrabold text-xs text-[#6B5D50] flex items-center">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  value={mobile}
                  onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="w-full px-4 py-3 rounded-r-xl border-2 border-[#E8DDD4] focus:border-[#3D2B1F] focus:ring-2 focus:ring-[#3D2B1F]/10 outline-none transition-all text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleTrack}
              disabled={loading}
              className="w-full py-3 bg-[#3D2B1F] hover:bg-[#5D4E42] text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="text-white">Checking your request...</span>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Track Request</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Server / network failure — distinct from "not found" */}
        {serverError && (
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-amber-200 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
              <CircleAlert className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-[#3D2B1F]">Something Went Wrong</h3>
            <p className="text-sm text-[#6B5D50]">{serverError}</p>
          </div>
        )}

        {/* Not Found */}
        {notFound && (
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-200 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <CircleAlert className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-[#3D2B1F]">Registration Not Found</h3>
            <p className="text-sm text-[#6B5D50]">No registration was found for the Wedding Request ID and mobile number provided. Please verify both details and try again.</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-[#E8DDD4]">
            {/* Status Banner */}
            <div className="bg-gradient-to-r from-[#3D2B1F] to-[#5D4E42] p-6 text-center">
              <Sparkles className="w-8 h-8 text-[#D4A58A] mx-auto mb-2" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#D4A58A] mb-1">Wedding Request</h3>
              <p className="text-xl font-mono font-black tracking-wider">{result.registration_id}</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Current Status */}
              <div className="text-center">
                <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold border ${STATUS_COLORS[result.current_status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                  {result.current_status}
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FBF8F5]">
                  <CircleCheck className="w-5 h-5 text-[#3D2B1F] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-[#5D4E42] uppercase">Customer Name</p>
                    <p className="text-sm font-bold text-[#3D2B1F]">{result.customer_name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FBF8F5]">
                  <MapPin className="w-5 h-5 text-[#3D2B1F] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-[#5D4E42] uppercase">BSC Store</p>
                    <p className="text-sm font-bold text-[#3D2B1F]">{result.store_name} ({result.store_code})</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FBF8F5]">
                  <Calendar className="w-5 h-5 text-[#3D2B1F] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-[#5D4E42] uppercase">Registration Date</p>
                    <p className="text-sm font-bold text-[#3D2B1F]">{formatDate(result.registration_date)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FBF8F5]">
                  <Heart className="w-5 h-5 text-[#3D2B1F] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-[#5D4E42] uppercase">Wedding Date</p>
                    <p className="text-sm font-bold text-[#3D2B1F]">{formatDate(result.wedding_date)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FBF8F5]">
                  <Clock className="w-5 h-5 text-[#3D2B1F] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-[#5D4E42] uppercase">Expected Shopping Date</p>
                    <p className="text-sm font-bold text-[#3D2B1F]">{formatDate(result.expected_shopping_date)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FBF8F5]">
                  <Phone className="w-5 h-5 text-[#3D2B1F] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-[#5D4E42] uppercase">Next Follow-up</p>
                    <p className="text-sm font-bold text-[#3D2B1F]">{formatDate(result.next_followup)}</p>
                  </div>
                </div>
              </div>

              {/* Status Timeline */}
              {result.status_timeline && result.status_timeline.length > 0 && (
                <div className="pt-4 border-t border-[#E8DDD4]">
                  <h4 className="text-xs font-bold text-[#3D2B1F] uppercase tracking-wider mb-3">Progress</h4>
                  <div className="space-y-2">
                    {result.status_timeline.map((status: string, idx: number) => {
                      const isCurrent = idx === result.status_timeline.length - 1;
                      return (
                        <div key={status} className={`flex items-center gap-3 p-2 rounded-lg ${isCurrent ? 'bg-[#3D2B1F]/5 border border-[#3D2B1F]/10' : ''}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isCurrent ? 'bg-[#3D2B1F] text-white' : 'bg-[#E8DDD4] text-[#5D4E42]'}`}>
                            {isCurrent ? <CircleCheck className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{idx + 1}</span>}
                          </div>
                          <span className={`text-xs font-bold ${isCurrent ? 'text-[#3D2B1F]' : 'text-[#5D4E42]'}`}>{status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Help Text */}
              <div className="pt-4 border-t border-[#E8DDD4] text-center">
                <p className="text-xs text-[#5D4E42]">For any queries, contact your BSC store directly.</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="text-center text-xs text-[#5D4E42] pb-6">
          <p>BSC Textiles — Wedding Shopping Registration & Tracking</p>
        </div>
      </div>
    </div>
  );
}
