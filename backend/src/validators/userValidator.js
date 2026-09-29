/**
 * BSC Textiles Portal — User Input Validator
 * Server-side validation for user management operations.
 * Frontend validation is supplementary — never trust it.
 */

const db = require('../config/db');
const { errorRes } = require('../utils/response');

// Password policy: at least 6 chars
function validatePasswordPolicy(password) {
  if (!password || typeof password !== 'string') return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters long';
  return null;
}

// Email format validation
function isValidEmail(email) {
  if (!email) return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
}

// Indian mobile number validation (10 digits, optionally prefixed with +91 or 0)
// Normalizes to +91XXXXXXXXXX format
function isValidMobile(mobile) {
  if (!mobile) return true; // optional field
  const cleaned = mobile.replace(/[\s\-()]/g, '');
  const re = /^(\+91|0)?[6-9]\d{9}$/;
  return re.test(cleaned);
}

// Normalize phone to +91XXXXXXXXXX format
function normalizeMobile(mobile) {
  if (!mobile) return mobile;
  const cleaned = mobile.replace(/[\s\-()]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  // If starts with 91 and has 12 digits, add + prefix
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  // If 10 digits, prepend +91
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  // If starts with 0 and has 11 digits, replace 0 with +91
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  return cleaned;
}

// Username validation
function isValidUsername(username) {
  if (!username) return false;
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 100) return false;
  // Allow email-format usernames and alphanumeric+dots+underscores+hyphens+spaces
  const re = /^[a-zA-Z0-9._@+\-\s]+$/;
  return re.test(trimmed);
}

// System roles recognized across the platform
const VALID_SYSTEM_ROLES = [
  'Super Admin', 'Admin', 'Wedding Collection Manager', 'Team Lead', 'Telecaller', 'HR', 'Manager', 'Recruiter', 'Interviewer', 'Employee', 'Greeter', 'Guest',
  'HR Manager', 'CRM Manager', 'CRM Executive', 'VM Extension Telecaller'
];

async function isValidRole(role) {
  if (!role || typeof role !== 'string') return false;
  const trimmed = role.trim();
  if (VALID_SYSTEM_ROLES.some(r => r.toLowerCase() === trimmed.toLowerCase())) return true;
  try {
    const [rows] = await db.query(
      `SELECT roleName FROM role WHERE LOWER(roleName) = ?`,
      [trimmed.toLowerCase()]
    );
    if (rows.length > 0) return true;
  } catch (e) {}
  try {
    const [rows2] = await db.query(`SELECT name FROM roles WHERE LOWER(name) = ?`, [trimmed.toLowerCase()]);
    if (rows2.length > 0) return true;
  } catch (e) {}
  return false;
}

/**
 * Validate create-user request body
 */
async function validateCreateUser(req, res, next) {
  const { username, password, confirmPassword, role, fullName, email, phone, employeeId } = req.body;
  const errors = [];

  // Required fields
  if (!username || !username.trim()) errors.push('Username is required');
  else if (!isValidUsername(username)) errors.push('Username must be 3-100 characters and contain only letters, numbers, dots, underscores, or @ symbols');

  if (!password) errors.push('Password is required');
  else {
    const pwdError = validatePasswordPolicy(password);
    if (pwdError) errors.push(pwdError);
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.push('Password and confirmation do not match');
  }

  if (!role) errors.push('Role is required');
  else {
    const valid = await isValidRole(role);
    if (!valid) {
      errors.push(`Invalid role "${role}".`);
    }
  }

  if (!fullName || !fullName.trim()) errors.push('Full name is required');
  else if (fullName.trim().length < 2 || fullName.trim().length > 150) errors.push('Full name must be 2-150 characters');

  // Optional but validated
  if (email && !isValidEmail(email)) errors.push('Invalid email format');
  if (phone && !isValidMobile(phone)) errors.push('Invalid phone number format');

  // Normalize phone to +91 format
  if (phone) req.body.phone = normalizeMobile(phone);

  if (employeeId && (typeof employeeId === 'string' && employeeId.length > 50)) errors.push('Employee ID must be under 50 characters');

  if (errors.length > 0) {
    return errorRes(res, 'Validation failed', errors, 400);
  }

  next();
}

/**
 * Validate update-user request body
 */
async function validateUpdateUser(req, res, next) {
  const { fullName, email, phone, role } = req.body;
  const errors = [];

  if (fullName !== undefined && (fullName.trim().length < 2 || fullName.trim().length > 150)) {
    errors.push('Full name must be 2-150 characters');
  }

  if (email !== undefined && email && !isValidEmail(email)) {
    errors.push('Invalid email format');
  }

  if (phone !== undefined && phone && !isValidMobile(phone)) {
    errors.push('Invalid phone number format');
  }

  // Normalize phone to +91 format
  if (phone !== undefined && phone) req.body.phone = normalizeMobile(phone);

  if (role !== undefined) {
    const valid = await isValidRole(role);
    if (!valid) {
      errors.push(`Invalid role "${role}".`);
    }
  }

  if (errors.length > 0) {
    return errorRes(res, 'Validation failed', errors, 400);
  }

  next();
}

/**
 * Validate password reset/change request
 */
function validatePasswordChange(req, res, next) {
  const { password, confirmPassword } = req.body;
  const errors = [];

  if (!password) {
    errors.push('New password is required');
  } else {
    const pwdError = validatePasswordPolicy(password);
    if (pwdError) errors.push(pwdError);
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    errors.push('Password and confirmation do not match');
  }

  if (errors.length > 0) {
    return errorRes(res, 'Validation failed', errors, 400);
  }

  next();
}

module.exports = {
  validateCreateUser,
  validateUpdateUser,
  validatePasswordChange,
  validatePasswordPolicy,
  isValidEmail,
  isValidMobile,
  normalizeMobile,
  isValidUsername
};

