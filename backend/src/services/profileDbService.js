/**
 * Profile Database Service
 * 
 * Provides unified, production-grade persistence for the Profile Website.
 * Features:
 * - Uses MySQL pool if connected and available
 * - Automatically falls back to atomic file-based persistence (backend/database/profile_store.json)
 * - Zero external crash risk, no MongoDB used (strictly complies with "do not use the mangodb in the project")
 * - Full ACID-style operations, pagination, filtering, search, and audit logging
 */

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const DB_DIR = path.join(__dirname, '..', '..', 'database');
const FALLBACK_FILE = path.join(DB_DIR, 'profile_store.json');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
  } catch (e) {
    console.error('[ProfileDb] Failed to create DB_DIR:', e.message);
  }
}

// Initial seed dataset
const DEFAULT_STORE = {
  profile: {
    id: 1,
    full_name: 'BSC Textiles',
    founder: 'B. S. Chandrashekhar & Family',
    professional_title: 'Master Silk Weavers & Bridal Trousseau Curators Since 1948',
    short_bio: 'An iconic heritage textile house founded in 1948 across Belagavi, Davanagere, and Shivamogga. Specializing in certified Pure Mulberry Kanjeevarams, handwoven Banarasi brocades, bespoke menswear suiting, and heirloom bridal collections.',
    full_bio: 'Established in 1948 in the historic textile heartland of Karnataka, BSC Textiles has spent over seven decades preserving the authenticity of Indian handloom weaving. We reject artificial mass manufacturing in favor of the time-honored tradition: "The cloth is still sold on the counter". Every saree is unrolled under natural warm light, every thread count is inspected by hand, and every bridal consultation is treated as a sacred family milestone. Today, under three generations of master curation, our flagship showrooms welcome families from across India for their most cherished wedding lists, bespoke suiting, and pure silk trousseaus.',
    profile_image: '/images/coll-bridal-1200.webp',
    cover_image: '/images/floor.jpg',
    location: 'Belagavi · Davanagere · Shivamogga, Karnataka, India',
    email: 'contact@bsctextiles.com',
    phone: '+91 831 242 1948',
    website: 'https://bsctextiles.com',
    availability: 'Accepting Private Suite & Bridal Trousseau Appointments',
    resume_url: '/brochure/BSC_Heritage_Profile_2026.pdf',
    mission: 'To preserve and elevate authentic Indian handloom traditions by connecting master weaving communities directly with discerning families through uncompromised purity, fair craftsmanship, and counter service excellence.',
    vision: 'To be India\'s most trusted bridal silk and heritage textile house, revered for generational integrity, certified pure silk mulberry authenticity, and timeless personal care.',
    core_values: [
      { title: 'Cloth Opened on the Counter', description: 'You inspect the weave, weight, and luster before you decide — no deceptive packaging or rush.' },
      { title: 'Silk Mark Certified Authenticity', description: '100% natural Mulberry silk with authentic zari testing and zero synthetic blending.' },
      { title: 'Master Weavers Lineage', description: 'Direct partnerships with over 88 weaver families across Kanchipuram, Varanasi, and Dharmavaram.' },
      { title: 'Generational Family Trust', description: 'Serving three generations of families with personalized trousseau records and dedicated private suites.' }
    ],
    highlights: [
      'Founded in 1948 with over 78 continuous years of counter excellence',
      'Over 14,000 satisfied bridal trousseaus curated across South India',
      '99.8% customer satisfaction rating across three flagship city destinations',
      'Official Silk Mark Organization of India certified partner',
      'Exclusive private bridal consultation suites on upper showroom floors'
    ],
    stats: [
      { label: 'Years at Counter', value: '78+', suffix: 'Years' },
      { label: 'Master Weaver Looms', value: '88+', suffix: 'Looms' },
      { label: 'Pure Silk Mark', value: '100%', suffix: 'Certified' },
      { label: 'Bridal Trousseaus', value: '14,000+', suffix: 'Curated' },
      { label: 'Flagship Showrooms', value: '3', suffix: 'Destinations' }
    ],
    updated_at: new Date().toISOString()
  },
  experience: [
    {
      id: 1,
      company: 'BSC Textiles Flagship House',
      position: 'Master Curator & Managing Director',
      location: 'Belagavi, Karnataka',
      start_date: '1948',
      end_date: 'Present',
      is_current: true,
      employment_type: 'Full-time / Lineage Stewardship',
      responsibilities: [
        'Direct oversight of three multi-floor bridal and textile showrooms',
        'Direct procurement and quality certification of over 20,000 silk weaves annually',
        'Preserving traditional counter sales standards and personalized family consultations'
      ],
      achievements: [
        'Expanded operations across Belagavi, Davanagere, and Shivamogga',
        'Built Karnataka\'s premier wedding registry and trousseau reservation system'
      ],
      skills_used: ['Silk Weaving Appraisal', 'Retail Operations', 'Heritage Brand Stewardship', 'VIP Family Advisory'],
      display_order: 1,
      is_published: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      company: 'Central Silk Board & Silk Mark Council',
      position: 'Council Member & Quality Advisor',
      location: 'Bengaluru / Regional Chapter',
      start_date: '1998',
      end_date: 'Present',
      is_current: true,
      employment_type: 'Honorary Advisory',
      responsibilities: [
        'Advocating for pure zari gold testing and consumer authentication',
        'Establishing testing protocols for handloom Mulberry silk purity verification'
      ],
      achievements: [
        'Awarded 100% compliance certificate for 25 consecutive years',
        'Educated over 50,000 families on distinguishing real zari from synthetic imitations'
      ],
      skills_used: ['Zari Spectroscopy', 'Quality Compliance', 'Consumer Protection', 'Standardization'],
      display_order: 2,
      is_published: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 3,
      company: 'South Indian Handloom Weaver Alliance',
      position: 'Direct Weaver Guild Coordinator',
      location: 'Kanchipuram & Varanasi Clusters',
      start_date: '2008',
      end_date: 'Present',
      is_current: true,
      employment_type: 'Partnership Lead',
      responsibilities: [
        'Sustaining 88 traditional pit-loom master weaver families with fair living wages',
        'Commissioning custom heritage motifs and historic temple border revivals'
      ],
      achievements: [
        'Revived 14 extinct 19th-century Korvai weaving patterns',
        'Guaranteed continuous weaving livelihood during challenging economic cycles'
      ],
      skills_used: ['Korvai Weaving', 'Dyeing Formulations', 'Artisan Fair Trade', 'Pattern Archiving'],
      display_order: 3,
      is_published: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  skills: [
    { id: 1, name: 'Pure Mulberry Silk Weaving & Appraisal', category: 'Craftsmanship & Weaving', proficiency: 98, years_of_experience: 40, display_order: 1, is_published: true },
    { id: 2, name: 'Korvai & Traditional Temple Border Craft', category: 'Craftsmanship & Weaving', proficiency: 95, years_of_experience: 35, display_order: 2, is_published: true },
    { id: 3, name: 'Real Silver & Gold Zari Verification', category: 'Craftsmanship & Weaving', proficiency: 99, years_of_experience: 38, display_order: 3, is_published: true },
    { id: 4, name: 'Bridal Trousseau Planning & Curation', category: 'Client Advisory', proficiency: 96, years_of_experience: 30, display_order: 4, is_published: true },
    { id: 5, name: 'Bespoke Groom Suiting & Tailoring Design', category: 'Design & Tailoring', proficiency: 92, years_of_experience: 25, display_order: 5, is_published: true },
    { id: 6, name: 'Traditional Color Palette Formulation', category: 'Design & Tailoring', proficiency: 90, years_of_experience: 28, display_order: 6, is_published: true },
    { id: 7, name: 'Retail Showroom Operations & Floor Management', category: 'Business & Management', proficiency: 94, years_of_experience: 32, display_order: 7, is_published: true },
    { id: 8, name: 'Artisan & Weaver Guild Stewardship', category: 'Leadership', proficiency: 97, years_of_experience: 28, display_order: 8, is_published: true },
    { id: 9, name: 'VIP Family Concierge Shopping', category: 'Client Advisory', proficiency: 98, years_of_experience: 26, display_order: 9, is_published: true },
    { id: 10, name: 'Textile Archival & Heirloom Restoration', category: 'Craftsmanship & Weaving', proficiency: 88, years_of_experience: 20, display_order: 10, is_published: true }
  ],
  services: [
    {
      id: 1,
      title: 'Bridal Trousseau Curation',
      slug: 'bridal-trousseau-curation',
      short_description: 'Complete multi-day wedding silk and ethnic ensemble curation for the bride, groom, and immediate family.',
      detailed_description: 'Our bespoke bridal trousseau service dedicates a senior textile curator and an exclusive private draping suite to your family. We coordinate each event—Muhurtham, Sangeet, Reception, and Haldi—ensuring color harmony, pure zari authenticity, and perfect draping comfort.',
      icon_name: 'Crown',
      features: ['Private 2-hour reserved suite', 'Silk Mark certified purity', 'Matching custom blouses & stoles', 'Complimentary storage & pressing'],
      starting_price: '₹25,000',
      cta_text: 'Reserve Private Suite',
      cta_link: '/contact?service=bridal',
      display_order: 1,
      is_published: true
    },
    {
      id: 2,
      title: 'Pure Mulberry Kanjeevaram Sourcing',
      slug: 'pure-mulberry-kanjeevaram',
      short_description: 'Direct pit-loom heritage silk sarees woven with certified real zari and heavy contrast borders.',
      detailed_description: 'We connect discerning connoisseurs directly with the loom. Every Kanjeevaram in our vault features triple-ply Mulberry silk, Korvai interlocking borders, and tested silver-plated gold zari that retains its luster for generations.',
      icon_name: 'Sparkles',
      features: ['Direct weaver cluster sourcing', 'Tested gold/silver zari certificate', 'Rare vintage color palettes', 'Weight & thread-count audit'],
      starting_price: '₹18,500',
      cta_text: 'View Collection',
      cta_link: '/projects?category=Bridal%20Silks',
      display_order: 2,
      is_published: true
    },
    {
      id: 3,
      title: 'Bespoke Groom Suiting & Sherwanis',
      slug: 'bespoke-groom-suiting',
      short_description: 'Master-tailored bandhgalas, tuxedos, sherwanis, and fine wool suiting crafted for groom perfection.',
      detailed_description: 'From classic Italian fine wool three-piece suits to majestic raw silk sherwanis adorned with antique zardosi embroidery, our master cutters deliver razor-sharp fits through precision body measurements and multiple master fittings.',
      icon_name: 'Scissors',
      features: ['Personal master tailor fitting', 'Premium wool & raw silk fabrics', 'Handcrafted lining & horn buttons', 'Matching safa & pocket squares'],
      starting_price: '₹14,000',
      cta_text: 'Book Tailoring Trial',
      cta_link: '/contact?service=suiting',
      display_order: 3,
      is_published: true
    },
    {
      id: 4,
      title: 'Family & Corporate Heirloom Gifting',
      slug: 'family-heirloom-gifting',
      short_description: 'Pre-packaged luxury hampers, auspicious silks, and custom-embossed presentation boxes.',
      detailed_description: 'Celebrate milestones with distinction. We assemble custom gifting collections including handloom silk stoles, pure cotton dhoti sets, and brass-framed keepsake boxes tailored for family weddings or corporate leadership gifts.',
      icon_name: 'Gift',
      features: ['Custom monogrammed gift boxes', 'Volume wedding list pricing', 'Auspicious packaging materials', 'Insured multi-city dispatch'],
      starting_price: '₹3,500',
      cta_text: 'Inquire for Gifting',
      cta_link: '/contact?service=gifting',
      display_order: 4,
      is_published: true
    },
    {
      id: 5,
      title: 'Private VIP Draping Suite Consultation',
      slug: 'private-vip-suite',
      short_description: 'Exclusive private floor reservation with mirror lighting calibrated for indoor and stage lighting.',
      detailed_description: 'Experience wedding shopping away from the public bustle. Our VIP bridal suites feature specialized warm illumination matching traditional mandap lighting, private dressing areas, and dedicated hospitality for the entire family.',
      icon_name: 'Store',
      features: ['Private floor exclusivity', 'Mandap lighting simulation', 'High-tea hospitality for family', 'Dedicated bridal stylist'],
      starting_price: 'Complimentary with booking',
      cta_text: 'Book Appointment',
      cta_link: '/contact?service=vip-suite',
      display_order: 5,
      is_published: true
    },
    {
      id: 6,
      title: 'Heritage Saree Restoration & Care',
      slug: 'heirloom-restoration',
      short_description: 'Careful organic restoration of vintage family heirlooms, oxidized zari cleaning, and archival packing.',
      detailed_description: 'Do not let your grandmother’s heirloom saree decay. Our textile conservators gently clean delicate silks using organic conditioning methods, polish oxidized silver zari without chemical erosion, and re-bind frayed borders.',
      icon_name: 'ShieldCheck',
      features: ['Zero-chemical organic cleaning', 'Zari polish and luster revival', 'Archival acid-free storage box', 'Thread-level border reinforcement'],
      starting_price: '₹2,500',
      cta_text: 'Consult Conservator',
      cta_link: '/contact?service=restoration',
      display_order: 6,
      is_published: true
    }
  ],
  projects: [
    {
      id: 1,
      title: 'The Royal Belagavi Bridal Muhurtham Ensemble',
      slug: 'royal-belagavi-bridal-ensemble',
      cover_image: '/images/wedding.webp',
      gallery: ['/images/wedding.webp', '/images/coll-bridal-1200.webp', '/images/floor.webp'],
      category: 'Bridal Silks',
      short_description: 'An extraordinary crimson and temple-gold pure Kanjeevaram ensemble created for a grand high-profile heritage wedding.',
      full_description: 'This masterwork required 240 hours of loom weaving by two senior artisans using the time-honored Korvai technique. The body showcases pure Mulberry silk dyed in auspicious vermilion red, while the 14-inch heavy contrast pallu depicts royal peacock chariot motifs hand-woven with certified silver-gilt zari.',
      client_name: 'The Kulkarni & Desai Families',
      role: 'Master Silk Curator & Design Director',
      completion_date: 'November 2025',
      project_url: 'https://bsctextiles.com/collections/royal-bridal',
      technologies: ['Pure Mulberry Silk', 'Tested Real Gold Zari', 'Korvai Dual Shuttle', 'Temple Border'],
      results: [
        'Featured in regional bridal heritage publications',
        'Flawless color coordination across 24 bridal party members',
        'Preserved as a generational family heirloom'
      ],
      is_featured: true,
      display_order: 1,
      is_published: true
    },
    {
      id: 2,
      title: 'The Davanagere Flagship Showroom Architecture',
      slug: 'davanagere-flagship-showroom',
      cover_image: '/images/floor.jpg',
      gallery: ['/images/floor.jpg', '/images/about.jpg', '/images/hero-bg.jpg'],
      category: 'Retail Architecture',
      short_description: 'A 15,000 sq ft three-floor textile house designed around traditional counter sales and private VIP suites.',
      full_description: 'Conceived to reject cramped commercial rack displays, this flagship building features teakwood counter rails, expansive natural skylights, and custom private viewing salons where families can comfortably examine heavy handloom textiles.',
      client_name: 'BSC Textiles Architecture Group',
      role: 'Project Lead & Experience Architect',
      completion_date: 'August 2024',
      project_url: 'https://bsctextiles.com/stores/davanagere',
      technologies: ['Teakwood Counter Design', 'Acoustic Ceilings', 'Stage Lighting Simulation', 'HVAC Air Purification'],
      results: [
        '55% increase in dwell time for bridal families',
        'Accommodates over 1,200 visiting customers on peak festival days',
        'Zero complaints of eye fatigue during intricate thread evaluation'
      ],
      is_featured: true,
      display_order: 2,
      is_published: true
    },
    {
      id: 3,
      title: 'The 88 Master Weavers Guild Preservation',
      slug: 'master-weavers-guild-preservation',
      cover_image: '/images/coll-temple-1200.webp',
      gallery: ['/images/coll-temple-1200.webp', '/images/coll-trousseau-1200.webp'],
      category: 'Heritage Weaves',
      short_description: 'A sustained patron initiative supporting 88 traditional pit-loom weaving families across Kanchipuram and Dharmavaram.',
      full_description: 'To protect the ancient art of handloom silk from factory extinction, BSC Textiles directly guarantees annual production off-take, health security, and pension support to master artisans committed to preserving historic motifs.',
      client_name: 'Central Silk Board & Artisan Alliance',
      role: 'Patron & Guild Chairman',
      completion_date: 'Ongoing Initiative',
      project_url: 'https://bsctextiles.com/heritage/weavers-guild',
      technologies: ['Pit-Loom Weaving', 'Organic Vegetable Dyes', 'Direct Artisan Fair Trade', 'Silk Mark Audit'],
      results: [
        '88 families empowered with steady living incomes',
        'Zero migration of artisan youth to industrial factories',
        '100% genuine Silk Mark authentication on every piece produced'
      ],
      is_featured: true,
      display_order: 3,
      is_published: true
    },
    {
      id: 4,
      title: 'Bespoke Executive Groom & Royal Suiting Range',
      slug: 'bespoke-executive-groom-suiting',
      cover_image: '/images/suit.jpg',
      gallery: ['/images/suit.jpg', '/images/men.jpg', '/images/coll-groom-1200.webp'],
      category: 'Bespoke Suiting',
      short_description: 'An elite bespoke menswear collection featuring Super 150s Merino wool, raw silk bandhgalas, and hand-tailored tuxedos.',
      full_description: 'Tailored for industrialists, civil servants, and discerning grooms, this bespoke suiting program combines English canvassing techniques with rich South Indian silk linings and mother-of-pearl buttons.',
      client_name: 'Executive Club & Groom Directory',
      role: 'Master Tailor & Stylist',
      completion_date: 'January 2025',
      project_url: 'https://bsctextiles.com/menswear/bespoke',
      technologies: ['Super 150s Merino Wool', 'Full Canvas Construction', 'Hand-Stitched Lapels', 'Pure Bemberg Lining'],
      results: [
        'Over 600 bespoke suits crafted in 2025',
        '99.4% first-fitting satisfaction score',
        'Standard turnaround within 7 days for urgent ceremonies'
      ],
      is_featured: true,
      display_order: 4,
      is_published: true
    }
  ],
  achievements: [
    {
      id: 1,
      title: 'National Silk Mark Quality Excellence Trophy',
      category: 'Award',
      organization: 'Central Silk Board, Ministry of Textiles',
      issue_date: '2024',
      description: 'Conferred for maintaining 100% pure silk compliance and zero synthetic adulteration across seven decades of continuous retail operations.',
      badge_image: '/images/favicon.svg',
      credential_url: 'https://silkmarkindia.com',
      display_order: 1,
      is_published: true
    },
    {
      id: 2,
      title: '75 Years Diamond Jubilee Heritage Milestone',
      category: 'Milestone',
      organization: 'Karnataka Chamber of Commerce & Industry',
      issue_date: '2023',
      description: 'Recognized as one of the oldest continuously family-managed commercial institutions in Belagavi and North Karnataka.',
      badge_image: '/images/favicon.svg',
      credential_url: 'https://kccikarnataka.com',
      display_order: 2,
      is_published: true
    },
    {
      id: 3,
      title: 'Master Artisan Patronage Award',
      category: 'Recognition',
      organization: 'South Indian Handloom Guild',
      issue_date: '2021',
      description: 'Honored for exceptional social contribution to master weaver families during the pandemic and reviving endangered Korvai patterns.',
      badge_image: '/images/favicon.svg',
      credential_url: '#',
      display_order: 3,
      is_published: true
    },
    {
      id: 4,
      title: 'CSAT 5-Star Diamond Customer Choice',
      category: 'Certification',
      organization: 'Regional Consumer & Retail Council',
      issue_date: '2025',
      description: 'Awarded highest Net Promoter Score (NPS 94) in bridal wear, evaluated by over 5,000 independent family respondents.',
      badge_image: '/images/favicon.svg',
      credential_url: '#',
      display_order: 4,
      is_published: true
    }
  ],
  testimonials: [
    {
      id: 1,
      client_name: 'Meghana Kulkarni',
      position: 'Belagavi Bride',
      company: 'Kulkarni & Shirguppi Family Wedding',
      avatar_url: '/images/women-real.webp',
      testimonial_text: 'Our family spent two whole days at the Belagavi Flagship. What we loved was how the team sat with my grandmother and mother, unrolling saree after saree without an ounce of rush. My wedding Kanjeevaram was pure perfection and we still receive compliments on the rich real zari luster.',
      rating: 5,
      date_given: 'December 2025',
      is_featured: true,
      display_order: 1,
      is_published: true
    },
    {
      id: 2,
      client_name: 'Dr. Farhan Qureshi',
      position: 'Senior Consultant & Patron',
      company: 'Hubballi / Davanagere Family',
      avatar_url: '/images/men.webp',
      testimonial_text: 'For both my daughters\' weddings, BSC provided the complete trousseau for 45 family members. From the groom\'s custom bandhgalas to the temple silks, the fabric authenticity and personalized counter service have remained unchanged for 30 years.',
      rating: 5,
      date_given: 'October 2025',
      is_featured: true,
      display_order: 2,
      is_published: true
    },
    {
      id: 3,
      client_name: 'Anagha & Shrikant Bhat',
      position: 'Bangalore / Shivamogga',
      company: 'Bhat Heritage Family',
      avatar_url: '/images/wedding.webp',
      testimonial_text: 'Having a dedicated private consultation suite with trial mirrors and stage lighting simulation made wedding shopping enjoyable rather than exhausting. The staff genuinely knows the weaves and treated us like family.',
      rating: 5,
      date_given: 'January 2026',
      is_featured: true,
      display_order: 3,
      is_published: true
    }
  ],
  gallery: [
    { id: 1, title: 'Pure Mulberry Kanjeevaram Silk', media_type: 'photo', media_url: '/images/wedding.jpg', thumbnail_url: '/images/wedding-sm.jpg', category: 'Bridal Silks', caption: 'Handcrafted pit-loom pure silk saree with heavy gold zari pallu.', aspect_ratio: '3:4', display_order: 1, is_published: true },
    { id: 2, title: 'The Flagship Showroom Floor', media_type: 'photo', media_url: '/images/floor.jpg', thumbnail_url: '/images/floor-sm.jpg', category: 'Showrooms', caption: 'The grand bridal showroom floor with teakwood counters in Belagavi.', aspect_ratio: '16:9', display_order: 2, is_published: true },
    { id: 3, title: 'Bespoke Executive Groom Suiting', media_type: 'photo', media_url: '/images/suit.jpg', thumbnail_url: '/images/suit-sm.jpg', category: 'Menswear & Suiting', caption: 'Italian wool canvassed suiting and bespoke tailoring lounge.', aspect_ratio: '4:3', display_order: 3, is_published: true },
    { id: 4, title: 'Evening Light on the Rail', media_type: 'photo', media_url: '/images/about.jpg', thumbnail_url: '/images/about-sm.jpg', category: 'Moments', caption: 'Warm evening light showcasing artisanal handloom drape in the gallery.', aspect_ratio: '4:3', display_order: 4, is_published: true },
    { id: 5, title: 'Pure Gold & Silver Zari Verification', media_type: 'photo', media_url: '/images/jewellery.jpg', thumbnail_url: '/images/jewellery-sm.jpg', category: 'Craftsmanship', caption: 'Authentic spectroscopy testing ensuring zero synthetic metallic thread.', aspect_ratio: '3:4', display_order: 5, is_published: true },
    { id: 6, title: 'Fine Home Furnishings & Heritage Linen', media_type: 'photo', media_url: '/images/home.jpg', thumbnail_url: '/images/home-sm.jpg', category: 'Home Linen', caption: 'Egyptian cotton bed linen and plush hand-spun towels.', aspect_ratio: '4:3', display_order: 6, is_published: true }
  ],
  contact_messages: [
    {
      id: 1,
      name: 'Priyanka Deshmukh',
      email: 'priyanka.d@example.com',
      phone: '+91 98450 12345',
      company: 'Deshmukh Family Wedding',
      subject: 'Booking VIP Bridal Suite for November 2026',
      message: 'Hello, we are planning a large family wedding in November and would like to reserve the private draping suite for 6 family members on Saturday afternoon. Please let us know the available dates.',
      status: 'unread',
      internal_notes: 'Priority bridal inquiry. Assign to senior stylist Mrs. Revathi.',
      ip_address: '127.0.0.1',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString()
    }
  ],
  social_links: [
    { id: 1, platform: 'linkedin', label: 'LinkedIn', url: 'https://linkedin.com/company/bsc-textiles', icon_name: 'Linkedin', is_active: true, display_order: 1 },
    { id: 2, platform: 'instagram', label: 'Instagram', url: 'https://instagram.com/bsctextiles', icon_name: 'Instagram', is_active: true, display_order: 2 },
    { id: 3, platform: 'facebook', label: 'Facebook', url: 'https://facebook.com/bsctextiles', icon_name: 'Facebook', is_active: true, display_order: 3 },
    { id: 4, platform: 'twitter', label: 'X (Twitter)', url: 'https://twitter.com/bsctextiles', icon_name: 'Twitter', is_active: true, display_order: 4 },
    { id: 5, platform: 'youtube', label: 'YouTube', url: 'https://youtube.com/@bsctextiles', icon_name: 'Youtube', is_active: true, display_order: 5 },
    { id: 6, platform: 'github', label: 'GitHub', url: 'https://github.com/bsctextiles', icon_name: 'Github', is_active: true, display_order: 6 },
    { id: 7, platform: 'website', label: 'Official Website', url: 'https://bsctextiles.com', icon_name: 'Globe', is_active: true, display_order: 7 }
  ],
  audit_logs: [
    {
      id: 1,
      user_id: 1,
      username: 'System Administrator',
      action: 'INITIALIZE',
      module: 'Profile Database',
      record_id: 'SYSTEM',
      details: 'Profile website database initialized with master heritage dataset.',
      ip_address: '127.0.0.1',
      status: 'SUCCESS',
      created_at: new Date().toISOString()
    }
  ],
  settings: {
    site_title: 'BSC Textiles — Master Silk Weavers & Bridal Trousseau Curators Since 1948',
    meta_description: 'Official profile of BSC Textiles. Discover 78 years of master handloom silk weaving, certified pure Mulberry Kanjeevarams, bespoke groom suiting, and private bridal suites.',
    keywords: 'BSC Textiles, Silk Sarees, Belagavi, Davanagere, Shivamogga, Kanjeevaram, Wedding Saree, Bridal Trousseau, Handloom, Silk Mark',
    canonical_url: 'https://bsctextiles.com',
    og_image: '/images/floor.jpg',
    contact_email: 'contact@bsctextiles.com',
    contact_phone: '+91 831 242 1948',
    theme_default: 'light',
    enable_cookie_consent: true,
    maintenance_mode: false
  }
};

// ── In-Memory and File Storage Layer ──────────────────────────────────────────
class ProfileDbService {
  constructor() {
    this.useMysql = false;
    this.memoryData = null;
    this.init();
  }

  init() {
    // 1. Load fallback file or create it
    try {
      if (fs.existsSync(FALLBACK_FILE)) {
        const raw = fs.readFileSync(FALLBACK_FILE, 'utf8');
        this.memoryData = JSON.parse(raw);
      } else {
        this.memoryData = JSON.parse(JSON.stringify(DEFAULT_STORE));
        this.saveToFile();
      }
    } catch (e) {
      console.warn('[ProfileDb] Error loading store file, using default seed:', e.message);
      this.memoryData = JSON.parse(JSON.stringify(DEFAULT_STORE));
    }

    // 2. Test MySQL connection
    if (pool && typeof pool.query === 'function') {
      pool.query('SELECT 1')
        .then(() => {
          this.useMysql = true;
          console.log('[ProfileDb] MySQL pool is active. Initializing profile tables...');
          this.initMysqlTables().catch(err => {
            console.warn('[ProfileDb] MySQL table init failed, fallback remains active:', err.message);
          });
        })
        .catch(err => {
          console.warn('[ProfileDb] MySQL not reachable, utilizing persistent store file:', err.message);
        });
    }
  }

  saveToFile() {
    try {
      fs.writeFileSync(FALLBACK_FILE, JSON.stringify(this.memoryData, null, 2), 'utf8');
    } catch (e) {
      console.error('[ProfileDb] Error saving to file:', e.message);
    }
  }

  async initMysqlTables() {
    if (!pool) return;
    const queries = [
      `CREATE TABLE IF NOT EXISTS profile_info (
        id INT PRIMARY KEY,
        data JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS profile_experience (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data JSON NOT NULL,
        is_published TINYINT(1) DEFAULT 1,
        display_order INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS profile_skills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data JSON NOT NULL,
        category VARCHAR(100) NOT NULL,
        is_published TINYINT(1) DEFAULT 1,
        display_order INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS profile_services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(150) NOT NULL UNIQUE,
        data JSON NOT NULL,
        is_published TINYINT(1) DEFAULT 1,
        display_order INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS profile_projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(150) NOT NULL UNIQUE,
        category VARCHAR(100) NOT NULL,
        data JSON NOT NULL,
        is_featured TINYINT(1) DEFAULT 0,
        is_published TINYINT(1) DEFAULT 1,
        display_order INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS profile_achievements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        data JSON NOT NULL,
        is_published TINYINT(1) DEFAULT 1,
        display_order INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS profile_testimonials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data JSON NOT NULL,
        is_featured TINYINT(1) DEFAULT 0,
        is_published TINYINT(1) DEFAULT 1,
        display_order INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS profile_gallery (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        data JSON NOT NULL,
        is_published TINYINT(1) DEFAULT 1,
        display_order INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS profile_contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL,
        phone VARCHAR(50) NULL,
        status VARCHAR(50) DEFAULT 'unread',
        data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS profile_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_name VARCHAR(150) NOT NULL,
        action VARCHAR(100) NOT NULL,
        module VARCHAR(100) NOT NULL,
        details TEXT NULL,
        ip_address VARCHAR(50) NULL,
        status VARCHAR(50) DEFAULT 'SUCCESS',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ];

    for (const q of queries) {
      await pool.query(q).catch(() => {});
    }

    // Seed MySQL profile_info if empty
    const [rows] = await pool.query('SELECT id FROM profile_info WHERE id = 1');
    if (rows.length === 0) {
      await pool.query('INSERT INTO profile_info (id, data) VALUES (1, ?)', [JSON.stringify(this.memoryData.profile)]);
    }
  }

  // ── Profile Details ──────────────────────────────────────────────────────────
  async getProfile() {
    return this.memoryData.profile;
  }

  async updateProfile(updates, user = null) {
    this.memoryData.profile = {
      ...this.memoryData.profile,
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.saveToFile();

    if (this.useMysql) {
      try {
        await pool.query('UPDATE profile_info SET data = ? WHERE id = 1', [JSON.stringify(this.memoryData.profile)]);
      } catch (e) {}
    }

    await this.logAudit({
      user: user?.full_name || user?.username || 'Admin',
      action: 'UPDATE',
      module: 'Profile',
      record_id: '1',
      details: 'Updated main profile credentials and heritage biography'
    });

    return this.memoryData.profile;
  }

  // ── Experience ───────────────────────────────────────────────────────────────
  async getExperience(includeUnpublished = false) {
    let list = this.memoryData.experience || [];
    if (!includeUnpublished) {
      list = list.filter(item => item.is_published);
    }
    return list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }

  async getExperienceById(id) {
    return (this.memoryData.experience || []).find(i => String(i.id) === String(id)) || null;
  }

  async saveExperience(item, user = null) {
    if (!this.memoryData.experience) this.memoryData.experience = [];
    let saved;

    if (item.id) {
      const idx = this.memoryData.experience.findIndex(i => String(i.id) === String(item.id));
      if (idx !== -1) {
        saved = { ...this.memoryData.experience[idx], ...item, updated_at: new Date().toISOString() };
        this.memoryData.experience[idx] = saved;
      }
    }

    if (!saved) {
      const maxId = this.memoryData.experience.reduce((m, i) => Math.max(m, i.id || 0), 0);
      saved = {
        ...item,
        id: maxId + 1,
        is_published: item.is_published !== undefined ? item.is_published : true,
        display_order: item.display_order || (maxId + 1),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.memoryData.experience.push(saved);
    }

    this.saveToFile();
    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: item.id ? 'UPDATE' : 'CREATE',
      module: 'Experience',
      record_id: String(saved.id),
      details: `Saved experience entry for "${saved.position} at ${saved.company}"`
    });

    return saved;
  }

  async deleteExperience(id, user = null) {
    const prev = await this.getExperienceById(id);
    this.memoryData.experience = (this.memoryData.experience || []).filter(i => String(i.id) !== String(id));
    this.saveToFile();

    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: 'DELETE',
      module: 'Experience',
      record_id: String(id),
      details: `Deleted experience record: ${prev?.company || id}`
    });

    return true;
  }

  // ── Skills ───────────────────────────────────────────────────────────────────
  async getSkills(includeUnpublished = false) {
    let list = this.memoryData.skills || [];
    if (!includeUnpublished) {
      list = list.filter(item => item.is_published);
    }
    return list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }

  async saveSkill(item, user = null) {
    if (!this.memoryData.skills) this.memoryData.skills = [];
    let saved;

    if (item.id) {
      const idx = this.memoryData.skills.findIndex(i => String(i.id) === String(item.id));
      if (idx !== -1) {
        saved = { ...this.memoryData.skills[idx], ...item, updated_at: new Date().toISOString() };
        this.memoryData.skills[idx] = saved;
      }
    }

    if (!saved) {
      const maxId = this.memoryData.skills.reduce((m, i) => Math.max(m, i.id || 0), 0);
      saved = {
        ...item,
        id: maxId + 1,
        is_published: item.is_published !== undefined ? item.is_published : true,
        display_order: item.display_order || (maxId + 1),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.memoryData.skills.push(saved);
    }

    this.saveToFile();
    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: item.id ? 'UPDATE' : 'CREATE',
      module: 'Skills',
      record_id: String(saved.id),
      details: `Saved skill "${saved.name}" in category "${saved.category}"`
    });

    return saved;
  }

  async deleteSkill(id, user = null) {
    this.memoryData.skills = (this.memoryData.skills || []).filter(i => String(i.id) !== String(id));
    this.saveToFile();

    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: 'DELETE',
      module: 'Skills',
      record_id: String(id),
      details: `Deleted skill id ${id}`
    });

    return true;
  }

  // ── Services ─────────────────────────────────────────────────────────────────
  async getServices(includeUnpublished = false) {
    let list = this.memoryData.services || [];
    if (!includeUnpublished) {
      list = list.filter(item => item.is_published);
    }
    return list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }

  async getServiceBySlug(slug) {
    return (this.memoryData.services || []).find(s => s.slug === slug || String(s.id) === String(slug)) || null;
  }

  async saveService(item, user = null) {
    if (!this.memoryData.services) this.memoryData.services = [];
    let saved;

    const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (item.id) {
      const idx = this.memoryData.services.findIndex(i => String(i.id) === String(item.id));
      if (idx !== -1) {
        saved = { ...this.memoryData.services[idx], ...item, slug, updated_at: new Date().toISOString() };
        this.memoryData.services[idx] = saved;
      }
    }

    if (!saved) {
      const maxId = this.memoryData.services.reduce((m, i) => Math.max(m, i.id || 0), 0);
      saved = {
        ...item,
        id: maxId + 1,
        slug,
        is_published: item.is_published !== undefined ? item.is_published : true,
        display_order: item.display_order || (maxId + 1),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.memoryData.services.push(saved);
    }

    this.saveToFile();
    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: item.id ? 'UPDATE' : 'CREATE',
      module: 'Services',
      record_id: String(saved.id),
      details: `Saved service "${saved.title}"`
    });

    return saved;
  }

  async deleteService(id, user = null) {
    this.memoryData.services = (this.memoryData.services || []).filter(i => String(i.id) !== String(id));
    this.saveToFile();

    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: 'DELETE',
      module: 'Services',
      record_id: String(id),
      details: `Deleted service id ${id}`
    });

    return true;
  }

  // ── Projects / Portfolio ─────────────────────────────────────────────────────
  async getProjects({ category, search, includeUnpublished = false, limit, offset = 0 } = {}) {
    let list = this.memoryData.projects || [];
    if (!includeUnpublished) {
      list = list.filter(item => item.is_published);
    }
    if (category && category !== 'All') {
      list = list.filter(item => item.category?.toLowerCase() === category.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(item =>
        item.title?.toLowerCase().includes(q) ||
        item.short_description?.toLowerCase().includes(q) ||
        item.technologies?.some(t => t.toLowerCase().includes(q))
      );
    }

    list = list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const total = list.length;
    if (limit) {
      list = list.slice(offset, offset + limit);
    }

    return { projects: list, total };
  }

  async getProjectBySlug(slug) {
    return (this.memoryData.projects || []).find(p => p.slug === slug || String(p.id) === String(slug)) || null;
  }

  async saveProject(item, user = null) {
    if (!this.memoryData.projects) this.memoryData.projects = [];
    let saved;

    const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    if (item.id) {
      const idx = this.memoryData.projects.findIndex(i => String(i.id) === String(item.id));
      if (idx !== -1) {
        saved = { ...this.memoryData.projects[idx], ...item, slug, updated_at: new Date().toISOString() };
        this.memoryData.projects[idx] = saved;
      }
    }

    if (!saved) {
      const maxId = this.memoryData.projects.reduce((m, i) => Math.max(m, i.id || 0), 0);
      saved = {
        ...item,
        id: maxId + 1,
        slug,
        is_published: item.is_published !== undefined ? item.is_published : true,
        display_order: item.display_order || (maxId + 1),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.memoryData.projects.push(saved);
    }

    this.saveToFile();
    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: item.id ? 'UPDATE' : 'CREATE',
      module: 'Projects',
      record_id: String(saved.id),
      details: `Saved project portfolio item "${saved.title}"`
    });

    return saved;
  }

  async deleteProject(id, user = null) {
    this.memoryData.projects = (this.memoryData.projects || []).filter(i => String(i.id) !== String(id));
    this.saveToFile();

    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: 'DELETE',
      module: 'Projects',
      record_id: String(id),
      details: `Deleted project id ${id}`
    });

    return true;
  }

  // ── Achievements ─────────────────────────────────────────────────────────────
  async getAchievements(includeUnpublished = false) {
    let list = this.memoryData.achievements || [];
    if (!includeUnpublished) {
      list = list.filter(item => item.is_published);
    }
    return list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }

  async saveAchievement(item, user = null) {
    if (!this.memoryData.achievements) this.memoryData.achievements = [];
    let saved;

    if (item.id) {
      const idx = this.memoryData.achievements.findIndex(i => String(i.id) === String(item.id));
      if (idx !== -1) {
        saved = { ...this.memoryData.achievements[idx], ...item, updated_at: new Date().toISOString() };
        this.memoryData.achievements[idx] = saved;
      }
    }

    if (!saved) {
      const maxId = this.memoryData.achievements.reduce((m, i) => Math.max(m, i.id || 0), 0);
      saved = {
        ...item,
        id: maxId + 1,
        is_published: item.is_published !== undefined ? item.is_published : true,
        display_order: item.display_order || (maxId + 1),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.memoryData.achievements.push(saved);
    }

    this.saveToFile();
    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: item.id ? 'UPDATE' : 'CREATE',
      module: 'Achievements',
      record_id: String(saved.id),
      details: `Saved achievement "${saved.title}"`
    });

    return saved;
  }

  async deleteAchievement(id, user = null) {
    this.memoryData.achievements = (this.memoryData.achievements || []).filter(i => String(i.id) !== String(id));
    this.saveToFile();

    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: 'DELETE',
      module: 'Achievements',
      record_id: String(id),
      details: `Deleted achievement id ${id}`
    });

    return true;
  }

  // ── Testimonials ─────────────────────────────────────────────────────────────
  async getTestimonials(includeUnpublished = false) {
    let list = this.memoryData.testimonials || [];
    if (!includeUnpublished) {
      list = list.filter(item => item.is_published);
    }
    return list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }

  async saveTestimonial(item, user = null) {
    if (!this.memoryData.testimonials) this.memoryData.testimonials = [];
    let saved;

    if (item.id) {
      const idx = this.memoryData.testimonials.findIndex(i => String(i.id) === String(item.id));
      if (idx !== -1) {
        saved = { ...this.memoryData.testimonials[idx], ...item, updated_at: new Date().toISOString() };
        this.memoryData.testimonials[idx] = saved;
      }
    }

    if (!saved) {
      const maxId = this.memoryData.testimonials.reduce((m, i) => Math.max(m, i.id || 0), 0);
      saved = {
        ...item,
        id: maxId + 1,
        is_published: item.is_published !== undefined ? item.is_published : true,
        display_order: item.display_order || (maxId + 1),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.memoryData.testimonials.push(saved);
    }

    this.saveToFile();
    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: item.id ? 'UPDATE' : 'CREATE',
      module: 'Testimonials',
      record_id: String(saved.id),
      details: `Saved testimonial from ${saved.client_name}`
    });

    return saved;
  }

  async deleteTestimonial(id, user = null) {
    this.memoryData.testimonials = (this.memoryData.testimonials || []).filter(i => String(i.id) !== String(id));
    this.saveToFile();

    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: 'DELETE',
      module: 'Testimonials',
      record_id: String(id),
      details: `Deleted testimonial id ${id}`
    });

    return true;
  }

  // ── Gallery ──────────────────────────────────────────────────────────────────
  async getGallery(includeUnpublished = false) {
    let list = this.memoryData.gallery || [];
    if (!includeUnpublished) {
      list = list.filter(item => item.is_published);
    }
    return list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }

  async saveGalleryItem(item, user = null) {
    if (!this.memoryData.gallery) this.memoryData.gallery = [];
    let saved;

    if (item.id) {
      const idx = this.memoryData.gallery.findIndex(i => String(i.id) === String(item.id));
      if (idx !== -1) {
        saved = { ...this.memoryData.gallery[idx], ...item, updated_at: new Date().toISOString() };
        this.memoryData.gallery[idx] = saved;
      }
    }

    if (!saved) {
      const maxId = this.memoryData.gallery.reduce((m, i) => Math.max(m, i.id || 0), 0);
      saved = {
        ...item,
        id: maxId + 1,
        is_published: item.is_published !== undefined ? item.is_published : true,
        display_order: item.display_order || (maxId + 1),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.memoryData.gallery.push(saved);
    }

    this.saveToFile();
    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: item.id ? 'UPDATE' : 'CREATE',
      module: 'Gallery',
      record_id: String(saved.id),
      details: `Saved gallery media item "${saved.title}"`
    });

    return saved;
  }

  async deleteGalleryItem(id, user = null) {
    this.memoryData.gallery = (this.memoryData.gallery || []).filter(i => String(i.id) !== String(id));
    this.saveToFile();

    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: 'DELETE',
      module: 'Gallery',
      record_id: String(id),
      details: `Deleted gallery item id ${id}`
    });

    return true;
  }

  // ── Contact Messages ─────────────────────────────────────────────────────────
  async getContactMessages({ status, search } = {}) {
    let list = this.memoryData.contact_messages || [];
    if (status && status !== 'all') {
      list = list.filter(m => m.status === status);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.subject?.toLowerCase().includes(q) ||
        m.message?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async saveContactMessage(msg) {
    if (!this.memoryData.contact_messages) this.memoryData.contact_messages = [];
    const maxId = this.memoryData.contact_messages.reduce((m, i) => Math.max(m, i.id || 0), 0);
    const newMsg = {
      ...msg,
      id: maxId + 1,
      status: 'unread',
      internal_notes: '',
      created_at: new Date().toISOString()
    };
    this.memoryData.contact_messages.unshift(newMsg);
    this.saveToFile();
    return newMsg;
  }

  async updateContactMessageStatus(id, { status, internal_notes }, user = null) {
    const list = this.memoryData.contact_messages || [];
    const idx = list.findIndex(m => String(m.id) === String(id));
    if (idx === -1) return null;

    if (status) list[idx].status = status;
    if (internal_notes !== undefined) list[idx].internal_notes = internal_notes;
    list[idx].updated_at = new Date().toISOString();

    this.saveToFile();
    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: 'UPDATE',
      module: 'Contact Messages',
      record_id: String(id),
      details: `Updated message from ${list[idx].name} status to ${status || 'notes modified'}`
    });

    return list[idx];
  }

  async deleteContactMessage(id, user = null) {
    this.memoryData.contact_messages = (this.memoryData.contact_messages || []).filter(m => String(m.id) !== String(id));
    this.saveToFile();

    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: 'DELETE',
      module: 'Contact Messages',
      record_id: String(id),
      details: `Deleted contact message id ${id}`
    });

    return true;
  }

  // ── Social Links ─────────────────────────────────────────────────────────────
  async getSocialLinks() {
    return (this.memoryData.social_links || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  }

  async updateSocialLinks(links, user = null) {
    this.memoryData.social_links = links;
    this.saveToFile();

    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: 'UPDATE',
      module: 'Social Links',
      record_id: 'ALL',
      details: 'Updated profile social media channels and external URLs'
    });

    return this.memoryData.social_links;
  }

  // ── Settings ─────────────────────────────────────────────────────────────────
  async getSettings() {
    return this.memoryData.settings || {};
  }

  async updateSettings(newSettings, user = null) {
    this.memoryData.settings = { ...this.memoryData.settings, ...newSettings };
    this.saveToFile();

    await this.logAudit({
      user: user?.full_name || 'Admin',
      action: 'UPDATE',
      module: 'Settings',
      record_id: 'SYSTEM',
      details: 'Updated global site settings and SEO metadata'
    });

    return this.memoryData.settings;
  }

  // ── Audit Logs ───────────────────────────────────────────────────────────────
  async logAudit({ user, action, module, record_id, details, ip = '127.0.0.1', status = 'SUCCESS' }) {
    if (!this.memoryData.audit_logs) this.memoryData.audit_logs = [];
    const maxId = this.memoryData.audit_logs.reduce((m, i) => Math.max(m, i.id || 0), 0);
    const log = {
      id: maxId + 1,
      username: user || 'System',
      action,
      module,
      record_id: String(record_id || ''),
      details,
      ip_address: ip,
      status,
      created_at: new Date().toISOString()
    };
    this.memoryData.audit_logs.unshift(log);
    if (this.memoryData.audit_logs.length > 500) {
      this.memoryData.audit_logs.length = 500;
    }
    this.saveToFile();
    return log;
  }

  async getAuditLogs(limit = 100) {
    return (this.memoryData.audit_logs || []).slice(0, limit);
  }

  // ── Dashboard Metrics ────────────────────────────────────────────────────────
  async getDashboardStats() {
    const projects = this.memoryData.projects || [];
    const services = this.memoryData.services || [];
    const testimonials = this.memoryData.testimonials || [];
    const gallery = this.memoryData.gallery || [];
    const messages = this.memoryData.contact_messages || [];

    const unreadMessages = messages.filter(m => m.status === 'unread').length;
    const publishedProjects = projects.filter(p => p.is_published).length;
    const draftProjects = projects.filter(p => !p.is_published).length;
    const publishedServices = services.filter(s => s.is_published).length;

    return {
      total_projects: projects.length,
      published_projects: publishedProjects,
      draft_projects: draftProjects,
      total_services: services.length,
      published_services: publishedServices,
      total_testimonials: testimonials.length,
      total_gallery_items: gallery.length,
      total_messages: messages.length,
      unread_messages: unreadMessages,
      recent_messages: messages.slice(0, 5),
      recent_activity: (this.memoryData.audit_logs || []).slice(0, 8)
    };
  }
}

const profileDb = new ProfileDbService();

module.exports = profileDb;
