/**
 * Centralized Store Locations Configuration for BSC Textiles
 * Single source of truth for Belagavi, Davanagere, and Shivamogga.
 * Used by backend API, database routing, feedback, and QR systems.
 */

const STORE_LOCATIONS = {
  BEL: {
    id: 1,
    code: 'BEL',
    city: 'Belagavi',
    name: 'Belagavi',
    storeName: 'BSC Textiles Belagavi',
    tableName: 'BSC_Feedback_Belagavi',
    address: '1st gate road, Shukrawar Peth Rd, Shivaji Colony, Tilakwadi, Belagavi, Karnataka 590006',
    phone: '+91 831 242 1938',
    email: 'belagavi@bsctextiles.in',
    hours: '10:30 AM to 8:30 PM · Open Every Day',
    image: '/images/floor.webp',
    departments: ['Bridal Silk Sarees', 'Wedding Suits & Sherwanis', 'Jewellery Section', 'Private Family Rooms'],
    mapsQuery: 'BSC Textiles Tilakwadi Belagavi',
    established: 'Est. 1938',
    badge: 'Grand Silk Showroom & Wedding Floor'
  },
  DAV: {
    id: 2,
    code: 'DAV',
    city: 'Davanagere',
    name: 'Davanagere',
    storeName: 'BSC Textiles Davanagere',
    tableName: 'BSC_Feedback_Davanagere',
    address: 'Medical College Rd, MCC B Block, Kuvempu Nagar, Davanagere, Karnataka 577004',
    phone: '+91 8192 221938',
    email: 'davanagere@bsctextiles.in',
    hours: '10:30 AM to 8:00 PM · Open Every Day',
    image: '/images/home.webp',
    departments: ['Pure Silk Sarees', 'Men’s Shirting & Suiting', 'Home Furnishings', 'Luxury Towels & Linens'],
    mapsQuery: 'BSC Textiles Medical College Rd Davanagere',
    established: 'Est. 1978',
    badge: 'Sarees, Shirting & Home Furnishing'
  },
  SHI: {
    id: 3,
    code: 'SHI',
    city: 'Shivamogga',
    name: 'Shivamogga',
    storeName: 'BSC Textiles Shivamogga',
    tableName: 'BSC_Feedback_Shivamogga',
    address: '01, BH Rd, Durgigudi, Shivamogga, Karnataka 577201',
    phone: '+91 8182 221938',
    email: 'shivamogga@bsctextiles.in',
    hours: '11:00 AM to 8:00 PM · Open Every Day',
    image: '/images/suit.webp',
    departments: ['Pure Silk Sarees', 'Custom Tailoring & Suits', 'Wedding Sherwanis', 'Women’s Festive Wear'],
    mapsQuery: 'BSC Textiles Durgigudi Shivamogga',
    established: 'Est. 2024',
    badge: 'Grand Wedding & Tailoring Floor'
  }
};

const LOCATION_BY_ID = {
  1: STORE_LOCATIONS.BEL,
  2: STORE_LOCATIONS.DAV,
  3: STORE_LOCATIONS.SHI
};

const LOCATION_BY_CODE = {
  'BEL': STORE_LOCATIONS.BEL,
  'DAV': STORE_LOCATIONS.DAV,
  'SHI': STORE_LOCATIONS.SHI,
  'BELAGAVI': STORE_LOCATIONS.BEL,
  'DAVANAGERE': STORE_LOCATIONS.DAV,
  'SHIVAMOGGA': STORE_LOCATIONS.SHI,
  'SHIMOGA': STORE_LOCATIONS.SHI
};

function resolveStoreLocation(input) {
  if (!input) return null;
  const num = parseInt(input, 10);
  if (!isNaN(num) && LOCATION_BY_ID[num]) {
    return LOCATION_BY_ID[num];
  }
  const clean = String(input).toUpperCase().trim();
  return LOCATION_BY_CODE[clean] || null;
}

module.exports = {
  STORE_LOCATIONS,
  LOCATION_BY_ID,
  LOCATION_BY_CODE,
  resolveStoreLocation
};
