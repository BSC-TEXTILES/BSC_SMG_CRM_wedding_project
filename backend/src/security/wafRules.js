/**
 * Enterprise Web Application Firewall (WAF) Rule Definitions
 * High-performance regex patterns designed to catch real-world attack vectors
 * without producing false positives on legitimate business data.
 */

// ── SQL Injection Patterns ────────────────────────────────────────────────────
const SQLI_PATTERNS = [
  // UNION SELECT injection
  /\bunion\s+(?:all\s+)?select\b/i,
  // Boolean-based tautologies: ' OR 1=1, " OR ""="", ' OR 'a'='a
  /(?:\bor\b|\band\b)\s+['"]?[\w.-]+['"]?\s*=\s*['"]?[\w.-]+['"]?/i,
  // Stacked queries with dangerous DDL/DML: ; DROP TABLE, ; TRUNCATE TABLE
  /;\s*(?:drop|alter|truncate|delete\s+from|grant|revoke)\s+[a-z0-9_`]/i,
  // Time-based blind SQLi functions
  /\b(?:sleep\s*\(\s*\d+\s*\)|benchmark\s*\(\s*\d+|waitfor\s+delay\s+['"]|pg_sleep\s*\(\s*\d+\s*\))/i,
  // Information schema & database metadata harvesting
  /\b(?:information_schema\b|sys\.tables\b|sys\.databases\b|load_file\s*\(|into\s+(?:dumpfile|outfile)\s*['"])/i,
  // SQL comment-based bypasses: /*!50000 SELECT ... */ or inline hex/eval
  /\/\*!\d*select/i
];

// ── Cross-Site Scripting (XSS) Patterns ───────────────────────────────────────
const XSS_PATTERNS = [
  // Explicit script tags: <script>, <script src=...>
  /<\s*script[^>]*>/i,
  // JavaScript URI pseudo-protocol: javascript:alert(1)
  /javascript\s*:\s*[^;\s]+/i,
  // VBScript pseudo-protocol
  /vbscript\s*:/i,
  // Inline HTML event handlers: onload=, onerror=, onmouseover=
  /\bon(?:load|error|click|mouseover|mouseenter|focus|blur|change|submit|reset)\s*=\s*['"]?[^'">\s]+/i,
  // Dangerous HTML embed tags: <iframe, <object, <embed, <applet
  /<\s*(?:iframe|object|embed|applet|base)\b[^>]*>/i,
  // Document object property manipulation: document.cookie, document.location
  /\bdocument\.(?:cookie|location|domain|write)\b/i,
  // Malicious JS execution functions: eval(), alert(), prompt() inside tags or expressions
  /<[^>]*(?:eval|alert|prompt|confirm|expression)\s*\([^)]*\)[^>]*>/i,
  // SVG onload injection: <svg onload=...
  /<\s*svg[^>]*\bon[a-z]+\s*=/i,
  // Image tag with inline error payload: <img src=x onerror=...
  /<\s*img[^>]*\bonerror\s*=/i
];

// ── Command Injection Patterns ───────────────────────────────────────────────
const COMMAND_INJECTION_PATTERNS = [
  // Chained shell execution targeting critical system files or binaries
  /(?:;|\||`|&&|\$\()\s*(?:cat\s+\/etc\/passwd|nc\s+-[e\w]|bash\s+-i|cmd(?:\.exe)?\s+\/c|powershell(?:\.exe)?\s+-[e\w]|\/bin\/sh|\/bin\/bash|wget\s+http|curl\s+http)\b/i,
  // Windows-specific command chaining
  /&(?:dir|net\s+user|whoami|ipconfig|systeminfo)\b/i,
  // Unix-specific command execution
  /(?:^|[\s;|&`])(?:whoami|uname\s+-a|id\s+-u)(?:[\s;|&`]|$)/i
];

// ── Path Traversal & Null Byte Patterns ──────────────────────────────────────
const PATH_TRAVERSAL_PATTERNS = [
  // Standard dot-dot-slash: ../, ..\, %2e%2e/, %2e%2e\
  /(?:\.\.[/\\]|\.\.%2f|\.\.%5c|%2e%2e[/\\]|%2e%2e%2f|%2e%2e%5c)/i,
  // Encoded directory traversal
  /(?:%252e%252e|%c0%ae%c0%ae)/i,
  // Null byte injection: \0, %00
  /(?:\0|%00)/
];

// ── Malicious Automated Scanner Signatures ────────────────────────────────────
const SCANNER_USER_AGENTS = [
  /\bsqlmap\b/i,
  /\bnikto\b/i,
  /\bacunetix\b/i,
  /\bmasscan\b/i,
  /\bdirbuster\b/i,
  /\bgobuster\b/i,
  /\bwpscan\b/i,
  /\bopenvas\b/i,
  /\bnessus\b/i,
  /\bwebinspect\b/i
];

// ── Whitelisted HTTP Methods ──────────────────────────────────────────────────
const ALLOWED_HTTP_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD'
]);

/**
 * Inspect a single string value against all active WAF rule sets.
 * Returns null if clean, or an object describing the violation.
 */
function inspectString(val, keyName = '') {
  if (typeof val !== 'string' || val.length === 0) return null;

  // 1. Path Traversal & Null Byte check
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(val)) {
      return {
        type: 'PATH_TRAVERSAL',
        rule: pattern.toString(),
        field: keyName,
        sample: val.substring(0, 100)
      };
    }
  }

  // Skip deep SQLi / XSS inspection for fields that are known hashes or UUIDs
  if (/^[a-f0-9]{32,64}$/i.test(val)) return null;

  // 2. SQL Injection check
  for (const pattern of SQLI_PATTERNS) {
    if (pattern.test(val)) {
      return {
        type: 'SQLI',
        rule: pattern.toString(),
        field: keyName,
        sample: val.substring(0, 100)
      };
    }
  }

  // 3. XSS check
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(val)) {
      return {
        type: 'XSS',
        rule: pattern.toString(),
        field: keyName,
        sample: val.substring(0, 100)
      };
    }
  }

  // 4. Command Injection check
  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(val)) {
      return {
        type: 'COMMAND_INJECTION',
        rule: pattern.toString(),
        field: keyName,
        sample: val.substring(0, 100)
      };
    }
  }

  return null;
}

/**
 * Deep recursive inspection of objects, arrays, and primitive values.
 * Bounded by maxDepth to prevent recursive depth exhaustion attacks.
 */
function inspectObject(obj, maxDepth = 5, currentDepth = 0) {
  if (currentDepth > maxDepth || obj === null || obj === undefined) return null;

  if (typeof obj === 'string') {
    return inspectString(obj);
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const violation = inspectObject(obj[i], maxDepth, currentDepth + 1);
      if (violation) return violation;
    }
    return null;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      // Check the key name itself (e.g. NoSQL injection keys like $gt, $where)
      if (key.startsWith('$') || key.includes('\0') || key.includes('..')) {
        return {
          type: 'MALFORMED_KEY',
          rule: 'Illegal key characters',
          field: key,
          sample: key
        };
      }

      const keyViolation = inspectString(key, 'key');
      if (keyViolation) return keyViolation;

      const valViolation = inspectObject(value, maxDepth, currentDepth + 1);
      if (valViolation) {
        valViolation.field = key;
        return valViolation;
      }
    }
  }

  return null;
}

module.exports = {
  SQLI_PATTERNS,
  XSS_PATTERNS,
  COMMAND_INJECTION_PATTERNS,
  PATH_TRAVERSAL_PATTERNS,
  SCANNER_USER_AGENTS,
  ALLOWED_HTTP_METHODS,
  inspectString,
  inspectObject
};
