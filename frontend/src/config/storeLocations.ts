/**
 * Centralized Store Locations Configuration for BSC Textiles
 * Single source of truth for Belagavi, Davanagere, and Shivamogga.
 * Used across the Landing Page, Customer Feedback system, QR codes, and Admin dashboards.
 */

export interface CentralStoreLocation {
  id: number;
  code: 'BEL' | 'DAV' | 'SHI';
  city: 'Belagavi' | 'Davanagere' | 'Shivamogga';
  name: string;
  storeName: string;
  tableName: 'BSC_Feedback_Belagavi' | 'BSC_Feedback_Davanagere' | 'BSC_Feedback_Shivamogga';
  address: string;
  phone: string;
  email: string;
  hours: string;
  image: string;
  departments: string[];
  mapsQuery: string;
  established: string;
  badge: string;
  featured?: boolean;
}

export const CENTRAL_STORE_LOCATIONS: Record<'BEL' | 'DAV' | 'SHI', CentralStoreLocation> = {
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
    badge: 'Grand Silk Showroom & Wedding Floor',
    featured: true
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

export const STORE_LOCATIONS_LIST: CentralStoreLocation[] = [
  CENTRAL_STORE_LOCATIONS.BEL,
  CENTRAL_STORE_LOCATIONS.DAV,
  CENTRAL_STORE_LOCATIONS.SHI
];

export function resolveStoreLocation(input?: string | number | null): CentralStoreLocation | null {
  if (!input) return null;
  const num = typeof input === 'number' ? input : parseInt(input, 10);
  if (!isNaN(num)) {
    if (num === 1) return CENTRAL_STORE_LOCATIONS.BEL;
    if (num === 2) return CENTRAL_STORE_LOCATIONS.DAV;
    if (num === 3) return CENTRAL_STORE_LOCATIONS.SHI;
  }
  const clean = String(input).toUpperCase().trim();
  if (clean === 'BEL' || clean === 'BELAGAVI') return CENTRAL_STORE_LOCATIONS.BEL;
  if (clean === 'DAV' || clean === 'DAVANAGERE') return CENTRAL_STORE_LOCATIONS.DAV;
  if (clean === 'SHI' || clean === 'SHIVAMOGGA' || clean === 'SHIMOGA') return CENTRAL_STORE_LOCATIONS.SHI;
  return null;
}
