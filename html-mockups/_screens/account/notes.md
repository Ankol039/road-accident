# My account — change notes

Route: `/admin/account`
Mockup: `html-mockups/_screens/account/index.html`
Editable CSS: `html-mockups/_screens/account/screen.css`

## What changed
- Restyled the screen to match the landing page, dashboard and the other admin screens: ink-black ground, cream text, signal orange and hazard amber accents, Jost headings, orange letter-spaced eyebrow, and the caution-tape strip under the header. The sidebar is identical to the other screens (orange line icons, orange-bar active item, amber count pill).
- Page header: eyebrow, large title, and the "Administrator" role line turned into a small pill with an amber lamp.
- Profile and Change password are two equal-height rounded cards with a lamp dot on each title (orange for Profile, amber for the password card). The form-page width was raised to 64rem so the cards use the space better.
- Labels are small-caps and muted; inputs are dark with an orange focus ring; the read-only Email field has a dashed border and no fill, so it reads as fixed rather than editable. Buttons are solid orange.
- Phone (390px): the two cards stack, and the Save profile / Change password buttons span the full width.

## Structural changes
- Replaced the `<h1>` + `<p class="text-secondary">Administrator</p>` pair with `<header class="rr-account-head">` containing an eyebrow, the same `<h1>` (keeps `data-rr-region="page/title"`) and the same role `<p>` (now also `rr-account-role`).
- Added a decorative `<div class="rr-account-tape" aria-hidden="true">` after the header.
- Sidebar: added a "Main menu" label and an inline SVG icon (`aria-hidden`) in each nav link. Link text, `href`, `data-rr-href`, `aria-current` and the Notifications pill are untouched.
- Added `rr-account-grid` to the existing `row g-4`.
- Both forms, all field ids, names, labels and buttons are unchanged.

## New classes
- `rr-account-nav-label`, `rr-account-ico`
- `rr-account-head`, `rr-account-eyebrow`, `rr-account-role`, `rr-account-tape`, `rr-account-grid`
- Custom properties are prefixed `--rr-account-*` and defined on `.staff-shell`.

## States covered
- [x] Default
- [ ] Empty — not applicable (the forms are always shown)
- [ ] Loading — not designed
- [ ] Error — not designed (no inline validation, "wrong current password" or save-success styling)
- [x] Mobile (390px)
- [x] Keyboard focus — amber 2px outline on nav links and buttons; orange ring on inputs
- [x] Reduced motion — all transitions disabled

## Anything the integrator must know
- Only `index.html` and `screen.css` changed. Nothing in `_shared/` was edited. I did not have the real `_shared/app.css`, so I checked the page against stand-in styles; please look at it once with the real shared files. The `.form-page` max-width is overridden in `screen.css`; if the shared rule changes, that line may need updating.
- The password form has no success or error message styling in the mockup. If the app shows alerts, match them to the cards: red `#e5483a` for errors, green `#3fbf7f` for success, on the same dark surface.
- New static copy (eyebrow) needs no data binding.

## Mobile burger menu (added later)
- Under 992px the sidebar turns into a sticky top bar (logo, and a menu button on the right). The navigation, the user name and Log out open from the button as a vertical list. At 992px and above nothing changes.
- Structural: added `<button class="rr-account-burger" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">` as the first child of the `<aside class="sidebar">`, and `id="site-nav"` on the `<nav class="side-nav">`. Added a small inline `<script>` at the end of the body. The existing links, `data-rr-*` attributes and the "Main menu" label are unchanged.
- New classes: `rr-account-burger`, `rr-account-burger-bars`, and the state class `rr-account-menu-open` (added to the `<aside>` while the menu is open).
- In React: keep an `open` state, put the `rr-account-menu-open` class on the `<aside>` when it is true, and set `aria-expanded={open}` and `aria-label={open ? "Close menu" : "Open menu"}` on the button. Close it on Escape and when a nav link is chosen. The inline script in the mockup is only a stand-in.
- The CSS forces the page into a single column under 992px (`.staff-shell { display: block }`) and makes the sidebar `position: sticky`, so it does not depend on the shared breakpoint for the sidebar. Please check once against the real `_shared/app.css`.

## Small-screen safety (added later)
- Checked every screen at 320, 360, 390, 414, 600, 768, 820 and 991px, including with shared styles that give inputs a large `min-width`, for anything that sticks out past the screen edge.
- Fixes in `screen.css`: filter-bar controls may always shrink under 576px and sit one per row under 420px (so dates and dropdown labels are never cut off); anything that still spills sideways is clipped on `.staff-main` under 992px (tables and the chart image keep their own sideways scroll); long words in table cells and panel text may wrap; images and SVGs never exceed their container. The two cards use a real CSS grid instead of Bootstrap's negative-margin row.
- If you still see something sticking out in the real build, send me the page name, the screen width and a screenshot.
