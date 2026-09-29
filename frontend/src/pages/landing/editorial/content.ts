/**
 * Every visible string on the editorial landing page lives here so the copy can
 * be proofread in one place.
 *
 * The hero description and the store names below are approved BSC Textiles copy
 * and must not be reworded.
 */

export const BRAND = 'BSC Textiles';

export const HERO_LABEL = 'Established 1938';
export const HERO_HEADLINE = 'Five Generations. Timeless Textiles.';

/** Approved company description — reproduce verbatim. */
export const HERO_DESCRIPTION =
  'Karnataka’s foremost heritage house for pure silk sarees, bespoke menswear, bridal trousseaus, and curated luxury textiles. Five generations of authentic handloom excellence across Belagavi, Davanagere, and Shivamogga.';

export const CTA_EXPLORE = 'Explore Collections';
export const CTA_REGISTER = 'Register for Wedding Shopping';
export const CTA_LOGIN = 'Staff Login';

/** Staff sign-in — the same route the rest of the app authenticates against. */
export const LOGIN_PATH = '/login';

/** The single approved destination for wedding registration. */
export const WEDDING_REGISTRATION_PATH = '/wedding/customer-registration';

export const NAV_ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'collections', label: 'Collections' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'stores', label: 'Stores' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' }
] as const;

export const COLLECTIONS = [
  {
    title: 'Sarees',
    description: 'Pure Kanchipuram, Banarasi and Dharmavaram silks, opened on the counter weave by weave.'
  },
  {
    title: 'Men’s Collection',
    description: 'Giza cotton shirting, fine suiting and linen, with measurements taken on the body.'
  },
  {
    title: 'Women’s Collection',
    description: 'Festive sarees, dress materials and everyday silks for every occasion in the calendar.'
  },
  {
    title: 'Wedding Collection',
    description: 'Bridal trousseaus, sherwanis and family sets, curated together in a private suite.'
  },
  {
    title: 'Home Furnishing',
    description: 'Bed linen, cotton covers and luxury towels — the fullest range at our Davanagere floor.'
  },
  {
    title: 'Jewellery',
    description: 'Temple jewellery and gold and silver zari pieces, shown away from the busy aisle.'
  }
] as const;

export const COLLECTIONS_NOTE =
  'Nine counters under one roof. Ask at the floor desk and we will bring out what you are looking for.';

/** Heritage progression — approved order and names. */
export const HERITAGE_STEPS = [
  { key: 'The beginning', value: '1938', note: 'BSC opens its first textile house in Karnataka.' },
  { key: 'The lineage', value: 'Five Generations', note: 'The same counters, the same promise, passed on.' },
  { key: 'First floor', value: 'Davanagere', note: 'Home furnishings, towels and linens on Medical College Road.' },
  { key: 'The flagship', value: 'Belagavi', note: 'Bridal silks, suits and the jewellery suite at Tilakwadi.' },
  { key: 'The newest floor', value: 'Shivamogga', note: 'Tailoring and wedding menswear at Durgigudi.' },
  { key: 'The house', value: 'BSC Textiles', note: 'Pure silk, bespoke menswear and wedding shopping in one place.' }
] as const;

export const HERITAGE_HEADING = 'A house built on what you can see and feel.';
export const HERITAGE_BODY =
  'Since 1938 we have followed one simple practice: open every bale in front of the family, let them inspect the weave, and prove the purity of the silk and the zari honestly. Five generations later, that is still how a purchase is made at BSC.';

export const WEDDING_HEADING = 'Wedding Shopping, Thoughtfully Curated.';
export const WEDDING_BODY =
  'Wedding shopping at BSC is a booked hour, not a walk-in between other customers. Bring your list, and we set aside the trousseau cloth, the groom’s suit, the jewellery and the linen for the new home — shown one at a time, in a private suite for the family.';

export const WEDDING_FACETS = [
  { title: 'Bridal silks', body: 'Kanchipuram, Banarasi and Dharmavaram handlooms held aside for your visit.' },
  { title: 'Groom’s ensemble', body: 'Sherwanis, bandhgalas and suits marked on the body by our master tailors.' },
  { title: 'Temple jewellery', body: 'Shown in a dedicated room, with pure gold and silver zari tested at the counter.' },
  { title: 'Family and linen', body: 'Matching outfits for the wedding party, and linen for the new household.' }
] as const;

export const STORES_HEADING = 'Three floors across Karnataka.';
export const STORES_BODY =
  'Every floor keeps the same standards and the same counters that remember returning families.';

export const FOOTER_TAGLINE =
  'A heritage silk house working directly with master weaving families in Kanchipuram, Varanasi, Arani and Dharmavaram — and with wedding families across Karnataka since 1938.';

export const CONTACT_NOTE = 'Call the floor you wish to visit, or register your wedding list online.';

export const FALLBACK_STORE_NOTE = 'Opening hours may vary on public holidays. Please call the floor to confirm.';
