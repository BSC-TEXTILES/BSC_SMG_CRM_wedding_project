import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { DESKS, mapsHref } from '../content';
import { useParallax } from '../motion/hooks';
import { Eyebrow, Reveal, Words } from '../motion/Reveal';

export function Desks() {
  return (
    <section className="sec sec--paper" style={{ paddingTop: 'clamp(56px, 8vh, 96px)' }}>
      <div className="wrap">
        <Eyebrow>08 — Public desks</Eyebrow>
        <Reveal as="h2" variant="up" className="t-h3" style={{ marginTop: 16, maxWidth: '22ch' }}>
          Everything else, one click away.
        </Reveal>

        <div className="desks" style={{ marginTop: 34 }}>
          {DESKS.map((desk, i) => (
            <Reveal as="div" key={desk.to} variant="up" delay={i * 90}>
              <Link to={desk.to} className="desk">
                <span className="desk__title">{desk.title}</span>
                <span className="desk__desc">{desk.desc}</span>
                <span className="desk__go">
                  Open desk
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Cta() {
  const bg = useRef<HTMLImageElement | null>(null);
  useParallax(bg, 60);

  return (
    <section className="cta on-ink" aria-labelledby="cta-title">
      <img
        ref={bg}
        className="cta__bg"
        src="/images/coll-temple-1200.webp"
        width={1200}
        height={800}
        alt=""
        loading="lazy"
        decoding="async"
        aria-hidden="true"
      />
      <div className="wrap cta__inner">
        <Eyebrow>09 — The invitation</Eyebrow>
        <Words
          as="h2"
          id="cta-title"
          className="t-display cta__title"
          delay={60}
          stagger={54}
          lines={[{ text: 'Keep an hour' }, { text: 'for the family.', accent: true }]}
        />
        <Reveal as="p" variant="up" delay={180} className="t-lede" style={{ textAlign: 'center', color: 'var(--on-ink-2)' }}>
          Bring the list, or start one at the counter. Suites are held for registered families across
          all three floors, seven days a week.
        </Reveal>

        <Reveal variant="up" delay={260} className="cta__actions">
          <Link to="/wedding/customer-registration" className="btn btn--gold" data-cursor="explore">
            <Heart className="w-4 h-4" aria-hidden="true" />
            <span>Register for Wedding Shopping</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link to="/login" className="btn btn--onink">
            <span>Staff login</span>
          </Link>
        </Reveal>

        <Reveal variant="fade" delay={340} className="cta__meta">
          <span>
            <Phone className="w-3.5 h-3.5" aria-hidden="true" />{' '}
            <a href="tel:+918192221938">+91 8192 221938</a>
          </span>
          <span>
            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />{' '}
            <a href="https://wa.me/918192221938" target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </span>
          <span>
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Silk Mark certified partner
          </span>
          <span>
            <a href={mapsHref('BSC Textiles Tilakwadi Belagavi')} target="_blank" rel="noopener noreferrer">
              Find the flagship
            </a>
          </span>
        </Reveal>
      </div>
    </section>
  );
}
