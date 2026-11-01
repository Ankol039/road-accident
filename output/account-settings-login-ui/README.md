# Account, Settings and Login UI integration

The finished mockup designs were still separate from the React pages. Integrated the page layouts by hand, reusing the existing shell, header, tape, panel and control styles. No mockup export/conversion was run and no generated reference JSX files were created or deleted.

## Source changes and original backups

| Changed file | Original backup |
|---|---|
| src/pages/Account.jsx | .codex-backup/account-settings-login/src/pages/Account.jsx |
| src/pages/Settings.jsx | .codex-backup/account-settings-login/src/pages/Settings.jsx |
| src/pages/Login.jsx | .codex-backup/account-settings-login/src/pages/Login.jsx |
| src/styles/app.css | .codex-backup/account-settings-login/src/styles/app.css |

New verification script: tests/account-settings-login-ui.mjs. All comparison images, route captures and checks.json are in this directory. Images named *-comparison-* show the integrated app on the left and the untouched mockup on the right.

## Scope and preserved behaviour

Account retains its exact hook and handler code, field identities, profile name/phone payload, readonly email, and service password-change flow. The password service still reauthenticates before updating. Settings retains its service calls, validation ranges, fields, edit/add/reset/remove controls and save handlers. Only rendering of loading, empty and error outcomes was added using States.jsx. Login retains its sign-in/reset handlers and auth guards; its password reveal is React state with the required accessibility attributes. There is no Login burger.

The shared shell, other routes, html-mockups, legacy, firestore.rules, dependencies and configuration were not edited by this task. No deployment or live data writes were performed.

## States added/styled

- Settings: category/contact loading, empty and load-error states; usage error; system-settings loading/load-error, using the existing States component and dark card colours.
- Account: existing field validation is red #e5483a; existing toast surfaces are dark, with error #e5483a and success #3fbf7f.
- Login: existing errors/reset success render through States; dark background, error #e5483a and success #3fbf7f. Existing disabled/signing-in button behaviour remains.
- Account forms are always available, so no new empty or loading gate was introduced.

## Design details intentionally not copied, and why

1. Screen-specific sidebar, nav-icon, menu/burger implementations and shell/background overrides: the existing shared shell already supplies them and was explicitly excluded from this task. No mockup inline scripts were copied.
2. Screen-prefixed copies of shared header/eyebrow/subtitle/tape, panel and control styling: reuse the established shared classes instead. The page-specific account role, layouts and settings groups remain.
3. Static sample people, email addresses, report counts, category lists, settings values and contacts: React continues to bind service data. Browser screenshots use isolated fictional fixtures, including hidden rows absent from the static designs.
4. White text on orange primary/hover buttons, faint input borders and a few small orange text colours: use dark button text, visible control borders and slightly lighter orange accents to meet contrast requirements. Existing shared control sizes/padding are retained where applicable.
5. The mockup's identical shown/hidden category wording: hidden rows use a muted style and "Hidden"; the existing Show/Hide controls remain functional.
6. Generic filter/chart/mobile clipping rules included in screen.css: these screens have no such filters/charts. Intrinsic grid sizing and contained tables prevent horizontal page overflow without clipping content.
7. The landing-page footer wording mentioned in the Login notes: landing is outside the three-screen scope. Login has the requested staff wording.

No unsupported feature was invented from the mockups. Tape, road, traffic lamps, login footer and eye controls are implemented.

## Verification and limits

- npm run build passes (existing bundle-size warning).
- Isolated headless Chrome: all three screens at 320, 360, 390, 414, 768, 1024 and 1440; no page-level overflow; visible keyboard focus; text-contrast audit; reduced-motion checks; checkbox and pointer/keyboard password reveal.
- Login, dashboard, reports, summaries, users, settings, audit, notifications and account opened at 1440 and 390. Captures were visually reviewed for consistent colours, headers, tape, cards, controls and shell.
- Sign-in and sign-out completed once through the actual React AuthProvider with an isolated auth-service fixture. Missing-profile sign-out and invalid-credential feedback were exercised. Live Firebase login/logout was not attempted without a supplied test account.
- Password mismatch, wrong-current-password presentation and blank category validation are checked without live writes.
- No console/runtime errors in the isolated checks. External Firebase requests are blocked; Firestore writes throw. This does not prove production networking or production writes.

## Existing functional problems left unchanged under UI-only scope

- Account destructures `{ toast }` from useToast(), then calls toast.success / toast.failure. That toast is a function; those methods exist on the hook result instead. Account also calls reloadProfile(), which useAuth() does not expose. These pre-existing issues can break save-success/error handling. The UI task preserves that handler code exactly.
- The existing canUsePortal() checks profile role but does not check inactive status. Missing profiles are signed out, but inactive profiles with an allowed role are not rejected by this client-side predicate. Auth logic and firestore.rules remain unchanged. This is a separate functional issue, not something this UI integration can claim to have verified as working.

Manual follow-up: use your own staff test account to confirm real sign-in/out. Resolve the two existing functional issues in a separately authorized task before relying on Account save-success handling or inactive-profile rejection. No deploy commands are needed for rules/indexes because neither was changed.
