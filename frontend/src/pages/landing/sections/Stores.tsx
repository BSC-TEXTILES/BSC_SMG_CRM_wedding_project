
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock, MapPin, Phone } from 'lucide-react';
import { STORES, mapsHref } from '../content';
import { Eyebrow, Reveal, Words } from '../motion/Reveal';

/**
 * Stores are presented as editorial rows rather than a card grid: the row
 * opens on hover (desktop) to reveal address, hours and directions, with a
 * small photographic peek at the far edge.
 */
export default function Stores({ withPhone = true }: { withPhone?: boolean }) {
  return (
    <section id="stores" className="sec sec--paper2">
      <div className="wrap">
        <div className="sec__head">
          <div>
            <Eyebrow>05 — Where to come</Eyebrow>
            <Words
              as="h2"
              className="t-h2"
              delay={60}
              stagger={46}
              lines={[{ text: 'Three counters.' }, { text: 'One house.', accent: true }]}
            />
          </div>
          <Reveal as="p" variant="up" delay={140} className="t-lede" style={{ maxWidth: '42ch' }}>
            Walk in, or write ahead so the suite and a stylist are waiting when your family arrives.
            Every floor keeps the same standards across Karnataka.
          </Reveal>
        </div>

        <ul className="stores">
          {STORES.map((store, i) => (
            <Reveal as="li" key={store.key} className="store" variant="up" delay={i * 90}>
              <div className="store__row" data-cursor="explore">
                {store.featured && <span className="store__featured">Central home floor</span>}
                <span className="store__idx">{store.idx}</span>

                <div>
                  <h3 className="store__name">{store.name}</h3>
                  <span className="store__city">
                    {store.city} · {store.est}
                  </span>
                </div>

                <div className="store__details">
                  <p>
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    <span>{store.address}</span>
                  </p>
                  <p>
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    <span>{store.hours}</span>
                  </p>
                  <p>
                    <Phone className="w-4 h-4" aria-hidden="true" />
                    <a href={`tel:${store.phone.replace(/\s+/g, '')}`}>{store.phone}</a>
                  </p>
                  <div className="store__links">
                    <a href={mapsHref(store.address)} target="_blank" rel="noopener noreferrer">
                      Directions
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                    <Link to="/wedding/customer-registration">Register for Wedding Shopping</Link>
                    <span className="store__badge">{store.badge}</span>
                  </div>
                </div>

                <span className="store__peek" aria-hidden="true">
                  <img src={store.img} width={264} height={184} alt="" loading="lazy" decoding="async" />
                </span>
              </div>
            </Reveal>
          ))}
        </ul>

        {withPhone && (
          <Reveal variant="up" delay={80} style={{ marginTop: 30 }}>
            <span className="store__meta">
              Daily 10:30 AM – 8:30 PM
              <a href="tel:+918192221938" style={{ color: 'var(--gold-d)', fontWeight: 700 }}>
                +91 8192 221938
              </a>
            </span>
          </Reveal>
        )}
      </div>
    </section>
  );
}
