import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  CircleCheck,
  Send,
  MessageSquare,
  Heart,
  TrendingUp,
  CircleHelp,
  User,
  Phone,
  ThumbsUp,
  ThumbsDown,
  Smile,
  Meh,
  Frown,
  Clock,
  Store,
  Star,
  Zap,
  ShieldCheck,
  Check,
  Award,
  ShoppingBag,
  Lock
} from 'lucide-react';
import { API } from '../services/api';
import { showToast } from '../components/Toast';

const defaultQuestions = [
  { id: 'q1', question: 'How satisfied are you with your overall shopping experience today?', category: 'Shopping Experience', options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied'] },
  { id: 'q2', question: 'Did you find the product you were looking for?', category: 'Product Availability', options: ['Yes, exactly what I wanted', 'Yes, with assistance', 'Partially', 'No'] },
  { id: 'q3', question: 'How would you rate the quality & variety of our collection?', category: 'Collection Quality', options: ['Excellent', 'Good', 'Average', 'Poor'] },
  { id: 'q4', question: 'How would you rate the behavior and helpfulness of our staff?', category: 'Staff Courtesy', options: ['Extremely helpful', 'Helpful', 'Average', 'Poor'] },
  { id: 'q5', question: 'How likely are you to recommend BSC Exclusive to your friends and family?', category: 'Store Recommendation', options: ['Definitely recommend', 'Probably recommend', 'Neutral', 'Not recommend'] }
];

// Location codes for the 3 standard locations
const LOCATIONS = {
  BEL: { code: 'BEL', name: 'Belagavi', storeName: 'BSC Textiles Belagavi' },
  DAV: { code: 'DAV', name: 'Davanagere', storeName: 'BSC Textiles Davanagere' },
  SHI: { code: 'SHI', name: 'Shivamogga', storeName: 'BSC Textiles Shivamogga' }
};

export default function PublicFeedback() {
  const [searchParams] = useSearchParams();
  const qrCodeId = searchParams.get('qr'); // Legacy support
  const locationCode = searchParams.get('location'); // New location-based parameter
  
  // Determine the effective location
  const effectiveLocationCode = locationCode?.toUpperCase() || qrCodeId;
  const location = LOCATIONS[effectiveLocationCode as keyof typeof LOCATIONS] || LOCATIONS.DAV;

  const [questions, setQuestions] = useState<any[]>(defaultQuestions);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');

  // Additional feedback text fields
  const [likedMost, setLikedMost] = useState<string>('');
  const [canImprove, setCanImprove] = useState<string>('');
  const [additionalComments, setAdditionalComments] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [refNo, setRefNo] = useState<string>('');

  // Track QR scan on mount
  useEffect(() => {
    if (location?.code) {
      API.trackQrScanByLocation(location.code, 'feedback_form').catch((err: any) => console.warn('QR scan tracking failed:', err));
    } else if (qrCodeId) {
      // Legacy support
      API.trackQrScan(qrCodeId, 'feedback_form').catch((err: any) => console.warn('QR scan tracking failed:', err));
    }
  }, [location?.code, qrCodeId]);

  useEffect(() => {
    API.getFeedbackQuestions()
      .then((res: any) => {
        if (res && res.questions && Array.isArray(res.questions) && res.questions.length > 0) {
          setQuestions(res.questions);
        }
      })
      .catch((err: any) => console.error(err));
  }, []);

  // Compute live survey completion progress (7 total items: Name + Mobile + 5 Questions)
  const progressStats = useMemo(() => {
    const totalRequired = questions.length + 2; // Name + Mobile + 5 Questions = 7
    const count = (customerName.trim() ? 1 : 0) + (mobile.trim() ? 1 : 0) + Object.keys(answers).length;
    const pct = Math.min(100, Math.round((count / totalRequired) * 100));
    return { count, total: totalRequired, pct };
  }, [customerName, mobile, answers, questions.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const normalizedMobile = mobile.length === 10 ? `+91${mobile}` : mobile;
      const targetLocId = location.code === 'BEL' ? 1 : location.code === 'SHI' ? 3 : 2;
      const res: any = await API.submitFeedback({
        customerName,
        custName: customerName,
        mobile: normalizedMobile,
        custMobile: normalizedMobile,
        answers,
        likedMost,
        canImprove,
        additionalComments,
        source: 'qr',
        qrCodeId: qrCodeId || undefined,
        locationCode: location.code,
        storeLocation: location.name,
        location_id: targetLocId,
        locationId: targetLocId
      });
      setRefNo(res?.id || res?.refNo || `FB-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
      showToast(`${location.name} feedback submitted successfully.`, 'success');
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      showToast('Unable to submit feedback. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getOptionIcon = (opt: string) => {
    const l = opt.toLowerCase();
    if (l.includes('very satisfied') || l.includes('definitely') || l.includes('excellent') || l.includes('extremely')) return <Smile className="w-5 h-5 text-emerald-500 shrink-0" />;
    if (l.includes('satisfied') || l.includes('good') || l.includes('helpful') || l.includes('yes')) return <ThumbsUp className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (l.includes('neutral') || l.includes('average') || l.includes('partially')) return <Meh className="w-4 h-4 text-amber-500 shrink-0" />;
    if (l.includes('dissatisfied') || l.includes('poor') || l.includes('no') || l.includes('not recommend')) return <Frown className="w-4 h-4 text-rose-500 shrink-0" />;
    return <Star className="w-4 h-4 text-accent shrink-0" />;
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-hover to-[#3D2B1F] flex items-center justify-center p-4 sm:p-6 select-text relative overflow-hidden text-white">
        {/* Background Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="bg-black/10 backdrop-blur-2xl p-8 sm:p-10 max-w-lg w-full text-center space-y-6 animate-scale-in border border-black/20 rounded-3xl shadow-2xl relative z-10">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-2xl border border-black/30 animate-bounce">
            <CircleCheck className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary border border-accent text-accent text-[10.5px] font-black uppercase tracking-widest">
              <Store className="w-3.5 h-3.5" /> {location.storeName}
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Thank You!</h2>
            <p className="text-white/85 text-sm font-medium leading-relaxed max-w-md mx-auto">
              Your valuable feedback has been received successfully. We appreciate your time in helping us improve our retail experience.
            </p>
          </div>

          {/* Reference Badge */}
          <div className="p-4 rounded-2xl bg-black/5 border border-black/10 text-xs text-white/90 space-y-1">
            <div className="text-[10px] uppercase font-black tracking-widest text-accent">Survey Reference ID</div>
            <div className="font-mono text-base font-black text-white">{refNo}</div>
          </div>

          <button
            onClick={() => {
              setSubmitted(false);
              setAnswers({});
              setCustomerName('');
              setMobile('');
              setLikedMost('');
              setCanImprove('');
              setAdditionalComments('');
            }}
            className="w-full h-14 bg-gradient-to-r from-accent via-[#D4A58A] to-accent text-primary font-black text-sm rounded-2xl shadow-xl active:scale-95 transition-all duration-150 border-2 border-amber-200/50"
          >
            Submit Another Survey Response
          </button>

          <div className="text-[10.5px] text-white/50 font-bold">
            BSC EXCLUSIVE • LUXURY STORE KIOSK FEEDBACK SYSTEM
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-5 sm:py-8 px-4 sm:px-6 flex justify-center selection:bg-accent selection:text-primary">
      <div className="max-w-4xl w-full space-y-5">

        {/* Luxury Deep Navy to Royal Navy & Gold Hero Section (220-260px Height) */}
        <div className="p-6 sm:p-8 rounded-[24px] bg-gradient-to-br from-primary via-primary-hover to-[#3D2B1F] text-white border border-black/20 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[230px] sm:min-h-[255px]">
          {/* Subtle Decorative Gold Highlight & Shapes */}
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-accent/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 items-center">

            {/* Left Content Column */}
            <div className="sm:col-span-2 space-y-2.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary text-accent text-[11px] font-black uppercase tracking-widest border border-accent/80 shadow-sm">
                <ShoppingBag className="w-3.5 h-3.5 text-accent" />
                <span>{location.storeName} • STORE SURVEY</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-white tracking-tight leading-tight drop-shadow-md">
                Customer Experience Survey
              </h1>

              <p className="text-white/85 text-sm sm:text-base font-medium leading-relaxed max-w-xl">
                “Help us improve your shopping experience in just one minute.”
              </p>
            </div>

            {/* Right Side Glass Summary Panel with Circular Progress Ring */}
            <div className="sm:col-span-1 bg-black/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-black/20 flex items-center justify-between sm:flex-col sm:justify-center gap-3 text-center shadow-lg">

              {/* Circular Progress Ring */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white/15"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-accent transition-all duration-500 ease-out"
                    strokeDasharray={`${progressStats.pct}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="font-mono text-xs sm:text-sm font-black text-accent drop-shadow-xs">{progressStats.pct}%</span>
                  <span className="text-[8px] uppercase font-bold text-white/75">Done</span>
                </div>
              </div>

              {/* Stats Summary Panel */}
              <div className="text-right sm:text-center space-y-0.5 text-xs">
                <div className="flex items-center justify-end sm:justify-center gap-1 text-[11px] font-black text-accent">
                  <Clock className="w-3 h-3 text-accent" />
                  <span>Est. Time: 1 Min</span>
                </div>
                <div className="text-white/95 text-[11px] font-extrabold">5 Survey Sections</div>
                <div className="text-white text-[10px] font-semibold">{progressStats.count} of {progressStats.total} Completed</div>
              </div>

            </div>

          </div>

          {/* Full-Width Animated Section Step Tracker below Hero */}
          <div className="relative z-10 pt-4 border-t border-white/15 space-y-2">
            <div className="flex items-center justify-between text-[10.5px] font-extrabold text-white/90 overflow-x-auto gap-1.5 scrollbar-none">
              <span className={`px-2.5 py-0.5 rounded-full whitespace-nowrap ${customerName && mobile ? 'bg-accent text-primary font-black' : 'bg-black/10 text-white'}`}>
                Details
              </span>
              <span className="text-white/40">·</span>
              <span className={`px-2.5 py-0.5 rounded-full whitespace-nowrap ${answers['q1'] ? 'bg-accent text-primary font-black' : 'bg-black/10 text-white'}`}>
                Shopping
              </span>
              <span className="text-white/40">·</span>
              <span className={`px-2.5 py-0.5 rounded-full whitespace-nowrap ${answers['q2'] || answers['q3'] ? 'bg-accent text-primary font-black' : 'bg-black/10 text-white'}`}>
                Product
              </span>
              <span className="text-white/40">·</span>
              <span className={`px-2.5 py-0.5 rounded-full whitespace-nowrap ${answers['q4'] ? 'bg-accent text-primary font-black' : 'bg-black/10 text-white'}`}>
                Staff
              </span>
              <span className="text-white/40">·</span>
              <span className={`px-2.5 py-0.5 rounded-full whitespace-nowrap ${answers['q5'] ? 'bg-accent text-primary font-black' : 'bg-black/10 text-white'}`}>
                Recommendation
              </span>
              <span className="text-white/40">·</span>
              <span className={`px-2.5 py-0.5 rounded-full whitespace-nowrap ${likedMost || canImprove ? 'bg-accent text-primary font-black' : 'bg-black/10 text-white'}`}>
                Feedback
              </span>
            </div>

            {/* Dark Navy Track & Gold Progress Line */}
            <div className="w-full h-2.5 bg-primary/80 rounded-full overflow-hidden p-0.5 border border-black/10">
              <div
                className="h-full bg-gradient-to-r from-accent via-[#D4A58A] to-amber-300 rounded-full transition-all duration-300 shadow-md"
                style={{ width: `${progressStats.pct}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Survey Form Body (20px Gap) */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Customer Verification Panel (Secure Check-in Screen) */}
          <div className="card-glass p-6 sm:p-8 rounded-[22px] space-y-4 border border-white/80 bg-white/95 shadow-lg border-t-4 border-t-accent">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <h3 className="font-black text-primary text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                <div className="bg-accent/15 p-1.5 rounded-xl text-primary">
                  <Lock className="w-4 h-4 text-accent" />
                </div>
                <span>Customer Verification Details</span>
              </h3>
              <span className="text-[10.5px] font-black text-accent uppercase tracking-wider bg-primary px-2.5 py-1 rounded-full">Required Verification *</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-primary">Full Name *</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 bg-accent/15 p-1.5 rounded-xl text-primary">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs font-semibold pl-12 pr-4 h-14 rounded-2xl border border-accent-soft bg-white/95 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-primary">Mobile Number *</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 bg-accent/15 p-1.5 rounded-xl text-primary">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <span className="absolute left-12 top-1/2 -translate-y-1/2 text-xs font-extrabold text-primary/60">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full text-xs font-mono font-semibold pl-16 pr-4 h-14 rounded-2xl border border-accent-soft bg-white/95 text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition-all shadow-xs"
                  />
                </div>
                <p className="text-[10.5px] font-bold text-primary pt-0.5">
                  “We will only use this number for service follow-up.”
                </p>
              </div>
            </div>
          </div>

          {/* Question Cards Stack */}
          <div className="space-y-5">
            {questions.map((q: any, idx: number) => {
              const opts = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? JSON.parse(q.options || '[]') : []);
              const categoryLabel = q.category || `Section ${idx + 1}`;
              const cleanTitle = q.question.replace(/^\d+\.\s*/, '');

              return (
                <div key={q.id || idx} className="card-glass p-7 sm:p-8 rounded-[22px] space-y-4 border border-white/90 bg-white/95 shadow-lg border-t-4 border-t-accent">

                  {/* Section Badge Pill */}
                  <div className="flex items-center justify-between border-b border-accent-soft pb-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-accent text-[10.5px] font-black uppercase tracking-widest">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      <span>{categoryLabel} • Section {idx + 1} of {questions.length}</span>
                    </span>
                    {answers[q.id] && (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        <Check className="w-3.5 h-3.5" /> Answered
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl sm:text-[22px] font-black text-primary leading-snug">
                    {cleanTitle}
                  </h3>

                  {/* Selectable Touch Chips Grid (54px Height) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                    {opts.map((opt: string) => {
                      const isSelected = answers[q.id] === opt;

                      return (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                          className={`
                            h-14 min-h-[56px] py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-extrabold transition-all duration-150 flex items-center justify-between gap-3 text-left border shadow-xs active:scale-95
                            ${isSelected
                              ? 'bg-primary text-white border-2 border-accent shadow-xl shadow-primary/20 scale-[1.01]'
                              : 'bg-white/95 text-primary border-accent-soft hover:bg-white hover:border-primary'}
                          `}
                        >
                          <span className="truncate">{opt}</span>
                          {getOptionIcon(opt)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Voice of Customer / Additional Feedback Section (3 Glass Textareas) */}
          <div className="card-glass p-7 sm:p-8 rounded-[22px] space-y-5 border border-white/90 bg-white/95 shadow-lg border-t-4 border-t-accent">
            <div className="flex items-center justify-between border-b border-accent-soft pb-3">
              <h3 className="font-black text-primary text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent" />
                <span>Voice of Customer Notes (Optional)</span>
              </h3>
              <span className="text-[10.5px] font-extrabold text-primary uppercase tracking-wider">Store Feedback</span>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-300/60 space-y-2">
                <label className="block text-xs font-extrabold text-emerald-900 flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-emerald-600" />
                  <span>What did you like most about your visit today?</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Tell us what stood out positively during your visit..."
                  value={likedMost}
                  onChange={(e) => setLikedMost(e.target.value)}
                  className="w-full text-xs font-medium p-3.5 rounded-xl border border-emerald-200 bg-white text-primary outline-none focus:ring-2 focus:ring-emerald-400/30 transition-all"
                ></textarea>
              </div>

              <div className="p-4 rounded-2xl bg-black/5 border border-amber-300/60 space-y-2">
                <label className="block text-xs font-extrabold text-amber-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>What can we improve to serve you better?</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Share suggestions or improvement areas for our store..."
                  value={canImprove}
                  onChange={(e) => setCanImprove(e.target.value)}
                  className="w-full text-xs font-medium p-3.5 rounded-xl border border-amber-200 bg-white text-primary outline-none focus:ring-2 focus:ring-amber-400/30 transition-all"
                ></textarea>
              </div>

              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-300/60 space-y-2">
                <label className="block text-xs font-extrabold text-blue-900 flex items-center gap-2">
                  <CircleHelp className="w-4 h-4 text-blue-600" />
                  <span>Any additional comments or suggestions?</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Write any extra thoughts, staff compliments, or general comments..."
                  value={additionalComments}
                  onChange={(e) => setAdditionalComments(e.target.value)}
                  className="w-full text-xs font-medium p-3.5 rounded-xl border border-blue-200 bg-white text-primary outline-none focus:ring-2 focus:ring-blue-400/30 transition-all"
                ></textarea>
              </div>
            </div>
          </div>

          {/* Luxury Gold Submit Action Button (58px Height) */}
          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-[58px] bg-gradient-to-r from-accent via-[#D4A58A] to-accent text-primary font-black text-base sm:text-lg rounded-2xl shadow-2xl border-2 border-amber-200/50 flex items-center justify-center gap-2.5 hover:brightness-105 active:scale-95 transition-all duration-150"
            >
              <Send className="w-5 h-5" />
              <span>{submitting ? 'Submitting Feedback...' : 'Submit Feedback Response'}</span>
            </button>

            <div className="text-center text-xs text-primary font-semibold flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>Your feedback helps us continuously improve your shopping experience.</span>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}


