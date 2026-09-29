import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../../../services/api';
import { LANDING_DATA } from '../landingData';
import { Reveal } from './useReveal';
import {
  BRAND,
  CONTACT_NOTE,
  COLLECTIONS,
  COLLECTIONS_NOTE,
  CTA_EXPLORE,
  CTA_REGISTER,
  FALLBACK_STORE_NOTE,
  FOOTER_TAGLINE,
  HERITAGE_BODY,
  HERITAGE_HEADING,
  HERITAGE_STEPS,
  HERO_DESCRIPTION,
  HERO_HEADLINE,
  HERO_LABEL,
  NAV_ITEMS,
  STORES_BODY,
  STORES_HEADING,
  WEDDING_BODY,
  WEDDING_FACETS,
  WEDDING_HEADING,
  WEDDING_REGISTRATION_PATH
} from './content';

interface LandingStore {
  id: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  established: string;
  flagship: boolean;
}

/**
 * Opening hours and the "Est." year are not columns on the `locations` table, so
 * they are read from the project's landing content and matched by city. Contact
 * details themselves always come from the live API below.
 */
function hoursFor(city: string): { hours: string; established: string } {
  const match = LANDING_DATA.stores.find(
    (s: { id?: string; city?: string; hours?: string; established?: string }) =>
      String(s.id || '').toLowerCase() === city.toLowerCase() ||
      String(s.city || '').toLowerCase().includes(city.toLowerCase())
  );
  return {
    hours: match?.hours || FALLBACK_STORE_NOTE,
    established: match?.established || 'BSC Textiles'
  };
}

/* ── Hero ────────────────────────────────────────────────────────────────── */

export function LandingHero({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <section id="hero" className="bsc-ed-hero" aria-labelledby="bsc-hero-title">
      <div className="bsc-ed-shell">
        <Reveal>
          <div className="bsc-ed-hero-rule" aria-hidden="true" />
          <p className="bsc-ed-label">{HERO_LABEL}</p>
          <h1 id="bsc-hero-title" className="bsc-ed-h1 bsc-ed-serif" style={{ marginTop: '1.25rem' }}>
            {HERO_HEADLINE}
          </h1>
          <p className="bsc-ed-lede bsc-ed-hero-copy" style={{ marginTop: '1.75rem' }}>
            {HERO_DESCRIPTION}
          </p>
          <div className="bsc-ed-hero-actions">
            <button
              type="button"
              className="bsc-ed-btn bsc-ed-btn-primary"
              onClick={() => onNavigate('collections')}
            >
              {CTA_EXPLORE}
            </button>
            <Link to={WEDDING_REGISTRATION_PATH} className="bsc-ed-btn bsc-ed-btn-ghost">
              {CTA_REGISTER}
            </Link>
          </div>
        </Reveal>

        <Reveal className="bsc-ed-hero-index" delay={120}>
          {HERITAGE_STEPS.slice(1, 5).map((step) => (
            <div className="bsc-ed-index-cell" key={`idx-${step.value}`}>
              <div className="bsc-ed-index-value bsc-ed-serif">{step.value}</div>
              <div className="bsc-ed-index-key">{step.key}</div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ── Collections ─────────────────────────────────────────────────────────── */

export function LandingCollections({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <section id="collections" className="bsc-ed-section" aria-labelledby="bsc-collections-title">
      <div className="bsc-ed-shell">
        <div className="bsc-ed-section-head">
          <Reveal>
            <p className="bsc-ed-label">What we keep</p>
            <h2 id="bsc-collections-title" className="bsc-ed-h2 bsc-ed-serif" style={{ marginTop: '0.75rem' }}>
              Collections
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="bsc-ed-lede" style={{ maxWidth: '40ch' }}>{COLLECTIONS_NOTE}</p>
          </Reveal>
        </div>

        <Reveal>
          <div className="bsc-ed-collections">
            {COLLECTIONS.map((category, index) => (
              <button
                type="button"
                className="bsc-ed-cat"
                key={category.title}
                onClick={() => onNavigate(index === 3 ? 'wedding' : 'stores')}
              >
                <span className="bsc-ed-cat-top">
                  <span className="bsc-ed-h3 bsc-ed-serif">{category.title}</span>
                  <span className="bsc-ed-cat-num">{String(index + 1).padStart(2, '0')}</span>
                </span>
                <span className="bsc-ed-cat-desc">{category.description}</span>
                <span className="bsc-ed-cat-arrow">Enquire at the floor</span>
              </button>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Heritage ────────────────────────────────────────────────────────────── */

export function LandingHeritage() {
  return (
    <section id="about" className="bsc-ed-section" aria-labelledby="bsc-heritage-title">
      <div className="bsc-ed-shell">
        <div className="bsc-ed-section-head">
          <Reveal>
            <p className="bsc-ed-label">Our story</p>
            <h2 id="bsc-heritage-title" className="bsc-ed-h2 bsc-ed-serif" style={{ marginTop: '0.75rem' }}>
              {HERITAGE_HEADING}
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="bsc-ed-lede" style={{ maxWidth: '46ch' }}>{HERITAGE_BODY}</p>
          </Reveal>
        </div>

        <ol className="bsc-ed-timeline">
          {HERITAGE_STEPS.map((step, index) => (
            <Reveal as="li" className="bsc-ed-step" key={step.value} delay={index * 70}>
              <p className="bsc-ed-step-key">{step.key}</p>
              <p className="bsc-ed-step-value bsc-ed-serif">{step.value}</p>
              <p className="bsc-ed-step-note">{step.note}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Wedding ─────────────────────────────────────────────────────────────── */

export function LandingWedding() {
  return (
    <section id="wedding" className="bsc-ed-section" aria-labelledby="bsc-wedding-title">
      <div className="bsc-ed-shell">
        <div className="bsc-ed-wedding-grid">
          <Reveal>
            <p className="bsc-ed-label">By appointment</p>
            <h2 id="bsc-wedding-title" className="bsc-ed-h2 bsc-ed-serif" style={{ marginTop: '0.75rem' }}>
              {WEDDING_HEADING}
            </h2>
            <p className="bsc-ed-lede" style={{ marginTop: '1.5rem' }}>{WEDDING_BODY}</p>
            <div className="bsc-ed-hero-actions" style={{ marginTop: '2.25rem' }}>
              <Link to={WEDDING_REGISTRATION_PATH} className="bsc-ed-btn bsc-ed-btn-primary">
                {CTA_REGISTER}
              </Link>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="bsc-ed-facets">
              {WEDDING_FACETS.map((facet) => (
                <div className="bsc-ed-facet" key={facet.title}>
                  <span className="bsc-ed-facet-dot" aria-hidden="true" />
                  <div>
                    <p className="bsc-ed-facet-title">{facet.title}</p>
                    <p className="bsc-ed-facet-body">{facet.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Stores ──────────────────────────────────────────────────────────────── */

export function LandingStores() {
  const [stores, setStores] = useState<LandingStore[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await API.getLandingLocations();
        const rows = res?.locations || res?.data || [];
        if (cancelled) return;

        const mapped: LandingStore[] = (Array.isArray(rows) ? rows : []).map((row: any) => {
          const city = String(row.location_name || '').trim();
          const meta = hoursFor(city);
          return {
            id: String(row.location_code || city).toLowerCase(),
            city,
            address: String(row.address || '').trim(),
            phone: String(row.phone || '').trim(),
            email: String(row.email || '').trim(),
            hours: meta.hours,
            established: meta.established,
            flagship: Number(row.sort_order || 99) === 1
          };
        });

        setStores(mapped);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <section id="stores" className="bsc-ed-section" aria-labelledby="bsc-stores-title">
      <div className="bsc-ed-shell">
        <div className="bsc-ed-section-head">
          <Reveal>
            <p className="bsc-ed-label">Where to find us</p>
            <h2 id="bsc-stores-title" className="bsc-ed-h2 bsc-ed-serif" style={{ marginTop: '0.75rem' }}>
              {STORES_HEADING}
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="bsc-ed-lede" style={{ maxWidth: '40ch' }}>{STORES_BODY}</p>
          </Reveal>
        </div>

        <Reveal>
          <div id="contact">
            {!stores && !failed && (
              <div className="bsc-ed-stores" aria-busy="true" aria-label="Loading store locations">
                {[0, 1, 2].map((i) => (
                  <div className="bsc-ed-store" key={i}>
                    <div className="bsc-ed-skeleton" style={{ width: '45%' }} />
                    <div className="bsc-ed-skeleton" style={{ width: '90%' }} />
                    <div className="bsc-ed-skeleton" style={{ width: '70%' }} />
                    <div className="bsc-ed-skeleton" style={{ width: '55%' }} />
                  </div>
                ))}
              </div>
            )}

            {failed && (
              <p className="bsc-ed-lede" role="status">
                Store details are unavailable right now. Please call the floor directly or try again shortly.
              </p>
            )}

            {stores && stores.length === 0 && !failed && (
              <p className="bsc-ed-lede" role="status">No store locations are listed at the moment.</p>
            )}

            {stores && stores.length > 0 && (
              <div className="bsc-ed-stores">
                {stores.map((store) => (
                  <article className="bsc-ed-store" key={store.id}>
                    {store.flagship && <span className="bsc-ed-flagship">Flagship</span>}
                    <h3 className="bsc-ed-store-city bsc-ed-serif">{store.city}</h3>
                    <p className="bsc-ed-store-row">
                      <span className="bsc-ed-store-key">Address</span>
                      {store.address}
                    </p>
                    {store.phone && (
                      <p className="bsc-ed-store-row">
                        <span className="bsc-ed-store-key">Telephone</span>
                        <a href={`tel:${store.phone.replace(/\s+/g, '')}`}>{store.phone}</a>
                      </p>
                    )}
                    {store.email && (
                      <p className="bsc-ed-store-row">
                        <span className="bsc-ed-store-key">Email</span>
                        <a href={`mailto:${store.email}`}>{store.email}</a>
                      </p>
                    )}
                    <p className="bsc-ed-store-row">
                      <span className="bsc-ed-store-key">Hours</span>
                      {store.hours}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

export function LandingFooter({ onNavigate }: { onNavigate: (id: string) => void }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bsc-ed-footer">
      <div className="bsc-ed-shell">
        <div className="bsc-ed-footer-grid">
          <Reveal>
            <picture className="bsc-ed-logo-wrap">
              <source srcSet="/logo.webp" type="image/webp" />
              <img
                className="bsc-ed-logo bsc-ed-logo-lg"
                src="/logo.png"
                alt="BSC Textiles"
                width={360}
                height={270}
                loading="lazy"
                decoding="async"
              />
            </picture>
            <p className="bsc-ed-store-row" style={{ marginTop: '1rem', maxWidth: '34ch' }}>{FOOTER_TAGLINE}</p>
          </Reveal>

          <Reveal delay={70}>
            <p className="bsc-ed-label">Explore</p>
            <ul className="bsc-ed-footer-links" style={{ marginTop: '1rem' }}>
              {NAV_ITEMS.filter((item) => item.id !== 'home').map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onNavigate(item.id === 'about' ? 'about' : item.id)}>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={140}>
            <p className="bsc-ed-label">Visit</p>
            <p className="bsc-ed-store-row" style={{ marginTop: '1rem' }}>{CONTACT_NOTE}</p>
            <Link
              to={WEDDING_REGISTRATION_PATH}
              className="bsc-ed-btn bsc-ed-btn-ghost"
              style={{ marginTop: '1.25rem' }}
            >
              {CTA_REGISTER}
            </Link>
          </Reveal>
        </div>

        <div className="bsc-ed-footer-base">
          <p style={{ margin: 0 }}>© {year} {BRAND}. All rights reserved.</p>
          <p style={{ margin: 0 }}>Belagavi · Davanagere · Shivamogga</p>
        </div>
      </div>
    </footer>
  );
}
