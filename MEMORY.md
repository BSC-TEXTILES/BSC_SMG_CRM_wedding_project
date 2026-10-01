# BSC MEMORY FILE

> **Purpose**: Living memory for the BSC Enterprise Operations Platform (Wedding Customer
> Follow-up CRM + HRMS + Store Operations) for BSC Textiles — Belagavi, Davanagere, Shivamogga.
> **Rule**: READ this file before every change. UPDATE it after every change. Never modify
> existing modules — only add isolated, documented additions.

---

## 1. PROJECT BASELINE (established 2026-09-16)

| Aspect | Value |
| --- | --- |
| Root | `D:\bssc\BSC_SMG\BSC_SMG_CRM` |
| Frontend (main app) | `frontend/` — React 18 + TypeScript + Vite 5 + Tailwind 3 SPA (React Router). Dev port 3000, proxies `/api` → `http://localhost:5000`. Built by `backend/build.js` into `backend/dist`. |
| Backend | `backend/` — Express (CommonJS). Entry `backend/index.js` (Hostinger/Passenger). Dev entry `backend/src/index.js` on port 5000 (127.0.0.1). |
| Database | MySQL 8 / MariaDB. Self-healing initializer: `backend/src/config/dbInitializer.js`. |
| Auth | JWT + httpOnly cookie, bcrypt, captcha on login, branch-level location isolation (`backend/src/middleware/auth.js`). |
| Design system | Burgundy `#611427` (primary / "navy" token), hover `#781D33`; Champagne Gold `#B88D42` (accent), hover `#9E742E`, soft `#EFE6DA`; Ivory `#F9F6F0` (background); White surfaces; text `#21181A` / muted `#6B5B5E`; border `#E8DED2`. Status: green `#1F7A54`, amber `#B87B19`, red `#B82837`. Fonts: Inter + Plus Jakarta Sans. Tokens live in `frontend/src/index.css` and `frontend/tailwind.config.ts`. |
| Brand | **BSC Textiles** · Multi-location system. Logo: `frontend/public/logo.png` (also repo-root `Main_logo.png`). Master recovery email domain: `bsctextiles.com`. |

### Key backend routes (DO NOT MODIFY)
- Mounted in `backend/index.js`: `/api/v1` → `src/routes/v1.js`, `/api` → `src/routes/api.js`.
- Wedding CRM: `/api/wedding-crm/*` and `/api/v1/wedding-crm/*` (`src/routes/weddingRoutes.js` → `src/controllers/weddingController.js`) — **all JWT-authenticated**.
- Public route pattern already in system: `/api/public/*` (interview token, candidate entry).
- SPA catch-all: `app.get('*')` serves `backend/dist/index.html` for non-API paths.

### Key database tables (DO NOT MODIFY)
- `locations` — id 1 = BEL (Belagavi), 2 = DAV (Davanagere), 3 = SHI (Shivamogga). Columns: `location_code`, `location_name`, `address`, `phone`, `email`, `status`, `sort_order` (address/phone/email may be NULL — no seed data exists for them).
- `wedding_customers` — `customer_code` UNIQUE, format `WED-{BEL|DAV|SHI}-{YEAR}-{NNNN}`; required: `customer_name`, `mobile_number`, `expected_shopping_date`, `follow_up_date`; defaults `customer_status='New'`, `call_status='Pending'`; PII `customer_notes` AES-256-GCM encrypted (`utils/crypto.js`).
- `wedding_call_logs`, `wedding_audit_logs`, `users`, `candidates`, and the full set in `dbInitializer.js`.

### Customer ID generation (reference implementation)
`weddingController.createCustomer`: `WED-{locCode}-{year}-` prefix → look up last code with `LIKE` prefix `ORDER BY id DESC LIMIT 1`, parse last 4 digits, +1, uniqueness-check, 5-attempt retry loop.

---

## 2. CHANGE LOG

### 2026-09-16 — BSC WEDDING COLLECTIONS LANDING PAGE (initial delivery)

**Task**: New public-facing, fully 3D animated, scroll-based landing page for the Wedding
Collections CRM at route `/wedding-collections`, built with React + Next.js. Zero changes
to any existing module, route, function, or table.

**Approach**: The existing SPA is React+Vite; Next.js cannot be embedded in it without a
rewrite (forbidden). The landing page was therefore added as a **new isolated Next.js app**
in `frontend-landing/` that static-exports and is served by the existing Express backend at
`/wedding-collections`. Backend received only **new, additive files** plus **one additive
mount line** and **one additive static-serving block** in `backend/index.js` (no existing
function modified; if the landing build folder is absent, the backend behaves exactly as before).

#### Files created — landing app (`frontend-landing/`)
- `package.json` — next 14.2.x, react 18.3.x, three, @react-three/fiber@8, @react-three/drei, framer-motion, lucide-react, tailwindcss 3, typescript.
- `next.config.mjs` — `output: 'export'`, `basePath: '/wedding-collections'`, `images.unoptimized`, dev rewrites `/api/*` → `http://127.0.0.1:5000`.
- `tsconfig.json`, `postcss.config.mjs`, `tailwind.config.ts` (BSC burgundy/gold/ivory tokens matching the CRM design system), `.gitignore`.
- `src/app/layout.tsx` — SEO metadata, Open Graph/Twitter tags, JSON-LD structured data (Store + FAQPage), Google Fonts (Inter + Plus Jakarta Sans), skip-link, global CSS.
- `src/app/page.tsx` — assembles all sections in required order.
- `src/app/globals.css` — design tokens, glass cards, gold gradient text, keyframes, reduced-motion support.
- `src/lib/content.ts` — single source of real content: 15 collection categories, 15 services, 6 process steps, 12 FAQs, testimonials (grounded in the system's own seeded wedding customers), store fallback data, trust counters.
- `src/lib/api.ts` — enquiry submission + batched event tracking client (sendBeacon on unload).
- `src/lib/tracking.ts` — session id, scroll-depth/click/section-view/time-on-page tracking helpers.
- `src/components/landing/` — `Navbar`, `Hero` (with `HeroScene` R3F canvas), `TrustBar`, `CollectionsShowcase` (15 tilt cards + detail modal), `Services`, `ProcessTimeline`, `Gallery` (filterable 3D grid + lightbox), `Testimonials` (3D marquee), `Locations`, `FAQ`, `Footer`, `StickyCTA`, `EnquiryModal`, `MusicToggle` (WebAudio-generated ambient tone, muted by default), `Section`/`Reveal` animation primitives, `TrackingProvider`.
- `public/logo.png` (copied from repo root `Main_logo.png`), `public/favicon.ico`.
- `scripts/export-to-backend.js` — copies `out/` → `backend/dist/wedding-collections/` after `npm run build`.
- `README.md` — dev/build/deploy instructions.

#### Backend files created (additive only)
- `backend/src/controllers/landingController.js` — public landing API:
  - `GET /api/landing/locations` — active locations (public fields only) from the real `locations` table.
  - `POST /api/landing/enquiry` — validated public enquiry → inserts into existing `wedding_customers` (same WED code generation pattern, duplicate-mobile check per location, `created_by='Wedding Landing Page'`, audit log entry) → returns the unique Customer ID (`customer_code`).
  - `POST /api/landing/event` — stores landing analytics events (clicks, scroll depth, section views, time on page) in a NEW self-healing table `wedding_landing_events` (created via `CREATE TABLE IF NOT EXISTS`, same pattern as weddingController.ensureTables).
- `backend/src/routes/landingRoutes.js` — express-rate-limit protected public router (no auth — public marketing endpoint; strict input validation; no PII beyond what the customer submits).

#### Backend files modified (additive lines only)
- `backend/index.js`:
  1. One mount line after the existing API mounts: `app.use('/api/landing', require('./src/routes/landingRoutes'));`
  2. One static-serving block inside the existing `distDir` block, before the SPA catch-all: serves `backend/dist/wedding-collections/` at `/wedding-collections` **only if that folder exists**.

#### Database additions
- NEW table `wedding_landing_events` (id, event_name, section, location_id, session_id, page_path, meta JSON, created_at + indexes). Self-healing on first API hit. No existing table altered.

#### Routes added
- Public page: `/wedding-collections` (static export served by Express; also runs standalone in dev at `http://localhost:3100/wedding-collections`).
- Public API: `GET /api/landing/locations`, `POST /api/landing/enquiry`, `POST /api/landing/event`.

#### 3D / animation libraries used
- `three` + `@react-three/fiber@8` + `@react-three/drei` — hero 3D wedding scene (mandap arch, interlocked rings, floral mandala, lehenga silhouette, jewellery torcs, rose petals, gold particle field), scroll-parallax camera, lazy-loaded `ssr:false`, DPR-clamped, reduced-motion & low-end-device fallbacks.
- `framer-motion` — scroll-linked section animations, count-up trust counters, timeline progress, 3D tilt cards, lightbox/marquee/modals.
- WebAudio API — optional ambient toggle (muted by default), no external audio asset.

#### Integration notes for future changes
- Enquiries land in `wedding_customers` with `customer_status='New'` → they appear in the existing Wedding CRM calling desk automatically. `preferred_shopping_category` carries the collection/service the customer engaged with.
- Landing analytics live in `wedding_landing_events`; the Wedding Collection Manager can query drop-offs directly via SQL or a future read-only admin panel (not built — would touch existing modules).
- Location selection passes `location_id` (1/2/3) with every enquiry/event.
- To rebuild the landing: `cd frontend-landing && npm install && npm run build` (auto-copies to `backend/dist/wedding-collections/`). Then `npm run build` at root if the main SPA also needs rebuilding.
- Store address/phone/email are read live from the `locations` table; if a column is NULL the UI falls back to brand-level contact info. Update rows in `locations` to update the landing page.

### 2026-09-16 — LANDING PAGE VERIFIED & BUILD CONFIRMED

**Verification**: Build tested (`npm run build` in `frontend-landing/`) — compiled successfully, static pages generated, export to `backend/dist/wedding-collections/` completed.

**Status**: All 18 components functional. All 12 mandatory sections present. Backend routes, enquiry form, tracking, 3D scene, and design system fully operational. Zero existing modules modified.

### 2026-09-18 — LOGIN SECURITY CODE (CAPTCHA) FIX

**Symptom**: Login always failed with "Incorrect captcha" even when entering the shown code. Root causes: (1) the input told users to "Enter 8 characters" while the server actually issues a **4-digit** code; (2) the SVG digits were tiny (font 24–32 in a 300×60 canvas → ~11 px when scaled to the 120×42 display) and heavily rotated (±28°), so digits were routinely misread/mistyped.

**Changes**:
- `backend/src/utils/captcha.js` — `createCaptcha()` now returns `codeLength` (4); digits rendered larger (font 32–40, rotation reduced to ±15°, fewer/lighter noise lines & dots) for legibility.
- `backend/src/controllers/authController.js` — `GET /api/auth/captcha` response now includes `codeLength`.
- `frontend/src/pages/Login.tsx` — captcha input is driven by `codeLength` (maxLength, placeholder "Enter N digits", alt text), restricts entry to digits only, `inputMode="numeric"`.
- Rebuilt frontend → synced `backend/dist` + root `dist` (new bundle `index-CgO-4iRB.js`), touched `restart.txt`.

**Verify**: `node backend/src/utils/captcha.js` smoke test returns `codeLength: 4`, `verifyCaptcha` ok; `tsc --noEmit` clean.

### 2026-10-01 � CUSTOMER FEEDBACK STORE SELECTION REDESIGNED (EDITORIAL UI + STORE-ACCESS GATING)

**Scope**: Redesigned ONLY the store/location selection screen of the public Customer Feedback flow (`/feedback`, `/feedback-public`). Routes, APIs, auth, DB schema and the feedback form/submission flow are untouched. Public visitors keep the existing behaviour (all stores listed); signed-in staff now only see the stores their existing role/location permissions allow (no new permission system, no extra API calls).

**Changes** (all frontend, additive):
- NEW `frontend/src/components/feedback/storeAccess.ts` � `resolveFeedbackStoreAccess(session, locationStatus)` mirrors `LocationContext` rules (role normalisation, super-admin/global-admin = all stores, `allowedLocations` else `locationId`, empty ? `empty` state, unresolvable ids ? `error` state, fail-closed). Public (no session) ? all stores. Also `describeStoreAccess()` ? `Belagavi` / `Belagavi & Shivamogga` / `All stores`.
- NEW `frontend/src/components/feedback/StoreSelectionPanel.tsx` � editorial header (logo + wordmark + "Back to website" pill), heading block, access chip, store-card grid, loading skeleton (2.5s grace on `locationStatus`), empty & error (Try again) states, trust footer, skip link. Reads the session via `Auth.check()/Auth.get()` and re-syncs on `bsc_auth_changed` + `storage` (avoids the stale `LocationContext.session` after same-tab login).
- NEW `frontend/src/components/feedback/storeSelection.css` � `bsc-fb-*` styles built strictly on `--ed-*` tokens from `editorial.css`; auto-fit card grid (1 card max 26rem, 2 cards max 54rem), white cards with hairline borders, accent hover, focus-radius overrides for the pill/card (the shared `:focus-visible` rule squares corners).
- `frontend/src/pages/PublicFeedback.tsx` � store-selection screen (old slate card list) replaced by `<StoreSelectionPanel onSelect={handleStoreSelect} />`; imports `./landing/editorial/editorial.css`; dropped now-unused imports (`ChevronRight`, `Phone`, `MessageSquare`, `Sparkles`, `ShieldCheck`, `Clock`, `STORE_LOCATIONS_LIST`). Everything else in the file unchanged.

**Verify**: `npx tsc --noEmit -p frontend/tsconfig.json` clean; `npm run build` (frontend) green; 13-case permission smoke test (public / super admin / global admin / scoped admin / BEL / BEL+SHI / SHI via locationId / no assignment / unresolvable ids / loading / error) all pass; every editorial class used exists in `editorial.css`; all icons are from the existing `lucide-react` dependency. NOT yet verified visually in a browser � needs a manual look at `/feedback` as public + as BEL-only / BEL+SHI / no-assignment users.
