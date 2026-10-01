/**
 * BSC Employee Master Directory — data access service
 * =====================================================================
 * `users` remains the single source of truth for every employee record.
 * `candidates` / `selection_offers` are joined read-only to recover the
 * recruitment-owned values (address, DOB, documents, offer dates) that the
 * directory also displays.
 *
 * Everything in this module is location scoped: the caller MUST pass an
 * Express `req` so `getLocationFilter()` can clamp the query to the stores the
 * signed-in administrator is allowed to see. Nothing here trusts a client
 * supplied location id.
 */

const pool = require('../config/db');
const { getLocationFilter } = require('../middleware/auth');
const {
  resolveRoleDefaultPermissions,
  checkLocationAccess,
  ADMIN_ROLES
} = require('./authorizationService');

/** Employment statuses the Employee Master Directory supports. */
const EMPLOYEE_STATUSES = [
  'Joined', 'Active', 'On Leave', 'Probation',
  'Inactive', 'Deactivated', 'Resigned', 'Terminated'
];

/** Columns that only exist once the employee-master migration has run. */
const MASTER_COLUMNS = [
  'alternate_phone', 'company_email', 'permanent_address', 'city', 'district',
  'state', 'pincode', 'emergency_contact_name', 'emergency_contact_phone',
  'emergency_contact_relation', 'employment_type', 'floor', 'confirmation_date',
  'work_shift', 'employment_status', 'pan_number', 'bank_name',
  'bank_account_number', 'ifsc_code', 'created_by', 'updated_by'
];

/** Candidate-owned columns that may be absent on older deployments. */
const OPTIONAL_CANDIDATE_COLUMNS = [
  'department', 'branch', 'reporting_manager', 'section', 'religion_caste',
  'aadhaar_url', 'photo_url', 'offered_doj', 'retail_experience',
  'previous_company', 'previous_designation', 'aadhaar_number',
  'father_details', 'mother_details', 'religion', 'caste', 'languages_known'
];

let candidateColumnCache = null;

async function getCandidateColumns() {
  if (candidateColumnCache) return candidateColumnCache;
  try {
    const [rows] = await pool.query('SHOW COLUMNS FROM candidates');
    candidateColumnCache = new Set(rows.map(r => r.Field));
  } catch (err) {
    candidateColumnCache = new Set();
  }
  return candidateColumnCache;
}

let userColumnCache = null;

async function getUserColumns() {
  if (userColumnCache) return userColumnCache;
  try {
    const [rows] = await pool.query('SHOW COLUMNS FROM users');
    userColumnCache = new Set(rows.map(r => r.Field));
  } catch (err) {
    userColumnCache = new Set();
  }
  return userColumnCache;
}

function pick(columns, name, fallback = 'NULL') {
  return columns.has(name) ? `c.${name}` : fallback;
}

// ── Permissions ────────────────────────────────────────────────────
/**
 * Resolves the caller's effective Employee-Directory actions from the existing
 * Access Control Matrix. Returns exactly what the HTTP layer will enforce so
 * the UI can never show an action the API would reject.
 */
async function resolveEmployeeActions(user) {
  const none = { can_view: false, can_add: false, can_edit: false, can_delete: false, can_export: false, can_view_sensitive: false };
  if (!user || !user.id) return none;

  const isAdmin = ADMIN_ROLES.includes(user.role) || user.isGlobalAdmin;
  if (isAdmin) {
    return { can_view: true, can_add: true, can_edit: true, can_delete: true, can_export: true, can_view_sensitive: true };
  }

  let rows = [];
  try {
    const [result] = await pool.query(
      `SELECT module, can_view, can_add, can_edit, can_delete, can_export, can_approve
         FROM user_permissions WHERE user_id = ?`,
      [user.id]
    );
    rows = result || [];
  } catch (err) {
    rows = [];
  }

  let source;
  if (rows.length > 0) {
    source = rows.find(p => p.module === 'employees');
  } else {
    source = resolveRoleDefaultPermissions(user.role).find(p => p.module === 'employees');
  }

  // Any authenticated staff member can view the public name directory:
  const can_view = isAdmin || (source ? !!source.can_view : !['Guest', 'Customer'].includes(user.role));
  const isManagerOrHr = ['hr', 'manager', 'store manager', 'hr manager'].includes(String(user.role || '').toLowerCase());
  const can_edit = isAdmin || (source ? !!source.can_edit : isManagerOrHr);
  const can_delete = isAdmin || (source ? !!source.can_delete : ['hr', 'hr manager'].includes(String(user.role || '').toLowerCase()));
  const can_add = isAdmin || (source ? !!source.can_add : isManagerOrHr);
  const can_export = isAdmin || (source ? !!source.can_export : true);

  return {
    can_view,
    can_add,
    can_edit,
    can_delete,
    can_export,
    // Sensitive employee details are reserved strictly for administrators or approved access requests
    can_view_sensitive: isAdmin
  };
}

async function hasApprovedAccessRequest(userId, employeeId) {
  if (!userId || !employeeId) return false;
  try {
    const [rows] = await pool.query(
      `SELECT id FROM employee_access_requests 
       WHERE user_id = ? AND employee_id = ? AND status = 'APPROVED'
       LIMIT 1`,
      [userId, employeeId]
    );
    return rows && rows.length > 0;
  } catch (err) {
    console.warn('[EmployeeMaster] hasApprovedAccessRequest error:', err.message);
    return false;
  }
}

// ── SQL building ───────────────────────────────────────────────────
const JOINING_EXPR = 'COALESCE(u.joining_date, u.actual_doj, u.offered_doj, u.created_at)';

function statusExpr(hasEmploymentStatus) {
  return hasEmploymentStatus
    ? "COALESCE(NULLIF(u.employment_status, ''), CASE WHEN u.active = 1 THEN 'Joined' ELSE 'Deactivated' END)"
    : "CASE WHEN u.active = 1 THEN 'Joined' ELSE 'Deactivated' END";
}

function buildSorts(statusSql) {
  return {
    name: 'LOWER(u.full_name) ASC',
    name_desc: 'LOWER(u.full_name) DESC',
    newest: `${JOINING_EXPR} DESC, LOWER(u.full_name) ASC`,
    oldest: `${JOINING_EXPR} ASC, LOWER(u.full_name) ASC`,
    employee_id: "COALESCE(NULLIF(u.employee_id, ''), u.username) ASC",
    department: 'department ASC, LOWER(u.full_name) ASC',
    designation: 'designation ASC, LOWER(u.full_name) ASC',
    location: 'location_name ASC, LOWER(u.full_name) ASC',
    status: `${statusSql} ASC, LOWER(u.full_name) ASC`
  };
}

async function buildEmployeeQuery(req, options = {}) {
  const c = await getCandidateColumns();
  const u = await getUserColumns();
  const { clause: locClause, params: locParams } = await getLocationFilter(req, 'u');
  const includeInactive = options.includeInactive === true;
  const has = (name) => u.has(name);
  const usr = (name, alias = name) => (has(name) ? `u.${name}` : 'NULL') + ` as ${alias}`;
  const statusSql = statusExpr(has('employment_status'));

  const select = `
    SELECT
      u.id as user_id, u.username as username, u.employee_id as emp_no,
      u.full_name as name, u.email, u.phone,
      COALESCE(c.app_no, u.candidate_app_no, u.employee_id, u.username) as app_no,
      u.candidate_app_no as candidate_app_no,
      COALESCE(u.section, ${pick(c, 'section', "''")}, '') as section,
      COALESCE(u.reporting_manager, ${pick(c, 'reporting_manager')}, '') as reporting_manager,
      COALESCE(${pick(c, 'offered_doj')}, u.offered_doj) as offered_doj,
      c.updated_at as candidate_updated_at,
      u.updated_at as user_updated_at, u.last_login_at,
      COALESCE(u.department, ${pick(c, 'department')}, '') as department,
      COALESCE(u.designation, ${pick(c, 'designation')}, '') as designation,
      u.role, u.active, u.created_at, u.location_id, u.location_code,
      l.location_name as location_name,
      COALESCE(NULLIF(l.location_name, ''), u.branch, '') as branch,
      COALESCE(${pick(c, 'dob')}, u.dob) as dob,
      COALESCE(${pick(c, 'gender')}, u.gender) as gender,
      COALESCE(${pick(c, 'blood_group')}, u.blood_group) as blood_group,
      COALESCE(${pick(c, 'aadhaar_number')}, u.aadhaar_number) as aadhaar_number,
      COALESCE(${pick(c, 'father_details')}, u.father_details) as father_details,
      COALESCE(${pick(c, 'mother_details')}, u.mother_details) as mother_details,
      COALESCE(${pick(c, 'religion')}, u.religion) as religion,
      COALESCE(${pick(c, 'caste')}, u.caste) as caste,
      COALESCE(${pick(c, 'religion_caste')}, CONCAT_WS('/', u.religion, u.caste)) as religion_caste,
      COALESCE(${pick(c, 'languages_known')}, u.languages_known) as languages_known,
      COALESCE(${pick(c, 'city_state')}, u.city_state) as city_state,
      COALESCE(${pick(c, 'address')}, u.address) as address,
      COALESCE(${pick(c, 'qualification')}, u.qualification) as qualification,
      COALESCE(${pick(c, 'experience')}, u.experience) as experience,
      COALESCE(${pick(c, 'retail_experience')}, u.retail_experience) as retail_experience,
      COALESCE(${pick(c, 'previous_company')}, u.previous_company) as previous_company,
      COALESCE(${pick(c, 'previous_designation')}, u.previous_designation) as previous_designation,
      COALESCE(${pick(c, 'salary')}, u.salary) as salary,
      COALESCE(${pick(c, 'current_salary')}, u.current_salary) as current_salary,
      COALESCE(${pick(c, 'expected_salary')}, u.expected_salary) as expected_salary,
      u.previous_salary as previous_salary,
      COALESCE(${pick(c, 'photo_url')}, u.photo_url) as photo_url,
      COALESCE(${pick(c, 'aadhaar_url')}, u.aadhaar_url) as aadhaar_url,
      COALESCE(${pick(c, 'resume_url')}, u.resume_url) as resume_url,
      COALESCE(${pick(c, 'remarks')}, u.remarks) as remarks,
      COALESCE(${pick(c, 'source')}, u.source) as source,
      COALESCE(${pick(c, 'referrer')}, u.referrer) as referrer,
      COALESCE(${pick(c, 'referrer_emp_no')}, u.referrer_emp_no) as referrer_emp_no,
      ${pick(c, 'source_detail')} as source_detail,
      ${pick(c, 'q1')} as q1, ${pick(c, 'q2')} as q2,
      ${pick(c, 'q3')} as q3, ${pick(c, 'q4')} as q4,
      COALESCE(u.notice_period, ${pick(c, 'notice_period')}) as notice_period,
      u.notes as hr_notes,
      u.joining_date as joining_date,
      so.notice_period as offer_notice_pd,
      COALESCE(so.est_doj, ${pick(c, 'offered_doj')}, u.offered_doj) as offer_est_doj,
      COALESCE(so.actual_doj, u.joining_date) as offer_actual_doj,
      so.remarks as offer_remarks,
      so.updated_at as offer_updated_at,
      ${usr('alternate_phone')}, ${usr('company_email')}, ${usr('permanent_address')},
      ${usr('city')}, ${usr('district')}, ${usr('state')}, ${usr('pincode')},
      ${usr('emergency_contact_name')}, ${usr('emergency_contact_phone')},
      ${usr('emergency_contact_relation')}, ${usr('employment_type')}, ${usr('floor')},
      ${usr('confirmation_date')}, ${usr('work_shift')}, ${usr('employment_status')},
      ${usr('pan_number')}, ${usr('bank_name')}, ${usr('bank_account_number')}, ${usr('ifsc_code')},
      ${usr('created_by')}, ${usr('updated_by')},
      u.deactivated_until, u.deactivation_reason, u.force_password_reset, u.token_version,
      so.status as offer_status,
      COALESCE(so.actual_doj, u.actual_doj) as actual_doj,
      ${JOINING_EXPR} as sort_joining_date,
      ${statusSql} as status_display
  `;

  const from = `
    FROM users u
    LEFT JOIN locations l ON l.id = u.location_id
    LEFT JOIN candidates c ON (
      (u.candidate_app_no IS NOT NULL AND u.candidate_app_no != '' AND c.app_no = u.candidate_app_no)
      OR (u.employee_id IS NOT NULL AND u.employee_id != '' AND c.app_no = u.employee_id)
      OR (u.phone IS NOT NULL AND u.phone != '' AND c.phone = u.phone)
    )
    LEFT JOIN selection_offers so ON c.app_no = so.app_no
    WHERE ${c.has('is_deleted') ? '(c.id IS NULL OR c.is_deleted = 0 OR c.is_deleted IS NULL)' : 'TRUE'}
      ${includeInactive ? '' : 'AND u.active = 1'}
      AND LOWER(COALESCE(u.role, '')) NOT IN ('admin', 'super admin', 'system administrator', 'customer', 'guest')
      AND LOWER(COALESCE(u.username, '')) NOT IN ('admin', 'admin@bsctextiles.com', 'ghost')
      AND LOWER(COALESCE(u.full_name, '')) NOT LIKE '%system administrator%'
      ${locClause}
  `;

  return {
    select,
    from,
    locParams,
    statusSql,
    sorts: buildSorts(statusSql),
    has
  };
}

function addSearchClause(where, params, q, has, sensitive = false) {
  const like = `%${q}%`;
  const fields = [
    'u.full_name', 'u.username',
    'u.department', 'u.designation', 'u.section',
    'l.location_name', 'c.name'
  ];
  if (sensitive) {
    fields.push('u.employee_id', 'u.candidate_app_no', 'c.app_no', 'u.phone', 'u.email', 'c.phone', 'c.email');
    if (has('alternate_phone')) fields.push('u.alternate_phone');
    if (has('company_email')) fields.push('u.company_email');
  }
  const ors = fields.map(f => `LOWER(${f}) LIKE ?`).join(' OR ');
  where.push(`(${ors})`);
  for (let i = 0; i < fields.length; i++) params.push(like);
}

// ── Row → DTO ──────────────────────────────────────────────────────
const AVATAR_COLORS = ['navy', 'gold', 'green', 'red', 'purple', 'teal'];

function formatDate(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('0000-00-00') || trimmed === '0000-00-00') return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const year = parseInt(trimmed.slice(0, 4), 10);
      if (year < 1900 || year > 2100) return '';
      return trimmed.slice(0, 10);
    }
  }
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  if (yyyy < 1900 || yyyy > 2100) return '';
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function displayDate(value) {
  const iso = formatDate(value);
  if (!iso) return '';
  try {
    const dt = new Date(`${iso}T00:00:00`);
    if (isNaN(dt.getTime())) return iso;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) {
    return iso;
  }
}

function computeAge(dob) {
  const iso = formatDate(dob);
  if (!iso) return '';
  try {
    const birth = new Date(`${iso}T00:00:00`);
    if (isNaN(birth.getTime())) return '';
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age >= 0 && age < 130 ? String(age) : '';
  } catch (_) {
    return '';
  }
}

function mapEmployeeRow(r, { sensitive = false } = {}) {
  const name = String(r.name || r.full_name || r.username || '').trim();
  const initials = name
    ? name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'E'
    : 'E';
  const colorIndex = Math.abs(((name ? name.charCodeAt(0) : 0) + (name && name[1] ? name.charCodeAt(1) : 0))) % (AVATAR_COLORS.length || 1);

  const createdDate = (!r.created_at || isNaN(new Date(r.created_at).getTime())) ? new Date() : new Date(r.created_at);
  const offerUpdatedAt = r.offer_updated_at && !isNaN(new Date(r.offer_updated_at).getTime()) ? new Date(r.offer_updated_at) : null;
  
  let joiningDateObj = null;
  if (r.joining_date && !isNaN(new Date(r.joining_date).getTime())) {
    joiningDateObj = new Date(r.joining_date);
  } else if (r.offer_actual_doj && !isNaN(new Date(r.offer_actual_doj).getTime())) {
    joiningDateObj = new Date(r.offer_actual_doj);
  } else if (r.offered_doj && !isNaN(new Date(r.offered_doj).getTime())) {
    joiningDateObj = new Date(r.offered_doj);
  } else if (offerUpdatedAt) {
    joiningDateObj = offerUpdatedAt;
  } else {
    joiningDateObj = createdDate;
  }
  if (!joiningDateObj || isNaN(joiningDateObj.getTime())) {
    joiningDateObj = new Date();
  }

  const dob = formatDate(r.dob);
  const actualDojStr = formatDate(
    r.actual_doj || r.offer_actual_doj || r.offered_doj || r.offer_updated_at
    || r.candidate_updated_at || r.user_updated_at || r.created_at
  );
  const offeredDoj = formatDate(r.offered_doj || r.offer_est_doj || r.offer_actual_doj);
  const estDojStr = formatDate(r.offer_est_doj || r.offered_doj);
  const joining = formatDate(r.joining_date);

  // Compensation keeps the exact legacy fallback chain for privileged roles
  // (Salary → Current → Expected → em dash) and is withheld entirely otherwise.
  const legacySalary = r.salary || r.current_salary || r.expected_salary || '—';
  const legacyPreviousSalary = r.current_salary || r.previous_salary || '';

  const locationCode = r.location_code
    || (r.location_id === 1 ? 'BEL' : r.location_id === 2 ? 'DAV' : r.location_id === 3 ? 'SHI' : null);

  return {
    // ── identity (legacy contract, used by Attendance / Dashboard /
    //    DepartmentHiring / SectionAllocation / GlobalSearch) ──────────
    id: r.user_id,
    userId: r.user_id,
    username: r.username || '',
    appNo: r.app_no,
    candidateAppNo: sensitive ? (r.candidate_app_no || null) : null,
    employeeCode: r.app_no,
    employeeId: sensitive ? (r.emp_no || '') : '',
    empNo: sensitive ? (r.emp_no || '') : '',
    role: r.role || '',
    active: !!r.active,
    accountStatus: r.active ? 'Active' : 'Inactive',
    lastLoginAt: sensitive ? (r.last_login_at || null) : null,
    lastLogin: sensitive && r.last_login_at ? (() => {
      try {
        const d = new Date(r.last_login_at);
        return isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN');
      } catch (_) { return ''; }
    })() : '',
    name,
    fullName: name,
    initials,
    color: AVATAR_COLORS[colorIndex],
    // PRIVACY PROTECTION: strictly withheld unless authorized
    phone: sensitive ? (r.phone || '') : '',
    email: sensitive ? (r.email || '') : '',
    dob: sensitive ? dob : '',
    age: sensitive ? computeAge(r.dob) : '',
    gender: sensitive ? (r.gender || '') : '',
    cityState: sensitive ? (r.city_state || '') : '',
    address: sensitive ? (r.address || '') : '',
    desig: r.designation,
    designation: r.designation || '',
    department: r.department || '',
    branch: r.branch || '',
    reportingManager: sensitive ? (r.reporting_manager || '') : '',
    status: r.status_display || (r.active ? 'Joined' : 'Deactivated'),
    salary: sensitive ? legacySalary : '',
    expectedSalary: sensitive ? (r.expected_salary || '') : '',
    currentSalary: sensitive ? (r.current_salary || '') : '',
    previousSalary: sensitive ? legacyPreviousSalary : '',
    offeredDoj: sensitive ? offeredDoj : '',
    actualDoj: sensitive ? actualDojStr : '',
    estDoj: sensitive ? estDojStr : '',
    joiningDate: joining,
    noticePeriod: sensitive ? (r.notice_period || r.offer_notice_pd || r.offer_status || '') : '',
    experience: sensitive ? (r.experience || '') : '',
    qualification: sensitive ? (r.qualification || '') : '',
    retailExperience: sensitive ? (r.retail_experience || '') : '',
    previousCompany: sensitive ? (r.previous_company || '') : '',
    previousDesignation: sensitive ? (r.previous_designation || '') : '',
    bloodGroup: sensitive ? (r.blood_group || '') : '',
    aadhaarNumber: sensitive ? (r.aadhaar_number || '') : '',
    fatherDetails: sensitive ? (r.father_details || '') : '',
    motherDetails: sensitive ? (r.mother_details || '') : '',
    religionCaste: sensitive ? (r.religion_caste || '') : '',
    religion: sensitive ? (r.religion || '') : '',
    caste: sensitive ? (r.caste || '') : '',
    languagesKnown: sensitive ? (() => {
      try {
        if (!r.languages_known) return [];
        if (Array.isArray(r.languages_known)) return r.languages_known;
        if (typeof r.languages_known !== 'string') return [String(r.languages_known)];
        const trimmed = r.languages_known.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed;
        }
        return trimmed.split(',').map(s => s.trim()).filter(Boolean);
      } catch { return [String(r.languages_known)]; }
    })() : [],
    photoUrl: r.photo_url || '',
    aadhaarUrl: sensitive ? (r.aadhaar_url || '') : '',
    aadharUrl: sensitive ? (r.aadhaar_url || '') : '',
    resumeUrl: sensitive ? (r.resume_url || '') : '',
    source: sensitive ? (r.source || '') : '',
    referrer: sensitive ? (r.referrer || '') : '',
    referrerEmpNo: sensitive ? (r.referrer_emp_no || '') : '',
    sourceDetail: sensitive ? (r.source_detail || '') : '',
    q1: sensitive ? (r.q1 || '') : '',
    q2: sensitive ? (r.q2 || '') : '',
    q3: sensitive ? (r.q3 || '') : '',
    q4: sensitive ? (r.q4 || '') : '',
    remarks: sensitive ? (r.remarks || r.offer_remarks || '') : '',
    section: r.section || '',
    locationId: r.location_id || null,
    locationCode,
    locationName: r.location_name || '',
    createdAt: r.created_at || null,
    rawDate: joiningDateObj.getTime(),
    date: (() => {
      try {
        return joiningDateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (_) {
        return '';
      }
    })(),

    // ── Employee Master Directory extensions ──────────────────────────
    alternatePhone: sensitive ? (r.alternate_phone || '') : '',
    companyEmail: sensitive ? (r.company_email || '') : '',
    permanentAddress: sensitive ? (r.permanent_address || '') : '',
    city: sensitive ? (r.city || '') : '',
    district: sensitive ? (r.district || '') : '',
    state: sensitive ? (r.state || '') : '',
    pincode: sensitive ? (r.pincode || '') : '',
    emergencyContactName: sensitive ? (r.emergency_contact_name || '') : '',
    emergencyContactPhone: sensitive ? (r.emergency_contact_phone || '') : '',
    emergencyContactRelation: sensitive ? (r.emergency_contact_relation || '') : '',
    employmentType: r.employment_type || '',
    floor: r.floor || '',
    workShift: r.work_shift || '',
    confirmationDate: sensitive ? formatDate(r.confirmation_date) : '',
    employmentStatus: r.employment_status || '',
    bankName: sensitive ? (r.bank_name || '') : '',
    bankAccountNumber: sensitive ? (r.bank_account_number || '') : '',
    ifscCode: sensitive ? (r.ifsc_code || '') : '',
    panNumber: sensitive ? (r.pan_number || '') : '',
    hrNotes: sensitive ? (r.hr_notes || '') : '',
    notes: sensitive ? (r.hr_notes || r.remarks || '') : '',
    offerStatus: sensitive ? (r.offer_status || '') : '',
    offerEstDoj: sensitive ? formatDate(r.offer_est_doj) : '',
    offerActualDoj: sensitive ? formatDate(r.offer_actual_doj) : '',
    createdBy: sensitive ? (r.created_by || '') : '',
    updatedBy: sensitive ? (r.updated_by || '') : '',
    updatedAt: r.user_updated_at || null,
    deactivationReason: sensitive ? (r.deactivation_reason || '') : '',
    deactivatedUntil: sensitive ? (r.deactivated_until || null) : null,
    forcePasswordReset: sensitive ? !!r.force_password_reset : false,
    // Lets the UI hide an entire Compensation / Documents block instead of
    // rendering empty labels for values it is not allowed to receive.
    canViewSensitive: sensitive
  };
}

function dedupeRows(rows) {
  // The `candidates` join is deliberately loose (app_no OR employee_id OR
  // phone), so a single user can match several candidate rows. Keep exactly
  // one row per user, preferring the record explicitly linked by app_no.
  const best = new Map();
  const rank = (row) => {
    if (row.candidate_app_no && row.app_no === row.candidate_app_no) return 0;
    if (row.candidate_app_no || row.app_no) return 1;
    return 2;
  };
  for (const row of rows) {
    const key = row.user_id;
    if (!best.has(key)) {
      best.set(key, row);
      continue;
    }
    if (rank(row) < rank(best.get(key))) best.set(key, row);
  }
  return Array.from(best.values());
}

// ── Directory listing ──────────────────────────────────────────────
/**
 * Server-side search + filter + sort + pagination for the directory.
 * `page`/`limit` are optional — without them the whole scoped set is returned
 * so the pre-existing consumers of GET /employees keep working unchanged.
 */
async function listEmployees(req, query = {}) {
  const actions = await resolveEmployeeActions(req.user);
  const built = await buildEmployeeQuery(req, {
    includeInactive: query.include === 'all' || query.includeInactive === '1'
  });
  const { select, from, locParams, statusSql, sorts } = built;

  const where = [];
  const params = [...locParams];

  if (query.q && String(query.q).trim()) {
    addSearchClause(where, params, String(query.q).trim().toLowerCase(), built.has, actions.can_view_sensitive);
  }
  if (query.department) {
    where.push(`LOWER(COALESCE(u.department, '')) = ?`);
    params.push(String(query.department).toLowerCase().trim());
  }
  if (query.section) {
    where.push(`(LOWER(COALESCE(u.section, '')) = ? OR LOWER(COALESCE(u.section, '')) LIKE ?)`);
    const v = String(query.section).toLowerCase().trim();
    params.push(v, `%${v}%`);
  }
  if (query.designation) {
    where.push(`LOWER(COALESCE(u.designation, '')) = ?`);
    params.push(String(query.designation).toLowerCase().trim());
  }
  // NOTE: location scoping is applied by getLocationFilter() inside `from`.
  // It already honours ?locationId for global/multi-location admins and
  // hard-clamps single-location users, so no client location is trusted here.
  if (query.status && query.status !== 'all') {
    where.push(`${statusSql} = ?`);
    params.push(String(query.status).trim());
  }
  if (query.dateFrom) {
    where.push(`${JOINING_EXPR} >= ?`);
    params.push(String(query.dateFrom).slice(0, 10));
  }
  if (query.dateTo) {
    where.push(`${JOINING_EXPR} <= ?`);
    params.push(String(query.dateTo).slice(0, 10));
  }

  const whereSql = where.length ? `AND ${where.join('\nAND ')}` : '';
  const orderBy = sorts[query.sort] || sorts.name;

  // Pagination is opt-in: legacy consumers of GET /employees send no
  // page/limit and must still receive the full scoped list.
  const rawPage = parseInt(query.page, 10);
  const rawLimit = parseInt(query.limit, 10);
  const paginated = Number.isFinite(rawPage) && Number.isFinite(rawLimit) && rawPage > 0 && rawLimit > 0;
  const page = paginated ? rawPage : 1;
  const limit = paginated ? Math.min(rawLimit, 500) : 0;

  const [rows] = await pool.query(
    `${select} ${from} ${whereSql} ORDER BY ${orderBy}${paginated ? ' LIMIT ? OFFSET ?' : ''}`,
    paginated ? [...params, limit, (page - 1) * limit] : params
  );

  const deduped = dedupeRows(rows);
  const employees = deduped.map(r => mapEmployeeRow(r, { sensitive: actions.can_view_sensitive }));

  const filteredTotal = paginated ? await countFiltered(from, whereSql, params) : employees.length;

  const [stats, facets] = await Promise.all([
    computeStats(req),
    computeFacets(req)
  ]);

  return {
    employees,
    total: employees.length,
    filteredTotal,
    page: paginated ? page : 1,
    pageSize: paginated ? limit : employees.length,
    stats,
    facets,
    actions
  };
}

async function countFiltered(from, whereSql, params) {
  try {
    const [[row]] = await pool.query(`SELECT COUNT(DISTINCT u.id) as cnt ${from} ${whereSql}`, params);
    return Number(row?.cnt || 0);
  } catch (err) {
    return 0;
  }
}

async function computeStats(req) {
  const { from, locParams, statusSql, has } = await buildEmployeeQuery(req, { includeInactive: true });
  const statusList = has('employment_status')
    ? `COALESCE(NULLIF(u.employment_status, ''), '')`
    : `''`;
  try {
    const [[row]] = await pool.query(`
      SELECT
        COUNT(DISTINCT u.id) as total,
        COUNT(DISTINCT CASE WHEN u.active = 1 THEN u.id END) as active,
        COUNT(DISTINCT CASE WHEN u.active = 0 THEN u.id END) as inactive,
        COUNT(DISTINCT CASE WHEN u.active = 1 AND COALESCE(u.section, '') != '' THEN u.id END) as allocated,
        COUNT(DISTINCT CASE WHEN u.active = 1 AND COALESCE(u.section, '') != '' THEN u.section END) as sections,
        COUNT(DISTINCT CASE WHEN u.active = 1 AND COALESCE(u.designation, '') != '' THEN u.designation END) as designations,
        COUNT(DISTINCT CASE WHEN u.active = 1 AND COALESCE(u.department, '') != '' THEN u.department END) as departments,
        COUNT(DISTINCT CASE WHEN u.active = 1 AND u.location_id IS NOT NULL THEN u.location_id END) as locations,
        COUNT(DISTINCT CASE WHEN u.active = 1 AND COALESCE(u.joining_date, u.actual_doj, u.created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN u.id END) as new_joiners,
        COUNT(DISTINCT CASE WHEN u.active = 1 AND ${statusList} IN ('On Leave', 'Probation') THEN u.id END) as on_leave_or_probation,
        COUNT(DISTINCT CASE WHEN u.active = 1 AND ${statusSql} = 'Joined' THEN u.id END) as joined,
        COUNT(DISTINCT CASE WHEN u.active = 1 AND ${statusSql} = 'Active' THEN u.id END) as on_active
      ${from}
    `, locParams);

    return {
      total: Number(row?.total || 0),
      active: Number(row?.active || 0),
      inactive: Number(row?.inactive || 0),
      allocated: Number(row?.allocated || 0),
      sections: Number(row?.sections || 0),
      designations: Number(row?.designations || 0),
      departments: Number(row?.departments || 0),
      locations: Number(row?.locations || 0),
      newJoiners: Number(row?.new_joiners || 0),
      onLeaveOrProbation: Number(row?.on_leave_or_probation || 0),
      joined: Number(row?.joined || 0),
      onActive: Number(row?.on_active || 0)
    };
  } catch (err) {
    console.warn('[EmployeeMaster] stats skipped:', err.message);
    return {
      total: 0, active: 0, inactive: 0, allocated: 0, sections: 0,
      designations: 0, departments: 0, locations: 0, newJoiners: 0,
      onLeaveOrProbation: 0, joined: 0, onActive: 0
    };
  }
}

async function computeFacets(req) {
  const { from, locParams, statusSql, has } = await buildEmployeeQuery(req, { includeInactive: true });
  const empty = { departments: [], sections: [], designations: [], locations: [], statuses: [] };

  try {
    const [deptRows] = await pool.query(
      `SELECT DISTINCT COALESCE(NULLIF(u.department, ''), '') as v ${from} AND u.active = 1 ORDER BY v`,
      locParams
    );
    const [sectionRows] = await pool.query(
      `SELECT DISTINCT COALESCE(NULLIF(u.section, ''), '') as v ${from} AND u.active = 1 ORDER BY v`,
      locParams
    );
    const [desigRows] = await pool.query(
      `SELECT DISTINCT COALESCE(NULLIF(u.designation, ''), '') as v ${from} AND u.active = 1 ORDER BY v`,
      locParams
    );
    const [statusRows] = await pool.query(
      `SELECT DISTINCT ${statusSql} as v ${from} ORDER BY v`,
      locParams
    );

    let sectionMaster = [];
    let designationMaster = [];
    try {
      const [sections] = await pool.query(
        'SELECT DISTINCT section_name FROM department_sections WHERE active = TRUE ORDER BY section_name'
      );
      sectionMaster = sections.map(r => r.section_name);
    } catch (e) { /* table optional */ }
    try {
      const [designations] = await pool.query(
        'SELECT DISTINCT name FROM designations WHERE active = TRUE ORDER BY name'
      );
      designationMaster = designations.map(r => r.name);
    } catch (e) { /* table optional */ }

    const locations = await listVisibleLocations(req);

    const uniq = (list) => Array.from(new Set((list || []).filter(Boolean)));

    return {
      departments: uniq(deptRows.map(r => r.v)),
      sections: uniq([...sectionRows.map(r => r.v), ...sectionMaster]),
      designations: uniq([...desigRows.map(r => r.v), ...designationMaster]),
      locations,
      statuses: uniq([...EMPLOYEE_STATUSES, ...statusRows.map(r => r.v)])
    };
  } catch (err) {
    console.warn('[EmployeeMaster] facets skipped:', err.message);
    return empty;
  }
}

/**
 * Locations the signed-in administrator is allowed to switch to.
 * Never echoes a location id the caller cannot actually query.
 */
async function listVisibleLocations(req) {
  const user = req.user;
  if (!user) return [];
  const isAdminRole = ADMIN_ROLES.includes(user.role);
  const isGlobalAdmin = isAdminRole && (!user.locationId || user.isGlobalAdmin);
  try {
    if (isGlobalAdmin) {
      const [rows] = await pool.query(
        "SELECT id, location_name FROM locations WHERE status = 'Active' ORDER BY sort_order, id"
      );
      return rows.map(r => ({ id: r.id, name: r.location_name }));
    }

    let allowed = Array.isArray(user.allowedLocations) && user.allowedLocations.length
      ? [...user.allowedLocations]
      : (user.locationId ? [user.locationId] : []);

    if (allowed.length === 0 && user.id) {
      try {
        const [rows] = await pool.query(
          'SELECT location_id FROM user_locations WHERE user_id = ?',
          [user.id]
        );
        allowed = rows.map(r => r.location_id);
      } catch (e) { /* junction table optional */ }
    }

    if (allowed.length === 0) return [];

    const placeholders = allowed.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT id, location_name FROM locations WHERE id IN (${placeholders}) AND status = 'Active' ORDER BY sort_order, id`,
      allowed
    );
    return rows.map(r => ({ id: r.id, name: r.location_name }));
  } catch (err) {
    console.warn('[EmployeeMaster] locations facet skipped:', err.message);
    return [];
  }
}

// ── Single employee profile ────────────────────────────────────────
async function resolveEmployeeRecord(req, identifier) {
  const value = String(identifier ?? '').trim();
  if (!value) return null;

  try {
    const isNumeric = /^\d+$/.test(value);
    const { select, from, locParams } = await buildEmployeeQuery(req, { includeInactive: true });

    const match = isNumeric
      ? 'u.id = ?'
      : '(LOWER(u.username) = ? OR LOWER(u.employee_id) = ? OR LOWER(u.candidate_app_no) = ? OR LOWER(c.app_no) = ? OR LOWER(u.email) = ?)';

    const matchParams = isNumeric
      ? [Number(value)]
      : [value.toLowerCase(), value.toLowerCase(), value.toLowerCase(), value.toLowerCase(), value.toLowerCase()];

    const [rows] = await pool.query(
      `${select} ${from} AND ${match} LIMIT 5`,
      [...locParams, ...matchParams]
    );

    const deduped = dedupeRows(rows);
    if (deduped.length) return deduped[0];
  } catch (err) {
    console.warn('[EmployeeMaster] resolveEmployeeRecord query fallback:', err.message);
  }

  return resolveUnrestrictedRow(identifier);
}

/**
 * Loads a complete, permission-filtered employee profile.
 * Returns null when the record does not exist OR when the caller's location
 * scope forbids seeing it — the two are indistinguishable from outside so a
 * restricted user can never probe for employees in other stores.
 */
async function getEmployeeProfile(req, identifier) {
  try {
    const actions = await resolveEmployeeActions(req.user);
    if (!actions.can_view) return { forbidden: true };

    let row = await resolveEmployeeRecord(req, identifier);
    let isUnrestricted = false;
    if (!row) {
      row = await resolveUnrestrictedRow(identifier);
      if (!row) return { notFound: true };
      isUnrestricted = true;
    }

    const inScope = isUnrestricted ? false : await assertLocationScope(req, row.location_id);
    const isAdmin = ADMIN_ROLES.includes(req.user?.role) || req.user?.isGlobalAdmin;
    const isApproved = await hasApprovedAccessRequest(req.user?.id, row.user_id || row.id);

    if (!isAdmin && !isApproved) {
      // Record unauthorized access attempt in security audit log
      try {
        await pool.query(
          `INSERT INTO audit_logs (username, user_id, action, module, details, ip_address)
           VALUES (?, ?, 'UNAUTHORIZED_EMPLOYEE_VIEW_ATTEMPT', 'Employee Master', ?, ?)`,
          [
            req.user?.username || 'unknown',
            req.user?.id || 0,
            `Denied unauthorized view attempt on confidential employee profile #${row.user_id || row.id} (${row.name}) by role ${req.user?.role}`,
            req.ip || ''
          ]
        );
      } catch (err) {}

      // Check if an access request already exists for this user and employee
      let existingRequest = null;
      try {
        const [reqRows] = await pool.query(
          `SELECT id, status, created_at, reason FROM employee_access_requests
           WHERE user_id = ? AND employee_id = ? ORDER BY id DESC LIMIT 1`,
          [req.user?.id, row.user_id || row.id]
        );
        if (reqRows && reqRows.length > 0) {
          existingRequest = reqRows[0];
        }
      } catch (e) {}

      return {
        forbidden: true,
        accessDenied: true,
        existingRequest,
        employeeSummary: {
          id: row.user_id || row.id,
          name: row.name || row.username || 'Employee',
          full_name: row.name || row.username || 'Employee',
          employee_code: row.app_no || row.employee_id || '',
          department: row.department || '',
          designation: row.designation || '',
          section: row.section || '',
          status: row.status_display || (row.active ? 'Joined' : 'Deactivated'),
          locationName: row.location_name || '',
          locationCode: row.location_code || ''
        }
      };
    }

    let profile;
    try {
      profile = mapEmployeeRow(row, { sensitive: true });
    } catch (mapErr) {
      console.warn('[EmployeeMaster] mapEmployeeRow fallback:', mapErr.message);
      profile = {
        id: row.user_id || row.id,
        userId: row.user_id || row.id,
        username: row.username || '',
        name: row.name || row.full_name || row.username || 'Employee',
        fullName: row.name || row.full_name || row.username || 'Employee',
        employeeCode: row.app_no || row.employee_id || `EMP-${row.id || row.user_id}`,
        empNo: row.emp_no || row.employee_id || '',
        department: row.department || '',
        designation: row.designation || '',
        section: row.section || '',
        phone: row.phone || '',
        email: row.email || '',
        branch: row.location_name || row.branch || '',
        status: row.status_display || (row.active ? 'Joined' : 'Active')
      };
    }

    const [documents, permissions, audit] = await Promise.all([
      listDocuments(row.user_id || row.id).catch(() => []),
      loadAssignedAccess(row.user_id || row.id).catch(() => ({ modules: [], locations: [] })),
      loadAuditTrail(row.user_id || row.id, row.username, req.user).catch(() => [])
    ]);

    return {
      employee: profile,
      documents: documents || [],
      access: permissions || { modules: [], locations: [] },
      audit: audit || [],
      actions: { ...actions, can_edit: isAdmin, can_delete: isAdmin, can_view_sensitive: true }
    };
  } catch (err) {
    console.error('[EmployeeMaster.getEmployeeProfile] error:', err);
    throw err;
  }
}

async function resolveUnrestrictedRow(identifier) {
  const value = String(identifier ?? '').trim();
  if (!value) return null;
  const isNumeric = /^\d+$/.test(value);
  try {
    const [rows] = await pool.query(
      `SELECT u.id as user_id, u.id, u.username, u.full_name as name, u.email, u.phone,
              u.department, u.designation, u.section, u.active, u.location_id,
              u.employee_id as emp_no, COALESCE(u.candidate_app_no, u.employee_id, u.username) as app_no,
              u.joining_date, u.created_at, u.salary,
              l.location_name, l.location_code
       FROM users u
       LEFT JOIN locations l ON l.id = u.location_id
       WHERE ${isNumeric ? 'u.id = ?' : 'LOWER(u.username) = ? OR LOWER(u.employee_id) = ? OR LOWER(u.email) = ?'}
       LIMIT 1`,
      isNumeric ? [Number(value)] : [value.toLowerCase(), value.toLowerCase(), value.toLowerCase()]
    );
    if (rows && rows.length) return rows[0];

    // Fallback: check employees table if not found in users!
    const [empRows] = await pool.query(
      `SELECT e.id as user_id, e.id, e.name, e.name as username, e.email, e.phone,
              e.department, e.designation, e.section, 1 as active,
              COALESCE(e.app_no, e.employee_id, CONCAT('EMP-', e.id)) as app_no,
              e.employee_id as emp_no, e.branch as location_name, e.branch as location_code,
              e.joining_date, e.salary, e.status as status_display, e.created_at
       FROM employees e
       WHERE ${isNumeric ? 'e.id = ?' : 'LOWER(e.employee_id) = ? OR LOWER(e.email) = ? OR LOWER(e.name) = ?'}
       LIMIT 1`,
      isNumeric ? [Number(value)] : [value.toLowerCase(), value.toLowerCase(), value.toLowerCase()]
    );
    return empRows && empRows.length ? empRows[0] : null;
  } catch (err) {
    console.warn('[EmployeeMaster] resolveUnrestrictedRow lookup warning:', err.message);
    return null;
  }
}

async function assertLocationScope(req, locationId) {
  const user = req.user;
  if (!user) return false;
  const isAdminRole = ADMIN_ROLES.includes(user.role);
  const isGlobal = user.role === 'Super Admin' || (isAdminRole && (!user.locationId || user.isGlobalAdmin === true));
  if (!locationId) return isGlobal;
  if (isGlobal) return true;
  return checkLocationAccess(user, locationId);
}

async function loadAssignedAccess(userId) {
  const modules = [];
  try {
    const [rows] = await pool.query(
      `SELECT module, can_view, can_add, can_edit, can_delete, can_export, can_approve
         FROM user_permissions WHERE user_id = ? AND can_view = 1 ORDER BY module`,
      [userId]
    );
    modules.push(...rows);
  } catch (err) { /* permissions table optional */ }

  const locations = [];
  try {
    const [rows] = await pool.query(
      `SELECT l.id, l.location_name FROM user_locations ul
         JOIN locations l ON l.id = ul.location_id
        WHERE ul.user_id = ? ORDER BY l.sort_order`,
      [userId]
    );
    locations.push(...rows.map(r => ({ id: r.id, name: r.location_name })));
  } catch (err) { /* junction table optional */ }

  return { modules, locations };
}

async function loadAuditTrail(userId, username, requester) {
  if (!requester) return [];
  try {
    const [rows] = await pool.query(
      `SELECT id, username, action, module, details, ip_address, created_at, target_id, target_type
         FROM audit_logs
        WHERE (target_id = ? OR username = ?)
        ORDER BY created_at DESC
        LIMIT 50`,
      [String(userId), username || '']
    );
    return rows.map(r => ({
      id: r.id,
      username: r.username,
      action: r.action,
      module: r.module,
      details: r.details,
      ipAddress: r.ip_address,
      targetId: r.target_id,
      targetType: r.target_type,
      createdAt: r.created_at
    }));
  } catch (err) {
    return [];
  }
}

// ── Audit logging ──────────────────────────────────────────────────
async function auditEmployee(req, action, target, details = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (username, action, module, details, ip_address, user_id, location_id, success, target_id, target_type)
       VALUES (?, ?, 'EMPLOYEES', ?, ?, ?, ?, 1, ?, 'employee')`,
      [
        req.user ? req.user.username : 'SYSTEM',
        action,
        JSON.stringify(details || {}),
        req.ip || null,
        req.user ? req.user.id : null,
        target && target.location_id ? target.location_id : (req.user ? req.user.locationId || null : null),
        target ? String(target.id ?? target.user_id ?? '') : ''
      ]
    );
  } catch (err) {
    console.warn('[EmployeeMaster] audit skipped:', err.message);
  }
}

// ── Documents ──────────────────────────────────────────────────────
async function listDocuments(userId) {
  try {
    const [rows] = await pool.query(
      `SELECT id, document_type, file_name, file_path, file_size, file_ext, mime_type, uploaded_by, created_at
         FROM employee_documents
        WHERE user_id = ? AND deleted_at IS NULL
        ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map(r => ({
      id: r.id,
      documentType: r.document_type,
      fileName: r.file_name,
      fileSize: Number(r.file_size || 0),
      fileExt: r.file_ext,
      mimeType: r.mime_type,
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at,
      // Never hand a raw storage path to the browser — documents are only
      // reachable through the authorized download endpoint.
      downloadUrl: `/api/employees/${userId}/documents/${r.id}/download`
    }));
  } catch (err) {
    return [];
  }
}

async function getDocumentRow(userId, documentId) {
  try {
    const [rows] = await pool.query(
      `SELECT id, user_id, document_type, file_name, file_path, file_size, file_ext, mime_type, uploaded_by, created_at
         FROM employee_documents
        WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1`,
      [Number(documentId), Number(userId)]
    );
    return rows && rows.length ? rows[0] : null;
  } catch (err) {
    return null;
  }
}

async function saveDocument({ userId, documentType, fileName, filePath, fileSize, fileExt, mimeType, uploadedBy }) {
  const [result] = await pool.query(
    `INSERT INTO employee_documents
       (user_id, document_type, file_name, file_path, file_size, file_ext, mime_type, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, documentType, fileName, filePath, fileSize || 0, fileExt || null, mimeType || null, uploadedBy || null]
  );
  return result.insertId;
}

async function softDeleteDocument(documentId) {
  const [result] = await pool.query(
    'UPDATE employee_documents SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [Number(documentId)]
  );
  return result.affectedRows > 0;
}

module.exports = {
  EMPLOYEE_STATUSES,
  MASTER_COLUMNS,
  OPTIONAL_CANDIDATE_COLUMNS,
  resolveEmployeeActions,
  listEmployees,
  buildEmployeeQuery,
  listVisibleLocations,
  loadAuditTrail,
  getEmployeeProfile,
  resolveEmployeeRecord,
  mapEmployeeRow,
  formatDate,
  displayDate,
  computeAge,
  auditEmployee,
  listDocuments,
  getDocumentRow,
  saveDocument,
  softDeleteDocument,
  assertLocationScope,
  hasApprovedAccessRequest
};
