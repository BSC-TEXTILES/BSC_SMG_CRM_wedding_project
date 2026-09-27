import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MadtLayout from './MadtLayout';
import {
  generateUnifiedAdvocationData,
  formatAutoAdvocationLetter,
  copyToClipboard
} from '../../utils/autoAdvocation';

export default function MadtConsult() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    floor: 'Belagavi Flagship (Khade Bazar)',
    day: 'Weekdays, late morning',
    note: ''
  });

  const [refNumber, setRefNumber] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [advocacyLetter, setAdvocacyLetter] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Book a Consultation — MADT';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/madt/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'consult', ...formData })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to submit consultation request');
      }

      setRefNumber(data.ref);
      setSubmitted(true);

      const advocacy = generateUnifiedAdvocationData({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        floor: formData.floor,
        preferredDay: formData.day,
        note: formData.note,
        ref: data.ref,
        kind: 'consult',
        role: 'Client / Visitor',
        status: 'new'
      });

      setAdvocacyLetter(formatAutoAdvocationLetter(advocacy));
    } catch (err: any) {
      // Mock / offline fallback
      const mockRef = `BSC-C-${Math.floor(1800 + Math.random() * 400)}`;
      setRefNumber(mockRef);
      setSubmitted(true);

      const advocacy = generateUnifiedAdvocationData({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        floor: formData.floor,
        preferredDay: formData.day,
        note: formData.note,
        ref: mockRef,
        kind: 'consult',
        role: 'Client / Visitor',
        status: 'new'
      });

      setAdvocacyLetter(formatAutoAdvocationLetter(advocacy));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(advocacyLetter);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <MadtLayout page="sub">
      <main id="main" className="subpage">
        <div className="wrap form-wrap">
          <p className="kicker">An unhurried hour</p>
          <h1>Book a consultation</h1>
          <p className="lede">
            If you are choosing cloth for an occasion, matching linen across rooms, or marking a suit,
            tell us when suits you. We hold thirty minutes with the counter staff who knows that section.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} noValidate>
              {errorMsg && (
                <div style={{ color: 'var(--accent-red, #B22222)', marginBottom: '1rem', fontWeight: 600 }}>
                  {errorMsg}
                </div>
              )}

              <div className="field">
                <label htmlFor="con-name">Your name</label>
                <input
                  id="con-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="con-email">Email</label>
                  <input
                    id="con-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@domain.com"
                  />
                </div>
                <div className="field">
                  <label htmlFor="con-phone">Phone number</label>
                  <input
                    id="con-phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="10 digits"
                  />
                </div>
              </div>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="con-floor">Counter or floor</label>
                  <select
                    id="con-floor"
                    value={formData.floor}
                    onChange={e => setFormData({ ...formData, floor: e.target.value })}
                  >
                    <option value="Belagavi Flagship (Khade Bazar)">Belagavi Flagship (Khade Bazar) — Women & Jewellery</option>
                    <option value="Shivamogga Store (Nehru Road)">Shivamogga Store (Nehru Road) — Suits & Tailoring</option>
                    <option value="Davanagere Heritage (Mandipet)">Davanagere Heritage (Mandipet) — Linen & Towels</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="con-day">Preferred day or time</label>
                  <select
                    id="con-day"
                    value={formData.day}
                    onChange={e => setFormData({ ...formData, day: e.target.value })}
                  >
                    <option value="Weekdays, late morning">Weekdays, late morning</option>
                    <option value="Weekdays, afternoon">Weekdays, afternoon</option>
                    <option value="Saturday morning">Saturday morning</option>
                    <option value="Sunday morning">Sunday morning</option>
                    <option value="Monday by appointment (Coen Road only)">Monday by appointment (Coen Road only)</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="con-note">What you want to look through</label>
                <textarea
                  id="con-note"
                  rows={4}
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  placeholder="E.g. groom’s jacket and matching shirt, five guest towels, mother-of-the-bride saree"
                />
              </div>

              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Sending request…' : 'Send consultation request'} <span className="btn-arrow">→</span>
              </button>
            </form>
          ) : (
            <div className="form-confirm">
              <p className="kicker">Request sent</p>
              <h2>We have noted your visit.</h2>
              <p>Reference: <strong className="ref-tag">{refNumber}</strong></p>
              <p>The floor will reply by telephone or message to confirm the counter is staffed for you.</p>

              {/* Auto-Advocation advocacy letter section */}
              {advocacyLetter && (
                <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--paper-deep, #EBE5DC)', borderRadius: '6px', border: '1px solid var(--line-strong, #DDD)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Auto-Advocation Unified Brief
                    </p>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={handleCopy}
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      {copied ? '✓ Copied Brief' : 'Copy Brief'}
                    </button>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.85rem', color: 'var(--ink-soft, #444)', maxHeight: '280px', overflowY: 'auto' }}>
                    {advocacyLetter}
                  </pre>
                </div>
              )}

              <p style={{ marginTop: '1.5rem' }}>
                <Link to="/madt" className="btn btn-ghost">Back to the house</Link>
              </p>
            </div>
          )}
        </div>
      </main>
    </MadtLayout>
  );
}
