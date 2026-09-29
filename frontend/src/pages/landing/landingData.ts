/**
 * Centralized Data Source for BSC Textiles Public Experience.
 *
 * All text, titles, descriptions, links, image references, and section
 * configuration are organized here using simple, clear, everyday English
 * that is welcoming and easy to understand for all families.
 */

import { CENTRAL_STORE_LOCATIONS } from '../../config/storeLocations';

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
    tagline: 'BSC Textiles · Five Generations of Pure Silk and Quality Fabrics',
    established: 1938,
    years: new Date().getFullYear() - 1938,
    certification: 'Silk Mark Certified · 100% Pure Silk Guarantee',
    cities: ['Davanagere', 'Belagavi', 'Shivamogga'],
    logo: '/Main_logo.png',
    logoSmall: '/logo.webp'
  },

  navigation: {
    logo: '/Main_logo.png',
    logoSmall: '/logo.webp',
    brandText: 'BSC TEXTILES',
    links: [
      { id: 'hero', label: 'Home' },
      { id: 'legacy', label: 'Our Story' },
      { id: 'collections', label: 'Collections' },
      { id: 'wedding', label: 'Wedding Shopping' },
      { id: 'stores', label: 'Our Stores' },
      { id: 'shivamogga-event', label: 'Shivamogga Store' },
      { id: 'about', label: 'About Us' },
      { id: 'contact', label: 'Contact' }
    ],
    primaryAction: {
      label: 'Register for Wedding Shopping',
      href: '/wedding/customer-registration'
    },
    staffAction: {
      label: 'Staff Login',
      href: '/login'
    }
  },

  hero: {
    badge: 'ESTABLISHED 1938 · 88+ YEARS OF TRUST',
    title: 'BSC Textiles',
    subtitle: 'Pure silk sarees, wedding fashion, and fine clothing for the whole family.',
    supportingText:
      'Welcome to BSC Textiles. We bring you authentic pure silk sarees, complete wedding collections, and custom-tailored clothing. Proudly serving families for five generations across Davanagere, Belagavi, and Shivamogga.',
    primaryCta: {
      label: 'Register for Wedding Shopping',
      href: '/wedding/customer-registration'
    },
    secondaryCta: {
      label: 'View Our Stores',
      targetId: 'stores'
    },
    proofItems: [
      { label: '100% Pure Silk (Silk Mark Certified)', icon: 'shield' },
      { label: 'Showrooms in Davanagere, Belagavi & Shivamogga', icon: 'store' },
      { label: 'Private Family Wedding Shopping Suites', icon: 'crown' }
    ]
  },

  floatingCards: [
    {
      id: 1,
      tag: 'OUR HERITAGE',
      title: 'Five Generations',
      subtitle: 'Since 1938 · 88+ Years of Trust',
      stat: 'Est. 1938',
      description: 'Karnataka’s trusted textile family. We open and drape every saree on the counter so you can see and feel the pure silk before buying.',
      highlight: '100% Pure Silk Guarantee',
      image: '/images/floor.webp'
    },
    {
      id: 2,
      tag: 'OUR SHOWROOMS',
      title: 'Three Grand Stores',
      subtitle: 'Davanagere · Belagavi · Shivamogga',
      stat: '3 Showrooms',
      description: 'Spacious showrooms with family seating, dedicated wedding floors, custom suit tailoring, and home furnishings.',
      highlight: 'Friendly Staff & Family Comfort',
      image: '/images/hero-bg.webp'
    },
    {
      id: 3,
      tag: 'WEDDING SHOPPING',
      title: 'Wedding Collections',
      subtitle: 'Special Care for the Whole Family',
      stat: 'Private Rooms',
      description: 'Enjoy a peaceful shopping experience in our private family rooms. Find matching wedding sarees, suits, sherwanis, and gift clothes all in one place.',
      highlight: 'Book in Advance',
      image: '/images/wedding.webp'
    },
    {
      id: 4,
      tag: 'OUR COLLECTIONS',
      title: 'Wide Range of Clothing',
      subtitle: 'Sarees · Men · Women · Kids · Home',
      stat: '12+ Sections',
      description: 'Pure Kanchipuram silks, soft cotton shirts, grand wedding suits, kids festive wear, and soft bath towels.',
      highlight: 'Quality in Every Thread',
      image: '/images/women-real.webp'
    },
    {
      id: 5,
      tag: 'SHIVAMOGGA',
      title: 'Shivamogga Showroom',
      subtitle: 'Grand Opening on BH Road',
      stat: 'New Showroom',
      description: 'Visit our newest and largest showroom on BH Road, Durgigudi, Shivamogga. Enjoy private wedding rooms and expert custom tailoring.',
      highlight: 'Open 7 Days a Week',
      image: '/images/suit.webp'
    }
  ] as FloatingCardData[],

  legacy: {
    kicker: 'OUR STORY · SINCE 1938',
    title: 'The Counter Tradition',
    subtitle: 'Touch the fabric, feel the quality, and test the pure silk before you decide.',
    bodyParagraphs: [
      'In 1938, BSC opened its first textile shop in Karnataka with one simple rule: open every saree in front of the family, let them inspect the weave, and prove the pure silk quality honestly.',
      'Today, after 88 years and five generations, we follow that exact same promise across Davanagere, Belagavi, and Shivamogga. We test pure gold and silver zari right in front of you, and our expert tailors take measurements in person for the perfect fit.'
    ],
    timeline: [
      {
        year: '1938',
        title: 'First Shop in Khade Bazar',
        city: 'Belagavi',
        desc: 'Started as a small silk and cloth store with a focus on honest quality and customer trust.'
      },
      {
        year: '1978',
        title: 'Grand Showroom Opened',
        city: 'Davanagere',
        desc: 'Opened a large showroom for wedding shopping, daily wear, and home curtains and bedsheets.'
      },
      {
        year: '1992',
        title: 'Custom Tailoring Section',
        city: 'Tailoring Desk',
        desc: 'Introduced master tailors for made-to-measure suits, sherwanis, and formal shirts.'
      },
      {
        year: '2024',
        title: 'New Grand Showroom',
        city: 'Shivamogga',
        desc: 'Opened a modern multi-floor shopping destination on BH Road, Durgigudi.'
      }
    ],
    stats: [
      { value: '88+', label: 'Years of Trust', sub: 'Serving families since 1938' },
      { value: '5', label: 'Generations', sub: 'Of continuous family service' },
      { value: '100%', label: 'Pure Silk', sub: 'Certified with Silk Mark' },
      { value: '50k+', label: 'Weddings Served', sub: 'Happy brides and families' }
    ]
  },

  collectionsOverview: {
    kicker: 'OUR COLLECTIONS',
    title: 'Explore Our Collections',
    subtitle: 'Explore our wide range of pure silks, wedding clothing, daily wear, and home fabrics.',
    items: [
      {
        id: 'sarees',
        code: '01',
        title: 'Pure Silk Sarees',
        category: 'Bridal & Traditional Handlooms',
        description: 'Authentic Kanchipuram, Banarasi, Dharmavaram, and Arani pure silk sarees for weddings and festivals.',
        image: '/images/women-real.webp',
        tag: 'Silk Mark Certified',
        details: ['Kanchipuram Silk Sarees', 'Banarasi Zari Sarees', 'Pure Bridal Muhurtham Sarees', 'Traditional Handloom Silks']
      },
      {
        id: 'womenswear',
        code: '02',
        title: "Women's Collection",
        category: 'Party Wear & Festive Dresses',
        description: 'Beautiful lehengas, festive anarkalis, party gowns, and ready-to-wear salwar suits.',
        image: '/images/womens-festive-couture.png',
        tag: 'Festive Wear',
        details: ['Bridal Lehengas', 'Festive Anarkalis', 'Designer Salwar Suits', 'Party Wear Sarees']
      },
      {
        id: 'menswear',
        code: '03',
        title: "Men's Collection",
        category: 'Shirts, Trousers & Kurtas',
        description: 'Fine cotton shirts, pure linen fabrics, festive silk kurtas, and formal trousers.',
        image: '/images/men.webp',
        tag: 'Perfect Fit',
        details: ['100% Pure Cotton Shirts', 'Pure Linen Fabrics', 'Festive Silk Kurtas', 'Formal Trousers & Suits']
      },
      {
        id: 'kids',
        code: '04',
        title: 'Kids Collection',
        category: 'Festive & Traditional Wear',
        description: 'Cute pure silk pattu pavadas for girls, dhoti-kurta sets for boys, and festive dresses.',
        image: '/images/coll-trousseau-1200.webp',
        tag: 'Soft & Safe Silk',
        details: ['Pure Silk Pattu Pavadas', 'Boys Dhoti & Kurta Sets', 'Comfortable Party Wear', 'Gentle Natural Fabrics']
      },
      {
        id: 'brands',
        code: '05',
        title: 'Branded Fabrics',
        category: 'Top Mill Brands',
        description: 'Top fabric brands for shirts and suits directly from trusted mills like Raymond and Linen Club.',
        image: '/images/brands.webp',
        tag: 'Original Brands',
        details: ['Raymond Suiting & Shirting', 'Linen Club Pure Linen', 'Arvind Premium Cottons', 'Grasim Fine Fabrics']
      },
      {
        id: 'home',
        code: '06',
        title: 'Home Furnishing',
        category: 'Bedsheets, Curtains & Living',
        description: 'Soft pure cotton bedsheets, beautiful window curtains, sofa covers, and table cloths.',
        image: '/images/home.webp',
        tag: 'Comfortable Living',
        details: ['Pure Cotton Bedsheets', 'Custom Window Curtains', 'Sofa Covers & Upholstery', 'Dining Table Covers']
      },
      {
        id: 'jewellery',
        code: '07',
        title: 'Wedding Jewellery',
        category: 'Traditional Gold & Antique Finishes',
        description: 'Temple necklaces, bridal sets, jhumkas, and accessories to match your wedding sarees.',
        image: '/images/jewellery.webp',
        tag: 'Bridal Sets',
        details: ['Temple Choker Sets', 'Antique Bridal Necklaces', 'Earrings & Jhumkas', 'Hair & Waist Accessories']
      },
      {
        id: 'wedding-coll',
        code: '08',
        title: 'Wedding Shopping',
        category: 'Complete Family Outfits',
        description: 'Everything for bride, groom, and family members in one easy, relaxed shopping visit.',
        image: '/images/wedding.webp',
        tag: 'Complete Family Sets',
        details: ['Matching Bride & Groom Outfits', 'Clothes for Family & Relatives', 'Wedding Gift Sarees', 'Special Wedding Packages']
      },
      {
        id: 'suits',
        code: '09',
        title: 'Custom Suits & Sherwanis',
        category: 'Tailored for Men',
        description: 'Royal sherwanis, bandhgalas, blazers, and 3-piece wedding suits tailored to your exact measurements.',
        image: '/images/suit.webp',
        tag: 'Custom Tailored',
        details: ['Perfect Body Measurements', 'Wedding Sherwanis & Kurta Sets', 'Classic Bandhgalas', 'Formal 3-Piece Suits']
      },
      {
        id: 'dozolo',
        code: '10',
        title: 'Modern Party Wear',
        category: 'Trendy Indo-Western Styles',
        description: 'Modern fusion dresses, stylish evening wear, and trendy outfits for celebrations.',
        image: '/images/women.webp',
        tag: 'Trendy Styles',
        details: ['Modern Indo-Western Wear', 'Crop Top & Skirt Sets', 'Party Wear Tunics', 'Stylish Festive Outfits']
      },
      {
        id: 'towels',
        code: '11',
        title: 'Luxury Bath Towels',
        category: '100% Pure Soft Cotton',
        description: 'Extra soft, thick, and quick-drying pure cotton bath towels, hand towels, and face towels.',
        image: '/images/towels.webp',
        tag: 'Extra Soft Cotton',
        details: ['Large Bath Towels', 'Soft Hand & Face Towels', 'Comfortable Bathrobes', 'Quick Absorbing Weave']
      },
      {
        id: 'other',
        code: '12',
        title: 'Accessories & Gifts',
        category: 'Dupattas, Dhotis & Stoles',
        description: 'Pure silk shawls, angavastrams, gold-border dhotis, matching potli bags, and gift items.',
        image: '/images/coll-temple-1200.webp',
        tag: 'Festive Accessories',
        details: ['Pure Silk Shawls', 'Zari Border Dhotis & Angavastrams', 'Matching Bridal Clutches', 'Gift Packaging Sets']
      }
    ] as CollectionItem[]
  },

  weddingExperience: {
    kicker: 'FAMILY WEDDING SHOPPING',
    title: 'Complete Wedding Shopping for Your Whole Family',
    subtitle: 'Dedicated private rooms, zero rush, and friendly helpers to assist every member of your family.',
    features: [
      {
        title: 'Private Family Rooms',
        desc: 'Spacious, cool air-conditioned rooms with comfortable sofa seating for up to 15 family members. Sit and relax while we show you our collections.'
      },
      {
        title: 'Dedicated Personal Assistant',
        desc: 'A friendly staff member stays with your family to help you pick matching colors, fabrics, and stay within your budget.'
      },
      {
        title: 'On-Counter Pure Silk Test',
        desc: 'We test the pure gold and silver zari in front of your family, giving you 100% confidence and peace of mind.'
      },
      {
        title: 'Matching Outfits for All',
        desc: 'Easily match the bride’s silk saree with the groom’s sherwani, plus matching clothes for parents and relatives.'
      }
    ],
    cta: {
      label: 'Register for Wedding Shopping',
      href: '/wedding/customer-registration'
    }
  },

  stores: [
    {
      id: 'belagavi',
      city: 'Belagavi Showroom',
      name: CENTRAL_STORE_LOCATIONS.BEL.storeName,
      badge: CENTRAL_STORE_LOCATIONS.BEL.badge,
      established: CENTRAL_STORE_LOCATIONS.BEL.established,
      address: CENTRAL_STORE_LOCATIONS.BEL.address,
      phone: CENTRAL_STORE_LOCATIONS.BEL.phone,
      email: CENTRAL_STORE_LOCATIONS.BEL.email,
      hours: CENTRAL_STORE_LOCATIONS.BEL.hours,
      departments: CENTRAL_STORE_LOCATIONS.BEL.departments,
      image: CENTRAL_STORE_LOCATIONS.BEL.image,
      mapsQuery: CENTRAL_STORE_LOCATIONS.BEL.mapsQuery,
      featured: true
    },
    {
      id: 'davanagere',
      city: 'Davanagere Showroom',
      name: CENTRAL_STORE_LOCATIONS.DAV.storeName,
      badge: CENTRAL_STORE_LOCATIONS.DAV.badge,
      established: CENTRAL_STORE_LOCATIONS.DAV.established,
      address: CENTRAL_STORE_LOCATIONS.DAV.address,
      phone: CENTRAL_STORE_LOCATIONS.DAV.phone,
      email: CENTRAL_STORE_LOCATIONS.DAV.email,
      hours: CENTRAL_STORE_LOCATIONS.DAV.hours,
      departments: CENTRAL_STORE_LOCATIONS.DAV.departments,
      image: CENTRAL_STORE_LOCATIONS.DAV.image,
      mapsQuery: CENTRAL_STORE_LOCATIONS.DAV.mapsQuery
    },
    {
      id: 'shivamogga',
      city: 'Shivamogga Showroom',
      name: CENTRAL_STORE_LOCATIONS.SHI.storeName,
      badge: CENTRAL_STORE_LOCATIONS.SHI.badge,
      established: CENTRAL_STORE_LOCATIONS.SHI.established,
      address: CENTRAL_STORE_LOCATIONS.SHI.address,
      phone: CENTRAL_STORE_LOCATIONS.SHI.phone,
      email: CENTRAL_STORE_LOCATIONS.SHI.email,
      hours: CENTRAL_STORE_LOCATIONS.SHI.hours,
      departments: CENTRAL_STORE_LOCATIONS.SHI.departments,
      image: CENTRAL_STORE_LOCATIONS.SHI.image,
      mapsQuery: CENTRAL_STORE_LOCATIONS.SHI.mapsQuery
    }
  ] as StoreLocationData[],

  shivamoggaEvent: {
    kicker: 'NEW SHOWROOM IN SHIVAMOGGA',
    title: 'Visit Our Grand Shivamogga Showroom',
    subtitle: 'Experience the largest textile and wedding shopping store in Malnad.',
    date: 'Now Open Daily',
    venue: 'BH Road, Near Durgigudi Main Road, Shivamogga, Karnataka',
    description:
      'We welcome you and your family to visit our grand new showroom in Shivamogga. Spread across multiple floors featuring pure silk sarees, wedding suits, sherwanis, and festive wear with private family seating.',
    highlights: [
      'Over 20,000 sq. ft. of comfortable shopping space',
      'Huge collection of pure Kanchipuram and Banarasi silk sarees',
      'Expert master tailors for custom suits and sherwanis',
      'Free valet car parking and family seating rooms'
    ],
    cta: {
      label: 'Get Directions on Map',
      mapsQuery: 'BSC Textiles Durgigudi Shivamogga'
    }
  },

  about: {
    kicker: 'OUR PROMISE TO YOU',
    title: 'Honest Quality. Pure Silk. Five Generations of Trust.',
    quote: '“We do not just sell cloth. We open the saree in your hands, test the pure zari before your eyes, and measure clothes to fit you comfortably.”',
    author: 'BSC Textiles Family',
    points: [
      {
        title: 'Direct from Weavers',
        desc: 'We work directly with over 400 skilled weaver families across Kanchipuram, Varanasi, Dharmavaram, and Gadwal, ensuring honest pricing and fair pay.'
      },
      {
        title: '100% Pure Silk Guarantee',
        desc: 'Every silk saree comes with an official Silk Mark of India tag. You can verify its pure authenticity anytime.'
      },
      {
        title: 'Generations of Family Trust',
        desc: 'Families who bought their wedding sarees with us decades ago continue to bring their children and grandchildren to BSC Textiles today.'
      }
    ]
  },

  contact: {
    kicker: 'CONTACT & VISIT US',
    title: 'We Are Happy to Help You',
    subtitle: 'Plan your visit, book your wedding shopping room, or call our store managers.',
    cards: [
      {
        title: 'Wedding Shopping',
        info: 'Book a free private room for your family',
        actionLabel: 'Register Online',
        href: '/wedding/customer-registration',
        icon: 'calendar'
      },
      {
        title: 'Customer Feedback',
        info: 'Tell us about your shopping experience with us',
        actionLabel: 'Send Feedback',
        href: '/feedback-public',
        icon: 'message'
      },
      {
        title: 'Work with Us',
        info: 'Join our friendly sales and showroom team',
        actionLabel: 'Apply for Job',
        href: '/apply',
        icon: 'briefcase'
      }
    ]
  }
};
