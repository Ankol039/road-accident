# Users — change notes

Route: `/admin/users`
Mockup: `html-mockups/_screens/users/index.html`
Editable CSS: `html-mockups/_screens/users/screen.css`

## What changed
- Restyled the screen to match the landing page, dashboard, reports and summaries screens: ink-black ground, cream text, signal orange and hazard amber accents, Jost headings, orange letter-spaced eyebrow, and the caution-tape strip under the header. The sidebar is identical to the other screens (orange line icons, orange-bar active item, amber count pill).
- Page header: eyebrow, large title, one-line subtitle, and "Add a user" as the solid orange primary action on the right (full width on phones).
- Filter bar is one raised panel: search field with a search icon, role and status selects, and a ghost Search button. Inputs are dark with an orange focus ring.
- Users table: transparent rows on a raised panel with an orange top edge, small-caps column headers, bold cream names with muted emails, hover tint, single-line status badges (with the "open case(s)" note underneath), and outlined Edit buttons that fill orange on hover.
- Pager buttons are outlined and go orange on hover; disabled buttons are dimmed.
- Phone (390px): each user becomes a card. Name and email on the left with the status badge on the right, then role and phone, then "Joined" and the Edit button. Filter controls each take a full row.

## Structural changes
- Replaced the plain `div.d-flex` that held the title and button with `<header class="rr-users-head">`; the `<h1>` (keeps `data-rr-region="page/title"`) and the "Add a user" `<button>` are unchanged inside it, plus an eyebrow and a subtitle.
- Added a decorative `<div class="rr-users-tape" aria-hidden="true">` after the header.
- Sidebar: added a "Main menu" label and an inline SVG icon (`aria-hidden`) in each nav link. Link text, `href`, `data-rr-href`, `aria-current` and the Notifications pill are untouched.
- Added classes to existing elements: `rr-users-filters` (form) and `rr-users-table` (table panel).
- No `data-rr-*` attribute, id, form field or table row/column was removed or reordered.

## New classes
- `rr-users-nav-label`, `rr-users-ico`
- `rr-users-head`, `rr-users-head-text`, `rr-users-eyebrow`, `rr-users-sub`, `rr-users-tape`
- `rr-users-filters`, `rr-users-table`
- Custom properties are prefixed `--rr-users-*` and defined on `.staff-shell`.

## States covered
- [x] Default
- [ ] Empty — not designed (no "no users match" message)
- [ ] Loading — not designed
- [ ] Error — not designed
- [x] Mobile (390px)
- [x] Keyboard focus — amber 2px outline on nav links, buttons and links; orange ring on inputs
- [x] Reduced motion — all transitions disabled

## Anything the integrator must know
- Only `index.html` and `screen.css` changed. Nothing in `_shared/` was edited. I did not have the real `_shared/app.css`, so I checked the page against stand-in styles; please look at it once with the real shared files. Where Bootstrap utilities win, a few rules use `!important`.
- The mobile cards use `display: grid` on table rows, which can drop table semantics in some screen readers. The header row is kept as visually hidden text. Add `role="row"` / `role="cell"` in the React markup if this matters. The "Joined:" label on phones is CSS-generated.
- On phones an empty Phone cell is hidden with `:empty`. If the React markup renders whitespace or a placeholder in that cell, it will show as an empty line; render nothing, or add a class.
- The status badges keep the shared `status-*` colours. "Active" is the green `status-verified`; an inactive user will need a muted status (for example `status-submitted`) from the shared CSS, which I did not restyle.
- New static copy (eyebrow, subtitle) needs no data binding.

## Mobile burger menu (added later)
- Under 992px the sidebar turns into a sticky top bar (logo, and a menu button on the right). The navigation, the user name and Log out open from the button as a vertical list. At 992px and above nothing changes.
- Structural: added `<button class="rr-users-burger" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">` as the first child of the `<aside class="sidebar">`, and `id="site-nav"` on the `<nav class="side-nav">`. Added a small inline `<script>` at the end of the body. The existing links, `data-rr-*` attributes and the "Main menu" label are unchanged.
- New classes: `rr-users-burger`, `rr-users-burger-bars`, and the state class `rr-users-menu-open` (added to the `<aside>` while the menu is open).
- In React: keep an `open` state, put the `rr-users-menu-open` class on the `<aside>` when it is true, and set `aria-expanded={open}` and `aria-label={open ? "Close menu" : "Open menu"}` on the button. Close it on Escape and when a nav link is chosen. The inline script in the mockup is only a stand-in.
- The CSS forces the page into a single column under 992px (`.staff-shell { display: block }`) and makes the sidebar `position: sticky`, so it does not depend on the shared breakpoint for the sidebar. Please check once against the real `_shared/app.css`.

## Small-screen safety (added later)
- Checked every screen at 320, 360, 390, 414, 600, 768, 820 and 991px, including with shared styles that give inputs a large `min-width`, for anything that sticks out past the screen edge.
- Fixes in `screen.css`: filter-bar controls may always shrink under 576px and sit one per row under 420px (so dates and dropdown labels are never cut off); anything that still spills sideways is clipped on `.staff-main` under 992px (tables and the chart image keep their own sideways scroll); long words in table cells and panel text may wrap; images and SVGs never exceed their container. The search and select fields take a full row on phones.
- If you still see something sticking out in the real build, send me the page name, the screen width and a screenshot.
