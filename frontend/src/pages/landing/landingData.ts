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
  email: string;
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
    tagline: 'BSC Textiles · Five Generations of Handloom Excellence',
    established: 1938,
    years: new Date().getFullYear() - 1938,
    certification: 'Silk Mark Certified & Weaver Guild Guaranteed',
    cities: ['Belagavi', 'Davanagere', 'Shivamogga'],
    logo: '/Main_logo.png',
    logoSmall: '/logo.webp'
  },

  navigation: {
    logo: '/Main_logo.png',
    logoSmall: '/logo.webp',
    brandText: 'BSC TEXTILES',
    links: [
      { id: 'hero', label: 'Home' },
      { id: 'legacy', label: 'Heritage' },
      { id: 'collections', label: 'Collections' },
      { id: 'wedding', label: 'Wedding' },
      { id: 'stores', label: 'Stores' },
      { id: 'shivamogga-event', label: 'Shivamogga' },
      { id: 'about', label: 'About' },
      { id: 'contact', label: 'Contact' }
    ],
    primaryAction: {
      label: 'Register for Wedding Shopping',
      href: '/wedding/customer-registration'
    },
    staffAction: {
      label: 'Staff Portal',
      href: '/login'
    }
  },

  hero: {
    badge: 'ESTABLISHED 1938 · FIVE GENERATIONS OF EXCELLENCE',
    title: 'BSC Textiles',
    subtitle: 'A legacy of textiles, fashion and timeless craftsmanship.',
    supportingText:
      'Karnataka’s foremost heritage house for pure silk sarees, bespoke menswear, bridal trousseaus, and curated luxury textiles. Five generations of authentic handloom excellence across Belagavi, Davanagere, and Shivamogga.',
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
      { label: 'Three Flagship Karnataka Showrooms', icon: 'store' },
      { label: 'Private Family Bridal Suites', icon: 'crown' }
    ]
  },

  floatingCards: [
    {
      id: 1,
      tag: 'BSC HERITAGE',
      title: 'Five Generations',
      subtitle: '1938 → Present · 88+ Years',
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
    kicker: 'SINCE 1938 · FIVE GENERATIONS',
    title: 'The Counter Tradition',
    subtitle: 'Where cloth is felt, weighed, and draped before you decide.',
    bodyParagraphs: [
      'In 1938, BSC opened its first textile counter in Karnataka with a single steadfast principle: every length of cloth must be unfolded before the family, its weave inspected under daylight, and its authenticity proven beyond doubt.',
      'Eighty-six years and five generations later, that same reverence for craftsmanship continues across Belagavi, Davanagere, and Shivamogga. We still host on-counter burn tests for pure gold and silver zari, and our master tailors still chalk fittings on the body rather than relying on standard sizing charts.'
    ],
    timeline: [
      {
        year: '1938',
        title: 'Founding in Khade Bazar',
        city: 'Belagavi',
        desc: 'First silk and textile counter established in Karnataka by the founding generation.'
      },
      {
        year: '1978',
        title: 'Central Karnataka Flagship',
        city: 'Davanagere',
        desc: 'Expanded with a grand showroom dedicated to wedding trousseaus and home furnishings.'
      },
      {
        year: '1992',
        title: 'Bespoke Atelier',
        city: 'Bespoke Desk',
        desc: 'Master cutters and suit desks introduced for custom menswear, sherwanis, and bandhgalas.'
      },
      {
        year: '2024',
        title: 'New Flagship Showroom',
        city: 'Shivamogga',
        desc: 'State-of-the-art multi-level luxury shopping destination inaugurated on Nehru Road.'
      }
    ],
    stats: [
      { value: '88+', label: 'Years of Heritage', sub: 'Unbroken legacy since 1938' },
      { value: '5', label: 'Generations', sub: 'Of textile expertise & trust' },
      { value: '100%', label: 'Pure Handloom', sub: 'Silk Mark certified authenticity' },
      { value: '50k+', label: 'Weddings Draped', sub: 'Generations of celebration' }
    ]
  },

  collectionsOverview: {
    kicker: 'CURATED FLOORS',
    title: '3D Collection Galleries',
    subtitle: 'Step into curated departments designed for unhurried exploration and tactile luxury.',
    items: [
      {
        id: 'sarees',
        code: '01',
        title: 'Sarees',
        category: 'Pure Silks & Bridal Handlooms',
        description: 'Kanchipuram Korvai, Banarasi Katan, Dharmavaram, and Arani silks preserved in cedar-lined cases.',
        image: '/images/women-real.webp',
        tag: 'Silk Mark Certified',
        details: ['Kanchipuram Korvai Weaves', 'Banarasi Brocade & Zari', 'Arani Pure Silks', 'Bridal Muhurtham Sarees']
      },
      {
        id: 'womenswear',
        code: '02',
        title: "Women's Collection",
        category: 'Contemporary & Festive Couture',
        description: 'Handcrafted lehengas, bridal anarkalis, festive coordinates, and celebration wear.',
        image: '/images/womens-festive-couture.png',
        tag: 'Festive Couture',
        details: ['Bridal Lehengas', 'Embroidered Anarkalis', 'Festive Coordinates', 'Ready-to-Wear Silks']
      },
      {
        id: 'menswear',
        code: '03',
        title: "Men's Collection",
        category: 'Tailored Luxury & Shirting',
        description: 'Fine Egyptian Giza cottons, pure Irish linens, Italian wools, and festive kurta ensembles.',
        image: '/images/men.webp',
        tag: 'Master Fit',
        details: ['Giza Cotton Shirting', 'Pure Linen Ensembles', 'Festive Silk Kurtas', 'Formal & Casual Suiting']
      },
      {
        id: 'kids',
        code: '04',
        title: 'Kids Collection',
        category: 'Junior Ethnic & Celebrations',
        description: 'Traditional silk pavadas, miniature dhotis, festive kurtas, and celebration ensembles for children.',
        image: '/images/coll-trousseau-1200.webp',
        tag: 'Pure & Soft Silk',
        details: ['Pure Silk Pattu Pavadas', 'Boys Dhoti & Kurta Sets', 'Festive Occasion Wear', 'Hypoallergenic Natural Dyes']
      },
      {
        id: 'brands',
        code: '05',
        title: 'Brand Collection',
        category: 'Curated Mill Labels',
        description: 'Direct partnerships with India’s foremost textile mills and luxury fabric manufacturers.',
        image: '/images/brands.webp',
        tag: 'Verified Mills',
        details: ['Raymond Fine Fabrics', 'Linen Club Italy', 'Arvind Luxury Cottons', 'Grasim Fine Suitings']
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
        id: 'jewellery',
        code: '07',
        title: 'Jewellery',
        category: 'Temple & Heirloom Ornaments',
        description: 'Traditional temple jewelry, antique gold finishes, and bridal ornaments displayed tray by tray in private suites.',
        image: '/images/jewellery.webp',
        tag: 'Private Viewing',
        details: ['Temple Chokers & Haarams', 'Antique Bridal Sets', 'Jhumkas & Maang Tikkas', 'Private Consultation Room']
      },
      {
        id: 'wedding-coll',
        code: '08',
        title: 'Wedding Collection',
        category: 'Complete Trousseau Curation',
        description: 'Sarees, shirting, blouse pieces, and wedding party cloth gathered in one booked consultation hour.',
        image: '/images/wedding.webp',
        tag: 'Complete Trousseau',
        details: ['Bride & Groom Coordination', 'Wedding Party Sets', 'Muhurtham & Reception Silks', 'Bespoke Family Packages']
      },
      {
        id: 'suits',
        code: '09',
        title: 'Suits',
        category: 'Bespoke Suit Desk',
        description: 'Bandhgalas, tuxedos, and sherwanis measured and marked directly on your posture by master drapers.',
        image: '/images/suit.webp',
        tag: 'Bespoke Fitting',
        details: ['Hand-Chalked Body Fittings', 'Bespoke Sherwanis & Indo-Western', 'Royal Jodhpur Bandhgalas', 'Custom 3-Piece Tuxedos']
      },
      {
        id: 'dozolo',
        code: '10',
        title: 'Dozolo',
        category: 'Contemporary & Ready Fashion',
        description: 'Modern silhouette wear, fusion Indo-Western coordinates, and ready-to-wear celebrations.',
        image: '/images/women.webp',
        tag: 'Modern Heritage',
        details: ['Contemporary Silhouettes', 'Fusion Indo-Western', 'Occasion Separates', 'Modern Craftsmanship']
      },
      {
        id: 'towels',
        code: '11',
        title: 'Towels',
        category: 'Ultra Plush 700 GSM Linen',
        description: '700 GSM combed zero-twist Turkish cotton towels, bath sheets, and luxury spa coordinates.',
        image: '/images/towels.webp',
        tag: 'Ultra Soft 700 GSM',
        details: ['Zero-Twist Bath Towels', 'Plush Hand Towels & Mats', 'Spa Bathrobes', 'Quick-Dry Aerocore Weave']
      },
      {
        id: 'other',
        code: '12',
        title: 'Other Collections',
        category: 'Accessories & Draping Crafts',
        description: 'Handcrafted dupattas, pure silk stoles, cufflinks, angavastrams, and festive accessories.',
        image: '/images/coll-temple-1200.webp',
        tag: 'Artisan Accents',
        details: ['Pure Silk Stoles', 'Zari Border Angavastrams', 'Custom Cufflinks & Brooches', 'Handmade Potlis & Clutches']
      }
    ] as CollectionItem[]
  },

  weddingExperience: {
    kicker: 'THE BSC WEDDING CONCIERGE',
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
      label: 'Register for Wedding Shopping',
      href: '/wedding/customer-registration'
    }
  },

  stores: [
    {
      id: 'davanagere',
      city: 'Davanagere Exclusive',
      name: 'Medical College Rd',
      badge: 'Home & Linen Floor',
      established: 'Est. 1938',
      address: 'Medical College Rd, MCC B Block, Kuvempu Nagar, Davangere, Karnataka 577004',
      phone: '+91 8192 221938',
      email: 'davanagere@bsctextiles.in',
      hours: '10:30 AM – 8:00 PM · Seven days',
      departments: ['Home Furnishing', 'Luxury Towels & Linens', 'Pure Silk Sarees', 'Menswear Shirting'],
      image: '/images/home.webp',
      mapsQuery: 'BSC Textiles Medical College Rd Davanagere'
    },
    {
      id: 'belagavi',
      city: 'Belagavi Textile Mall',
      name: 'Khade Bazar · Tilakwadi',
      badge: 'Heritage Showroom & Silk Floor',
      established: 'Est. 2022',
      address: '1st gate road, Shukrawar Peth Rd, Shivaji Colony, Tilakwadi, Belagavi, Karnataka 590006',
      phone: '+91 831 242 1938',
      email: 'belagavi@bsctextiles.in',
      hours: '10:30 AM – 8:30 PM · Seven days',
      departments: ['Royal Bridal Silks', 'Jewellery Suite', 'Bespoke Menswear', 'Bridal Draping Suites'],
      image: '/images/floor.webp',
      mapsQuery: 'BSC Textiles Khade Bazar Belagavi',
      featured: true
    },
    {
      id: 'shivamogga',
      city: 'Shivamogga Flagship',
      name: 'Nehru Road · Durgigudi',
      badge: 'Bespoke Suit Desk & Wedding Floor',
      established: 'Est. 1992',
      address: 'Nehru Road / Durgigudi Main Road, Shivamogga, Karnataka 577201',
      phone: '+91 8182 221938',
      email: 'shivamogga@bsctextiles.in',
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
    author: 'BSC Textiles Custodians',
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
