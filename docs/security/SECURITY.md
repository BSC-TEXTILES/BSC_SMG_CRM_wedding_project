# 🛡️ Enterprise Security Model & Configuration Guide

This document defines the security architecture, threat model, secret management practices, and deployment controls enforced across the **BSC Textiles Enterprise Platform**.

---

## 1. 🔑 Secrets & Key Management

### Policy
- **Zero Secrets in Frontend**: No API keys, database URLs, JWT secrets, encryption keys, or private tokens are permitted in client-side bundles, HTML, or public assets.
- **Fail-Fast Startup Validation**: The backend invokes `validateStartupSecrets()` at boot (`backend/src/security/secretsValidator.js`). If any required secret (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, `DB_HOST`, `DB_USER`, `DB_NAME`) is missing or insecure, the server terminates immediately (`process.exit(1)`).
- **Git Protections**: All `.env*` files are strictly ignored via `.gitignore` and blocked from tracking.

### Setting Secrets Locally
1. Copy the template:
   ```bash
   cp .env.example .env
   cp .env.example backend/.env
   ```
2. Populate the required environment variables with high-entropy keys:
   ```env
   NODE_ENV=development
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=bsc_db_user
   DB_PASSWORD=your_strong_db_password
   DB_NAME=bsc_crm
   JWT_SECRET=super_secret_jwt_hmac_key_minimum_32_characters
   JWT_REFRESH_SECRET=super_secret_jwt_refresh_key_minimum_32_chars
   ENCRYPTION_KEY=32_byte_aes_hex_or_string_key_here
   ```

### Setting Secrets in Production
- Inject secrets via container environment variables, Kubernetes Secrets, or host platform settings (e.g. cPanel/Passenger environment manager).
- Never bake `.env` files into Docker images.
- To rotate secrets: update the production environment variable and perform a zero-downtime rolling restart.

### Pre-Commit Secret Scanning
A repository scanner is located at [scripts/securityScan.js](file:///d:/BTPL_SMG/BSC_SMG_CRM_wedding_project/scripts/securityScan.js). It detects bearer tokens, private key blocks, connection strings with embedded credentials, and committed `.env` files:
```bash
node scripts/securityScan.js
```

---

## 2. 🪙 JWT & Session Security Architecture

### Short-Lived Access Tokens
- **Lifetime**: Maximum **15 minutes (`15m`)**.
- **Storage**: Kept strictly in memory (or delivered via `HttpOnly`, `SameSite=Strict`, `Secure` cookies). Never stored in `localStorage` or `sessionStorage`.
- **Payload**: Contains only minimal claims (`id`, `username`, `role`, `tokenVersion`, `locationId`). Never contains passwords, credentials, or sensitive PII.

### Refresh Tokens & Rotation
- **Lifetime**: Maximum **7 days (`7d`)**.
- **Single-Use Rotation**: Every time `/api/auth/refresh` is called, the old refresh token is blacklisted, and a brand-new refresh token pair is issued.
- **Theft Detection & Session Revocation**: If an already-used or blacklisted refresh token is presented, the system detects a token reuse attack, increments the user's `token_version` in the database, and immediately invalidates all active user sessions.
- **Stale Token Invalidation**: Password changes and logouts increment `token_version` and blacklist active tokens.

### Client-Side Silent Refresh
The frontend client (`frontend/src/services/api.ts`) includes:
- Automatic transparent 401 retry interceptor calling `POST /api/auth/refresh`.
- Scheduled background renewal 1 minute before access token expiry (every 14 minutes).

---

## 3. 🚫 Frontend Identifier & Storage Protection

- **No Sensitive Identifiers in Client Storage**: Neither internal database primary keys nor sensitive `sectionId` references are stored in `localStorage`, `sessionStorage`, or client cookies.
- **Client Cache Limited to Display Data**: `localStorage` is restricted to user preferences and non-sensitive display strings (e.g. `fullName`, `displayName`, `role`).
- **DevTools & Console Hardening**:
  - React DevTools is disabled in production via `window.__REACT_DEVTOOLS_GLOBAL_HOOK__.isDisabled = true`.
  - Production builds strip `console.log` and `debugger` statements via Vite's `esbuild.drop` configuration.

---

## 4. 🔁 Reverse Proxy (Nginx / Caddy) Configuration

A production reverse proxy must front the application for TLS termination, identity hiding, and perimeter rate limiting.

### Security Directives (`nginx.conf`)
- **Server Identity Hidden**:
  ```nginx
  server_tokens off;
  proxy_hide_header X-Powered-By;
  proxy_hide_header Server;
  ```
- **Strict Transport Security (HSTS)**:
  ```nginx
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
  ```
- **Clickjacking & Content Protection**:
  ```nginx
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
  ```
- **Sensitive File Blocking**:
  ```nginx
  location ~* \.(env|git|sql|log|bak|backup|config)$ { deny all; return 404; }
  location ~ /\. { deny all; return 404; }
  ```
- **Perimeter Rate Limiting**:
  - `/api/auth/*`: 5 requests per minute per IP.
  - `/api/*`: 30 requests per second per IP.

---

## 5. 🛡️ Defense-in-Depth Middleware Stack

1. **Helmet**: Comprehensive security headers.
2. **CORS Whitelist**: Explicit origin verification with `credentials: true`; rejects untrusted origins with 403.
3. **Strict Content-Type Validation**: Rejects invalid MIME types on POST/PUT/PATCH (`backend/src/middleware/validateContentType.js`).
4. **Web Application Firewall (WAF)**: Real-time inspection for SQL injection, XSS vectors, path traversal, scanner user-agents, and automated IP ban on aggressive attacks (`backend/src/security/wafMiddleware.js`).
5. **Input Sanitization**: Recursive sanitization stripping dangerous script elements and control characters (`backend/src/security/inputSanitizer.js`).
6. **Password Hashing**: `bcryptjs` with `saltRounds >= 12`.
7. **Error Masking**: Database error messages and server stack traces are never sent to clients; generic error messages are returned while detailed diagnostics are written to server-side audit logs.

---

## 6. 🧪 Security Verification

Run the automated security test suite:
```bash
node --test tests/securityHardening.test.js
```
Expected output:
```text
ok 1 - 1. Expired JWT token is rejected with 401
ok 2 - 2. Token with invalid signature is rejected with 401
ok 3 - 3. Missing authentication token on protected route returns 401
ok 4 - 4. Token with outdated tokenVersion is rejected with 401
ok 5 - 5. Refresh token rotation generates new pair and rejects reused token
ok 6 - 6. Non-admin user cannot access admin routes (returns 403)
ok 7 - 7. WAF intercepts and blocks malicious SQL injection payloads
ok 8 - 8. Input sanitizer neutralizes script tags in request bodies
ok 9 - 9. Required security headers are present and identity headers hidden
ok 10 - 10. Health check endpoint exposes no sensitive config or credentials
```
