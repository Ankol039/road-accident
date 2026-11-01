# Audit trail — change notes

Route: `/admin/audit`
Mockup: `html-mockups/_screens/audit/index.html`
Editable CSS: `html-mockups/_screens/audit/screen.css`

## What changed
- Restyled the screen to match the landing page, dashboard, reports, summaries, users and settings screens: ink-black ground, cream text, signal orange and hazard amber accents, Jost headings, orange letter-spaced eyebrow, and the caution-tape strip under the header. The sidebar is identical to the other screens (orange line icons, orange-bar active item, amber count pill).
- Page header: eyebrow, large title and a one-line subtitle.
- Filter bar is one raised panel on a single row: search (with a search icon), action select, from and to dates, and an orange Search button. Inputs are dark with an orange focus ring.
- Audit table is styled like a log: small-caps headers, bold cream names with a muted role, orange item links, hover tint, and Details in a small monospace so values like `120 → 95` line up.
- Timeline rail: the first column (When) has a thin vertical line with a glowing orange lamp per entry, running from row to row. It is pure CSS (`::before` / `::after` on the first cell).
- Pager buttons are outlined and go orange on hover; disabled buttons are dimmed.
- Phone (390px): each entry becomes a card. The action is the bold first line, then the item, then the details, then a footer with the time on the left and "who · role" on the right. The timeline rail is hidden.

## Structural changes
- Added `<header class="rr-audit-head">` around the `<h1>`, with an eyebrow and a subtitle. The `<h1>` keeps its `data-rr-region="page/title"`.
- Added a decorative `<div class="rr-audit-tape" aria-hidden="true">` after the header.
- Sidebar: added a "Main menu" label and an inline SVG icon (`aria-hidden`) in each nav link. Link text, `href`, `data-rr-href`, `aria-current` and the Notifications pill are untouched.
- Added classes to existing elements: `rr-audit-filters` (form) and `rr-audit-table` (table panel).
- No `data-rr-*` attribute, id, form field or table row/column was removed or reordered.

## New classes
- `rr-audit-nav-label`, `rr-audit-ico`
- `rr-audit-head`, `rr-audit-eyebrow`, `rr-audit-sub`, `rr-audit-tape`
- `rr-audit-filters`, `rr-audit-table`
- Custom properties are prefixed `--rr-audit-*` and defined on `.staff-shell`.

## States covered
- [x] Default
- [ ] Empty — not designed (no "no entries in this range" message)
- [ ] Loading — not designed
- [ ] Error — not designed
- [x] Mobile (390px)
- [x] Keyboard focus — amber 2px outline on nav links, buttons and links; orange ring on inputs
- [x] Reduced motion — all transitions disabled

## Anything the integrator must know
- Only `index.html` and `screen.css` changed. Nothing in `_shared/` was edited. I did not have the real `_shared/app.css`, so I checked the page against stand-in styles; please look at it once with the real shared files. Where Bootstrap utilities win, a few rules use `!important`.
- The timeline rail relies on `position: relative` on the first `<td>` and on the cells touching vertically, so the line looks continuous. If the real table adds row gaps or `border-spacing`, the line will show breaks.
- The mobile cards use `display: grid` on table rows, which can drop table semantics in some screen readers. The header row is kept as visually hidden text. Add `role="row"` / `role="cell"` in the React markup if this matters. The " · " between name and role on phones is CSS-generated.
- Details are styled by column position (`td:nth-child(5)`), not by action type. All entries use the same lamp colour; if you want colours by action (for example red for deletes), add a class per row in the React markup and I can style it.
- New static copy (eyebrow, subtitle) needs no data binding.

## Mobile burger menu (added later)
- Under 992px the sidebar turns into a sticky top bar (logo, and a menu button on the right). The navigation, the user name and Log out open from the button as a vertical list. At 992px and above nothing changes.
- Structural: added `<button class="rr-audit-burger" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">` as the first child of the `<aside class="sidebar">`, and `id="site-nav"` on the `<nav class="side-nav">`. Added a small inline `<script>` at the end of the body. The existing links, `data-rr-*` attributes and the "Main menu" label are unchanged.
- New classes: `rr-audit-burger`, `rr-audit-burger-bars`, and the state class `rr-audit-menu-open` (added to the `<aside>` while the menu is open).
- In React: keep an `open` state, put the `rr-audit-menu-open` class on the `<aside>` when it is true, and set `aria-expanded={open}` and `aria-label={open ? "Close menu" : "Open menu"}` on the button. Close it on Escape and when a nav link is chosen. The inline script in the mockup is only a stand-in.
- The CSS forces the page into a single column under 992px (`.staff-shell { display: block }`) and makes the sidebar `position: sticky`, so it does not depend on the shared breakpoint for the sidebar. Please check once against the real `_shared/app.css`.

## Small-screen safety (added later)
- Checked every screen at 320, 360, 390, 414, 600, 768, 820 and 991px, including with shared styles that give inputs a large `min-width`, for anything that sticks out past the screen edge.
- Fixes in `screen.css`: filter-bar controls may always shrink under 576px and sit one per row under 420px (so dates and dropdown labels are never cut off); anything that still spills sideways is clipped on `.staff-main` under 992px (tables and the chart image keep their own sideways scroll); long words in table cells and panel text may wrap; images and SVGs never exceed their container. The search and select fields take a full row on phones.
- If you still see something sticking out in the real build, send me the page name, the screen width and a screenshot.
