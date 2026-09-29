/**
 * BSC Wedding Collection — Server-side Validation
 * =================================================
 * Every Wedding Registration form field is validated on the backend.
 * Frontend validation is supplementary — never trust it.
 *
 * Returns `{ ok: true }` or `{ ok: false, errors: string[] }`.
 */

// ── Email format (practical, not overly restrictive) ─────────────
function isValidEmail(email) {
  if (!email) return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
}

// ── Indian mobile validation + normalization (+91XXXXXXXXXX) ──────
function normalizeMobile(input) {
  if (input === undefined || input === null) return null;
  const digits = String(input).replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  return null;
}

function isValidMobile(input) {
  const normalized = normalizeMobile(input);
  if (!normalized) return false;
  // Must be exactly +91 followed by a valid Indian 10-digit number starting 6-9
  return /^\+91[6-9]\d{9}$/.test(normalized);
}

// ── Name validation (letters, spaces, dots, apostrophes, hyphens) ─
function isValidName(name) {
  if (name === undefined || name === null) return false;
  const trimmed = String(name).trim();
  if (trimmed.length < 2 || trimmed.length > 150) return false;
  // Allow unicode letters, spaces, ., ' and -
  return /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s.'-]+$/.test(trimmed);
}

// ── Date validation (YYYY-MM-DD, real calendar date) ──────────────
function isValidDate(value, { allowPast = true, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    return !required;
  }
  const str = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00`);
  if (isNaN(d.getTime())) return false;
  // Reject impossible dates like 2026-02-30
  const [y, m, day] = str.split('-').map(Number);
  if (d.getFullYear() !== y || d.getMonth() + 1 !== m || d.getDate() !== day) return false;
  if (!allowPast) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return false;
  }
  return true;
}

// ── Numeric validation (positive integer within bounds) ───────────
function parsePositiveInt(value, { min = 1, max = 100000 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const num = parseInt(value, 10);
  if (isNaN(num) || !isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

// ── Full registration payload validation ──────────────────────────
function validateWeddingRegistration(data) {
  const errors = [];
  const d = data && typeof data === 'object' ? data : {};

  // Required identity fields
  if (!isValidName(d.customer_name)) {
    errors.push('Customer name is required and must be at least 2 characters.');
  }

  if (!isValidMobile(d.mobile)) {
    errors.push('Please enter a valid 10-digit Indian mobile number.');
  }

  if (d.alternate_mobile && !isValidMobile(d.alternate_mobile)) {
    errors.push('Please enter a valid alternate mobile number.');
  }

  if (d.email && !isValidEmail(d.email)) {
    errors.push('Please enter a valid email address.');
  }

  if (d.bride_name && !isValidName(d.bride_name)) {
    errors.push('Please enter a valid bride name.');
  }
  if (d.groom_name && !isValidName(d.groom_name)) {
    errors.push('Please enter a valid groom name.');
  }

  if (d.bride_contact && !isValidMobile(d.bride_contact)) {
    errors.push('Please enter a valid bride contact number.');
  }
  if (d.groom_contact && !isValidMobile(d.groom_contact)) {
    errors.push('Please enter a valid groom contact number.');
  }

  // Dates (optional)
  if (!isValidDate(d.wedding_date, { allowPast: false, required: false })) {
    errors.push('Wedding date must be a valid future date.');
  }
  if (!isValidDate(d.preferred_shopping_date, { allowPast: false, required: false })) {
    errors.push('Preferred shopping date must be a valid future date.');
  }
  if (!isValidDate(d.expected_shopping_date, { allowPast: false, required: false })) {
    errors.push('Expected shopping date must be a valid future date.');
  }

  // Numeric fields (optional but must be valid when provided)
  const numChecks = [
    ['guest_count', d.guest_count, { max: 100000 }],
    ['family_size', d.family_size, { max: 1000 }],
    ['expected_visitors', d.expected_visitors, { max: 1000 }],
    ['age', d.age, { max: 120 }],
    ['bride_age', d.bride_age, { max: 120 }],
    ['groom_age', d.groom_age, { max: 120 }]
  ];
  for (const [field, value, opts] of numChecks) {
    if (value !== undefined && value !== null && value !== '') {
      const num = parsePositiveInt(value, opts);
      if (num === null) {
        errors.push(`Please enter a valid ${field.replace(/_/g, ' ')} (positive whole number).`);
      }
    }
  }

  // Consent is mandatory for processing
  if (!(d.consent === true || d.consent === 'true' || d.consent === 1)) {
    errors.push('You must provide consent before submitting.');
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  isValidEmail,
  isValidMobile,
  normalizeMobile,
  isValidName,
  isValidDate,
  parsePositiveInt,
  validateWeddingRegistration
};