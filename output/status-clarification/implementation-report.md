# Status clarification implementation report

Completed November 2, 2026 (Asia/Manila). All ten stored status codes and all existing badge colors/classes are retained. No migration, Firebase data access, deployment, permissions changes, commits or pushes.

## Root cause and result

Labels, grouping calculations and workflow messages described different things with the same words. The pure shared definition map now supplies labels, definitions, badge classes/colors, action verbs, allowed next statuses and official/open/officer-active groups. Existing imports through constants.js continue to work.

The six approved fixes are complete:

1. Dashboard: the six status cards count and link to exactly their respective codes, retaining applied dates. In review replaces Duplicate's card. Nine cards, desktop 3x3 arrangement, data-level lamp colors and hidden level text are preserved. The donut uses shared labels/colors; all ten statuses appear in the map legend.
2. Transactions: status transitions, required notes/evidence, duplicate originals and reassignment eligibility are checked against the transaction snapshot on every retry. Offline tests simulate a conflicting write and verify no invalid write commits.
3. Duplicate links: removing an attention flag preserves duplicate_of and duplicate_of_code on a confirmed Duplicate, including a simulated concurrent confirmation.
4. Closure: an explicit site-cleared checkbox is required in the form and a true confirmation is required by the service. Direct Clearance approved -> Site cleared records the skipped Clearing site step in status_history.note; no new stored field is introduced.
5. Reassignment: after Arrival reported/Clearance approved/Clearing site, the control is disabled with a visible reason; the service rejects the operation. Dispatch and reassignment while Dispatched remain available. Existing administrator clearance/clearing actions remain.
6. Help: badges have definition tooltips, and expandable native details/summary guides provide touch-accessible definitions and explain Official records and Flagged.

Official records membership remains verified, in_progress, resolved. Users' Active/Inactive label overrides and the four officer-workload statuses are preserved. Historical free text and stored audit/notification records are never rewritten. Structured report status codes translate at display time; account statuses are not treated as report statuses. Future status notifications use shared labels and definitions.

Public landing descriptions now follow dispatch before arrival approval, and sample map labels come from real codes. HANDOFF.md includes the correct information-request return to review and documents the unconfirmed Android/permissions contract.

## Verification performed offline

- npm run build passed; only the existing large-chunk advisory remains.
- tests/status-clarification.mjs passed with Firebase/auth intercepted before application modules load. Every external page request is blocked; writes exist only in an in-memory fixture store.
- Dashboard, reports/filter, all ten report-detail states/actions, summaries, notifications, audit, users and maps checked at 1440px and 390px, without page overflow. Screenshots are in this directory. Landing sample map also checked at 390px.
- All 100 possible status pairs tested against the actual status service, plus transaction retries, required notes, closure with/without confirmation, skipped-step notes, reassignment, duplicate flag removal, future notification wording and rendered form submissions.
- All ten original stored codes display the new labels and preserved badge classes/colors. Official/workload memberships and the Firestore rules' allowed-code list were compared to the shared map.
- Dashboard status counts, filtered links and dates, donut labels/colors, all-status legend, count lamp levels (including zero), account overrides, audit account/report distinction and historical prose preservation passed.
- tests/summaries-downloads.mjs passed: CSV/PDF generation, new labels/header, unchanged column order/shape, official filtering, applied dates, formula protection and loading/error/cap behavior.
- tests/summaries-print.mjs verify passed. Bundled Python ran tests/summaries-print-pdf.py successfully: A4 landscape, A4 portrait and Letter summary headers repeat, rows stay whole, chart/text stay within margins, and Total stays with the final period. Rendered pages were visually inspected.
- Updated live check scripts were syntax-checked only; they were NOT executed. No production data was used.
- Old display-label search in src leaves only “Submitted” as a creation timestamp verb and “Submitted a report” as an audit-event description. Neither is a current status label. Historical prose and read-only legacy/mockup files intentionally retain their original words.

## Files changed and original backups

Backups were made before the first edit, outside the project as requested. Originals are unchanged in the backup directory. Each path is listed below.

| Changed file | Original backup |
|---|---|
| [src/lib/constants.js](/Users/polmacbook/roadreport-latest-hostinger/src/lib/constants.js) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/lib/constants.js](/private/tmp/roadreport-status-clarification-8aaa0c04/src/lib/constants.js) |
| [src/components/StatusBadge.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/components/StatusBadge.jsx) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/components/StatusBadge.jsx](/private/tmp/roadreport-status-clarification-8aaa0c04/src/components/StatusBadge.jsx) |
| [src/components/Charts.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/components/Charts.jsx) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/components/Charts.jsx](/private/tmp/roadreport-status-clarification-8aaa0c04/src/components/Charts.jsx) |
| [src/components/MapView.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/components/MapView.jsx) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/components/MapView.jsx](/private/tmp/roadreport-status-clarification-8aaa0c04/src/components/MapView.jsx) |
| [src/pages/Reports.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/pages/Reports.jsx) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/Reports.jsx](/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/Reports.jsx) |
| [src/pages/Dashboard.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/pages/Dashboard.jsx) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/Dashboard.jsx](/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/Dashboard.jsx) |
| [src/pages/ReportDetail.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/pages/ReportDetail.jsx) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/ReportDetail.jsx](/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/ReportDetail.jsx) |
| [src/pages/Summaries.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/pages/Summaries.jsx) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/Summaries.jsx](/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/Summaries.jsx) |
| [src/pages/Audit.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/pages/Audit.jsx) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/Audit.jsx](/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/Audit.jsx) |
| [src/pages/Notifications.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/pages/Notifications.jsx) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/Notifications.jsx](/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/Notifications.jsx) |
| [src/pages/LandingMap.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/pages/LandingMap.jsx) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/LandingMap.jsx](/private/tmp/roadreport-status-clarification-8aaa0c04/src/pages/LandingMap.jsx) |
| [src/styles/landing-markup.js](/Users/polmacbook/roadreport-latest-hostinger/src/styles/landing-markup.js) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/styles/landing-markup.js](/private/tmp/roadreport-status-clarification-8aaa0c04/src/styles/landing-markup.js) |
| [src/services/reports.service.js](/Users/polmacbook/roadreport-latest-hostinger/src/services/reports.service.js) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/services/reports.service.js](/private/tmp/roadreport-status-clarification-8aaa0c04/src/services/reports.service.js) |
| [src/services/stats.service.js](/Users/polmacbook/roadreport-latest-hostinger/src/services/stats.service.js) | [/private/tmp/roadreport-status-clarification-8aaa0c04/src/services/stats.service.js](/private/tmp/roadreport-status-clarification-8aaa0c04/src/services/stats.service.js) |
| [scripts/check-status-change.mjs](/Users/polmacbook/roadreport-latest-hostinger/scripts/check-status-change.mjs) | [/private/tmp/roadreport-status-clarification-8aaa0c04/scripts/check-status-change.mjs](/private/tmp/roadreport-status-clarification-8aaa0c04/scripts/check-status-change.mjs) |
| [scripts/check-audit.mjs](/Users/polmacbook/roadreport-latest-hostinger/scripts/check-audit.mjs) | [/private/tmp/roadreport-status-clarification-8aaa0c04/scripts/check-audit.mjs](/private/tmp/roadreport-status-clarification-8aaa0c04/scripts/check-audit.mjs) |
| [scripts/probe-indexes.mjs](/Users/polmacbook/roadreport-latest-hostinger/scripts/probe-indexes.mjs) | [/private/tmp/roadreport-status-clarification-8aaa0c04/scripts/probe-indexes.mjs](/private/tmp/roadreport-status-clarification-8aaa0c04/scripts/probe-indexes.mjs) |
| [tests/summaries-downloads.mjs](/Users/polmacbook/roadreport-latest-hostinger/tests/summaries-downloads.mjs) | [/private/tmp/roadreport-status-clarification-8aaa0c04/tests/summaries-downloads.mjs](/private/tmp/roadreport-status-clarification-8aaa0c04/tests/summaries-downloads.mjs) |
| [tests/summaries-print-pdf.py](/Users/polmacbook/roadreport-latest-hostinger/tests/summaries-print-pdf.py) | [/private/tmp/roadreport-status-clarification-8aaa0c04/tests/summaries-print-pdf.py](/private/tmp/roadreport-status-clarification-8aaa0c04/tests/summaries-print-pdf.py) |
| [HANDOFF.md](/Users/polmacbook/roadreport-latest-hostinger/HANDOFF.md) | [/private/tmp/roadreport-status-clarification-8aaa0c04/HANDOFF.md](/private/tmp/roadreport-status-clarification-8aaa0c04/HANDOFF.md) |
| [tests/summaries-print.mjs](/Users/polmacbook/roadreport-latest-hostinger/tests/summaries-print.mjs) | [/private/tmp/roadreport-status-clarification-8aaa0c04/tests/summaries-print.mjs](/private/tmp/roadreport-status-clarification-8aaa0c04/tests/summaries-print.mjs) |
| [tests/reports-summaries-ui.mjs](/Users/polmacbook/roadreport-latest-hostinger/tests/reports-summaries-ui.mjs) | [/private/tmp/roadreport-status-clarification-8aaa0c04/tests/reports-summaries-ui.mjs](/private/tmp/roadreport-status-clarification-8aaa0c04/tests/reports-summaries-ui.mjs) |

New files (no original existed to back up):

- [src/lib/reportStatuses.js](/Users/polmacbook/roadreport-latest-hostinger/src/lib/reportStatuses.js)
- [src/components/StatusHelp.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/components/StatusHelp.jsx)
- [tests/status-clarification.mjs](/Users/polmacbook/roadreport-latest-hostinger/tests/status-clarification.mjs)

This report and the screenshots/verification JSON/print captures are new verification artifacts under output/status-clarification and tmp/status-clarification. Build output was generated by Vite; dist was not edited by hand. Existing static mockup snapshots and previous verification artifacts were not overwritten.

## Intentionally unchanged and remaining checks

- Firestore/storage rules, indexes, Firebase configuration, routes, authentication, package scripts/dependencies, admin CSS, burger menu and animations are unchanged. Legacy and static html-mockups remain untouched. CSV/PDF utilities and the Users page already consume shared exports and required no edits.
- No data migration or rules/index deployment is needed for these changes. Nothing was deployed.
- Android and deployed rules remain unknown. With the teammate, verify the real data path and permissions for reporter submissions/information replies, officer arrival/retry and officer clearing/closure. Verify all ten unchanged codes render appropriately, old reports/history still work, status notifications are understandable and unsupported future values are handled gracefully. Use emulator/test fixtures, not real reports. No Android code was created or edited here.
- Local rules currently allow only administrators to create/update reports. This work does not fix or assume the Android writer path. Offline checks cannot validate deployed permissions, real Android synchronization or production data quality. Map tiles and external fonts were blocked during checks.
- Spreadsheets matching the old English header “Resolved” must be updated to “Site cleared”; formulas matching old English status labels also need the new labels. Column order and stored status codes did not change.
