# Notifications — change notes

Route: `/admin/notifications`
Mockup: `html-mockups/_screens/notifications/index.html`
Editable CSS: `html-mockups/_screens/notifications/screen.css`

## What changed
- Restyled the screen to match the landing page, dashboard and the other admin screens: ink-black ground, cream text, signal orange and hazard amber accents, Jost headings, orange letter-spaced eyebrow, and the caution-tape strip under the header. The sidebar is identical to the other screens (orange line icons, orange-bar active item, amber count pill).
- Page header: eyebrow, large title, one-line subtitle, and "Mark all as read" as an outlined button that fills orange on hover (full width on phones).
- Each notification is a rounded card with a ring and lamp on the left, the same language as the dashboard's stat cards. **Unread** rows have a glowing amber lamp, an amber top accent line and a faint amber wash; **read** rows (no `is-unread` class) are calmer: a dim gray lamp, a normal-weight title and muted text.
- The list is capped at 60rem wide so the short messages stay easy to read on large screens. Rows lift slightly on hover and have an amber focus ring.
- Phone (390px): same cards with a slightly smaller ring and padding.

## Structural changes
- Replaced the plain `div.d-flex` that held the title and button with `<header class="rr-notifications-head">`; the `<h1>` (keeps `data-rr-region="page/title"`) and the `#mark-all` button are unchanged inside it, plus an eyebrow and a subtitle.
- Added a decorative `<div class="rr-notifications-tape" aria-hidden="true">` after the header.
- Sidebar: added a "Main menu" label and an inline SVG icon (`aria-hidden`) in each nav link. Link text, `href`, `data-rr-href`, `aria-current` and the Notifications pill are untouched.
- Added `rr-notifications-list` to the existing `<ul class="list-plain">`.
- The notification rows (`button.notif-row`, with `data-id`, `data-read` and `data-rr-*`) are unchanged.

## New classes
- `rr-notifications-nav-label`, `rr-notifications-ico`
- `rr-notifications-head`, `rr-notifications-head-text`, `rr-notifications-eyebrow`, `rr-notifications-sub`, `rr-notifications-tape`
- `rr-notifications-list`
- Custom properties are prefixed `--rr-notifications-*` and defined on `.staff-shell`.

## States covered
- [x] Default (all three sample rows are unread)
- [ ] Empty — not designed (no "You're all caught up" message)
- [ ] Loading — not designed
- [ ] Error — not designed
- [x] Mobile (390px)
- [x] Keyboard focus — amber 2px outline on rows, buttons and nav links
- [x] Reduced motion — transitions and the hover lift are disabled

## Anything the integrator must know
- Only `index.html` and `screen.css` changed. Nothing in `_shared/` was edited. I did not have the real `_shared/app.css`, so I checked the page against stand-in styles; please look at it once with the real shared files. The rows set their own `border`, `background` and `padding`, so they replace the shared `.notif-row` look (including its yellow left border).
- The mockup only shows unread rows. A read row is any `.notif-row` without `is-unread`; I checked this by removing the class on one row (see `preview-read-state-demo.png`).
- All unread rows use the same amber lamp. If you later want a lamp colour per notification type (new report, dispatched, cleared), add a class per type in the React markup and I can style it.
- New static copy (eyebrow, subtitle) needs no data binding.

## Mobile burger menu (added later)
- Under 992px the sidebar turns into a sticky top bar (logo, and a menu button on the right). The navigation, the user name and Log out open from the button as a vertical list. At 992px and above nothing changes.
- Structural: added `<button class="rr-notifications-burger" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">` as the first child of the `<aside class="sidebar">`, and `id="site-nav"` on the `<nav class="side-nav">`. Added a small inline `<script>` at the end of the body. The existing links, `data-rr-*` attributes and the "Main menu" label are unchanged.
- New classes: `rr-notifications-burger`, `rr-notifications-burger-bars`, and the state class `rr-notifications-menu-open` (added to the `<aside>` while the menu is open).
- In React: keep an `open` state, put the `rr-notifications-menu-open` class on the `<aside>` when it is true, and set `aria-expanded={open}` and `aria-label={open ? "Close menu" : "Open menu"}` on the button. Close it on Escape and when a nav link is chosen. The inline script in the mockup is only a stand-in.
- The CSS forces the page into a single column under 992px (`.staff-shell { display: block }`) and makes the sidebar `position: sticky`, so it does not depend on the shared breakpoint for the sidebar. Please check once against the real `_shared/app.css`.

## Small-screen safety (added later)
- Checked every screen at 320, 360, 390, 414, 600, 768, 820 and 991px, including with shared styles that give inputs a large `min-width`, for anything that sticks out past the screen edge.
- Fixes in `screen.css`: filter-bar controls may always shrink under 576px and sit one per row under 420px (so dates and dropdown labels are never cut off); anything that still spills sideways is clipped on `.staff-main` under 992px (tables and the chart image keep their own sideways scroll); long words in table cells and panel text may wrap; images and SVGs never exceed their container.
- If you still see something sticking out in the real build, send me the page name, the screen width and a screenshot.
