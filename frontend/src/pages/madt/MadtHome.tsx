import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MadtLayout from './MadtLayout';

export default function MadtHome() {
  const [activeLoc, setActiveLoc] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'BSC Textiles — Pure Silk Sarees, Wedding & Menswear';
  }, []);

  return (
    <MadtLayout page="home">
      <main id="main">
        {/* HERO SECTION */}
        <section className="hero-wrap" aria-labelledby="hero-title">
          <div className="wrap hero">
            <div className="hero-copy">
              <p className="kicker">Cloth house · Belagavi · Davanagere · Shivamogga</p>
              <h1 id="hero-title">The cloth is still sold on the counter.</h1>
              <p className="lede">
                MADT keeps menswear, womenswear, suits, jewellery, towels and home linen in one building.
                Wedding shopping is a booked hour, so a family list is not rushed between other customers.
              </p>
              <div className="hero-actions">
                <a className="btn" href="#stores">
                  Visit the store <span className="btn-arrow" aria-hidden="true">→</span>
                </a>
                <Link className="btn btn-ghost" to="/madt/wedding">Wedding shopping</Link>
              </div>
              <p className="hero-meta">Belagavi Flagship · Davanagere · Shivamogga · 10:30 to 8:30 · seven days</p>
            </div>
            <figure className="hero-figure">
              <img
                src="/images/floor.jpg"
                srcSet="/images/floor-sm.jpg 900w, /images/floor.jpg 1800w"
                sizes="(max-width: 860px) 100vw, 48vw"
                width={1800}
                height={1201}
                alt="BSC Textiles authentic flagship bridal showroom floor in Belagavi"
                decoding="async"
              />
              <figcaption>The flagship bridal showroom floor, Belagavi.</figcaption>
            </figure>
          </div>
          <div className="wrap">
            <ul className="dept-rail">
              <li><a href="#men">Men</a></li>
              <li><a href="#women">Women</a></li>
              <li><a href="#brands">Brands</a></li>
              <li><a href="#home">Home furnishing</a></li>
              <li><a href="#jewellery">Jewellery</a></li>
              <li><Link to="/madt/wedding">Wedding</Link></li>
              <li><a href="#suits">Suits</a></li>
              <li><a href="#towels">Towels</a></li>
              <li><a href="#other">Other</a></li>
            </ul>
          </div>
        </section>

        {/* HOUSE SECTION */}
        <section className="section" id="house">
          <div className="wrap about-grid">
            <figure className="reveal">
              <img
                src="/images/about.jpg"
                srcSet="/images/about-sm.jpg 800w, /images/about.jpg 1400w"
                sizes="(max-width: 860px) 100vw, 42vw"
                width={1400}
                height={934}
                alt="Knitwear and dresses on wooden hangers in a warmly lit shop window"
                loading="lazy"
                decoding="async"
              />
              <figcaption className="caption">Evening light on the rail.</figcaption>
            </figure>
            <div className="about-copy">
              <p className="kicker">The house</p>
              <h2 className="reveal">Most of what we sell is chosen in person.</h2>
              <p>
                BSC Textiles is a premier textile and bridal house in Belagavi, Davanagere, and Shivamogga. The work is ordinary in the best sense.
                A bale is opened. A shoulder is marked. A chain is held to the light. A towel is unfolded so you can feel the weight.
              </p>
              <p>
                Families come back because the same counter remembers them. A school shirt one year, a suit the next,
                then a wedding list with both sides written on facing pages.
              </p>
              <p>
                This is not a club, and there is no membership. If you have bought here before, the staff will usually know.
                If you have not, you will still be shown the cloth, not a screen.
              </p>
            </div>
          </div>
          <div className="wrap">
            <dl className="values">
              <div>
                <dt>Cloth, opened</dt>
                <dd>You see the weave before you decide.</dd>
              </div>
              <div>
                <dt>Lists, by name</dt>
                <dd>A wedding note stays with the person who started it.</dd>
              </div>
              <div>
                <dt>Suits, on the body</dt>
                <dd>The fitting is marked here, not guessed from a chart.</dd>
              </div>
              <div>
                <dt>Jewellery, quietly</dt>
                <dd>Trays come out away from the busy aisle.</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* COLLECTIONS SECTION */}
        <section className="section" id="collections" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <header className="section-head">
              <div>
                <p className="kicker">The floors</p>
                <h2 className="reveal">What the building holds</h2>
              </div>
              <p className="lede">
                Nine counters. You do not need all of them in one visit. Photographs show the kind of cloth and the rooms.
                Stock changes with the bale.
              </p>
            </header>

            <article className="feature" id="women">
              <Link className="frame" to="/madt/wedding">
                <img
                  src="/images/women-real.png"
                  width={1200}
                  height={1800}
                  alt="Authentic photoshoot: Model in royal purple silk saree with gold border"
                  loading="lazy"
                  decoding="async"
                />
              </Link>
              <div className="feature-copy">
                <p className="kicker">Women</p>
                <h3>Sarees, suits, and cloth for an ordinary Thursday.</h3>
                <p>
                  Silk stays covered until you ask to see it. Dress material and everyday suits are on the same floor,
                  so a wedding saree and a weekday set do not require two shops.
                </p>
                <p>
                  <Link className="link-arrow" to="/madt/wedding">
                    Wedding cloth <span className="btn-arrow" aria-hidden="true">→</span>
                  </Link>
                </p>
              </div>
            </article>

            <div className="pair">
              <article className="tile" id="jewellery">
                <img
                  src="/images/jewellery.jpg"
                  srcSet="/images/jewellery-sm.jpg 800w, /images/jewellery.jpg 1400w"
                  sizes="(max-width: 860px) 100vw, 40vw"
                  width={1400}
                  height={970}
                  alt="A gold necklace and matching earrings with red stones on a dark tray"
                  loading="lazy"
                  decoding="async"
                />
                <h3>Jewellery</h3>
                <p>Gold and set pieces, shown tray by tray. The room is off the aisle, so you are not deciding a chain in a crowd.</p>
              </article>
              <article className="tile" id="suits">
                <img
                  src="/images/suit.jpg"
                  srcSet="/images/suit-sm.jpg 700w, /images/suit.jpg 1200w"
                  sizes="(max-width: 860px) 100vw, 48vw"
                  width={1200}
                  height={1200}
                  alt="A man in a striped shirt holding a grey checked suit jacket"
                  loading="lazy"
                  decoding="async"
                />
                <h3>Suits</h3>
                <p>
                  A fitting table, not a size you guess from a hanger. Shoulders are marked before you leave.
                  The suit desk on Coen Road takes Monday fittings by appointment.
                </p>
              </article>
            </div>

            <article className="men-band" id="men">
              <div>
                <p className="kicker">Men</p>
                <h3>Shirts, trousers, and what you wear when the invitation is formal.</h3>
                <p>
                  Alterations are noted on the floor, not sent across town. If the shirt needs a wedding jacket as well,
                  the suit desk already has your measurements.
                </p>
              </div>
              <img
                src="/images/men.jpg"
                srcSet="/images/men-sm.jpg 800w, /images/men.jpg 1400w"
                sizes="(max-width: 860px) 100vw, 46vw"
                width={1400}
                height={715}
                alt="Close detail of a white dress shirt beside a pale blue shirt"
                loading="lazy"
                decoding="async"
              />
            </article>

            <div className="quiet-grid">
              <article id="brands">
                <img
                  src="/images/brands.jpg"
                  srcSet="/images/brands-sm.jpg 800w, /images/brands.jpg 1400w"
                  sizes="(max-width: 560px) 100vw, 30vw"
                  width={1400}
                  height={934}
                  alt="A shop wall of dresses, shirts and folded knitwear"
                  loading="lazy"
                  decoding="async"
                />
                <h3>Brands</h3>
                <p>A short rail of labels the house actually stocks. Not a wall of names we do not carry.</p>
              </article>
              <article id="home">
                <img
                  src="/images/home.jpg"
                  srcSet="/images/home-sm.jpg 800w, /images/home.jpg 1600w"
                  sizes="(max-width: 560px) 100vw, 28vw"
                  width={1600}
                  height={1465}
                  alt="A wooden bed dressed in rust linen with striped pillows"
                  loading="lazy"
                  decoding="async"
                />
                <h3>Home furnishing</h3>
                <p>Bed linen, covers, and cloth for the house. The Vidyanagar floor keeps the fuller range.</p>
              </article>
              <article id="towels">
                <img
                  src="/images/towels.jpg"
                  srcSet="/images/towels-sm.jpg 600w, /images/towels.jpg 1000w"
                  sizes="(max-width: 560px) 100vw, 24vw"
                  width={1000}
                  height={1452}
                  alt="Grey and white bath towels hanging on rails"
                  loading="lazy"
                  decoding="async"
                />
                <h3>Towels</h3>
                <p>Bath and guest towels. Weight and weave, checked by hand before you buy.</p>
              </article>
              <article id="other">
                <p className="other-mark" aria-hidden="true">09</p>
                <h3>Other</h3>
                <p>Seasonal cloth, small gifts, and what does not fit a neat shelf. Ask at the counter if you cannot see it from the aisle.</p>
              </article>
            </div>
          </div>
        </section>

        {/* WEDDING SECTION */}
        <section className="section wedding" id="wedding">
          <div className="wrap wedding-grid">
            <figure className="wedding-figure reveal">
              <img
                src="/images/wedding.jpg"
                srcSet="/images/wedding-sm.jpg 700w, /images/wedding.jpg 1200w"
                sizes="(max-width: 860px) 100vw, 40vw"
                width={1200}
                height={1800}
                alt="A woman in a red and gold silk saree wearing a gold necklace and bangles"
                loading="lazy"
                decoding="async"
              />
              <figcaption className="caption">Wedding silk, shown in daylight.</figcaption>
            </figure>
            <div>
              <p className="kicker">Wedding shopping</p>
              <h2 className="reveal">Register the list before the family arrives.</h2>
              <p>
                Wedding shopping at MADT is a booked hour, not a walk-in between other customers.
                Bring the list, or start one here. We set aside trousseau cloth, the groom’s suit, jewellery,
                clothes for the wedding party, and linen for the new house.
              </p>
              <ul className="wed-list">
                <li><strong>Trousseau cloth</strong><span>Sarees and dress material, opened one bale at a time.</span></li>
                <li><strong>Groom’s suit</strong><span>Marked on the body at the suit desk.</span></li>
                <li><strong>Jewellery</strong><span>Shown in the room, not on the open floor.</span></li>
                <li><strong>Wedding party</strong><span>Clothes for the people standing with you.</span></li>
                <li><strong>Home linen</strong><span>Towels and covers for the new house.</span></li>
                <li><strong>Gifts</strong><span>Small pieces that do not need a second market.</span></li>
              </ul>
              <div className="wedding-actions">
                <Link className="btn" to="/madt/wedding">Register for wedding shopping</Link>
                <Link className="btn btn-ghost" to="/madt/consult">Book consultation</Link>
              </div>
            </div>
          </div>
        </section>

        {/* STORES SECTION */}
        <section className="section" id="stores">
          <div className="wrap">
            <p className="kicker">Where to come</p>
            <h2 className="reveal">Three counters. One house.</h2>
            <p className="lede">Write before you bring a wedding party. The map opens the road, not a door number. Ask for BSC Textiles when you arrive.</p>
            <div className="store-list">
              <article className="store-row">
                <p className="store-index">01</p>
                <div>
                  <h3>Flagship floor</h3>
                  <p>Cloth, women, men and jewellery.</p>
                </div>
                <div>
                  <p>Khade Bazar / Raviwar Peth, Belagavi 590001</p>
                  <p>10:30–20:30 · Monday to Sunday</p>
                </div>
                <button className="text-btn" type="button" onClick={() => setActiveLoc('koppikar')}>View location</button>
              </article>
              <article className="store-row">
                <p className="store-index">02</p>
                <div>
                  <h3>Home floor</h3>
                  <p>Towels, linen and home furnishing.</p>
                </div>
                <div>
                  <p>Mandipet / PB Road, Davanagere 577001</p>
                  <p>10:30–20:00 · Monday to Sunday</p>
                </div>
                <button className="text-btn" type="button" onClick={() => setActiveLoc('vidyanagar')}>View location</button>
              </article>
              <article className="store-row">
                <p className="store-index">03</p>
                <div>
                  <h3>Suit desk</h3>
                  <p>Suits, branded menswear and fittings.</p>
                </div>
                <div>
                  <p>Nehru Road / Durgigudi, Shivamogga 577201</p>
                  <p>11:00–20:00 · Tuesday to Sunday. Monday by appointment.</p>
                </div>
                <button className="text-btn" type="button" onClick={() => setActiveLoc('coen')}>View location</button>
              </article>
            </div>
          </div>
        </section>

        {/* WHY STAY SECTION */}
        <section className="section" id="why" style={{ paddingTop: 0 }}>
          <div className="wrap why-grid">
            <div className="why-intro">
              <p className="kicker">Why stay</p>
              <h2 className="reveal">Families come back because the visit is simple.</h2>
              <p>No points. No membership card. If we have seen you before, the staff will usually know. If we have not, you will still be shown the cloth.</p>
            </div>
            <ol className="why-list">
              <li>
                <span>01</span>
                <h3>The counter</h3>
                <p>Cloth is opened, not described from a tag.</p>
              </li>
              <li>
                <span>02</span>
                <h3>The same person</h3>
                <p>A wedding list can be picked up by the person who started it.</p>
              </li>
              <li>
                <span>03</span>
                <h3>The range</h3>
                <p>A shirt, a saree, a towel and a chain without crossing the market.</p>
              </li>
              <li>
                <span>04</span>
                <h3>The fitting</h3>
                <p>Suits are marked on the body.</p>
              </li>
              <li>
                <span>05</span>
                <h3>The room</h3>
                <p>Jewellery is shown away from the busy aisle.</p>
              </li>
              <li>
                <span>06</span>
                <h3>The hour</h3>
                <p>You can book a consultation instead of waiting with a full family.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* LEGACY SECTION */}
        <section className="section legacy" id="legacy" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <p className="kicker">How the floors were added</p>
            <h2 className="reveal">The other floors were added because customers kept asking in the same visit.</h2>
            <p className="legacy-lead">The house did not open as a department store. It opened as a cloth counter.</p>
            <ol className="timeline">
              <li>
                <span>01</span>
                <h3>Cloth counter</h3>
                <p>Where a visit still starts.</p>
              </li>
              <li>
                <span>02</span>
                <h3>Suit table</h3>
                <p>Added when ready sizes were not enough.</p>
              </li>
              <li>
                <span>03</span>
                <h3>Jewellery room</h3>
                <p>For families who did not want a second errand on a wedding day.</p>
              </li>
              <li>
                <span>04</span>
                <h3>Home floor</h3>
                <p>Towels and linen, because a new household is more than clothes.</p>
              </li>
              <li>
                <span>05</span>
                <h3>Wedding book</h3>
                <p>A separate hour, written down by name.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* VISIT BAND SECTION */}
        <section className="visit-band" id="visit">
          <div className="wrap">
            <h2>Come to the floor, or write first.</h2>
            <p className="visit-note">A reference from the form is a note for the desk. The hour is confirmed when the floor replies.</p>
            <ul className="visit-actions">
              <li><a href="#stores">Visit Store <span aria-hidden="true">→</span></a></li>
              <li><Link to="/madt/consult">Book Consultation <span aria-hidden="true">→</span></Link></li>
              <li><Link to="/madt/wedding">Register for Wedding Shopping <span aria-hidden="true">→</span></Link></li>
              <li><Link to="/madt/contact">Contact Us <span aria-hidden="true">→</span></Link></li>
            </ul>
          </div>
        </section>
      </main>

      {/* Location Modal */}
      {activeLoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setActiveLoc(null)}>
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
    </MadtLayout>
  );
}
