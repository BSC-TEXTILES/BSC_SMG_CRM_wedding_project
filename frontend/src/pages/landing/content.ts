export const YEARS_AT_THE_COUNTER = new Date().getFullYear() - 1938;

export const NAV_LINKS = [
  { id: 'house', label: 'The House' },
  { id: 'counters', label: 'Counters' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'stores', label: 'Stores' },
  { id: 'stories', label: 'Stories' }
] as const;

export const mapsHref = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const TICKER = [
  'Est. 1938',
  'Kanchipuram Korvai',
  'Silk Mark Certified',
  'Varanasi Katan',
  'Belagavi · Davanagere · Shivamogga',
  'Arani & Dharmavaram',
  'Four Generations',
  'Wedding Suites By Appointment'
];

export interface Department {
  no: string;
  id: string;
  title: string;
  kicker: string;
  blurb: string;
  img: string;
  sm?: string;
  wide?: boolean;
  pos?: string;
}

export const DEPARTMENTS: Department[] = [
  {
    no: '01',
    id: 'women',
    title: 'Bridal & Handloom Silks',
    kicker: 'Women',
    blurb: 'Kanchipuram, Banarasi and Arani silks kept in cedar sleeves until you ask to see them.',
    img: '/images/women-real.webp',
    pos: '50% 18%'
  },
  {
    no: '02',
    id: 'jewellery',
    title: 'The Jewellery Suite',
    kicker: 'Jewellery',
    blurb: 'Temple necklaces and heirloom sets, shown tray by tray in a room off the aisle.',
    img: '/images/jewellery.webp',
    sm: '/images/jewellery-sm.webp'
  },
  {
    no: '03',
    id: 'suits',
    title: 'Bespoke Suit Desk',
    kicker: 'Tailoring',
    blurb: 'Shoulders, chest and sleeve marked on the body by master cutters, not from a chart.',
    img: '/images/suit.webp',
    sm: '/images/suit-sm.webp'
  },
  {
    no: '04',
    id: 'men',
    title: 'Menswear & Shirting',
    kicker: 'Men',
    blurb: 'Giza cotton, linen and tussar — alterations noted on the floor the same afternoon.',
    img: '/images/men.webp',
    sm: '/images/men-sm.webp'
  },
  {
    no: '05',
    id: 'wedding-coll',
    title: 'The Wedding Trousseau',
    kicker: 'Collection',
    blurb: 'Sarees, blouse pieces and party cloth gathered on one list, in one booked hour.',
    img: '/images/coll-bridal-1200.webp'
  },
  {
    no: '06',
    id: 'brands',
    title: 'Curated Labels',
    kicker: 'Brands',
    blurb: 'A short rail of the labels this house actually stocks, verified mill by mill.',
    img: '/images/brands.webp',
    sm: '/images/brands-sm.webp'
  },
  {
    no: '07',
    id: 'home',
    title: 'Home Furnishing',
    kicker: 'Home',
    blurb: 'Bed linen and household cloth for the new home — Davanagere keeps the fullest range.',
    img: '/images/home.webp',
    sm: '/images/home-sm.webp'
  },
  {
    no: '08',
    id: 'towels',
    title: 'Towels & Bath',
    kicker: 'Linen',
    blurb: 'Heavy GSM, combed zero-twist weave, unfolded at the counter so you can feel the weight.',
    img: '/images/towels.webp',
    sm: '/images/towels-sm.webp'
  }
];

export interface Store {
  key: string;
  idx: string;
  est: string;
  name: string;
  city: string;
  badge: string;
  address: string;
  phone: string;
  hours: string;
  departments: string;
  img: string;
  featured?: boolean;
}

export const STORES: Store[] = [
  {
    key: 'belagavi',
    idx: '01',
    est: 'Est. 1938',
    name: 'Belagavi Flagship',
    city: 'Khade Bazar · Tilakwadi',
    badge: 'Royal Bridal Silks',
    address: 'Khade Bazar / Raviwar Peth, Tilakwadi, Belagavi, Karnataka 590001',
    phone: '+91 831 242 1938',
    hours: '10:30 AM – 8:30 PM · Seven days',
    departments: 'Royal Bridal Silks · Jewellery Suite · Menswear',
    img: '/images/floor.webp',
    featured: true
  },
  {
    key: 'davanagere',
    idx: '02',
    est: 'Est. 1978',
    name: 'Davanagere Central',
    city: 'Mandipet · PB Road',
    badge: 'Home & Linen Floor',
    address: 'Mandipet / PB Road, MCC B Block, Davanagere, Karnataka 577001',
    phone: '+91 8192 221938',
    hours: '10:30 AM – 8:00 PM · Seven days',
    departments: 'Home Furnishing · Luxury Towels · Bed Linens',
    img: '/images/home.webp'
  },
  {
    key: 'shivamogga',
    idx: '03',
    est: 'Est. 1992',
    name: 'Shivamogga Suit Room',
    city: 'Nehru Road · Durgigudi',
    badge: 'Suit Desk & Menswear',
    address: 'Nehru Road / Durgigudi Main Road, Shivamogga, Karnataka 577201',
    phone: '+91 8182 221938',
    hours: '11:00 AM – 8:00 PM · Tue – Sun',
    departments: 'Bespoke Tailoring · Sherwanis · Bandhgalas',
    img: '/images/suit.webp'
  }
];

export const HOUSE_FACTS = [
  { title: 'Cloth, opened', desc: 'You see the weave before you decide.' },
  { title: 'Lists, by name', desc: 'A wedding note stays with the person who started it.' },
  { title: 'Suits, on the body', desc: 'The fitting is marked here, not guessed from a chart.' },
  { title: 'Jewellery, quietly', desc: 'Trays come out away from the busy aisle.' }
];

export const WEDDING_ITEMS = [
  { title: 'Trousseau cloth', desc: 'Sarees and dress material, opened one bale at a time.' },
  { title: "Groom's ensemble", desc: 'Marked on the body at our master suit desk.' },
  { title: 'Temple jewellery', desc: 'Shown in a dedicated room, away from the open floor.' },
  { title: 'Wedding party', desc: 'Colour-matched cloth for the people standing with you.' },
  { title: 'Home linen', desc: 'Towels and bed linen for the new household.' },
  { title: 'Family gifts', desc: 'Commemorative pieces that do not need a second market.' }
];

export const REASONS = [
  { n: '01', title: 'The counter', desc: 'Cloth is opened and draped, not described from a tag.' },
  { n: '02', title: 'The same person', desc: 'A wedding note can be picked up by the stylist who started it.' },
  { n: '03', title: 'The range', desc: 'A shirt, a saree, a towel and a chain without crossing the market.' },
  { n: '04', title: 'The fitting', desc: 'Suits and blouses are marked on the body by our master drapers.' },
  { n: '05', title: 'The room', desc: 'Jewellery is shown away from the busy aisle, on your own time.' },
  { n: '06', title: 'The hour', desc: 'Book a consultation ahead instead of waiting with a full family.' }
];

export const TESTIMONIALS = [
  {
    quote:
      'We registered on a Tuesday and by Saturday three Korvai-border Kanjeevarams were waiting in Suite 2 with our name on the card. The manager brought the burn test to the table so my mother was completely at ease.',
    name: 'Meghana Kulkarni',
    role: 'Bride · Belagavi',
    portrait: 0
  },
  {
    quote:
      'The bandhgala and trousers were marked on the body on Sunday and collected on Thursday. No second trip, no delay. The master tailor checked the shoulder drop himself.',
    name: 'Farhan Qureshi',
    role: "Groom's family · Davanagere",
    portrait: 1
  },
  {
    quote:
      'We had a wedding list with fourteen family members. BSC gave us a private suite with refreshments, and every saree and suit was handled seamlessly under one roof.',
    name: 'Anagha Bhat',
    role: 'Family of fourteen · Shivamogga',
    portrait: 2
  }
];

export const FEATURED_POINTS = [
  'Private bridal draping suites with family seating',
  'In-house burn-testing station for gold and silver zari',
  'Master tailors on the floor for blouse and suit markings',
  'Over 2,400 handpicked silks in individual cedar sleeves'
];

export const DESKS = [
  { to: '/apply', title: 'Careers at BSC', desc: 'Floor, draping and telecaller roles across three Karnataka stores.' },
  { to: '/feedback-public', title: 'Rate Your Visit', desc: 'Takes two minutes. Store managers review feedback daily.' },
  { to: '/track', title: 'Track an Order', desc: 'Blouse stitching, alterations and dispatch by reference ID.' }
];
