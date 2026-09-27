import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './madt.css';

interface MadtLayoutProps {
  children: React.ReactNode;
  page?: string;
}

export default function MadtLayout({ children, page }: MadtLayoutProps) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLoc, setActiveLoc] = useState<string | null>(null);
  const [user, setUser] = useState<{ name: string; role: string; email: string } | null>(null);

  useEffect(() => {
    fetch('/api/madt/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        setUser(data);
        if (data && typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('madt_user', JSON.stringify(data));
        }
      })
      .catch(() => {
        // Fallback to sessionStorage if offline/mock
        try {
          const saved = sessionStorage.getItem('madt_user');
          if (saved) setUser(JSON.parse(saved));
        } catch {}
      });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/madt/logout', { method: 'POST' });
    } catch {}
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('madt_user');
    setUser(null);
    navigate('/madt');
  };

  const searchIndex = [
    { t: 'Women', d: 'Sarees, suits, everyday cloth', h: '/madt#women' },
    { t: 'Men', d: 'Shirts, trousers, occasion wear', h: '/madt#men' },
    { t: 'Brands', d: 'Labels the house stocks', h: '/madt#brands' },
    { t: 'Home furnishing', d: 'Linen and cloth for the house', h: '/madt#home' },
    { t: 'Jewellery', d: 'Gold and set pieces', h: '/madt#jewellery' },
    { t: 'Wedding', d: 'Booked wedding shopping', h: '/madt/wedding' },
    { t: 'Suits', d: 'Fittings and suit cloth', h: '/madt#suits' },
    { t: 'Towels', d: 'Bath and guest towels', h: '/madt#towels' },
    { t: 'Stores', d: 'Koppikar Road, Vidyanagar, Coen Road', h: '/madt#stores' },
    { t: 'Visit the store', d: 'Hours and how to come', h: '/madt#visit' },
    { t: 'Book consultation', d: 'Reserve an hour', h: '/madt/consult' },
    { t: 'Register for wedding shopping', d: 'Start the wedding list', h: '/madt/wedding' },
    { t: 'Contact', d: 'Write to the desk', h: '/madt/contact' },
    { t: 'Login', d: 'Desk sign-in', h: '/madt/login' }
  ];

  const filteredSearch = searchIndex.filter(item => {
    const q = searchQuery.trim().toLowerCase();
    return !q || (item.t + ' ' + item.d).toLowerCase().includes(q);
  });

  return (
    <div className={`layout-root ${mobileMenuOpen ? 'menu-open' : ''}`} data-page={page}>
      <header className="site-header">
        <div className="header-bar">
          <Link to="/madt" className="logo" aria-label="BSC Textiles — Belagavi, Davanagere, Shivamogga">
            <span className="logo-word">BSC</span>
            <span className="logo-sub">Textiles</span>
          </Link>

          <nav className="desk-nav" aria-label="Primary">
            <ul>
              <li><Link to="/madt#house">House</Link></li>
              <li><Link to="/madt#collections">Collections</Link></li>
              <li><Link to="/madt/wedding">Wedding</Link></li>
              <li><Link to="/madt#stores">Stores</Link></li>
              <li><Link to="/madt#visit">Visit</Link></li>
            </ul>
          </nav>

          <div className="header-end">
            <button
              className="icon-btn"
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search the house"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="11" cy="11" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M16 16.5 20 20.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>

            {!user ? (
              <Link to="/madt/login" className="quiet-link nav-login">Login</Link>
            ) : (
              <>
                <Link to="/madt/desk" className="quiet-link nav-account">
                  {user.role === 'admin' ? 'House desk' : user.role === 'staff' ? 'Floor book' : 'Account'}
                </Link>
                <button className="quiet-link nav-logout" type="button" onClick={handleLogout}>
                  Logout
                </button>
              </>
            )}

            <Link to="/madt/consult" className="btn btn-sm nav-book">Book a visit</Link>

            <button
              className="menu-btn"
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="mobile-menu" id="mobile-menu">
          <nav aria-label="Mobile">
            <ul>
              <li><Link to="/madt#house" onClick={() => setMobileMenuOpen(false)}>House</Link></li>
              <li><Link to="/madt#collections" onClick={() => setMobileMenuOpen(false)}>Collections</Link></li>
              <li><Link to="/madt/wedding" onClick={() => setMobileMenuOpen(false)}>Wedding</Link></li>
              <li><Link to="/madt#stores" onClick={() => setMobileMenuOpen(false)}>Stores</Link></li>
              <li><Link to="/madt#visit" onClick={() => setMobileMenuOpen(false)}>Visit</Link></li>
              <li><Link to="/madt/consult" onClick={() => setMobileMenuOpen(false)}>Book a visit</Link></li>
              {!user ? (
                <li><Link to="/madt/login" onClick={() => setMobileMenuOpen(false)}>Login</Link></li>
              ) : (
                <>
                  <li><Link to="/madt/desk" onClick={() => setMobileMenuOpen(false)}>Account</Link></li>
                  <li><button type="button" onClick={handleLogout}>Logout</button></li>
                </>
              )}
            </ul>
          </nav>
        </div>
      )}

      {children}

      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div>
            <p className="footer-brand">MADT</p>
            <p className="footer-blurb">Cloth, jewellery, suits and home. Hubballi.</p>
          </div>
          <div>
            <p className="footer-label">House</p>
            <ul>
              <li><Link to="/madt#house">The house</Link></li>
              <li><Link to="/madt#collections">Collections</Link></li>
              <li><Link to="/madt/wedding">Wedding</Link></li>
              <li><Link to="/madt#legacy">Legacy</Link></li>
              <li><Link to="/madt/login">Login</Link></li>
            </ul>
          </div>
          <div>
            <p className="footer-label">Collections</p>
            <ul>
              <li><Link to="/madt#women">Women</Link></li>
              <li><Link to="/madt#men">Men</Link></li>
              <li><Link to="/madt#brands">Brands</Link></li>
              <li><Link to="/madt#home">Home furnishing</Link></li>
              <li><Link to="/madt#jewellery">Jewellery</Link></li>
              <li><Link to="/madt#suits">Suits</Link></li>
              <li><Link to="/madt#towels">Towels</Link></li>
              <li><Link to="/madt#other">Other</Link></li>
            </ul>
          </div>
          <div>
            <p className="footer-label">Visit</p>
            <ul>
              <li><Link to="/madt#stores">Belagavi Flagship</Link></li>
              <li><Link to="/madt#stores">Davanagere Heritage</Link></li>
              <li><Link to="/madt#stores">Shivamogga Store</Link></li>
              <li><Link to="/madt/contact">Contact</Link></li>
              <li><Link to="/madt/consult">Book a consultation</Link></li>
              <li><Link to="/madt/wedding">Wedding register</Link></li>
            </ul>
          </div>
        </div>
        <div className="wrap footer-base">
          <p>© 2026 BSC Textiles. Belagavi · Davanagere · Shivamogga.</p>
          <ul>
            <li><Link to="/madt/privacy">Privacy</Link></li>
            <li><Link to="/madt/terms">Terms</Link></li>
            <li><Link to="/madt/contact">Instagram</Link></li>
            <li><Link to="/madt/contact">Facebook</Link></li>
          </ul>
        </div>
      </footer>

      {/* Search Modal */}
      {searchOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setSearchOpen(false)}>
          <div style={{ background: 'var(--paper, #F3EEE7)', borderRadius: '8px', maxWidth: '540px', width: '100%', padding: '1.5rem', boxShadow: '0 12px 36px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.4rem', margin: 0 }}>Search the house</h2>
              <button type="button" className="text-btn" onClick={() => setSearchOpen(false)}>Close</button>
            </div>
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Women, wedding, towels…"
              autoFocus
              style={{ width: '100%', border: 0, borderBottom: '1px solid var(--line-strong, #CCC)', background: 'transparent', padding: '0.7rem 0', fontSize: '1rem', outline: 'none' }}
            />
            <ul style={{ listStyle: 'none', maxHeight: '50vh', overflowY: 'auto', padding: 0, margin: '1rem 0 0' }}>
              {filteredSearch.map((item, idx) => (
                <li key={idx} style={{ borderTop: '1px solid var(--line, #E5E0D8)', padding: '0.65rem 0' }}>
                  <Link to={item.h} onClick={() => setSearchOpen(false)} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <span style={{ fontWeight: 600 }}>{item.t}</span>
                    <small style={{ display: 'block', color: 'var(--muted, #666)' }}>{item.d}</small>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Location Modal */}
      {activeLoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setActiveLoc(null)}>
          <div style={{ background: 'var(--paper, #F3EEE7)', borderRadius: '8px', maxWidth: '500px', width: '100%', padding: '1.75rem', boxShadow: '0 12px 36px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Location</h2>
              <button type="button" className="text-btn" onClick={() => setActiveLoc(null)}>Close</button>
            </div>
            {activeLoc === 'koppikar' && (
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Flagship floor</h3>
                <p style={{ margin: '0.5rem 0', color: 'var(--ink-soft)' }}>Khade Bazar / Raviwar Peth, Belagavi 590001. Cloth, women, men and jewellery.</p>
                <p style={{ margin: '0.5rem 0', color: 'var(--ink-soft)' }}>10:30–20:30, Monday to Sunday. Write ahead if you are bringing a wedding party.</p>
                <p style={{ marginTop: '1rem' }}><a className="maps" href="https://www.google.com/maps/search/?api=1&query=BSC+Textiles+Khade+Bazar+Belagavi" target="_blank" rel="noopener noreferrer">Open Belagavi Store in maps →</a></p>
              </div>
            )}
            {activeLoc === 'vidyanagar' && (
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Home floor</h3>
                <p style={{ margin: '0.5rem 0', color: 'var(--ink-soft)' }}>Mandipet / PB Road, Davanagere 577001. Towels, linen and home furnishing.</p>
                <p style={{ margin: '0.5rem 0', color: 'var(--ink-soft)' }}>10:30–20:00, Monday to Sunday.</p>
                <p style={{ marginTop: '1rem' }}><a className="maps" href="https://www.google.com/maps/search/?api=1&query=BSC+Textiles+Mandipet+Davanagere" target="_blank" rel="noopener noreferrer">Open Davanagere Store in maps →</a></p>
              </div>
            )}
            {activeLoc === 'coen' && (
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Suit desk</h3>
                <p style={{ margin: '0.5rem 0', color: 'var(--ink-soft)' }}>Nehru Road / Durgigudi, Shivamogga 577201. Suits, branded menswear and fittings.</p>
                <p style={{ margin: '0.5rem 0', color: 'var(--ink-soft)' }}>11:00–20:00, Tuesday to Sunday. Monday by appointment.</p>
                <p style={{ marginTop: '1rem' }}><a className="maps" href="https://www.google.com/maps/search/?api=1&query=BSC+Textiles+Nehru+Road+Shivamogga" target="_blank" rel="noopener noreferrer">Open Shivamogga Store in maps →</a></p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
