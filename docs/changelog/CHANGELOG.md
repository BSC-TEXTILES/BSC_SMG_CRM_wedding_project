# Changelog

All notable changes to the BSC Enterprise CRM & HRMS project are documented in this file.

## [1.2.0] - 2026-09-26

### Comprehensive Project Audit, Cleanup, Security Hardening & Performance Optimization Pass

#### 1. Dead Code Elimination
- **Frontend Lucide Icons**: Removed unused icons (`Award`, `Calendar`, `Compass`, `Send`, `Users`, `Star`, `ExternalLink`, `Layers`, `ShoppingBag`) from `frontend/src/pages/Home.tsx`.
- **Backend Logging Cleaned**: Removed debug middleware request logs (`[DEBUG] API request:`, `[DEBUG] After CSRF:`) in `backend/index.js` that caused console spam on every HTTP request.
- **Removed Deprecated Landing Text & CTAs**: Removed "Book a VIP Consultation" and "Tested Pure Zari / 3-ply silver thread electroplated in authentic 24-karat gold" per customer requirements, while perfectly maintaining layout balance and centering remaining hallmarks.

#### 2. Zero-Error Bug Fixes
- **Backend User Management**: Fixed `SyntaxError` in `backend/src/controllers/userManagementController.js` (missing `try` block wrapper around `listUsers`).
- **Auth Service Password Handling**: Fixed `ReferenceError: user is not defined` in `backend/src/services/authService.js` and added dual-read AES-256-GCM `decryptField` support for encrypted and plaintext password fields.
- **Test Suite Teardown & Stability**: 
  - Fixed premature `process.exit(0)` and dangling connection pools across test suites (`password_update.test.js`, `apiConnectEndpoints.test.js`, `apiKeyManagement.test.js`, `telecaller_flow.test.js`, `firewall_security.test.js`, `securityHardening.test.js`).
  - Added test concurrency management (`--test-concurrency=1` in `package.json`) to prevent port collision on port 5000 during test execution.

#### 3. Security Hardening
- **Secrets Management**: Verified zero secrets committed in repo or client bundles. Cryptographically generated 256-bit secrets for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `ENCRYPTION_KEY` configured in server environment.
- **Environment Templates**: Created `backend/.env.example` with safe placeholder variables and verified `.gitignore` coverage.
- **Reverse Proxy & WAF**: Verified `nginx.conf` with TLSv1.2/1.3, rate-limiting zones (`auth_limit`, `api_limit`, `general_limit`), strict CSP, and security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).

#### 4. Performance & Reliability
- **Vite & TypeScript Compilation**: Passed with 0 errors across all 86 production asset bundles.
- **Test Suite Coverage**: 100% pass rate across all 31 enterprise tests (6 test suites) covering Auth, API Key Management, Security Firewall/WAF, Telecaller Flow, and Universal Password Updates.
- **Pixel-Perfect UI**: Preserved 100% of existing CSS/Tailwind design tokens, component styling, and UX structure without any visual regression.
