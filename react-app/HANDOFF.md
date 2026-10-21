# RoadReport Bulacan Admin Portal — Handoff

**Status:** scaffold + core screens built and verified. Remaining screens listed below.
**Last updated:** 2026-10-21
**App location:** `react-app/` (the original PHP app is untouched at the repo root)

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

```
react-app/
├── index.html                 # Vite entry; loads fonts, sets theme-color
├── vite.config.js             # manualChunks splits firebase/charts/maps
├── firebase.json              # Hosting (public: dist, SPA rewrite) + rules refs
├── .firebaserc                # project: group3finalproj-9761b
├── firestore.rules            # ← the real backend; review before every deploy
├── firestore.indexes.json
├── .env / .env.example        # Firebase web config (see §6)
├── scripts/
│   ├── create-user.mjs        # create an admin (Auth user + profile)
│   └── seed.mjs               # fresh sample data
└── src/
    ├── components/            # Layout, RequireAuth, StatusBadge, Charts, MapView, Pager, States, Brand
    ├── hooks/                 # useAuth (AuthContext), useAsync, useUnread, useToast
    ├── lib/                   # firebase.js (init), firestore.js (query helpers), constants.js, errors.js, time.js
    ├── pages/                 # Landing, LandingMap, Login, Dashboard, Reports, Pending
    ├── services/              # auth, reports, users, audit, settings, notifications, stats
    ├── styles/                # app.css (theme), landing.css, landing-markup.js (extracted markup)
    └── utils/                 # date, format, validation (+haversine), imageCompress
```

---

## 5. What is done

Built, wired and **verified to render** (headless Chrome, no runtime errors):

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
- **Security rules** — written and documented (`firestore.rules`)
- **Seed + admin scripts** — `scripts/seed.mjs`, `scripts/create-user.mjs`

---

## 6. Running it

### 6.1 Fill in `.env` (required before anything works)

The app will not talk to Firebase until you paste the **Web app config**.
Get it from:

> Firebase console → ⚙️ Project settings → **General** → *Your apps* → Web app (`</>`)
> If no Web app exists, click **`</>` Add app**, register one, then copy the config.

Then edit `react-app/.env`:

```dotenv
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=group3finalproj-9761b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=group3finalproj-9761b
VITE_FIREBASE_STORAGE_BUCKET=group3finalproj-9761b.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abc123
```

> ⚠️ The key in `~/private/firebase-service-account.json` is a **service account**
> key (server-side, for the scripts). It is **not** the web config and must never
> be put in `.env` or shipped to the browser.

### 6.2 Enable Auth and create the first admin

1. Firebase console → **Authentication** → *Sign-in method* → enable **Email/Password**.
2. Create the first admin (needs the service-account key in place):

```bash
cd react-app
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
cd react-app
npm run deploy                     # build + deploy hosting
firebase deploy --only firestore:rules
```

`firebase.json` already sets `public: "dist"` and rewrites every path to
`/index.html`, so client-side routes work on refresh.

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
| `report.php` + `pages/report.js` | `src/pages/ReportDetail.jsx` | ⛔ **to build** |
| `admin-users.php` + `pages/admin-users.js` | `src/pages/Users.jsx` | ⛔ **to build** |
| `admin-settings.php` + `pages/admin-settings.js` | `src/pages/Settings.jsx` | ⛔ **to build** |
| `admin-audit.php` + `pages/admin-audit.js` | `src/pages/Audit.jsx` | ⛔ **to build** |
| `admin-summaries.php` + `pages/admin-summaries.js` | `src/pages/Summaries.jsx` | ⛔ **to build** |
| `notifications.php` + `pages/notifications.js` | `src/pages/Notifications.jsx` | ⛔ **to build** |
| `account.php` + `pages/account.js` | `src/pages/Account.jsx` | ⛔ **to build** |

Every "to build" route currently renders `src/pages/Pending.jsx` so the sidebar
never dead-ends.

---

## 11. Next steps for the new session

Build these seven screens. **All the data access already exists** — these are
mostly markup plus wiring, using `useAsync`, the components in
`src/components/`, and the services in `src/services/`.

Each route is already registered in `src/App.jsx`; replace the `<Pending/>`
element with the real page.

### 11.1 `ReportDetail.jsx` (highest priority, largest)
Route `/admin/reports/:id`. Reference: `report.php`, `js-release-20261020b/pages/report.js`.
- `OnePinMap` (already built) for the pin + officer arrival point
- Workflow action panels: approve / request info / mark false / restore / assign / remark / flag — each calls `updateStatus(...)` or `setFlag(...)`
- Status timeline from `report.status_history`
- Photo sections by category with the sensitive-photo blur + reveal (classes already in `app.css`: `.photo-section.is-sensitive.is-revealed`)
- Inline edit modal → `updateReport(...)`
- Arrival-distance check via `distanceMeters()` + `settings.arrival_match_radius_m`

### 11.2 `Users.jsx` — `/admin/users`
Reference: `admin-users.php`, `pages/admin-users.js`. Use `listUsers`, `updateUser`.
Editing is profile-only; creating accounts stays with `scripts/create-user.mjs`.

### 11.3 `Settings.jsx` — `/admin/settings`
Reference: `admin-settings.php`. Three panels: accident categories
(`listAccidentTypes` / `saveAccidentType` / `toggleAccidentType`), system settings
(`getSystemSettings` / `saveSystemSettings`), emergency contacts
(`listEmergencyContacts` / `saveEmergencyContact` / `deleteEmergencyContact`).

### 11.4 `Audit.jsx` — `/admin/audit`
Reference: `admin-audit.php`. `listAudit({action, from, to, cursor})` already
pages and filters. Add an action `<select>` and date range to the filter bar.

### 11.5 `Summaries.jsx` — `/admin/summaries`
Reference: `admin-summaries.php`, `pages/admin-summaries.js`. Use `loadRange` +
`bucketBy(rows, period)` from `stats.service.js`; render with `Trend`/`Bars`
and the CSV/print buttons already demonstrated in `Reports.jsx`.

### 11.6 `Notifications.jsx` — `/admin/notifications`
Reference: `notifications.php`. `listNotifications`, `markRead`, `markAllRead`.
Calls `refresh()` from `useUnread()` after marking so the sidebar pill updates.

### 11.7 `Account.jsx` — `/admin/account`
Reference: `account.php`. Profile form → `updateUser(uid, ...)`;
password change → `changePassword()` in `auth.service.js` (already handles
reauthentication).

### 11.8 Then
1. Review `firestore.rules` against the final field names.
2. Add composite indexes if Firestore asks for them (it logs a console link).
3. Fill `.env`, seed, create the admin, and walk through every screen once.
4. `npm run deploy` + `firebase deploy --only firestore:rules`.

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

---

## 13. Original PHP app

Left untouched at the repo root as the reference implementation
(`api/`, `js/`, `js-release-20261020b/`, `css/`, the `*.php` page shells).
Nothing in `react-app/` imports from it. Once the rewrite is verified in
production, the PHP app can be archived or removed.
