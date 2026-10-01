# Security Vulnerabilities & Fixes Report

This document outlines the recent security audit findings, detailing the data leaks/vulnerabilities ("4 breaks") discovered in the system, their root causes, and the comprehensive fixes implemented during the enterprise platform hardening phase.

## 1. Hardcoded Master Credentials & Backdoors
**The Vulnerability (Break 1):** 
A critical vulnerability existed where master authentication credentials (e.g., `admin@2026`) were hardcoded directly into the authentication service, auto-initializer, and seed scripts. This acted as a backdoor, allowing anyone with access to the source code or binary to easily bypass authentication mechanisms.

**Root Cause:**
Developers hardcoded credentials to bypass login during development and testing phases, which inadvertently made its way into the production environment.

**The Fix:**
- **Removal of Backdoors:** All hardcoded master passwords and backdoors were completely stripped from the source code.
- **Strong Hashing:** Implemented strict `bcrypt` hashing for all credentials, including main login passwords and kiosk/cash PINs. 
- **PIN Masking:** PINs are now securely masked during entry and transit.

---

## 2. Client-Side Exposure of Secrets
**The Vulnerability (Break 2):** 
Sensitive environment secrets and backend configuration details were being bundled into the frontend React application. This allowed malicious actors to inspect the client-side JavaScript bundle and extract database URIs, API keys, and encryption secrets.

**Root Cause:**
Improper separation of frontend and backend environment variables during the build process, leading to backend secrets being injected into the client bundle.

**The Fix:**
- **Zero Frontend Secrets:** Enforced a strict policy where zero secrets are included in the frontend bundle.
- **Centralized Env Management:** All sensitive configurations are now exclusively stored in the `backend/.env` file and managed securely at runtime via runtime secret management.

---

## 3. Insecure Session Management & Token Leakage
**The Vulnerability (Break 3):** 
Sessions were not securely managed on the server, and authentication tokens were susceptible to leakage. Storing tokens insecurely on the client-side (e.g., `localStorage`) made them vulnerable to Cross-Site Scripting (XSS) attacks, where an attacker could steal a user's active session.

**Root Cause:**
Reliance on client-side token storage without appropriate HTTP headers and strict server-side validation.

**The Fix:**
- **Server-Managed Sessions:** Transitioned to fully server-managed sessions.
- **httpOnly Cookies:** Session tokens are now delivered via `httpOnly` cookies, making them completely inaccessible to client-side JavaScript and neutralizing XSS token theft.
- **Strict Expirations:** Implemented a mandatory 6-hour absolute auto-logout (`SESSION_HOURS`) to ensure stale sessions are systematically destroyed.

---

## 4. Unencrypted Data at Rest & Brute-Force Susceptibility
**The Vulnerability (Break 4):** 
Sensitive customer and operational data (such as the Wedding CRM database) was stored in plaintext. Furthermore, the authentication endpoints lacked rate-limiting or human-verification, leaving the system highly susceptible to automated brute-force attacks and credential stuffing.

**Root Cause:**
Lack of database encryption protocols and absence of middleware to verify that login attempts were initiated by human users.

**The Fix:**
- **Data Encryption (AES-256-GCM):** Implemented enterprise-grade `AES-256-GCM` encryption for data at rest. Data is encrypted before being written to the database, ensuring that even if the database file is compromised, the data remains unreadable.
- **Server-Generated Captcha:** Deployed a strict, server-generated numeric SVG Captcha on the sign-in page. 
  - Features include: 30-second auto-refresh, auto-reload on wrong entry, and one-time use enforcement. This immediately halts any automated bot or brute-force scripts from attacking the login gateway.
- **Audit Trails:** Added a dashboard for authentication activity with precise timestamps and GPS sign-in trails to monitor and audit access logs actively.
