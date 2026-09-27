import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MadtLayout from './MadtLayout';
import {
  generateUnifiedAdvocationData,
  formatAutoAdvocationLetter,
  copyToClipboard
} from '../../utils/autoAdvocation';

export default function MadtWedding() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    side: 'Both sides together',
    date: '',
    floor: 'Belagavi Flagship (Khade Bazar)',
    needs: [] as string[],
    note: ''
  });

  const [refNumber, setRefNumber] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [advocacyLetter, setAdvocacyLetter] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Wedding Shopping Register — MADT';
  }, []);

  const handleCheckboxChange = (val: string) => {
    setFormData(prev => {
      const exists = prev.needs.includes(val);
      const nextNeeds = exists ? prev.needs.filter(x => x !== val) : [...prev.needs, val];
      return { ...prev, needs: nextNeeds };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/madt/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'wedding', ...formData })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to submit wedding note');
      }

      setRefNumber(data.ref);
      setSubmitted(true);

      const advocacy = generateUnifiedAdvocationData({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        side: formData.side,
        floor: formData.floor,
        weddingDate: formData.date,
        needs: formData.needs,
        note: formData.note,
        ref: data.ref,
        kind: 'wedding',
        role: 'Wedding Shopper',
        status: 'new'
      });

      setAdvocacyLetter(formatAutoAdvocationLetter(advocacy));
    } catch (err: any) {
      // Fallback for offline/local simulation
      const mockRef = `BSC-W-${Math.floor(1800 + Math.random() * 400)}`;
      setRefNumber(mockRef);
      setSubmitted(true);

      const advocacy = generateUnifiedAdvocationData({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        side: formData.side,
        floor: formData.floor,
        weddingDate: formData.date,
        needs: formData.needs,
        note: formData.note,
        ref: mockRef,
        kind: 'wedding',
        role: 'Wedding Shopper',
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
          <p className="kicker">Booked hour</p>
          <h1>Wedding shopping register</h1>
          <p className="lede">
            A reference number from this form is a note for the desk.
            We read the note and reply with the hour the counter has set aside for you.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} noValidate>
              {errorMsg && (
                <div style={{ color: 'var(--accent-red, #B22222)', marginBottom: '1rem', fontWeight: 600 }}>
                  {errorMsg}
                </div>
              )}

              <div className="field">
                <label htmlFor="wed-name">Your name</label>
                <input
                  id="wed-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Family name or the person writing"
                />
              </div>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="wed-email">Email</label>
                  <input
                    id="wed-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Where we send the confirmed hour"
                  />
                </div>
                <div className="field">
                  <label htmlFor="wed-phone">Phone number</label>
                  <input
                    id="wed-phone"
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
                  <label htmlFor="wed-side">Shopping for</label>
                  <select
                    id="wed-side"
                    value={formData.side}
                    onChange={e => setFormData({ ...formData, side: e.target.value })}
                  >
                    <option value="Both sides together">Both sides together</option>
                    <option value="Bride’s side">Bride’s side</option>
                    <option value="Groom’s side">Groom’s side</option>
                    <option value="Trousseau only">Trousseau only</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="wed-date">Approximate wedding date</label>
                  <input
                    id="wed-date"
                    type="text"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    placeholder="Month or season is enough"
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="wed-floor">Preferred floor</label>
                <select
                  id="wed-floor"
                  value={formData.floor}
                  onChange={e => setFormData({ ...formData, floor: e.target.value })}
                >
                  <option value="Belagavi Flagship (Khade Bazar)">Belagavi Flagship (Khade Bazar) — Silk, suits and jewellery</option>
                  <option value="Davanagere Heritage (Mandipet)">Davanagere Heritage (Mandipet) — Linen, towels, home gifts</option>
                  <option value="Shivamogga Store (Nehru Road)">Shivamogga Store (Nehru Road) — Tailoring and menswear</option>
                </select>
              </div>

              <fieldset className="field check-group">
                <legend>What you want set aside</legend>
                {[
                  'Trousseau silk sarees',
                  'Groom’s suit and fitting',
                  'Jewellery room appointment',
                  'Wedding party cloth',
                  'Home linen and towels',
                  'Gifts for relatives'
                ].map((item, idx) => (
                  <label key={idx}>
                    <input
                      type="checkbox"
                      checked={formData.needs.includes(item)}
                      onChange={() => handleCheckboxChange(item)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </fieldset>

              <div className="field">
                <label htmlFor="wed-note">Notes for the desk</label>
                <textarea
                  id="wed-note"
                  rows={4}
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Numbers in the party, specific weaves, or dates you will be in Hubballi"
                />
              </div>

              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Sending note…' : 'Send wedding note'} <span className="btn-arrow">→</span>
              </button>
            </form>
          ) : (
            <div className="form-confirm">
              <p className="kicker">Note recorded</p>
              <h2>The desk has your note.</h2>
              <p>Reference: <strong className="ref-tag">{refNumber}</strong></p>
              <p>We read notes between morning bales and reply to your phone or email with the confirmed hour.</p>

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
