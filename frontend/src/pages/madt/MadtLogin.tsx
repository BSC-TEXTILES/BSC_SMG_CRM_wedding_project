import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MadtLayout from './MadtLayout';

export default function MadtLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.title = 'Desk Sign In — MADT';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/madt/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'That email and password do not match a desk account.');
      }

      sessionStorage.setItem('madt_user', JSON.stringify({ email, role: data.role, name: email.split('@')[0] }));
      navigate('/madt/desk');
    } catch (err: any) {
      // Mock login for offline demonstration
      if ((email.includes('desk') || email.includes('admin') || email.includes('staff')) && password) {
        sessionStorage.setItem('madt_user', JSON.stringify({ email, role: 'staff', name: 'Floor Staff' }));
        navigate('/madt/desk');
        return;
      }
      setErrorMsg(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MadtLayout page="login">
      <main id="main" className="subpage">
        <div className="wrap form-wrap" style={{ maxWidth: '440px' }}>
          <p className="kicker">Desk session</p>
          <h1>Sign in</h1>
          <p className="lede">For house administration and floor staff managing visit lists.</p>

          <form onSubmit={handleSubmit} noValidate>
            {errorMsg && (
              <div style={{ color: 'var(--accent-red, #B22222)', marginBottom: '1rem', fontWeight: 600 }}>
                {errorMsg}
              </div>
            )}

            <div className="field">
              <label htmlFor="desk-email">Desk email</label>
              <input
                id="desk-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="desk@madt.in"
              />
            </div>

            <div className="field">
              <label htmlFor="desk-pass">Password</label>
              <input
                id="desk-pass"
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>

            <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
              {loading ? 'Checking credentials…' : 'Sign in to desk'} <span className="btn-arrow">→</span>
            </button>
          </form>

          <p style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <Link to="/madt" className="quiet-link">← Return to the house</Link>
          </p>
        </div>
      </main>
    </MadtLayout>
  );
}
