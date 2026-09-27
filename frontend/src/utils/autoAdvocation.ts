/**
 * Auto-Advocation Module (TypeScript / React frontend)
 * Combines all existing fields across the repository into a single unified
 * data structure and generates a formal, deterministic advocacy message/letter.
 */

export interface AutoAdvocationApplicant {
  name: string;
  email: string;
  phone: string;
  role: string;
  side?: string;
  affiliation?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
}

export interface AutoAdvocationLocation {
  floor?: string;
  storeName?: string;
  address?: string;
  hours?: string;
  city?: string;
  organization: string;
}

export interface AutoAdvocationCaseDetails {
  kind: string;
  category: string;
  preferredDay?: string;
  weddingDate?: string;
  needs?: string[];
  note?: string;
  subject?: string;
  ref: string;
  status: string;
  submissionDate: string;
}

export interface AutoAdvocationData {
  applicant: AutoAdvocationApplicant;
  location: AutoAdvocationLocation;
  caseDetails: AutoAdvocationCaseDetails;
  meta: {
    generatedAt: string;
    source: string;
  };
}

export const STORE_LOCATIONS: Record<string, { name: string; address: string; hours: string }> = {
  'Flagship, Koppikar Road': {
    name: 'Flagship Store',
    address: 'Koppikar Road, Hubballi 580020',
    hours: '10:30–20:30, all week'
  },
  'Home floor, Vidyanagar': {
    name: 'Home Floor',
    address: 'Vidyanagar, Hubballi 580021',
    hours: '10:30–20:00, all week'
  },
  'Suit desk, Coen Road': {
    name: 'Suit Desk',
    address: 'Coen Road, Hubballi 580020',
    hours: '11:00–20:00, Tuesday to Sunday (Monday by appointment)'
  },
  'Wedding room': {
    name: 'Wedding Room',
    address: 'Flagship, Koppikar Road, Hubballi 580020',
    hours: '10:30–20:30, by appointment'
  },
  'Jewellery room': {
    name: 'Jewellery Room',
    address: 'Flagship, Koppikar Road, Hubballi 580020',
    hours: '10:30–20:30, all week'
  }
};

/**
 * Format a date nicely
 */
export function formatDate(d?: string | Date | null): string {
  if (!d) return '';
  try {
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
  } catch {}
  return String(d);
}

/**
 * Collect & combine all existing fields across the project into a normalized object
 */
export function buildAutoAdvocationData(source?: Partial<any>): AutoAdvocationData {
  const src = source || {};

  // Read stored session if available
  let sessionUser: any = {};
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('bsc_crm_session') || localStorage.getItem('madt_user');
      if (stored) sessionUser = JSON.parse(stored);
    } catch {}
  }

  // DOM extraction if present
  const domValues: Record<string, any> = {};
  if (typeof document !== 'undefined') {
    const form = document.querySelector('form');
    if (form) {
      try {
        const formData = new FormData(form);
        formData.forEach((val, key) => {
          if (key === 'needs') {
            domValues.needs = domValues.needs || [];
            domValues.needs.push(val.toString());
          } else {
            domValues[key] = val.toString().trim();
          }
        });
      } catch {}
    }
  }

  const rawName = src.name || src.fullName || domValues.name || sessionUser.name || sessionUser.fullName || sessionUser.username || 'Valued Client';
  const rawEmail = src.email || domValues.email || sessionUser.email || '';
  const rawPhone = src.phone || domValues.phone || sessionUser.phone || '';
  const rawRole = src.role || sessionUser.role || 'Client';
  const rawFloor = src.floor || src.locationName || domValues.floor || 'Flagship, Koppikar Road';
  const rawDay = src.day || src.preferredDay || domValues.day || '';
  const rawDate = src.date || src.weddingDate || domValues.date || '';
  const rawSide = src.side || domValues.side || '';
  const rawNeeds = src.needs || domValues.needs || [];
  const rawNote = src.note || src.message || domValues.note || '';
  const rawRef = src.ref || domValues.ref || 'MADT-PENDING';
  const rawKind = src.kind || domValues.kind || 'advocacy';

  const storeInfo = STORE_LOCATIONS[rawFloor] || {
    name: rawFloor,
    address: 'Hubballi / Karnataka Store Network',
    hours: '10:30–20:30, all week'
  };

  return {
    applicant: {
      name: rawName,
      email: rawEmail,
      phone: rawPhone,
      role: rawRole,
      side: rawSide,
      affiliation: rawRole === 'Admin' ? 'Management Desk' : (rawSide ? `${rawSide} Representation` : 'Customer Advocate'),
      employeeId: src.employeeId || sessionUser.employeeId,
      department: src.department || sessionUser.department,
      designation: src.designation || sessionUser.designation
    },
    location: {
      floor: rawFloor,
      storeName: storeInfo.name,
      address: storeInfo.address,
      hours: storeInfo.hours,
      city: 'Hubballi',
      organization: 'MADT House / BSC Store Network'
    },
    caseDetails: {
      kind: rawKind,
      category: rawKind === 'wedding' ? 'Wedding Shopping & Trousseau Registration' :
                rawKind === 'consult' ? 'Floor Consultation & Custom Fitting' : 'General Advocacy & Client Representation',
      preferredDay: rawDay,
      weddingDate: rawDate ? formatDate(rawDate) : '',
      needs: Array.isArray(rawNeeds) ? rawNeeds : [rawNeeds],
      note: rawNote,
      ref: rawRef,
      status: src.status || 'Active Advocacy Request',
      submissionDate: formatDate(new Date())
    },
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'Unified Auto-Advocation Core Engine'
    }
  };
}

/**
 * Auto-generate an advocacy message / letter using the combined fields
 */
export function generateAdvocacyLetter(data?: AutoAdvocationData): string {
  const d = data || buildAutoAdvocationData();
  const app = d.applicant;
  const loc = d.location;
  const c = d.caseDetails;

  const lines: string[] = [];

  lines.push('================================================================================');
  lines.push('              FORMAL ADVOCACY & CLIENT REPRESENTATION BRIEF');
  lines.push(`                          ${loc.organization}`);
  lines.push('================================================================================\n');

  lines.push(`Date: ${c.submissionDate}`);
  lines.push(`To: The Floor Desk & Management`);
  lines.push(`    ${loc.organization} — ${loc.floor || 'Store Counter'}`);
  if (loc.address) lines.push(`    ${loc.address}`);
  if (c.ref && c.ref !== 'MADT-PENDING') lines.push(`Reference Code: ${c.ref}`);
  lines.push(`Status: ${c.status}\n`);

  lines.push(`SUBJECT: Formal Representation & Advocacy Request — ${c.category}\n`);

  const introWho = app.side ? `${app.name} (${app.side})` : `${app.name} (${app.affiliation || app.role})`;
  lines.push(`Dear Floor Desk,\n`);
  lines.push(`This formal advocacy letter is submitted on behalf of ${introWho}. We hereby register an official representation request regarding curated appointments, specialized coordination, and dedicated floor assistance.\n`);

  lines.push('CONTEXT & REQUIREMENTS OVERVIEW:');
  let contextText = `The client has requested tailored assistance at ${loc.floor || 'the designated counter'}.`;
  if (c.weddingDate) {
    contextText += ` The upcoming wedding ceremony is scheduled for ${c.weddingDate}, necessitating timely preparation and advance coordination.`;
  }
  if (c.preferredDay) {
    contextText += ` The preferred appointment window is ${c.preferredDay}.`;
  }
  lines.push(contextText + '\n');

  lines.push('REQUESTED ADVOCACY ACTION:');
  if (c.kind === 'wedding') {
    lines.push('1. Reserve a dedicated floor hour without interruption to review the family wedding shopping list.');
    lines.push('2. Pre-assign a senior staff advisor familiar with our textile collections, suits, and jewellery.');
    lines.push('3. Provide priority verification and log the booking on the house desk book.');
  } else if (c.kind === 'consult') {
    lines.push(`1. Confirm reserved consultation time on the floor schedule for ${c.preferredDay || 'the requested time'}.`);
    lines.push(`2. Prepare fabric swatches and fittings in advance at the ${loc.floor || 'counter'}.`);
    lines.push('3. Provide direct confirmation notice once the floor time has been allocated.');
  } else {
    lines.push('1. Review the client brief and provide an official response from the counter desk.');
    lines.push('2. Coordinate requested details with the relevant floor manager.');
    lines.push('3. Record this representation inquiry in the centralized desk ledger.');
  }
  lines.push('');

  lines.push('SUPPORTING CASE DETAILS:');
  if (app.name) lines.push(`• Client / Applicant Name: ${app.name}`);
  if (app.email) lines.push(`• Contact Email: ${app.email}`);
  if (app.phone) lines.push(`• Telephone: ${app.phone}`);
  if (app.side) lines.push(`• Party Representation: ${app.side}`);
  if (loc.floor) lines.push(`• Assigned Floor / Counter: ${loc.floor}`);
  if (loc.hours) lines.push(`• Operating Counter Hours: ${loc.hours}`);
  if (c.preferredDay) lines.push(`• Preferred Consultation Timing: ${c.preferredDay}`);
  if (c.weddingDate) lines.push(`• Target Event Date: ${c.weddingDate}`);
  if (c.needs && c.needs.length > 0) {
    lines.push(`• Requested Merchandise & Categories: ${c.needs.join(', ')}`);
  }
  if (c.note) {
    lines.push(`• Specific Client Brief / Instructions: ${c.note}`);
  }
  lines.push('');

  lines.push('CLOSING & AFFIRMATION:');
  lines.push(`All information provided above reflects the verified client request on record. We appreciate the courtesy and traditional standards of ${loc.organization} in facilitating this request.\n`);
  lines.push('Respectfully submitted,\n');
  lines.push(app.name);
  if (app.phone) lines.push(`Phone: ${app.phone}`);
  if (app.email) lines.push(`Email: ${app.email}`);
  lines.push(loc.organization);
  lines.push('================================================================================');

  return lines.join('\n');
}

export const generateUnifiedAdvocationData = buildAutoAdvocationData;
export const formatAutoAdvocationLetter = generateAdvocacyLetter;

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  return false;
}
