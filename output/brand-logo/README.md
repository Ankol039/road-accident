# RoadReport logo replacement — 2026-11-02

The old branding was split between an inline diamond component, landing-page CSS/markup and an SVG favicon. The new branding uses one shared Logo component (kept in the existing Brand.jsx file), base-aware asset paths and the supplied PNGs without changing their pixels.

## Original inventory

Line numbers below refer to the task-start sources retained in the backups. Sizes are source-defined; complete logo widths depend on the accompanying text/font.

| Location | Original appearance / size | Result |
|---|---|---|
| src/components/Brand.jsx:6–22 | brand / brand-light; 28×28 diamond plus 18px name | Shared Logo component, no SVG or separate name |
| src/components/Layout.jsx:211 | Sidebar and narrow top bar share that component | Horizontal on-dark: 30px desktop, 28px narrow; Administrator label and dashboard link preserved |
| src/pages/Login.jsx:80 | Same 28×28 diamond plus name | Horizontal on-dark, 34px; home link and traffic-light dots preserved |
| src/styles/landing-markup.js:9 | 26×26 ring-and-dot plus 18px name | Horizontal on-dark, 34px; home link points to / |
| src/styles/landing.css:21–23,110 | Ring drawn with border and pseudo-element; spinning | Old logo-only CSS removed; supplied logo has no effects or animation |
| src/styles/app.css:112–120,823,4235 | Brand / brand-light typography rules | Logo styling/focus added; obsolete brand-light removed |
| src/styles/landing-markup.js:125 | Footer copyright text, 13px; no logo | Horizontal on-dark, 28px; duplicate adjacent brand text removed |
| src/styles/landing-markup.js:118 | Existing closing CTA, no logo | Stacked on-dark, 160px, decorative empty alt |
| src/utils/reportPdf.js:34 | RoadReport report list brand header, 16pt | Original light horizontal PNG, 7mm high, followed by report list |
| public/favicon.svg:1 and index.html:5 | Diamond SVG with 64×64 viewBox; browser-sized tab icon | Replaced with 16/32 PNG and 16/32/48 ICO, plus touch-icon links |
| index.html:7 | Theme color #0e1214 | Preserved; social image tags added |
| src/components/Layout.jsx:230 | Drawer heading Menu, no logo | Preserved |
| src/pages/Summaries.jsx:234 and app.css print rules | Unbranded Summaries and export heading | Preserved; no new print brand section |
| States.jsx / RequireAuth.jsx | Text loading/error/session states, no brand image | Preserved; no splash screen added |
| HANDOFF.md:1,12,13,85 | Documentation text and generic static-asset reference; no rendered logo | Brand maintenance note added |

There was no README, dedicated 404 page, email template, web app manifest, service worker, existing social image or small notification/toast brand slot. Vite has no base override, so its base is /. No PWA behavior was added.

Other RoadReport occurrences are ordinary copy, titles, metadata or configuration, not duplicate labels beside logos: Login.jsx:85,154; Reports.jsx:107; landing-markup.js:19,57,59,95,111; Layout.jsx:163; reportPdf.js:10; constants.js:9; settings.service.js:31; useAuth.jsx:44; index.html:15; comments in Landing.jsx and styles; package metadata and documentation. These were preserved except the duplicate copyright name beside the new landing footer logo. Tooling/fixture references do not render brand images and were left alone.

## Changed files

- [index.html](/Users/polmacbook/roadreport-latest-hostinger/index.html)
- [src/components/Brand.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/components/Brand.jsx)
- [src/components/Layout.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/components/Layout.jsx)
- [src/pages/Login.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/pages/Login.jsx)
- [src/pages/Landing.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/pages/Landing.jsx)
- [src/styles/app.css](/Users/polmacbook/roadreport-latest-hostinger/src/styles/app.css)
- [src/styles/landing.css](/Users/polmacbook/roadreport-latest-hostinger/src/styles/landing.css)
- [src/styles/landing-markup.js](/Users/polmacbook/roadreport-latest-hostinger/src/styles/landing-markup.js)
- [src/utils/reportPdf.js](/Users/polmacbook/roadreport-latest-hostinger/src/utils/reportPdf.js)
- [HANDOFF.md](/Users/polmacbook/roadreport-latest-hostinger/HANDOFF.md)

Removed after confirming no active references: public/favicon.svg.

## Created source/tooling files

- [src/lib/brand.js](/Users/polmacbook/roadreport-latest-hostinger/src/lib/brand.js)
- [scripts/generate-brand-assets.mjs](/Users/polmacbook/roadreport-latest-hostinger/scripts/generate-brand-assets.mjs)
- [tests/brand-logo.mjs](/Users/polmacbook/roadreport-latest-hostinger/tests/brand-logo.mjs)

## Created public assets

- [public/brand/logo-horizontal-on-dark.png](/Users/polmacbook/roadreport-latest-hostinger/public/brand/logo-horizontal-on-dark.png)
- [public/brand/logo-horizontal-on-light.png](/Users/polmacbook/roadreport-latest-hostinger/public/brand/logo-horizontal-on-light.png)
- [public/brand/logo-mark-on-dark.png](/Users/polmacbook/roadreport-latest-hostinger/public/brand/logo-mark-on-dark.png)
- [public/brand/logo-mark-on-light.png](/Users/polmacbook/roadreport-latest-hostinger/public/brand/logo-mark-on-light.png)
- [public/brand/logo-stacked-on-dark.png](/Users/polmacbook/roadreport-latest-hostinger/public/brand/logo-stacked-on-dark.png)
- [public/brand/logo-stacked-on-light.png](/Users/polmacbook/roadreport-latest-hostinger/public/brand/logo-stacked-on-light.png)
- [public/apple-touch-icon.png](/Users/polmacbook/roadreport-latest-hostinger/public/apple-touch-icon.png)
- [public/favicon-16.png](/Users/polmacbook/roadreport-latest-hostinger/public/favicon-16.png)
- [public/favicon-32.png](/Users/polmacbook/roadreport-latest-hostinger/public/favicon-32.png)
- [public/favicon.ico](/Users/polmacbook/roadreport-latest-hostinger/public/favicon.ico)
- [public/icon-192.png](/Users/polmacbook/roadreport-latest-hostinger/public/icon-192.png)
- [public/icon-512.png](/Users/polmacbook/roadreport-latest-hostinger/public/icon-512.png)
- [public/icon-maskable-512.png](/Users/polmacbook/roadreport-latest-hostinger/public/icon-maskable-512.png)
- [public/og-image.png](/Users/polmacbook/roadreport-latest-hostinger/public/og-image.png)

All six public/brand PNGs match logo-source/ byte-for-byte. Source dimensions are 901×183 (horizontal), 290×317 (stacked) and 268×270 (mark). The originals remain untouched. Only derived favicon/app/share assets are generated.

The 180px/192px app canvases use approximately 15% padding per side. To honor the no-upscaling rule, both 512px icons retain the native 268×270 mark centered on #0e1214, resulting in more padding. This also keeps the maskable mark inside the central 60% safe zone. The 1200×630 share image uses the native stacked PNG on #0e1214 with the requested subtle orange radial glow.

## Every backup

- [.codex-backup/brand-logo/index.html](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/brand-logo/index.html)
- [.codex-backup/brand-logo/src/components/Brand.jsx](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/brand-logo/src/components/Brand.jsx)
- [.codex-backup/brand-logo/src/components/Layout.jsx](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/brand-logo/src/components/Layout.jsx)
- [.codex-backup/brand-logo/src/pages/Login.jsx](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/brand-logo/src/pages/Login.jsx)
- [.codex-backup/brand-logo/src/pages/Landing.jsx](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/brand-logo/src/pages/Landing.jsx)
- [.codex-backup/brand-logo/src/styles/app.css](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/brand-logo/src/styles/app.css)
- [.codex-backup/brand-logo/src/styles/landing.css](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/brand-logo/src/styles/landing.css)
- [.codex-backup/brand-logo/src/styles/landing-markup.js](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/brand-logo/src/styles/landing-markup.js)
- [.codex-backup/brand-logo/src/utils/reportPdf.js](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/brand-logo/src/utils/reportPdf.js)
- [.codex-backup/brand-logo/HANDOFF.md](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/brand-logo/HANDOFF.md)
- [.codex-backup/brand-logo/public/favicon.svg](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/brand-logo/public/favicon.svg)

New files had no prior version to back up. No existing backup was changed.

## Verification

- npm run build passed (existing large Firebase chunk warning only).
- node tests/brand-logo.mjs baseline captured original layouts before edits.
- node tests/brand-logo.mjs verify passed 9 screen checks: login, landing, dashboard and reports at 1440px/390px, plus the open 390px drawer.
- [output/brand-logo/verify/checks.json](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/checks.json) records measured dimensions, alt text, preserved burger spacing and HTTP responses for all 14 new image paths. No local HTTP errors or browser runtime errors occurred.
- All UI images have explicit intrinsic width/height, the original ratio, async decoding and no filter, shadow or animation. There is exactly one visible image with alt=RoadReport per page; landing duplicates have empty alt. Home links retain a 2px amber focus ring.
- Dashboard/reports main frames and burger geometry match baseline exactly at both widths. The 390px primary admin logo is 137.84×28 at the left; the burger starts at x=332.
- Generated PDF was rendered with the bundled PDFium runtime and visually inspected. Its original 901×183 on-light PNG is embedded with the correct ratio. The bundled Poppler command emitted font-configuration errors, so its output was not used for the visual check.
- ICO structure verified: 16×16, 32×32, 48×48 entries. [output/brand-logo/favicon-preview.png](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/favicon-preview.png) shows native 16px and 32px favicons, left to right.
- All copied PNGs were byte-compared with the originals, and transparency checked.
- Final application/source search found no old diamond/ring signatures, brand-light or old favicon references. Historical screenshots and backups are retained.

Screenshots: [output/brand-logo/baseline](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/baseline) and [output/brand-logo/verify](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify). The screenshot set includes landing nav/footer/closing section, login, dashboard, reports and mobile drawer. Authentication and Firestore were replaced with isolated fixtures; external requests were blocked. No live data was read or changed, and live sign-in/deployment behavior was not tested. Other browsers/platform launchers/social crawlers require a manual check.

## Screenshot links

| Screen | 1440px | 390px |
|---|---|---|
| Login | [Desktop](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/login-1440.png) | [Narrow](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/login-390.png) |
| Landing navigation | [Desktop](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/landing-1440.png) | [Narrow](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/landing-390.png) |
| Landing footer | [Desktop](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/landing-footer-1440.png) | [Narrow](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/landing-footer-390.png) |
| Landing closing section | [Desktop](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/landing-closing-1440.png) | [Narrow](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/landing-closing-390.png) |
| Dashboard / sidebar or top bar | [Desktop](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/dashboard-1440.png) | [Narrow](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/dashboard-390.png) |
| Reports | [Desktop](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/reports-1440.png) | [Narrow](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/reports-390.png) |
| Open burger drawer | Desktop uses the sidebar | [Open drawer](/Users/polmacbook/roadreport-latest-hostinger/output/brand-logo/verify/drawer-390.png) |

## Manual follow-up

1. Set the absolute deployed image URL in the og:image and twitter:image tags in index.html; a clear TODO remains because the actual public domain was not confirmed.
2. Hard-refresh or open a fresh private browser window to check cached favicons. Inspect the deployed site in your usual browsers, and optionally test social previews after the URL tags are set.
3. Nothing was deployed. No dependencies, scripts in package.json, routes, authentication/data code, Firestore rules, Firebase configuration, secrets, legacy files or static mockups were changed.
