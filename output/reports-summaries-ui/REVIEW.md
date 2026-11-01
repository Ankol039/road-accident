# Reports and Summaries UI review

Completed locally on November 1, 2026. Stopped at this scope for review. Nothing deployed.

## Result

The finished designs existed only in the HTML mockups. The React pages now use the shared header, eyebrow, subtitle and tape, with scoped screen styling. Existing shared CSS is preserved byte for byte, with new rules appended. Both pages' state, handlers, hooks, queries and export/print logic before the rendered view are preserved byte for byte (apart from the States import).

Reports has the two-row desktop filter, active checkbox pills, a desktop table with a 300px minimum Location column, and mobile cards with explicit table roles. Below 420px filters stack in one column. Summaries retains real download buttons, its live chart, pinned opaque Period column and warm Total row. Bars accepts an optional tickColor; other chart callers retain their defaults.

States.jsx supplies Reports loading, empty and error messages; Summaries chart loading/empty messages, table loading and error messages; and download errors. Existing shared state colours are reused. Empty Summary buckets and totals remain as before.

## Screenshots

App on the left; finished mockup on the right. Offline test fixtures use the real services and page components; record values, dates and counts differ from the static samples.

| Screen | Desktop (1440px) | Phone (390px) |
| --- | --- | --- |
| Reports | [Compare](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/reports-comparison-1440.png) | [Compare](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/reports-comparison-390.png) |
| Summaries | [Compare](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/summaries-comparison-1440.png) | [Compare](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/summaries-comparison-390.png) |

## Print previews

| Screen | Landscape | Portrait |
| --- | --- | --- |
| Summaries | [All pages](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/print/a4-landscape-all-pages.png) / [PDF](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/print/a4-landscape.pdf) | [All pages](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/print/a4-portrait-all-pages.png) / [PDF](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/print/a4-portrait.pdf) |
| Reports | [All pages](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/print/reports-verify-a4-landscape-all-pages.png) / [PDF](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/print/reports-verify-a4-landscape.pdf) | [All pages](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/print/reports-verify-a4-portrait-all-pages.png) / [PDF](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/print/reports-verify-a4-portrait.pdf) |

Summaries retains the print-only title, applied filters and generated date; named A4 landscape page; full-width ten-column table; repeated table headers; final period kept with Total; and hidden controls. Portrait is explicitly overridden in the test as a stress check. All pages were visually inspected. Reports also resets the document background to white, preventing a dark block below the last row. No card layouts or sticky columns print.

## Verification

- npm run build passed. Existing large-chunk warning remains.
- tests/reports-summaries-ui.mjs: both screens at 320, 360, 390, 414, 768, 1024 and 1440px; no page-level overflow; card/table breakpoint; keyboard focus; contrast checks; sticky Period scrolling and opaque background; active toggle styling; Clear; loading, empty and error states; reduced-motion CSS and Chart.js animation; correct chart palette; no runtime or console errors.
- Rendered text contrast checked 175 Reports and 156 Summaries text elements in populated fixtures, plus shared palette, control borders and focus colours.
- tests/summaries-downloads.mjs passed: clicked all three Summaries export buttons and verified downloaded CSV contents/filenames and valid PDF bytes; Reports CSV; loading/error/empty disabling; applied filters; cap warning; CSV escaping/injection protection and download lifecycle.
- tests/summaries-print.mjs baseline and verify passed: Summaries A4 landscape, A4 portrait and Letter, plus Reports previews; applied filters remain correct despite unsaved edits. Four requested orientation previews are linked above.
- Firebase/auth modules were intercepted; external Firebase requests and writes were blocked. No real project data was modified.
- [Machine-readable UI results](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui/verification.json)

## Differences and limits

The static chart image and sample records are replaced by live components/data. The live chart retains its existing 320px height, so its phone frame differs slightly from the static image. Shared accessible control borders and dark text on orange buttons are retained; Reports links and the Summary Total label use a slightly lighter orange for contrast. These differ intentionally from some mockup colours. The existing shell is unchanged. No unsupported feature was added or omitted. Export links from the mockup remain real browser-download buttons.

No live Firebase login/data session, Safari/Firefox or physical printer was tested. Print previews use Chrome's print renderer. No converter reference files were generated or deleted. No dependencies, scripts, Firebase configuration, rules, legacy files or mockups were changed. No deployment is required for this review; the next action is your visual review.

## Changed files and backups

| File | Backup |
| --- | --- |
| [src/pages/Reports.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/pages/Reports.jsx) | [Original](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/reports-summaries-ui/src/pages/Reports.jsx) |
| [src/pages/Summaries.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/pages/Summaries.jsx) | [Original](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/reports-summaries-ui/src/pages/Summaries.jsx) |
| [src/components/Charts.jsx](/Users/polmacbook/roadreport-latest-hostinger/src/components/Charts.jsx) | [Original](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/reports-summaries-ui/src/components/Charts.jsx) |
| [src/styles/app.css](/Users/polmacbook/roadreport-latest-hostinger/src/styles/app.css) | [Original](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/reports-summaries-ui/src/styles/app.css) |
| [tests/summaries-downloads.mjs](/Users/polmacbook/roadreport-latest-hostinger/tests/summaries-downloads.mjs) | [Original](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/reports-summaries-ui/tests/summaries-downloads.mjs) |
| [tests/summaries-print.mjs](/Users/polmacbook/roadreport-latest-hostinger/tests/summaries-print.mjs) | [Original](/Users/polmacbook/roadreport-latest-hostinger/.codex-backup/reports-summaries-ui/tests/summaries-print.mjs) |

New verification file (no prior original): [tests/reports-summaries-ui.mjs](/Users/polmacbook/roadreport-latest-hostinger/tests/reports-summaries-ui.mjs).

New review artifacts are in [output/reports-summaries-ui](/Users/polmacbook/roadreport-latest-hostinger/output/reports-summaries-ui). Browser profiles and renderer intermediates remain under tmp/.
