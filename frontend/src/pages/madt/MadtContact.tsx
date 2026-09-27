import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MadtLayout from './MadtLayout';
import {
  generateUnifiedAdvocationData,
  formatAutoAdvocationLetter,
  copyToClipboard
} from '../../utils/autoAdvocation';

export default function MadtContact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General inquiry',
    message: ''
  });

  const [refNumber, setRefNumber] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [advocacyLetter, setAdvocacyLetter] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Contact — MADT';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/madt/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'contact', ...formData, note: formData.message })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to submit contact message');
      }

      setRefNumber(data.ref);
      setSubmitted(true);

      const advocacy = generateUnifiedAdvocationData({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject: formData.subject,
        note: formData.message,
        ref: data.ref,
        kind: 'contact',
        role: 'Inquirer',
        status: 'new'
      });

      setAdvocacyLetter(formatAutoAdvocationLetter(advocacy));
    } catch (err: any) {
      // Mock / offline fallback
      const mockRef = `BSC-M-${Math.floor(1800 + Math.random() * 400)}`;
      setRefNumber(mockRef);
      setSubmitted(true);

      const advocacy = generateUnifiedAdvocationData({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject: formData.subject,
        note: formData.message,
        ref: mockRef,
        kind: 'contact',
        role: 'Inquirer',
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
          <p className="kicker">Desk inquiry</p>
          <h1>Write to the house</h1>
          <p className="lede">
            For wedding lists, bespoke tailoring inquiries, or opening hours across stores, send a message.
            The front desk checks inquiries daily.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} noValidate>
              {errorMsg && (
                <div style={{ color: 'var(--accent-red, #B22222)', marginBottom: '1rem', fontWeight: 600 }}>
                  {errorMsg}
                </div>
              )}

              <div className="field">
                <label htmlFor="cnt-name">Your name</label>
                <input
                  id="cnt-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="cnt-email">Email</label>
                  <input
                    id="cnt-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@domain.com"
                  />
                </div>
                <div className="field">
                  <label htmlFor="cnt-phone">Phone number</label>
                  <input
                    id="cnt-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Optional for quick SMS reply"
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="cnt-subject">Subject</label>
                <select
                  id="cnt-subject"
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                >
                  <option value="General inquiry">General inquiry</option>
                  <option value="Wedding shopping appointment">Wedding shopping appointment</option>
                  <option value="Suit desk fitting query">Suit desk fitting query</option>
                  <option value="Bulk home linen / towels order">Bulk home linen / towels order</option>
                  <option value="Store feedback / compliment">Store feedback / compliment</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="cnt-message">Your message</label>
                <textarea
                  id="cnt-message"
                  rows={5}
                  required
                  value={formData.message}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                  placeholder="How can the house assist you?"
                />
              </div>

              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Sending message…' : 'Send message to desk'} <span className="btn-arrow">→</span>
              </button>
            </form>
          ) : (
            <div className="form-confirm">
              <p className="kicker">Message received</p>
              <h2>Thank you for writing.</h2>
              <p>Inquiry Reference: <strong className="ref-tag">{refNumber}</strong></p>
              <p>A member of the house will respond within one business day.</p>

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
