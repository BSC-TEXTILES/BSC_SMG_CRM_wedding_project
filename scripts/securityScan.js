#!/usr/bin/env node
/**
 * BSC Security Scanner & Pre-Commit Hardening Hook
 * Scans codebase and staged changes for:
 * 1. Hardcoded API keys and secrets
 * 2. Bearer token strings
 * 3. Private key blocks (RSA/OPENSSH/EC)
 * 4. Database connection strings containing passwords
 * 5. Tracked .env files committed to git
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

const SENSITIVE_PATTERNS = [
  { name: 'Private Key Block', regex: /-----BEGIN\s+(?:RSA|OPENSSH|DSA|EC|PGP)?\s*PRIVATE KEY-----/i },
  { name: 'Bearer Token Literal', regex: /Bearer\s+[A-Za-z0-9\-_]{30,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}/i },
  { name: 'Hardcoded DB Connection String with Credentials', regex: /(?:mysql|postgres|mongodb|redis):\/\/[a-zA-Z0-9_\-]+:[^@\s]{4,}@[a-zA-Z0-9\-_\.]+/i },
  { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'AWS Secret Key', regex: /\b[0-9a-zA-Z/+=]{40}\b(?=.*(?:aws_secret|AWS_SECRET))/i },
  { name: 'Google API Key', regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { name: 'Generic Secret Assignment', regex: /(?:jwt_secret|refresh_secret|api_key|app_secret|db_password)\s*[:=]\s*['"][a-zA-Z0-9!@#$%^&*()_+]{8,}['"]/i }
];

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.system_generated'
]);

let violations = [];

// 1. Check if git is tracking any real .env files
try {
  const trackedFiles = execSync('git ls-files', { cwd: ROOT_DIR, encoding: 'utf8' }).split('\n');
  for (const file of trackedFiles) {
    const trimmed = file.trim();
    if (!trimmed) continue;
    const base = path.basename(trimmed);
    if (base.startsWith('.env') && !base.endsWith('.example')) {
      violations.push({
        file: trimmed,
        line: 1,
        rule: 'Tracked .env file in git repository! Remove from git index using git rm --cached',
        preview: base
      });
    }
  }
} catch (e) {
  // Not a git repo or git not available, continue file scanning
}

function scanFile(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  const fileName = path.basename(filePath);

  // Skip .example templates
  if (fileName.endsWith('.example')) return;

  // Skip untracked local dev .env files from text content scan (they are in .gitignore)
  if (fileName.startsWith('.env')) return;

  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 2 * 1024 * 1024) return; // Skip large binary files

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.regex.test(line)) {
          // Exclude self-references in security scanners, test cases, or placeholder comments
          if (
            relativePath.includes('securityScan.js') ||
            relativePath.includes('securityHardening.test.js') ||
            relativePath.includes('package-lock.json') ||
            line.includes('your-secret') ||
            line.includes('placeholder') ||
            line.includes('process.env.') ||
            line.includes('mock') ||
            line.includes('example')
          ) {
            continue;
          }

          violations.push({
            file: relativePath,
            line: i + 1,
            rule: pattern.name,
            preview: line.trim().slice(0, 80)
          });
        }
      }
    }
  } catch (err) {
    // Binary or unreadable file
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile()) {
      scanFile(fullPath);
    }
  }
}

console.log('🔍 [Security Scan] Scanning project for hardcoded secrets, keys, and credentials...');
walkDir(ROOT_DIR);

if (violations.length > 0) {
  console.error('\n❌ [Security Scan Failed] Critical issues detected:');
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} [${v.rule}] -> ${v.preview}`);
  }
  process.exit(1);
} else {
  console.log('✅ [Security Scan Passed] Zero exposed secrets or private keys found across project files.');
  process.exit(0);
}
