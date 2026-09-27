/**
 * Enterprise Input Sanitization Middleware
 * Neutralizes malicious script tags and control characters from user input
 * while strictly preserving legitimate punctuation, names, quotes, and notes.
 */

// Patterns to strip from free-text strings
const DANGEROUS_PATTERNS = [
  /<\s*script[^>]*>[\s\S]*?<\s*\/script\s*>/gi, // Strip <script>...</script>
  /<\s*script[^>]*>/gi,                          // Strip standalone <script>
  /javascript\s*:\s*/gi,                         // Strip javascript: protocol
  /vbscript\s*:\s*/gi,                           // Strip vbscript: protocol
  /\bon(?:load|error|click|mouseover|focus|submit|reset)\s*=\s*['"][^'"]*['"]/gi, // Strip event attributes
  /\0/g                                          // Strip null bytes
];

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  let clean = str;
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, '');
  }
  return clean.trim();
}

function sanitizeData(data, depth = 0) {
  if (depth > 5 || data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const cleanObj = {};
    for (const [key, value] of Object.entries(data)) {
      // Clean key name
      const cleanKey = sanitizeString(key);
      cleanObj[cleanKey] = sanitizeData(value, depth + 1);
    }
    return cleanObj;
  }

  return data;
}

const inputSanitizer = (req, res, next) => {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeData(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeData(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeData(req.params);
    }
  } catch (err) {
    console.warn('[Input Sanitizer Warning]', err.message);
  }
  next();
};

module.exports = {
  inputSanitizer,
  sanitizeString,
  sanitizeData
};
