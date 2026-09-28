
import { REASONS, TESTIMONIALS } from '../content';
import { Eyebrow, Reveal, Words } from '../motion/Reveal';

const STARS = [1, 2, 3, 4, 5];

function Stars() {
  return (
    <span className="stars" role="img" aria-label="Rated 5 out of 5">
      {STARS.map((n) => (
        <svg key={n} width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5l2.9 6.06 6.6.9-4.8 4.6 1.2 6.54L12 17.5l-5.9 3.1 1.2-6.54-4.8-4.6 6.6-.9z" />
        </svg>
      ))}
    </span>
  );
}

export function Highlights() {
  return (
    <section id="why" className="sec sec--paper">
      <div className="wrap">
        <div className="sec__head">
          <div>
            <Eyebrow>06 — Why families return</Eyebrow>
            <Words
              as="h2"
              className="t-h2"
              delay={60}
              stagger={44}
              lines={[{ text: 'The visit is simple.' }, { text: 'That is the point.', accent: true }]}
            />
          </div>
          <Reveal as="p" variant="up" delay={140} className="t-lede" style={{ maxWidth: '40ch' }}>
            No plastic cards, no points, no pressure. If you have visited before, the counter will
            remember you.
          </Reveal>
        </div>

        <ol className="reasons">
          {REASONS.map((reason, i) => (
            <Reveal as="li" key={reason.n} className="reason" variant="up" delay={(i % 3) * 90}>
              <span className="reason__n">{reason.n}</span>
              <h3>{reason.title}</h3>
              <p>{reason.desc}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Stories({ csat }: { csat: number }) {
  return (
    <section id="stories" className="sec sec--paper2">
      <div className="wrap">
        <div className="sec__head">
          <div>
            <Eyebrow>07 — From the families</Eyebrow>
            <Words
              as="h2"
              className="t-h2"
              delay={60}
              stagger={44}
              lines={[{ text: 'What people say' }, { text: 'after the wedding.', accent: true }]}
            />
          </div>
          <Reveal variant="up" delay={140} style={{ textAlign: 'right' }}>
            <Stars />
            <p style={{ margin: '10px 0 0', fontFamily: 'var(--f-display)', fontSize: '1.5rem' }}>
              {csat || 99}% positive
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'var(--text-3)' }}>
              Verified feedback slips filled at our three counters
            </p>
          </Reveal>
        </div>

        <div className="stories">
          {TESTIMONIALS.map((item, i) => (
            <Reveal as="figure" key={item.name} className="story" variant="up" delay={i * 110}>
              <Stars />
              <blockquote className="story__quote">“{item.quote}”</blockquote>
              <figcaption>
                <span className="story__mono" aria-hidden="true">
                  {item.name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')}
                </span>
                <span>
                  <span className="story__name">{item.name}</span>
                  <span className="story__role">{item.role}</span>
                </span>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
