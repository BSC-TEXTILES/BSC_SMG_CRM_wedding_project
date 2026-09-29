/**
 * Centralized Data Source for BSC Textiles Public Experience.
 *
 * All text, titles, descriptions, links, image references, and section
 * configuration are organized here so content can be updated or expanded
 * without modifying any UI component structure.
 */

export interface FloatingCardData {
  id: number;
  tag: string;
  title: string;
  subtitle: string;
  stat?: string;
  description: string;
  highlight: string;
  image?: string;
}

export interface StoreLocationData {
  id: string;
  city: string;
  name: string;
  badge: string;
  established: string;
  address: string;
  phone: string;
  hours: string;
  departments: string[];
  image: string;
  mapsQuery: string;
  featured?: boolean;
}

export interface CollectionItem {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string;
  image: string;
  tag: string;
  details?: string[];
}

export const LANDING_DATA = {
  brand: {
    name: 'BSC Textiles',
    tagline: 'BSC Exclusive · Five Generations',
    established: 1938,
    years: new Date().getFullYear() - 1938,
    certification: 'Silk Mark Certified & Weaver Guild Guaranteed',
    cities: ['Belagavi', 'Davanagere', 'Shivamogga']
  },

  navigation: {
    logo: '/logo.webp',
    brandText: 'BSC EXCLUSIVE',
    links: [
      { id: 'hero', label: 'Home' },
      { id: 'legacy', label: 'Legacy' },
      { id: 'collections', label: 'Collections' },
      { id: 'wedding', label: 'Wedding' },
      { id: 'stores', label: 'Stores' },
      { id: 'shivamogga-event', label: 'Shivamogga' },
      { id: 'about', label: 'About BSC' },
      { id: 'contact', label: 'Contact' }
    ],
    primaryAction: {
      label: 'Wedding Register',
      href: '/wedding/customer-registration'
    },
    staffAction: {
      label: 'Staff Portal',
      href: '/login'
    }
  },

  hero: {
    badge: 'ESTABLISHED 1938 · FIVE GENERATIONS OF EXCELLENCE',
    headingLine1: 'Tradition.',
    headingLine2: 'Styled for today.',
    supportingText:
      'Karnataka’s heritage house for pure silk sarees, bespoke menswear, bridal trousseaus, and curated luxury textiles. Five generations of authentic handloom excellence across Belagavi, Davanagere, and Shivamogga.',
    primaryCta: {
      label: 'Register for Wedding Shopping',
      href: '/wedding/customer-registration'
    },
    secondaryCta: {
      label: 'Discover Our Stores',
      targetId: 'stores'
    },
    proofItems: [
      { label: 'Silk Mark Certified Handlooms', icon: 'shield' },
      { label: 'Three Flagship Karnataka Stores', icon: 'store' },
      { label: 'Private Family Bridal Suites', icon: 'crown' }
    ]
  },

  floatingCards: [
    {
      id: 1,
      tag: 'BSC HERITAGE',
      title: 'Five Generations',
      subtitle: '1938 → Present · 86+ Years',
      stat: 'Est. 1938',
      description: 'Karnataka’s timeless textile institution. Authentic handloom silks opened and draped on the counter, verified weaver by weaver.',
      highlight: 'Silk Mark Certified Authentic Zari',
      image: '/images/floor.webp'
    },
    {
      id: 2,
      tag: 'FLAGSHIP SHOWROOMS',
      title: 'Three Destinations',
      subtitle: 'Davanagere · Belagavi · Shivamogga',
      stat: '3 Showrooms',
      description: 'Over 60,000 sq. ft. of luxury shopping. Dedicated bridal suites, bespoke shirting desks, and home furnishing floors.',
      highlight: 'Personalized Concierge Service',
      image: '/images/hero-bg.webp'
    },
    {
      id: 3,
      tag: 'WEDDING CONCIERGE',
      title: 'Wedding Shopping',
      subtitle: 'Personalized Bridal Experience',
      stat: 'Private Suites',
      description: 'A dedicated shopping hour for the whole family. Complete trousseau planning, burn-testing stations, and master suit markings.',
      highlight: 'By Advance Appointment',
      image: '/images/wedding.webp'
    },
    {
      id: 4,
      tag: 'MASTER CURATION',
      title: 'Curated Collections',
      subtitle: 'Silks · Menswear · Home · Jewellery',
      stat: '12+ Departments',
      description: 'From Kanchipuram Korvai silks to Giza cotton shirting, bespoke bandhgalas, and combed high-GSM bath linens.',
      highlight: 'Handcrafted Heritage Pieces',
      image: '/images/women-real.webp'
    },
    {
      id: 5,
      tag: 'SPECIAL EVENT',
      title: 'Shivamogga Showroom',
      subtitle: 'Grand Opening & Bespoke Suite',
      stat: 'New Flagship',
      description: 'Experience Malnad’s premier fashion and wedding destination. Nehru Road, Durgigudi Main Road, Shivamogga.',
      highlight: 'Exclusive Festive Inauguration',
      image: '/images/suit.webp'
    }
  ] as FloatingCardData[],

  legacy: {
    kicker: 'SINCE 1938',
    title: 'The Counter Tradition',
    subtitle: 'Where cloth is felt, weighed, and draped before you decide.',
    bodyParagraphs: [
      'In 1938, BSC opened its first textile counter in Karnataka with a single steadfast principle: every length of cloth must be unfolded before the family, its weave inspected under daylight, and its authenticity proven beyond doubt.',
      'Eighty-six years and five generations later, that same reverence for craftsmanship continues across Belagavi, Davanagere, and Shivamogga. We still host on-counter burn tests for pure gold and silver zari, and our master tailors still chalk fittings on the body rather than relying on standard sizing charts.'
    ],
    milestones: [
      { year: '1938', title: 'Belagavi Foundation', desc: 'First silk and textile counter established in historic Khade Bazar.' },
      { year: '1978', title: 'Davanagere Expansion', desc: 'Central Karnataka flagship opened for wedding trousseaus and home furnishing.' },
      { year: '1992', title: 'Bespoke Tailoring', desc: 'Master cutters and suit desks introduced for custom menswear & bandhgalas.' },
      { year: '2024', title: 'Shivamogga Flagship', desc: 'State-of-the-art multi-level luxury shopping destination inaugurated.' }
    ],
    stats: [
      { value: '86+', label: 'Years of Heritage', sub: 'Unbroken legacy since 1938' },
      { value: '5', label: 'Generations', sub: 'Of textile expertise & trust' },
      { value: '100%', label: 'Pure Handloom', sub: 'Silk Mark certified authenticity' },
      { value: '50k+', label: 'Weddings Draped', sub: 'Generations of celebration' }
    ]
  },

  collectionsOverview: {
    kicker: 'OUR DEPARTMENTS',
    title: 'Curated Floors for Every Occasion',
    subtitle: 'Step into departments designed for unhurried exploration and tactile luxury.',
    items: [
      {
        id: 'sarees',
        code: '01',
        title: 'Pure Silk Sarees',
        category: 'Bridal & Handlooms',
        description: 'Kanchipuram Korvai, Banarasi Katan, Dharmavaram, and Arani silks preserved in cedar-lined cases.',
        image: '/images/women-real.webp',
        tag: 'Silk Mark Certified',
        details: ['Kanchipuram Korvai Weaves', 'Banarasi Brocade & Zari', 'Arani Pure Silks', 'Bridal Muhurtham Sarees']
      },
      {
        id: 'menswear',
        code: '02',
        title: 'Menswear & Shirting',
        category: 'Tailored Luxury',
        description: 'Fine Egyptian Giza cottons, pure Irish linens, Italian wools, and festive kurta ensembles.',
        image: '/images/men.webp',
        tag: 'Master Fit',
        details: ['Giza Cotton Shirting', 'Pure Linen Ensembles', 'Festive Silk Kurtas', 'Formal & Casual Suiting']
      },
      {
        id: 'suits',
        code: '03',
        title: 'Bespoke Suit Desk',
        category: 'Custom Tailoring',
        description: 'Bandhgalas, tuxedos, and sherwanis measured and marked directly on your posture by master drapers.',
        image: '/images/suit.webp',
        tag: 'Bespoke Fitting',
        details: ['Hand-Chalked Body Fittings', 'Bespoke Sherwanis & Indo-Western', 'Royal Jodhpur Bandhgalas', 'Custom 3-Piece Tuxedos']
      },
      {
        id: 'womenswear',
        code: '04',
        title: 'Designer Womenswear',
        category: 'Contemporary & Festive',
        description: 'Handcrafted lehengas, bridal anarkalis, festive coordinates, and celebration wear.',
        image: '/images/coll-bridal-1200.webp',
        tag: 'Festive Couture',
        details: ['Bridal Lehengas', 'Embroidered Anarkalis', 'Festive Coordinates', 'Ready-to-Wear Silks']
      },
      {
        id: 'jewellery',
        code: '05',
        title: 'The Jewellery Suite',
        category: 'Temple & Heirloom',
        description: 'Traditional temple jewelry, antique gold finishes, and bridal ornaments displayed tray by tray in private suites.',
        image: '/images/jewellery.webp',
        tag: 'Private Viewing',
        details: ['Temple Chokers & Haarams', 'Antique Bridal Sets', 'Jhumkas & Maang Tikkas', 'Private Consultation Room']
      },
      {
        id: 'home',
        code: '06',
        title: 'Home Furnishing',
        category: 'Living & Bed Linen',
        description: 'Egyptian cotton bed sets, jacquard curtains, rich upholstery, and heirloom household fabrics.',
        image: '/images/home.webp',
        tag: 'Luxury Living',
        details: ['600+ Thread Count Bed Linen', 'Custom Jacquard Curtains', 'Sofa Fabrics & Upholstery', 'Dining Linen & Accessories']
      },
      {
        id: 'towels',
        code: '07',
        title: 'Luxury Towels & Bath',
        category: 'Plush Linen',
        description: '700 GSM combed zero-twist Turkish cotton towels, bath sheets, and luxury spa coordinates.',
        image: '/images/towels.webp',
        tag: 'Ultra Soft 700 GSM',
        details: ['Zero-Twist Bath Towels', 'Plush Hand Towels & Mats', 'Spa Bathrobes', 'Quick-Dry Aerocore Weave']
      },
      {
        id: 'brands',
        code: '08',
        title: 'Curated Mill Brands',
        category: 'Mill Labels',
        description: 'Direct partnerships with India’s foremost textile mills and luxury fabric manufacturers.',
        image: '/images/brands.webp',
        tag: 'Verified Mills',
        details: ['Raymond Fine Fabrics', 'Linen Club Italy', 'Arvind Luxury Cottons', 'Grasim Fine Suitings']
      }
    ] as CollectionItem[]
  },

  weddingExperience: {
    kicker: 'THE BSC WEDDING SUITE',
    title: 'Curated Wedding Shopping for the Whole Family',
    subtitle: 'A dedicated consultation hour. One stylist, zero rush, every family member taken care of under one roof.',
    features: [
      {
        title: 'Private Draping Suites',
        desc: 'Spacious air-conditioned salons with sofa seating for up to 15 family members, refreshments, and unhurried viewing.'
      },
      {
        title: 'Dedicated Wedding Stylist',
        desc: 'One assigned expert stays with your family throughout the journey, coordinating colours and budgets seamlessly.'
      },
      {
        title: 'On-Counter Pure Zari Testing',
        desc: 'Witness the traditional burn and rub test right at your table so your elders have complete peace of mind.'
      },
      {
        title: 'Head-to-Toe Coordination',
        desc: 'Match bride’s silk saree borders with groom’s angavastram, sherwani stoles, and family celebration attire.'
      }
    ],
    cta: {
      label: 'Book Your Wedding Suite',
      href: '/wedding/customer-registration'
    }
  },

  stores: [
    {
      id: 'belagavi',
      city: 'Belagavi Flagship',
      name: 'Khade Bazar · Tilakwadi',
      badge: 'Heritage Showroom & Silk Floor',
      established: 'Est. 1938',
      address: 'Khade Bazar / Raviwar Peth, Tilakwadi, Belagavi, Karnataka 590001',
      phone: '+91 831 242 1938',
      hours: '10:30 AM – 8:30 PM · Seven days',
      departments: ['Royal Bridal Silks', 'Jewellery Suite', 'Bespoke Menswear', 'Bridal Draping Suites'],
      image: '/images/floor.webp',
      mapsQuery: 'BSC Textiles Khade Bazar Belagavi',
      featured: true
    },
    {
      id: 'davanagere',
      city: 'Davanagere Central',
      name: 'Mandipet · PB Road',
      badge: 'Home & Linen Floor',
      established: 'Est. 1978',
      address: 'Mandipet / PB Road, MCC B Block, Davanagere, Karnataka 577001',
      phone: '+91 8192 221938',
      hours: '10:30 AM – 8:00 PM · Seven days',
      departments: ['Home Furnishing', 'Luxury Towels & Linens', 'Pure Silk Sarees', 'Menswear Shirting'],
      image: '/images/home.webp',
      mapsQuery: 'BSC Textiles Mandipet Davanagere'
    },
    {
      id: 'shivamogga',
      city: 'Shivamogga Flagship',
      name: 'Nehru Road · Durgigudi',
      badge: 'Bespoke Suit Desk & Wedding Floor',
      established: 'Est. 1992',
      address: 'Nehru Road / Durgigudi Main Road, Shivamogga, Karnataka 577201',
      phone: '+91 8182 221938',
      hours: '11:00 AM – 8:00 PM · Tue – Sun',
      departments: ['Bespoke Tailoring', 'Sherwanis & Bandhgalas', 'Bridal Silks', 'Festive Womenswear'],
      image: '/images/suit.webp',
      mapsQuery: 'BSC Textiles Nehru Road Shivamogga'
    }
  ] as StoreLocationData[],

  shivamoggaEvent: {
    kicker: 'GRAND INAUGURATION & FESTIVE PREVIEW',
    title: 'The Shivamogga Flagship Showroom',
    subtitle: 'A new chapter in Malnad’s textile heritage.',
    date: 'Inaugural Celebration Season',
    venue: 'Nehru Road / Durgigudi Main Road, Shivamogga, Karnataka',
    description:
      'We welcome you to experience Shivamogga’s most expansive textile and wedding fashion destination. Spread across multiple curated levels featuring private bridal suites, bespoke suit ateliers, and Karnataka’s finest handloom silks.',
    highlights: [
      'Over 20,000 sq. ft. of exclusive shopping space',
      'Exclusive Kanchipuram and Banarasi handloom vault',
      'Resident master cutters for custom suits and sherwanis',
      'Complimentary valet parking and family hospitality suites'
    ],
    cta: {
      label: 'Get Directions & Visit',
      mapsQuery: 'BSC Textiles Nehru Road Shivamogga'
    }
  },

  about: {
    kicker: 'OUR PROMISE',
    title: 'The Weaver’s Knot. The Master’s Eye.',
    quote: '“We do not sell cloth from a catalogue. We place the bale in your hands, test the zari before your eyes, and measure the garment on your body.”',
    author: 'BSC Family Custodians',
    points: [
      {
        title: 'Direct Weaver Partnerships',
        desc: 'Over 400 weaver families across Kanchipuram, Varanasi, Dharmavaram, and Gadwal receive fair artisan compensation.'
      },
      {
        title: 'Authenticity Guarantee',
        desc: 'Every genuine silk saree carries the Silk Mark of India tag with a unique serial number verifiable on the national portal.'
      },
      {
        title: 'Generations of Trust',
        desc: 'Families who bought their grandparents’ wedding sarees here in 1950 return today for their children and grandchildren.'
      }
    ]
  },

  contact: {
    kicker: 'REACH OUT TO US',
    title: 'We Look Forward to Welcoming You',
    subtitle: 'Plan your visit, schedule a wedding consultation, or speak directly with our store managers.',
    cards: [
      {
        title: 'Wedding Concierge',
        info: 'Book a private suite for your family',
        actionLabel: 'Register Online',
        href: '/wedding/customer-registration',
        icon: 'calendar'
      },
      {
        title: 'Guest Feedback',
        info: 'Share your shopping experience with store directors',
        actionLabel: 'Leave Feedback',
        href: '/feedback-public',
        icon: 'message'
      },
      {
        title: 'Careers at BSC',
        info: 'Explore fashion consultant & store operations roles',
        actionLabel: 'Apply Now',
        href: '/apply',
        icon: 'briefcase'
      }
    ]
  }
};
