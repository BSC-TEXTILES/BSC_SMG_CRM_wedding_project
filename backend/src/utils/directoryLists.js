// Shared department/designation option lists for user creation & management.
// These are merged with any values already present in the database so that
// hand-entered / legacy values never disappear from the dropdowns.

const DEFAULT_DEPARTMENTS = [
  'Sales',
  'HR',
  'Cashier',
  'Admin',
  'Management',
  'Operations',
  'Marketing',
  'IT',
  'Customer Support',
  'Visual Merchandising',
  'Logistics/Stock',
  'Telecalling',
  'Security'
];

const DEFAULT_DESIGNATIONS = [
  'Super Admin',
  'Admin',
  'Wedding Collection Manager',
  'Team Lead',
  'Telecaller',
  'HR',
  'Manager',
  'Recruiter',
  'Interviewer',
  'Employee',
  'Greeter',
  'Guest',
  'HR Manager',
  'CRM Manager',
  'CRM Executive',
  'VM Extension Telecaller',
  'Store Manager',
  'Assistant Store Manager',
  'Sales Executive',
  'HR Executive',
  'Cashier',
  'Head Cashier',
  'Floor Manager',
  'System Admin',
  'Admin Assistant',
  'Team Leader',
  'Security Guard',
  'Visual Merchandiser',
  'Inventory Manager',
  'Accountant'
];

// Case-insensitive de-dup, preserving first-seen casing and input order.
function mergeOptions(defaults = [], extra = []) {
  const seen = new Map();
  const push = (value) => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.set(key, text);
  };
  defaults.forEach(push);
  extra.forEach(push);
  return Array.from(seen.values());
}

module.exports = {
  DEFAULT_DEPARTMENTS,
  DEFAULT_DESIGNATIONS,
  mergeOptions
};
