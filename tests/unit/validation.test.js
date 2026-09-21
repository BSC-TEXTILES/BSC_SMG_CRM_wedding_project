const test = require('node:test');
const assert = require('node:assert');
const { 
  isValidEmail, 
  isValidMobile, 
  validatePasswordPolicy, 
  isValidUsername 
} = require('../../backend/src/validators/userValidator');

test('Email Validation', (t) => {
  assert.strictEqual(isValidEmail('test@example.com'), true);
  assert.strictEqual(isValidEmail('user.name+tag@company.co.in'), true);
  
  assert.strictEqual(isValidEmail('invalid-email'), false);
  assert.strictEqual(isValidEmail('@missinguser.com'), false);
  assert.strictEqual(isValidEmail('spaces in@email.com'), false);
  assert.strictEqual(isValidEmail(''), false);
  assert.strictEqual(isValidEmail(null), false);
});

test('Mobile Number Validation (Indian Format)', (t) => {
  assert.strictEqual(isValidMobile('9876543210'), true);
  assert.strictEqual(isValidMobile('+919876543210'), true);
  assert.strictEqual(isValidMobile('09876543210'), true);
  
  // Fails on non-Indian prefixes/formats assuming basic rules
  assert.strictEqual(isValidMobile('1234567890'), false); // Doesn't start with 6-9
  assert.strictEqual(isValidMobile('98765'), false); // Too short
  assert.strictEqual(isValidMobile('abcdefghij'), false); // Letters
});

test('Password Policy Validation', (t) => {
  // Policy was deliberately relaxed to a 6-character minimum
  // (commit "Relax password and phone validation rules") so existing
  // deployment accounts like 'bsc@123' can be managed without lockout.
  assert.strictEqual(validatePasswordPolicy('StrongPass123!'), null);
  assert.strictEqual(validatePasswordPolicy('A1b2C3d4E5'), null);
  assert.strictEqual(validatePasswordPolicy('bsc@123'), null);   // 7 chars — valid

  // Invalid passwords
  assert.ok(validatePasswordPolicy('short'), 'Should fail length < 6');
  assert.ok(validatePasswordPolicy(''), 'Should fail empty');
  assert.ok(validatePasswordPolicy(null), 'Should fail missing');
  assert.ok(validatePasswordPolicy(123456), 'Should fail non-string');
});

test('Username Format Validation', (t) => {
  assert.strictEqual(isValidUsername('admin.user'), true);
  assert.strictEqual(isValidUsername('hr_manager'), true);
  assert.strictEqual(isValidUsername('user@domain.com'), true);
  assert.strictEqual(isValidUsername('Full Name User'), true); // names as usernames are allowed

  assert.strictEqual(isValidUsername('ab'), false); // Too short (< 3)
  assert.strictEqual(isValidUsername('a'.repeat(101)), false); // Too long (> 100)
  assert.strictEqual(isValidUsername('user!invalid'), false); // Illegal character
  assert.strictEqual(isValidUsername(''), false);
});
