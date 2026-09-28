import { useRef } from 'react';
import { HOUSE_FACTS } from '../content';
import { useParallax } from '../motion/hooks';
import { Eyebrow, Reveal, Rule, Words } from '../motion/Reveal';

export default function House() {
  const media = useRef<HTMLDivElement | null>(null);
  useParallax(media, 44);

  return (
    <section id="house" className="sec sec--paper">
      <div className="wrap house__grid">
        <Reveal variant="clip" duration={1100} className="house__media" id="house-media">
          <div ref={media} style={{ display: 'block' }}>
            <img
              src="/images/about.webp"
              srcSet="/images/about-sm.webp 800w, /images/about.webp 1400w"
              sizes="(max-width: 992px) 100vw, 52vw"
              width={1400}
              height={934}
              alt="Evening light on a rail of knitwear and fine dresses in the shop window"
              loading="lazy"
              decoding="async"
            />
          </div>
          <p className="house__tag">
            <b>Evening light on the rail</b>
            Cloth is opened on the counter, examined by hand, and marked before you leave.
          </p>
        </Reveal>

        <div>
          <Eyebrow>01 — The house</Eyebrow>

          <Words
            as="h2"
            className="t-h2"
            delay={80}
            stagger={46}
            lines={[{ text: 'Most of what we sell is' }, { text: 'chosen in person.', accent: true }]}
          />

          <Rule className="rule" delay={260} />

          <Reveal as="p" variant="up" delay={120} className="t-lede" style={{ marginTop: 26 }}>
            A bale is opened. A shoulder is marked. A chain is held to the light. A towel is unfolded
            so you can feel the weight. The work is ordinary in the best sense — and it is the reason
            families come back to the same counter for four generations.
          </Reveal>

          <Reveal as="p" variant="up" delay={220} className="t-body" style={{ marginTop: 18 }}>
            One year it is a school shirt. The next, a suit. Then a wedding list with both sides
            written on facing pages, kept exactly where the stylist left it.
          </Reveal>

          <ul className="house__facts">
            {HOUSE_FACTS.map((fact, i) => (
              <Reveal as="li" key={fact.title} variant="left" delay={i * 80}>
                <strong>{fact.title}</strong>
                <span>{fact.desc}</span>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
