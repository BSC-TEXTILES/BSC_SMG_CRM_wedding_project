import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Crown } from 'lucide-react';
import { WEDDING_ITEMS } from '../content';
import { useParallax } from '../motion/hooks';
import { Eyebrow, Reveal, Words } from '../motion/Reveal';

export default function Wedding() {
  const main = useRef<HTMLDivElement | null>(null);
  const float = useRef<HTMLDivElement | null>(null);
  useParallax(main, 52);
  useParallax(float, 74);

  return (
    <section id="wedding" className="sec sec--paper">
      <div className="wrap wedding__grid">
        <div className="wedding__stack">
          <Reveal variant="clip" duration={1100} className="wedding__main">
            <div ref={main} style={{ display: 'block' }}>
              <img
                src="/images/wedding.webp"
                srcSet="/images/wedding-sm.webp 700w, /images/wedding.webp 1200w"
                sizes="(max-width: 992px) 100vw, 40vw"
                width={1200}
                height={1800}
                alt="A bride in vermilion and gold silk with a traditional temple necklace"
                loading="lazy"
                decoding="async"
              />
            </div>
          </Reveal>

          <Reveal variant="right" delay={220} className="wedding__float" duration={1100}>
            <div ref={float} className="wedding__float-inner">
              <img
                src="/images/coll-trousseau-700.webp"
                width={700}
                height={700}
                alt="Folded trousseau silks prepared for a wedding list"
                loading="lazy"
                decoding="async"
              />
            </div>
          </Reveal>
        </div>

        <div>
          <Eyebrow>04 — Wedding shopping</Eyebrow>

          <Words
            as="h2"
            className="t-h2"
            delay={70}
            stagger={46}
            lines={[
              { text: 'Register the list before' },
              { text: 'the family arrives.', accent: true }
            ]}
          />

          <Reveal as="p" variant="up" delay={140} className="t-lede" style={{ marginTop: 22 }}>
            Wedding shopping here is a booked hour, not a walk-in between other customers. Bring
            your list or start one — we set aside trousseau cloth, the groom's suit, jewellery,
            clothes for the wedding party, and linen for the new home.
          </Reveal>

          <ul className="wedding__items">
            {WEDDING_ITEMS.map((item, i) => (
              <Reveal as="li" key={item.title} variant="up" delay={i * 60}>
                <strong>{item.title}</strong>
                <span>{item.desc}</span>
              </Reveal>
            ))}
          </ul>

          <Reveal variant="up" delay={120} className="wedding__cta">
            <Link to="/wedding-registration" className="btn btn--ink" data-cursor="explore">
              <Crown className="w-4 h-4" aria-hidden="true" />
              <span>Register for wedding shopping</span>
            </Link>
            <Link to="/wedding-registration" className="btn btn--ghost">
              <span>Book a consultation</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
