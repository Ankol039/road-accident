# Prompt 8 — shared shell and Dashboard

Root cause: the finished static designs had not yet been integrated into the React shell and Dashboard. The burger prerequisite now passes and its state, handlers, effects and breakpoint were preserved.

## Changed files and original backups

| Changed file | Original backup |
| --- | --- |
| src/components/Layout.jsx | .codex-backup/prompt8-shell-dashboard/src/components/Layout.jsx |
| src/components/Charts.jsx | .codex-backup/prompt8-shell-dashboard/src/components/Charts.jsx |
| src/components/States.jsx | .codex-backup/prompt8-shell-dashboard/src/components/States.jsx |
| src/pages/Dashboard.jsx | .codex-backup/prompt8-shell-dashboard/src/pages/Dashboard.jsx |
| src/styles/app.css | .codex-backup/prompt8-shell-dashboard/src/styles/app.css |

New: tests/prompt8-shell-dashboard.mjs and this report. Browser screenshots/results are in output/prompt8; test profiles are in tmp/prompt8. No generated JSX references were created or deleted. No dependencies or scripts changed.

## Global changes

The admin shell now defines neutral --rr-* tokens and the shared .rr-nav-label, .rr-ico, .rr-head, .rr-head-text, .rr-eyebrow, .rr-sub and .rr-tape classes once. Sidebar links have the eight mockup SVGs; navigation text, URLs, active link semantics and the notification pill are preserved. Shared panels, buttons, inputs, tables, badges, focus styling and state surfaces use the finished theme. Chart wrappers also affect Summaries: cream ticks/legends, faint grids, orange/amber/teal palette and reduced-motion support. The public landing/login designs were not redesigned.

The existing burger classes and behaviour are retained, with the narrow sidebar divider styled horizontally. The branding wrapper replaces Bootstrap padding utilities so no !important override is needed there. New content rules are screen-only; existing print CSS and all CSS after it are byte-identical to the task backup. All mockup !important overrides were removed except the defensive reduced-motion rule.

## Shared CSS comparison

Compared Dashboard with Reports and Users after normalizing rr-dashboard-/rr-reports-/rr-users-:

- Tokens, sidebar/nav/icons/count pill/logout and burger sections are identical. Reports/Users also explicitly set min-width:0 on .staff-main; retained globally.
- Header/eyebrow/title/subtitle/tape declarations match. Reports/Users add outline action styling; Users adds a solid primary header action. Shared outline controls are neutral; no Users-only header action was ported.
- Dashboard filters use a compact 16px-radius date pill with 40px controls. Reports/Users use 20px-radius filter panels, 42px controls and larger spacing; their search icons, report-specific toggles and select widths remain page-specific and were not ported globally.
- Panels share surfaces, border, 22px radius and shadow. Dashboard additionally has padding, clipping and lamp-dot titles; clipping is limited to the Dashboard recent table and map so other page controls are not hidden.
- Tables share transparent cells, uppercase headings, orange hover tint and status-pill geometry. Dashboard uses .75rem/1.4rem header padding and .85rem/1.4rem cells; Reports uses .95rem/1.2rem headings and .9rem/1.2rem cells; Users uses .95rem/1.2rem for both. Reports/Users use a stronger lower header border, vertical alignment and page-specific column widths; these were not copied. Their phone row layouts differ and were not made global. Dashboard stacking is scoped to .rr-dashboard-recent.
- Shared narrow-screen safety and reduced-motion intent match. Search/select sizing differs by page, so only neutral shrinking rules are global.

## Dashboard and new states

Existing hooks, service calls, aggregation, date handlers and report links remain. Added the exact eyebrow/subtitle, shared header/tape, ring/lamp cards, accessible level words (0 none, 1–5 low, 6–10 moderate, 11+ high), equal chart grid, 2:1 map/spots split, numbered ranking, heading link and phone report cards with explicit table roles. Existing Verified Reports/Closed Reports/Duplicated Reports/Flagged Reports labels remain.

States.jsx now styles Loading (role=status), error (role=alert) and empty content with dark rounded surfaces and cream/muted/error text. The Dashboard uses it for empty hotspot/recent sections; zero cards remain visible and dim gray. No mockup scripts or sample records were shipped.

## Verification

- npm run build: passed (existing large-bundle warning remains).
- APP_BASE=http://127.0.0.1:5178 node tests/prompt8-shell-dashboard.mjs: passed.
- Dashboard plus every route loaded at 320, 360, 390, 414, 768, 1024 and 1440px; no page-level horizontal overflow. Login also loaded as a guest.
- Dashboard menu opening/Escape/link closing, icons, counter, stat boundary values, empty/loading/error, All dates/Apply, keyboard focus and reduced-motion chart/CSS behaviour passed. No runtime or console errors.
- Contrasts tested for cream/muted/eyebrow/report text, Apply, focus and input boundaries: all meet their AA thresholds (details in verification.json). This is a targeted contrast check, not a full assistive-technology audit.
- Existing offline notifications-unread, summaries-downloads, users-roles and summaries-print verify scripts passed. Reports and Summaries print captures succeeded; the existing print stylesheet was also compared byte-for-byte with the backup.
- Reviewed full-page side-by-side captures at 1440px, 390px and 390px menu open: app on left, mockup on right.

## Differences and limits

Live charts intentionally differ from static PNGs: cream labels are larger/readable, municipality is teal and time-of-day is amber. Fixture dates/counts/locations and chart shapes differ from the mockup sample. Leaflet retains live controls, attribution and existing status marker colours; its tile pane receives exactly saturate(.8) brightness(.78) contrast(1.05), as specified. Static chart/map images were not substituted for functioning components.

To meet AA, Apply uses dark text on orange, form borders are stronger, report links are a slightly lighter orange, and the sidebar role label uses readable muted text. Existing longer card labels are retained. No unavailable mockup feature needed omission.

Firebase/Auth were intercepted only in the isolated test browser; no live production data was read or written for testing. Authenticated production behaviour and physical-device/screen-reader testing were not performed. Browser fixtures cover layout and the existing React services, not production permissions. No deploy performed; no rules, indexes, mockups or legacy files edited by this task.

## User action

Review the three comparison images. No console changes or deploy commands are needed for this local review. Stop here; remaining page-specific redesigns are outside this scope.
