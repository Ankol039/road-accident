# RoadReport Bulacan Admin Portal — Handoff

**Status:** every screen is ported, verified and committed. See §5 and §11.
**Last updated:** 2026-10-23
**App location:** the **repo root** (the React app). The original PHP app now lives in
`legacy/` as read-only reference — see §4.

---

## 1. What this project is

The Bulacan admin website for RoadReport. Public users and traffic officers file
accident reports from the RoadReport mobile app; this website is where
**administrators** review, verify, assign, summarise and export those reports.
The landing page is public; everything else is admin-only.

**This is a rewrite.** The previous version was PHP (64 files, ~14,000 lines)
with vanilla-JS pages. This version is a React 18 + Vite single-page app.

---

## 2. Why it was rewritten (the constraint that shaped everything)

The goal was to deploy on **Firebase Hosting**, and the project is limited to the
**free Spark plan**.

| Fact | Consequence |
|---|---|
| Firebase Hosting serves **static files only** — no PHP runtime | The PHP backend could not be deployed there at all |
| **Cloud Functions requires Blaze** (paid) | No serverless backend could replace the PHP API |
| **Firebase Storage requires Blaze** | Photos cannot be uploaded to Storage |
| Spark **does** include Auth + Firestore + Hosting | The app talks to Firestore **directly from the browser** |

That third point is the key decision: **the React app uses the Firebase JS SDK to
read and write Cloud Firestore directly.** There is no API server.

### What that changes versus the PHP version

| Concern | PHP version | This version |
|---|---|---|
| Login | Custom bcrypt + 64-hex bearer tokens | **Firebase Authentication** (email + password) |
| Roles | `require_auth(['admin'])` in each endpoint | `users/{uid}.role` + **Firestore security rules** |
| Business logic | Server-side PHP | Moved into `src/services/*` (client) + rules |
| Photos | GD resize → base64 in Firestore | Canvas resize → base64 in Firestore |
| Audit trail | `api/core/audit.php` | `audit.service.js` (rules make it append-only) |
| Email notifications | PHPMailer | **Not possible on Spark** — see §9 |
| Creating users | PHP admin endpoint | **Node script** with Admin SDK — see §8 |

**Security note:** moving logic to the client is only safe because Firestore
security rules (`firestore.rules`) enforce who may write what. Those rules are
now the real backend. Treat them as production code.

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18.3 + Vite 5 |
| Routing | react-router-dom 6 |
| Styling | **Bootstrap 5.3** + the ported dark burnt-orange theme (`src/styles/app.css`) |
| Charts | Chart.js 4 via `react-chartjs-2` |
| Maps | Leaflet 1.9 via `react-leaflet` |
| Backend | Firebase Auth + Cloud Firestore (JS SDK), Spark plan |
| Fonts | DM Sans (UI) + Instrument Serif (headings), from Google Fonts |

Bootstrap, Chart.js and Leaflet were kept deliberately — the visual design and
chart/map behaviour carry over from the PHP app with minimal change.

---

## 4. Folder structure

The repo root **is** the React app. Everything below is relative to the repo root:

```
<repo root>/
├── index.html                 # Vite entry; loads fonts, sets theme-color
├── vite.config.js             # manualChunks splits firebase/charts/maps; outDir: dist
├── firebase.json              # Hosting (public: dist, SPA rewrite) + rules refs
├── .firebaserc                # project: roadreport-402a6
├── firestore.rules            # ← the real backend; review before every deploy
├── firestore.indexes.json
├── .env / .env.example        # Firebase web config (see §6)
├── public/                    # static assets served as-is (favicon, etc.)
├── scripts/
│   ├── create-user.mjs        # create an admin (Auth user + profile)
│   └── seed.mjs               # fresh sample data
├── src/
│   ├── components/            # Layout, RequireAuth, StatusBadge, Charts, MapView, Pager, States, Brand
│   ├── hooks/                 # useAuth (AuthContext), useAsync, useUnread, useToast
│   ├── lib/                   # firebase.js (init), firestore.js (query helpers), constants.js, errors.js, time.js
│   ├── pages/                 # Landing, LandingMap, Login, Dashboard, Reports, ReportDetail,
│   │                          #   Users, Settings, Audit, Summaries, Notifications, Account
│   ├── services/              # auth, reports, users, audit, settings, notifications, stats
│   ├── styles/                # app.css (theme), landing.css, landing-markup.js (extracted markup)
│   └── utils/                 # date, format, validation (+haversine), imageCompress
└── legacy/                    # ← the ORIGINAL PHP app. READ-ONLY reference. Do not modify.
    ├── *.php                  # index, login, admin*, report, account, notifications
    ├── api/  includes/        # PHP backend
    ├── css/  js/              # original styles + page scripts
    └── js-release-20261020b/  # the release bundle (pages/*.js)
```

> **`legacy/` is read-only.** It is kept in-repo as the reference every screen was
> ported from (§10, §11). Never edit, restructure or delete anything inside it.
> Removing `legacy/` is a separate decision, not part of a normal change.

---

## 5. What is done

Every screen is built and **verified in a real browser** (headless Chrome driving
the live Firestore project — no runtime or console errors on any route):

- **Scaffold** — Vite config, folder structure, `.env` handling, `.gitignore`
- **Theme** — `src/styles/app.css` ported verbatim from `css/app.css` (all tokens, badges, tables, buttons, print styles); `landing.css` likewise
- **Firebase init** — `src/lib/firebase.js`, reads `.env`, optional emulators via `VITE_USE_EMULATORS=true`, offline persistent cache
- **Constants** — statuses, towns, roles, injury/vehicle options, photo categories, status colours, collection names
- **Services** — complete CRUD + business rules: reports (duplicate detection, status workflow, report codes, audit hooks), users, audit, settings, notifications, stats (aggregation done client-side since Firestore has no GROUP BY)
- **Auth** — `AuthProvider` + `useAuth`, `RequireAuth` guard, role check against `STAFF_ROLES`
- **Landing page** (`/`) — full port including the hero collision animation, feature cards, hotspots bars, the Bulacan municipality SVG live map with scroll-driven pins and severity filters, marquees, canvases
- **Login page** (`/login`) — Firebase email/password, `?next=` redirect, password reset
- **Storage shell** — sidebar with the original 8 items, active states, unread-count pill, logout
- **Dashboard** (`/admin`) — date-range filter, 9 stat cards, 6 charts, points map + legend, accident-prone spots, recent-reports table
- **Reports list** (`/admin/reports`) — filter bar (search/status/type/town/dates/flagged/verified-only), paged table, CSV export, print
- **Report detail** (`/admin/reports/:id`) — see §11.1
- **Users** (`/admin/users`) — see §11.2
- **Settings** (`/admin/settings`) — see §11.3
- **Audit trail** (`/admin/audit`) — see §11.4
- **Summaries** (`/admin/summaries`) — see §11.5
- **Notifications** (`/admin/notifications`) — see §11.6
- **Account** (`/admin/account`) — see §11.7
- **Security rules** — written and documented (`firestore.rules`)
- **Indexes** — all composite indexes deployed (`firestore.indexes.json`); `scripts/probe-indexes.mjs` exercises 55 query shapes and confirms none needs a missing index
- **Seed + admin scripts** — `scripts/seed.mjs`, `scripts/create-user.mjs`
- **Browser checks** — a suite of puppeteer-driven checks that drive the real UI and read Firestore back with the Admin SDK (`npm run check:*`)

---

## 6. Running it

### 6.1 Fill in `.env` (required before anything works)

The current project is **`roadreport-402a6`**. Its Web SDK configuration is set
in `.env` and `.env.example`. Copy `.env.example` to `.env` on a fresh checkout.
To retrieve the configuration again, get it from:

> Firebase console → ⚙️ Project settings → **General** → *Your apps* → Web app (`</>`)
> If no Web app exists, click **`</>` Add app**, register one, then copy the config.

Then edit `.env` (at the repo root):

```dotenv
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=roadreport-402a6.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=roadreport-402a6
VITE_FIREBASE_STORAGE_BUCKET=roadreport-402a6.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=481949702737
VITE_FIREBASE_APP_ID=1:481949702737:web:6dc5049dfeb19853113670
```

> ⚠️ The key in `~/private/firebase-service-account.json` is a **service account**
> key and must belong to **`roadreport-402a6`**. The scripts reject credentials whose
> `project_id` differs from `.firebaserc`. Set `GOOGLE_APPLICATION_CREDENTIALS`
> to the new key file to override auto-discovery. It is **not** the web config and must never
> be put in `.env` or shipped to the browser.
>
> `scripts/seed.mjs` and `scripts/create-user.mjs` locate it as
> `resolve(here, '../../private/firebase-service-account.json')`. Since `scripts/`
> sits exactly two levels below `~/`, this path is **correct as-is — do not change
> it to `../private`**, which would resolve to a non-existent
> `<repo>/private/` and break both scripts. Verify with `node scripts/create-user.mjs`
> (no args): you should see the usage message, not a "could not find a
> service-account key" error.

### 6.2 Enable Auth and create the first admin

1. Firebase console → **Authentication** → *Sign-in method* → enable **Email/Password**.
2. Create the first admin (needs the service-account key in place):

```bash
npm run create-user -- admin@example.com "a-long-password" "Jan Russel" admin
```

### 6.3 Load sample data (optional but recommended)

```bash
npm run seed          # 40 reports, 6 categories, 3 contacts, settings
npm run seed -- --reset   # wipe and reseed
```

### 6.4 Run and build

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # check the production build locally
```

### 6.5 Deploy to Firebase Hosting

```bash
npm i -g firebase-tools
firebase login
npm run deploy                     # build + deploy hosting
firebase deploy --only firestore:rules
```

`firebase.json` already sets `public: "dist"` and rewrites every path to
`/index.html`, so client-side routes work on refresh. The `primary` target now maps
to the default `roadreport-402a6` Hosting site. The previous secondary-site
mapping was removed; add another target only after creating a site in the new project.

---

## 7. Firestore data model

| Collection | Document | Key fields |
|---|---|---|
| `users` | `{uid}` | `email`, `full_name`, `role` (`admin`/`officer`/`reporter`), `status`, `phone`, `badge_no` |
| `reports` | auto | `report_code`, `accident_date`, `accident_time`, `accident_type_id`, `accident_type_name`, `injury_status`, `location_text`, `barangay`, `municipality`, `latitude`, `longitude`, `description`, `vehicles[]`, `status`, `flagged`, `status_history[]`, `officer_name` |
| `report_photos` | auto | `report_id`, `category`, `source`, `mime`, `data` (base64), `width`, `height` |
| `audit_logs` | auto | `actor_id`, `actor_name`, `action`, `entity`, `entity_id`, `details`, `created_at` |
| `notifications` | auto | `user_id`, `title`, `body`, `read`, `report_id`, `created_at` |
| `accident_types` | auto | `name`, `description`, `active` |
| `emergency_contacts` | auto | `name`, `phone`, `category`, `sort_order`, `is_active` |
| `settings` | `system`, `duplicate_window_minutes`, `duplicate_radius_m`, `arrival_match_radius_m` | `value` (or fields for `system`) |
| `counters` | `reports_{year}` | `value` (report-code sequence) |

**Reports workflow statuses:** `submitted → under_review → info_required →
assigned → on_scene → verified → in_progress → resolved`, plus `rejected` and
`duplicate`. "Official accident record" = `verified` / `in_progress` / `resolved`.

---

## 8. Creating and managing users

Creating the **Auth half** of an account needs the Admin SDK (service-account
key), which cannot run in the browser on Spark. So:

- **Creating accounts** → `npm run create-user -- <email> <password> "<name>" <role>`
- **Editing profiles** (name, phone, role, status) → the Users screen in the app (once built, §11)
- **Deleting accounts** → Firebase console, or extend `create-user.mjs` into a small CLI

Firestore rules stop a user from changing their own `role` or `status`, and stop
anyone editing or deleting audit entries.

---

## 9. Known limitations (all consequences of the Spark plan)

1. **No email notifications.** PHPMailer has no free equivalent without Blaze.
   The `notifications` collection is still written and read in-app. Options if
   email is required later: upgrade to Blaze + Cloud Functions, or use a free
   third-party mail API from the seed-style Node scripts.
2. **Photos live inside Firestore documents** (base64, compressed to ≤900 KB in
   the browser via `src/utils/imageCompress.js`). This counts against the 1 MiB
   document limit and consumes the 1 GiB/day Spark download quota quickly. For
   heavy use, move to Storage (Blaze) or an external image host.
3. **Client-side aggregation.** The dashboard reads up to 2,000 reports per range
   and aggregates in the browser. Beyond that, add pre-aggregated summary docs.
4. **No server-side validation.** Firestore rules validate shape and permission,
   not business meaning. Keep `src/services/*` as the single source of rules.
5. **Bundle size.** The Firebase chunk is ~536 KB (126 KB gzipped). Acceptable,
   but a candidate for trimming later.

---

## 10. Where each old page lives now

| PHP / JS (old) | React (new) | State |
|---|---|---|
| `index.php` | `src/pages/Landing.jsx` + `LandingMap.jsx` | ✅ done |
| `login.php` + `pages/login.js` | `src/pages/Login.jsx` | ✅ done |
| `admin.php` + `pages/admin.js` | `src/pages/Dashboard.jsx` | ✅ done |
| `admin-reports.php` + `js/reports-table.js` | `src/pages/Reports.jsx` | ✅ done |
| `includes/layout.php` + `js/app.js` shell | `src/components/Layout.jsx` + `App.jsx` | ✅ done |
| `js/api.js`, `js/config.js` | `src/lib/firebase.js`, `src/services/*` | ✅ done |
| `js/ui.js` (toasts, formatters) | `useToast.jsx`, `utils/format.js`, `utils/date.js` | ✅ done |
| `js/map.js` | `src/components/MapView.jsx` | ✅ done |
| `report.php` + `pages/report.js` | `src/pages/ReportDetail.jsx` | ✅ done |
| `admin-users.php` + `pages/admin-users.js` | `src/pages/Users.jsx` | ✅ done |
| `admin-settings.php` + `pages/admin-settings.js` | `src/pages/Settings.jsx` | ✅ done |
| `admin-audit.php` + `pages/admin-audit.js` | `src/pages/Audit.jsx` | ✅ done |
| `admin-summaries.php` + `pages/admin-summaries.js` | `src/pages/Summaries.jsx` | ✅ done |
| `notifications.php` + `pages/notifications.js` | `src/pages/Notifications.jsx` | ✅ done |
| `account.php` + `pages/account.js` | `src/pages/Account.jsx` | ✅ done |

Every old page has a React equivalent. An unknown path falls through to the
landing page, so a mistyped admin URL never dead-ends.

---

## 11. The seven admin screens

All seven are built, wired and verified. Each route lives in `src/App.jsx`
under the `RequireAuth` + `Layout` wrapper.

### 11.1 `ReportDetail.jsx` — `/admin/reports/:id`
Port of `report.php`. `OnePinMap` for the pin + officer arrival point; workflow
action panels driven by `updateStatus(...)` / `setFlag(...)`; status timeline
from `status_history`; photo sections by category with the sensitive-photo blur
and reveal; inline edit modal → `updateReport(...)`; arrival-distance check via
`distanceMeters()` + `settings.arrival_match_radius_m`.

The "Update status" panel only renders its `#next-status` select when the
report's current status has somewhere left to go — `STATUS_FORM_HIDDEN` pauses
it for the officer-only steps.

### 11.2 `Users.jsx` — `/admin/users`
Port of `admin-users.php`. `listUsers` / `updateUser`. Editing is profile-only;
creating accounts stays with `scripts/create-user.mjs`.

### 11.3 `Settings.jsx` — `/admin/settings`
Port of `admin-settings.php`. Three panels: accident categories
(`listAccidentTypes` / `saveAccidentType` / `toggleAccidentType`), system
settings (`getSystemSettings` / `saveSystemSettings`), emergency contacts
(`listEmergencyContacts` / `saveEmergencyContact` / `deleteEmergencyContact`).

### 11.4 `Audit.jsx` — `/admin/audit`
Port of `admin-audit.php`. `listAudit()` pages 50 rows at a time; the action
filter and the free-text search run in JS so the screen works without extra
composite indexes, and only the date range goes to Firestore.

### 11.5 `Summaries.jsx` — `/admin/summaries`
Port of `admin-summaries.php`. `loadRange` + `bucketBy(rows, period)` from
`stats.service.js`, rendered with `Trend`/`Bars`; client-side CSV and
`window.print()` for PDF, matching `Reports.jsx`.

### 11.6 `Notifications.jsx` — `/admin/notifications`
Port of `notifications.php`. `listNotifications`, `markRead`, `markAllRead`;
clicking an unread row marks it read and navigates to `/admin/reports`. Calls
`refresh()` from `useUnread()` so the sidebar pill updates.

### 11.7 `Account.jsx` — `/admin/account`
Port of `account.php`. Profile form → `updateUser(uid, ...)`; password change →
`changePassword()` in `auth.service.js`. Email is a read-only field — changing it
is an administrator's job.

### 11.8 Verifying and shipping
1. `npm run check:db` — proves the live schema matches what the app expects.
2. `npm run check:indexes` — exercises every query shape; must report no missing index.
3. `npm run check:landing`, `check:audit`, `check:settings`, `check:users`, `check:status` — drive the real UI and read Firestore back.
4. `npm run deploy` — build + `firebase deploy --only hosting`.
   Rules and indexes deploy separately: `firebase deploy --only firestore:rules,firestore:indexes`.

---

## 12. Gotchas

- **`.env` is gitignored** but `.env.example` is committed. Keep them in sync.
- **`firebase-service-account.json` must never be committed** — it lives outside
  the app (`~/private/`). Only `scripts/*.mjs` read it.
- **Firestore composite indexes**: a query combining a `where` with
  `orderBy` on a different field will fail until an index exists. Firestore
  prints a clickable console link when this happens.
- **`STRICT MODE` double-mounting**: React 18 StrictMode runs effects twice in
  dev. The landing page's animation effects are written to be idempotent and
  clean up after themselves; keep it that way.
- **`landing-markup.js` is generated** from the old `index.php` — if the landing
  copy changes, edit that file directly rather than trying to re-extract.
- **Do not put the service-account key in `.env`.** It is a server credential.
- **Testing with headless Chrome**: do **not** judge auth-gated routes using
  `chrome --headless --dump-dom --virtual-time-budget=N`. That flag fast-forwards
  timers but starves network-backed promises, so `onAuthStateChanged` never
  settles and `/login` and `/admin` appear stuck on `Loading…` /
  `Checking your session…`. **This is a test artifact, not a bug** — do not
  "fix" it by weakening the auth guard. Verify instead with a real event loop
  (e.g. Chrome DevTools Protocol, or just open the page in a normal browser).
  Expected results: `/` renders the landing page; `/login` renders the login
  card; `/admin` with no session **redirects to `/login?next=%2Fadmin`**.

---

## 13. Original PHP app (`legacy/`)

The original PHP implementation now lives in **`legacy/`** at the repo root
(`api/`, `includes/`, `js/`, `js-release-20261020b/`, `css/`, the `*.php` page
shells). It is **read-only reference** for everything that was ported (§10, §11)
— nothing in `src/` imports from it, and it must not be modified.

`legacy/` is kept in-repo deliberately so the port can be checked for fidelity
(validation messages, field order, edge cases). Removing it is its own commit
and its own decision — it stays fully recoverable from git history either way.

Note that the PHP app's internal asset paths are relative
(e.g. `js-release-20261020b/pages/admin.js`), so it must stay together as one
unit while it remains in the repo.
