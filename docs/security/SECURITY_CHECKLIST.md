# Production Security Pre-Deployment Checklist

Before deploying any new version of the BSC Enterprise HRMS to production, ensure the following checks are complete:

## 1. Network & Infrastructure
- [ ] Application is deployed behind a WAF/CDN (e.g., Cloudflare) with "Under Attack Mode" available if needed.
- [ ] Only HTTPS ports (443) are publicly exposed. Database ports (3306) are strictly bound to localhost or a private VPC subnet.
- [ ] The `UPLOAD_DIR` environment variable points to a persistent directory outside of the application's executable root.

## 2. Environment Variables
- [ ] `NODE_ENV` is explicitly set to `production`.
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are strong, randomly generated cryptographic strings.
- [ ] `COOKIE_SECURE` is set to `true` to mandate HTTPS-only session transmission.
- [ ] Database credentials (`DB_PASS`) are strong and unique to the production environment.
- [ ] No `.env` files or secret values are committed to the git repository.

## 3. Application Security
- [ ] Hardcoded backdoor accounts (e.g., `admin@2026`) remain removed from `authService.js`.
- [ ] CSRF protection is active; frontend requests correctly extract and send the `x-csrf-token`.
- [ ] Global rate limiting (500 req/15m) and Auth rate limiting (50 req/10m) are active.
- [ ] Helmet is injecting strict CSP and HSTS headers on all requests.

## 4. Dependencies
- [ ] `npm audit` has been executed; zero critical or high vulnerabilities exist in production dependencies.
- [ ] Unused dependencies have been pruned prior to the final build.

## 5. Testing
- [ ] Admin endpoints (`/api/wipe-db`, `/api/fix-db-schema`, `/settings/users`) successfully reject unauthenticated or non-admin users.
- [ ] File uploads correctly reject executable files (e.g., `.php`, `.sh`, `.exe`) and oversized files (>800KB).
- [ ] Error messages do not leak internal stack traces or database schema details in the API response.
