import React, { useState } from 'react';
import { ServiceItem } from '../types';
import { ProfileApi } from '../api';
import { X, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface ServiceInquiryModalProps {
  service: ServiceItem | null;
  onClose: () => void;
}

export const ServiceInquiryModal: React.FC<ServiceInquiryModalProps> = ({ service, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    preferred_date: '',
    notes: '',
    _hp_field: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!service) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await ProfileApi.submitContact({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject: `Service Reservation: ${service.title}`,
        message: `Inquiry for ${service.title}. Preferred Date: ${formData.preferred_date || 'Flexible'}. Notes: ${formData.notes || 'None provided'}`,
        _hp_field: formData._hp_field
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit booking inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[var(--pf-bg-card)] border border-[var(--pf-border)] rounded-2xl sm:rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative text-[var(--pf-text-main)]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1.5 rounded-full border border-[var(--pf-border)] text-[var(--pf-text-muted)] hover:bg-[var(--pf-bg-alt)]"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-serif text-2xl font-bold">Appointment Requested</h3>
            <p className="text-xs sm:text-sm text-[var(--pf-text-muted)] leading-relaxed max-w-md mx-auto">
              Thank you, <strong>{formData.name}</strong>. Our senior stylist at BSC Textiles has received your reservation request for <strong>{service.title}</strong> and will telephone you shortly to confirm timings.
            </p>
            <button onClick={onClose} className="pf-btn-primary mx-auto text-xs mt-4">
              Return to Website
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="pf-badge-gold text-[10px] mb-1.5 inline-block">VIP Counter Reservation</span>
              <h3 className="font-serif text-xl sm:text-2xl font-bold">{service.title}</h3>
              <p className="text-xs text-[var(--pf-text-muted)] mt-1">
                {service.short_description}
              </p>
            </div>

            <div className="p-3 bg-[var(--pf-bg-alt)] rounded-xl border border-[var(--pf-border-soft)] flex items-center justify-between text-xs">
              <span className="text-[var(--pf-text-muted)] font-medium">Starting Investment</span>
              <span className="font-bold text-[var(--pf-burgundy)] font-serif text-sm">{service.starting_price}</span>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Honeypot field */}
            <input
              type="text"
              name="_hp_field"
              value={formData._hp_field}
              onChange={e => setFormData({ ...formData, _hp_field: e.target.value })}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--pf-text-main)]">Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Smt. Radhika Kulkarni"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs focus:outline-none focus:border-[var(--pf-gold)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--pf-text-main)]">Mobile Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98450 00000"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs focus:outline-none focus:border-[var(--pf-gold)] font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--pf-text-main)]">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="radhika@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs focus:outline-none focus:border-[var(--pf-gold)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--pf-text-main)]">Preferred Shopping Date</label>
                <input
                  type="date"
                  value={formData.preferred_date}
                  onChange={e => setFormData({ ...formData, preferred_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs focus:outline-none focus:border-[var(--pf-gold)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--pf-text-main)]">Special Requirements / Family Members</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Mention wedding date, preferred saree styles, or family size..."
                className="w-full px-3 py-2 rounded-xl border border-[var(--pf-border)] bg-[var(--pf-bg)] text-xs focus:outline-none focus:border-[var(--pf-gold)]"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-[var(--pf-text-subtle)] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Reserved 2-Hour Floor Window</span>
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="pf-btn-primary text-xs disabled:opacity-50"
              >
                {submitting ? 'Confirming...' : 'Request Private Suite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ServiceInquiryModal;
