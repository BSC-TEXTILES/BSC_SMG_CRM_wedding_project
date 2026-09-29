
import { Link } from 'react-router-dom';
import { ArrowUpRight, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { mapsHref } from '../content';

interface FooterProps {
  onNavigate: (id: string) => void;
}

const FOOT_DEPARTMENTS: { id: string; label: string }[] = [
  { id: 'counters', label: 'Womenswear & sarees' },
  { id: 'counters', label: 'Jewellery suite' },
  { id: 'counters', label: 'Suits & tailoring' },
  { id: 'wedding', label: 'Wedding shopping' },
  { id: 'counters', label: 'Home & towels' }
];

const FOOT_STORES: { id: string; label: string }[] = [
  { id: 'stores', label: 'Belagavi flagship' },
  { id: 'stores', label: 'Davanagere central' },
  { id: 'stores', label: 'Shivamogga suit room' },
  { id: 'why', label: 'Why BSC' },
  { id: 'stories', label: 'Family stories' }
];

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div>
            <Link to="/" className="footer__brand">
              <img src="/logo.webp" width={46} height={34} alt="" />
              <span>BSC Textiles</span>
            </Link>
            <p className="footer__blurb">
              A handloom silk house working directly with weaving families in Kanchipuram, Varanasi,
              Arani and Dharmavaram — and with wedding families across Karnataka since 1938.
            </p>
            <p className="footer__cert">Silk Mark Organization of India · certified partner</p>
            <div className="footer__contact">
              <a href="tel:+918192221938">
                <Phone className="w-4 h-4" aria-hidden="true" />
                +91 8192 221938
              </a>
              <a href="https://wa.me/918192221938" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                WhatsApp
              </a>
            </div>
          </div>

          <nav aria-label="Departments">
            <h3>Departments</h3>
            <ul>
              {FOOT_DEPARTMENTS.map((item) => (
                <li key={item.label}>
                  <button type="button" onClick={() => onNavigate(item.id)}>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Visit">
            <h3>Visit</h3>
            <ul>
              {FOOT_STORES.map((item) => (
                <li key={item.label}>
                  <button type="button" onClick={() => onNavigate(item.id)}>
                    {item.label}
                  </button>
                </li>
              ))}
              <li style={{ color: 'var(--gold-l)' }}>Daily, 10:30 AM – 8:30 PM</li>
            </ul>
          </nav>

          <nav aria-label="Help and legal">
            <h3>Help & legal</h3>
            <ul>
              <li>
                <Link to="/wedding/customer-registration">Register for Wedding Shopping</Link>
              </li>
              <li>
                <Link to="/track">Track an order</Link>
              </li>
              <li>
                <Link to="/feedback-public">Rate your visit</Link>
              </li>
              <li>
                <Link to="/apply">Careers</Link>
              </li>
              <li>
                <Link to="/login">Staff login</Link>
              </li>
              <li>
                <a href={mapsHref('BSC Textiles Tilakwadi Belagavi')} target="_blank" rel="noopener noreferrer">
                  Find the flagship
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="footer__bar">
          <p style={{ margin: 0 }}>
            © {new Date().getFullYear()} BSC Textiles Private Limited · Handloom silk house · Belagavi,
            Karnataka
          </p>
          <div className="footer__bar-links">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" style={{ color: 'var(--gold)' }} />
              Silk Mark certified
            </span>
            <Link to="/madt/privacy">Privacy</Link>
            <Link to="/madt/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
