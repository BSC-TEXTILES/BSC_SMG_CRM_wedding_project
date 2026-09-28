import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileFooter } from '../components/ProfileFooter';
import { ProfileApi } from '../api';
import { Phone, Clock, Send, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

export const ProfileContact: React.FC = () => {
  const [searchParams] = useSearchParams();
  const serviceParam = searchParams.get('service');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    subject: serviceParam ? `Inquiry regarding ${serviceParam}` : 'Bridal Suite & Counter Consultation',
    message: '',
    _hp_field: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Contact Desk & Showrooms — BSC Textiles';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const res = await ProfileApi.submitContact(formData);
      setSuccessMsg(
        'Thank you! Your inquiry has been registered with our counter desk. Our senior consultant will telephone you within 24 hours.'
      );
      setFormData({
        name: '',
        email: '',
        phone: '',
        company: '',
        subject: 'Bridal Suite & Counter Consultation',
        message: '',
        _hp_field: ''
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit your message. Please verify fields or contact us directly by phone.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <ProfileHeader />

      <main className="flex-1 py-10 sm:py-16">
        <div className="pf-container space-y-16">
          {/* Header */}
          <div className="space-y-3 max-w-2xl border-b border-[var(--pf-border)] pb-8">
            <span className="pf-subheading">Contact Desk & Appointments</span>
            <h1 className="font-serif text-3xl sm:text-5xl font-bold text-[var(--pf-text-main)]">
              Write to the Counter Desk
            </h1>
            <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed">
              Whether reserving a private VIP draping suite, inquiring about pure Mulberry Kanjeevarams, or scheduling a groom tailoring consultation, our team is at your service.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
            {/* Left Column: Contact Form */}
            <div className="lg:col-span-7">
              <div className="pf-card p-6 sm:p-10 space-y-6">
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[var(--pf-text-main)]">
                    Send a Direct Message
                  </h2>
                  <p className="text-xs text-[var(--pf-text-muted)] mt-1">
                    Every message is stored securely and directly routed to our showroom managers.
                  </p>
                </div>

                {successMsg && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Message Received Successfully</p>
                      <p className="text-xs mt-0.5">{successMsg}</p>
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Submission Error</p>
                      <p className="text-xs mt-0.5">{errorMsg}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  {/* Honeypot Spam Protection Field */}
                  <input
                    type="text"
                    name="_hp_field"
                    value={formData._hp_field}
                    onChange={e => setFormData({ ...formData, _hp_field: e.target.value })}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-[var(--pf-text-main)] mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Smt. Sumitra Patil"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs text-[var(--pf-text-main)] focus:outline-none focus:border-[var(--pf-gold)]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-[var(--pf-text-main)] mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="patil.family@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs text-[var(--pf-text-main)] focus:outline-none focus:border-[var(--pf-gold)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-[var(--pf-text-main)] mb-1">
                        Mobile Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 98450 12345"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs text-[var(--pf-text-main)] focus:outline-none focus:border-[var(--pf-gold)] font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-[var(--pf-text-main)] mb-1">
                        Family Name / Company (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={e => setFormData({ ...formData, company: e.target.value })}
                        placeholder="e.g. Patil Family Wedding"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs text-[var(--pf-text-main)] focus:outline-none focus:border-[var(--pf-gold)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[var(--pf-text-main)] mb-1">
                      Subject *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={e => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="e.g. Reserving VIP Bridal Floor for November Wedding"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs text-[var(--pf-text-main)] focus:outline-none focus:border-[var(--pf-gold)]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[var(--pf-text-main)] mb-1">
                      Your Message & Requirements *
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={formData.message}
                      onChange={e => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Please let us know your wedding date, approximate family members attending, and preferred showroom destination..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs text-[var(--pf-text-main)] focus:outline-none focus:border-[var(--pf-gold)] leading-relaxed"
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-[11px] text-[var(--pf-text-subtle)] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Encrypted transmission · Zero spam policy</span>
                    </span>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="pf-btn-primary justify-center text-xs disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submitting ? 'Submitting to Desk...' : 'Send Message to Desk'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Physical Counters & Hours */}
            <div className="lg:col-span-5 space-y-6">
              <div className="pf-card p-6 space-y-4">
                <span className="pf-subheading">Flagship Destination</span>
                <h3 className="font-serif text-xl font-bold text-[var(--pf-text-main)]">
                  Belagavi Main House
                </h3>
                <p className="text-xs text-[var(--pf-text-muted)] leading-relaxed">
                  Khade Bazar & Kirloskar Road intersection, Belagavi, Karnataka 590001
                </p>
                <div className="space-y-2 text-xs text-[var(--pf-text-muted)] border-t border-[var(--pf-border-soft)] pt-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[var(--pf-gold)]" />
                    <span className="font-mono font-bold text-[var(--pf-text-main)]">+91 831 242 1948</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--pf-gold)]" />
                    <span>Open 10:30 AM to 8:30 PM (All 7 Days)</span>
                  </div>
                </div>
              </div>

              {/* Regional Centers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="pf-card p-4 space-y-2">
                  <h4 className="font-serif text-sm font-bold text-[var(--pf-text-main)]">Davanagere</h4>
                  <p className="text-[11px] text-[var(--pf-text-muted)]">Coen Road Silk Pavilion</p>
                  <p className="text-[11px] font-mono text-[var(--pf-gold)] font-bold">+91 8192 234 567</p>
                </div>

                <div className="pf-card p-4 space-y-2">
                  <h4 className="font-serif text-sm font-bold text-[var(--pf-text-main)]">Shivamogga</h4>
                  <p className="text-[11px] text-[var(--pf-text-muted)]">Vidyanagar Complex</p>
                  <p className="text-[11px] font-mono text-[var(--pf-gold)] font-bold">+91 8182 278 910</p>
                </div>
              </div>

              {/* Counter Protocol Guarantee */}
              <div className="p-6 rounded-2xl bg-[var(--pf-bg-alt)] border border-[var(--pf-border)] space-y-2.5">
                <h4 className="font-serif text-sm font-bold text-[var(--pf-text-main)] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--pf-gold)]" />
                  <span>The Counter Protocol</span>
                </h4>
                <p className="text-xs text-[var(--pf-text-muted)] leading-relaxed">
                  We never require walk-in appointments for regular shopping. However, reserving the private bridal consultation suite guarantees a reserved changing suite and private stylists for multi-generational families.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <ProfileFooter />
    </div>
  );
};

export default ProfileContact;
