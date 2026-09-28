/**
 * BSC Textiles Portal — Employee / User bulk-import CSV format
 *
 * SINGLE SOURCE OF TRUTH for the approved employee/user import file.
 * The sample download, the header validator and the row mapper all read
 * EMPLOYEE_CSV_HEADERS from this one module, so the template a user downloads
 * and the file the server accepts can never drift apart.
 *
 * Accepted format: RFC 4180 comma-separated values, UTF-8, .csv extension only.
 */

const EMPLOYEE_CSV_HEADERS = [
  'Username',
  'Password',
  'Full Name',
  'Role',
  'Email',
  'Phone',
  'Department',
  'Designation',
  'Section',
  'Employee ID',
  'Location',
  'Joining Date'
];

// Column name -> the key used on the create-user request body.
const EMPLOYEE_CSV_FIELD_MAP = {
  Username: 'username',
  Password: 'password',
  'Full Name': 'fullName',
  Role: 'role',
  Email: 'email',
  Phone: 'phone',
  Department: 'department',
  Designation: 'designation',
  Section: 'section',
  'Employee ID': 'employeeId',
  Location: 'location',
  'Joining Date': 'joiningDate'
};

// Hard limits keep a mistyped upload from turning into a mass-write.
const EMPLOYEE_CSV_MAX_ROWS = 2000;
const EMPLOYEE_CSV_MAX_BYTES = 1024 * 1024; // 1 MB

const EMPLOYEE_CSV_INVALID_FORMAT_MESSAGE =
  'Invalid file format. Please upload the approved CSV file.';

/** Strip a UTF-8 BOM without relying on an invisible literal in source. */
function stripBom(str) {
  const text = String(str == null ? '' : str);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * RFC 4180 parser. Handles quoted fields, doubled quotes, commas and line
 * breaks inside quotes, and CRLF/CR/LF endings. Returns an array of rows,
 * each row being an array of raw cell strings. Blank physical lines are kept
 * (as a single empty cell) so the reported row number still matches the file.
 */
function parseCsv(input) {
  const text = stripBom(input);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && field === '') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** True when every cell of a row is empty/whitespace. */
function isEmptyRow(cells) {
  return !Array.isArray(cells) || cells.every(c => String(c == null ? '' : c).trim() === '');
}

/**
 * Strict header validation: the header must be present, must contain exactly
 * the approved columns (no missing, no extra, no duplicates, no blanks) and
 * must be in the approved order. Returns an array of human-readable errors
 * (empty array = valid).
 */
function validateHeaderRow(rawRow) {
  const errors = [];
  const expected = EMPLOYEE_CSV_HEADERS;
  const got = (Array.isArray(rawRow) ? rawRow : [])
    .map(c => stripBom(c == null ? '' : c).trim());

  if (got.length === 0 || got.every(h => h === '')) {
    errors.push('The file does not start with a header row.');
    errors.push(`Expected header: ${expected.join(',')}`);
    return errors;
  }

  got.forEach((h, idx) => {
    if (h === '') errors.push(`Column header at position ${idx + 1} is empty.`);
  });

  const seen = new Set();
  const duplicates = new Set();
  got.forEach(h => {
    const key = h.toLowerCase();
    if (!key) return;
    if (seen.has(key)) duplicates.add(h);
    seen.add(key);
  });
  duplicates.forEach(d => errors.push(`Duplicate column: "${d}".`));

  const expectedKeys = expected.map(h => h.toLowerCase());
  expected.forEach(h => {
    if (!seen.has(h.toLowerCase())) errors.push(`Missing column: "${h}".`);
  });
  got.forEach(h => {
    if (h && !expectedKeys.includes(h.toLowerCase())) {
      errors.push(`Unknown column: "${h}".`);
    }
  });

  // Order is only meaningful once the column set itself is correct.
  if (errors.length === 0) {
    expected.forEach((h, idx) => {
      if (got[idx].toLowerCase() !== h.toLowerCase()) {
        errors.push(`Column ${idx + 1} must be "${h}" but found "${got[idx] || '(empty)'}".`);
      }
    });
  }

  if (errors.length > 0) {
    errors.push(`Expected header: ${expected.join(',')}`);
  }
  return errors;
}

/** Convert one parsed row into a create-user request body (no validation). */
function rowToBody(cells, headerRow) {
  const body = {};
  const header = headerRow || EMPLOYEE_CSV_HEADERS;
  header.forEach((name, idx) => {
    const key = EMPLOYEE_CSV_FIELD_MAP[String(name).trim()] || String(name).trim();
    body[key] = String(cells[idx] == null ? '' : cells[idx]).trim();
  });
  return body;
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvLine(values) {
  return values.map(csvEscape).join(',');
}

/** Built from EMPLOYEE_CSV_HEADERS so the sample can never drift. */
function buildSampleCsv() {
  const example = [
    'john.doe',
    'TempPass123',
    'John Doe',
    'Telecaller',
    'john.doe@bsctextiles.com',
    '9876543210',
    'Telesales',
    'Senior Telecaller',
    'Inbound',
    'EMP-9001',
    'DAV',
    '2026-01-05'
  ];
  return [toCsvLine(EMPLOYEE_CSV_HEADERS), toCsvLine(example)].join('\r\n') + '\r\n';
}

/**
 * Best-effort detection of a non-CSV payload wearing a .csv extension
 * (a renamed .xlsx/.xls/.doc/.pdf/.zip ships as opaque binary).
 */
function looksBinary(buf) {
  if (!buf || buf.length === 0) return false;
  if (buf.includes(0x00)) return true;
  // ZIP / xlsx / docx
  if (buf[0] === 0x50 && buf[1] === 0x4b) return true;
  // OLE2 compound file (legacy .xls / .doc / .xlsx)
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return true;
  // PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return true;
  return false;
}

module.exports = {
  EMPLOYEE_CSV_HEADERS,
  EMPLOYEE_CSV_FIELD_MAP,
  EMPLOYEE_CSV_MAX_ROWS,
  EMPLOYEE_CSV_MAX_BYTES,
  EMPLOYEE_CSV_INVALID_FORMAT_MESSAGE,
  parseCsv,
  isEmptyRow,
  validateHeaderRow,
  rowToBody,
  csvEscape,
  toCsvLine,
  buildSampleCsv,
  looksBinary
};
