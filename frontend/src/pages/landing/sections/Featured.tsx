import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { FEATURED_POINTS } from '../content';
import { useScrollProgress } from '../motion/hooks';
import { Reveal, Words } from '../motion/Reveal';

/**
 * The cinematic moment: a sticky frame whose plate expands from a
 * letterboxed crop to full bleed while the headline and the supporting
 * detail arrive in sequence. The section then hands over to the wedding floor.
 */
export default function Featured() {
  const root = useRef<HTMLElement | null>(null);
  useScrollProgress(root);

  return (
    <section id="featured" className="featured on-ink" ref={root} aria-labelledby="featured-title">
      <div className="featured__sticky">
        <figure className="featured__media">
          <img
            src="/images/floor.webp"
            srcSet="/images/floor-sm.webp 900w, /images/floor.webp 1800w"
            sizes="100vw"
            width={1800}
            height={1201}
            alt="Chandeliers and hand-polished teak counters on the Belagavi bridal showroom floor"
            loading="lazy"
            decoding="async"
          />
        </figure>

        <span className="featured__index" aria-hidden="true">
          03 — Featured floor
        </span>

        <div className="featured__content">
          <div>
            <p className="eyebrow featured__kicker" style={{ color: 'var(--gold-b)' }}>
              <span className="eyebrow__dot" aria-hidden="true" />
              Belagavi flagship
            </p>
            <Words
              as="h2"
              id="featured-title"
              className="t-h2 featured__title"
              delay={0}
              stagger={52}
              lines={[
                { text: 'Two thousand four hundred' },
                { text: 'silks, one quiet floor.', accent: true }
              ]}
            />
          </div>

          <div className="featured__aside">
            <p>
              Under chandeliers and hand-polished teak, the Belagavi floor keeps Karnataka's most
              celebrated bridal handlooms in individual cedar sleeves — brought out one bale at a
              time, in daylight, for your family alone.
            </p>
            <ul className="featured__list">
              {FEATURED_POINTS.map((point) => (
                <li key={point}>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <div className="featured__cta">
              <Link to="/wedding-registration" className="btn btn--gold" data-cursor="explore">
                <span>Book an hour on this floor</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Reveal className="sr-only" variant="fade">
        Showroom architecture: private draping suites, zari burn testing and on-site master tailors.
      </Reveal>
    </section>
  );
}
