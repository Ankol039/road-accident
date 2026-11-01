# Dashboard — change notes

Route: `/admin`
Mockup: `html-mockups/_screens/dashboard/index.html`
Editable CSS: `html-mockups/_screens/dashboard/screen.css`

## What changed
- Restyled the whole screen to match the public landing page: ink-black ground (`#0e1214`), cream text, signal orange (`#e4572e`), hazard amber (`#f5c518`), Jost display headings, small letter-spaced orange eyebrows, and the caution-tape motif (thin version under the page header).
- Layout takes its cues from the dark banking-dashboard reference: rounded raised panels, orange line icons in the sidebar, an active nav item with an orange bar and glow, ring-and-lamp stat tiles, and orange accent dots on panel titles.
- Stat cards: 3×3 grid (2-column on phones, last card spans the row so there is no orphan gap). Each card has a top accent and a ring with a glowing lamp, echoing the landing page's traffic-light lamps. Lamp colour now carries meaning, based on the number in the card: **0 = gray, 1–5 = green, 6–10 = yellow, 11 or more = red**. A gray card also drops its glow and dims its number.
- Chart panels keep the 2-up grid with equal heights; titles use Jost with an orange lamp dot.
- Map and "Accident-prone spots" now sit side by side on desktop (2/3 + 1/3). The hotspot list is a numbered ranking (01–06) with count pills, like the landing page's numbered feature list. The static basemap is toned down so it does not glare on the dark UI.
- Recent reports table: transparent rows, small-caps header, orange report IDs, orange hover tint. Under 768px each row becomes a stacked card (ID + status, date, location).
- Filter bar is now a single pill container with dark date inputs (`color-scheme: dark`), orange Apply and amber "All dates".

## Structural changes
- Page title and filter form are wrapped in `<header class="rr-dashboard-head">`; an eyebrow ("Bulacan admin portal") and a one-line subtitle were added. The `<h1>` and the `<form>` are unchanged inside it.
- Added a decorative `<div class="rr-dashboard-tape" aria-hidden="true">` (caution tape) after the header.
- Sidebar: added a "Main menu" label above the nav and an inline SVG icon (`aria-hidden`) inside each nav link. Link text, `href`, `data-rr-href`, `aria-current` and the Notifications count pill are untouched.
- Map panel and "Accident-prone spots" panel are wrapped together in `<div class="rr-dashboard-split">`. DOM order is unchanged (map first, then spots).
- The recent-reports panel gets a heading row ("Recent reports" + "View all reports" link to `../reports/index.html`, `data-rr-href="/admin/reports"`).
- Each stat card gets a `data-level` attribute (`none` | `low` | `moderate` | `high`) and a visually hidden `<span class="rr-dashboard-level-text">` with the level in words, so the status is not conveyed by colour alone.
- Added a small inline `<script>` at the end of the body that sets `data-level` from the card's number on load and again whenever `.stat-value` changes (MutationObserver), so live updates only need to change the number.
- Extra classes added to existing elements: `rr-dashboard-stats` (stat grid), `rr-dashboard-charts` (chart row), `rr-dashboard-note` (official-note paragraph). All original classes, ids and `data-rr-*` attributes are kept.

## New classes
- `rr-dashboard-nav-label`, `rr-dashboard-ico`
- `rr-dashboard-head`, `rr-dashboard-head-text`, `rr-dashboard-eyebrow`, `rr-dashboard-sub`, `rr-dashboard-tape`
- `rr-dashboard-stats`, `rr-dashboard-note`
- `rr-dashboard-charts`, `rr-dashboard-split`
- `rr-dashboard-panel-head`, `rr-dashboard-link`, `rr-dashboard-level-text`
- CSS custom properties are also prefixed `--rr-dashboard-*` and are defined on `.staff-shell`.

## States covered
- [x] Default
- [ ] Empty — not designed here; stat cards already read cleanly at 0, but empty chart/table/map copy is not styled
- [ ] Loading — not designed here
- [ ] Error — not designed here
- [x] Mobile (390px)
- [x] Keyboard focus — amber 2px outline on nav links, buttons, inputs and links; stat-card and table links keep a visible focus ring
- [x] Reduced motion — all transitions and the stat-card hover lift are disabled

## Anything the integrator must know
- Only `index.html` and `screen.css` changed. Nothing in `_shared/` was edited, and the shared sidebar divider (yellow dashed line) and layout breakpoints are left to `app.css`.
- `screen.css` was written without access to `_shared/app.css`, so a few overrides use `!important` where Bootstrap utilities win (`.border-bottom` and `.d-flex` on hotspot rows, `.text-secondary`). I checked it in a test harness with stand-in shared CSS only; please look at it once with the real shared files.
- Chart tiles still use the static PNGs at their native size inside the 260px `chart-box`. The real Chart.js canvases should use the same orange (`#e4572e`), amber (`#f5c518`), teal (`#5fb7a5`) palette and cream (`#ece8df`) tick/legend text, and a faint grid (`rgba(236,232,223,.09)`), to match the panels. The PNG for By municipality is still green.
- The map toning uses `filter` on `.rr-static-map` and `.leaflet-tile-pane`, so the live Leaflet tiles get the same treatment.
- On phones the table uses `display: grid` on rows, which can drop table semantics in some screen readers. The header row is kept as visually hidden text. If this is a concern, add `role="row"`/`role="cell"` in the React markup.
- New content (eyebrow, subtitle, "View all reports" link, nav icons) is static copy with no data binding.
- **Stat-card level logic.** The mockup script is for the mockup only. In the app, compute the level where the count is rendered and set `data-level` on the card, using the same thresholds:
  `const level = (n) => (n > 0 ? (n <= 5 ? "low" : n <= 10 ? "moderate" : "high") : "none");`
  Then render `<a ... data-level={level(count)}>` and put the matching word (None / Low / Moderate / High) in the hidden `rr-dashboard-level-text` span. The CSS only reads `data-level`, so no further styling is needed. Cards without a `data-level` fall back to orange. The thresholds apply to every card, including "All reports", so 11 reports shows red.

## Mobile burger menu (added later)
- Under 992px the sidebar turns into a sticky top bar (logo, and a menu button on the right). The navigation, the user name and Log out open from the button as a vertical list. At 992px and above nothing changes.
- Structural: added `<button class="rr-dashboard-burger" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">` as the first child of the `<aside class="sidebar">`, and `id="site-nav"` on the `<nav class="side-nav">`. Added a small inline `<script>` at the end of the body. The existing links, `data-rr-*` attributes and the "Main menu" label are unchanged.
- New classes: `rr-dashboard-burger`, `rr-dashboard-burger-bars`, and the state class `rr-dashboard-menu-open` (added to the `<aside>` while the menu is open).
- In React: keep an `open` state, put the `rr-dashboard-menu-open` class on the `<aside>` when it is true, and set `aria-expanded={open}` and `aria-label={open ? "Close menu" : "Open menu"}` on the button. Close it on Escape and when a nav link is chosen. The inline script in the mockup is only a stand-in.
- The CSS forces the page into a single column under 992px (`.staff-shell { display: block }`) and makes the sidebar `position: sticky`, so it does not depend on the shared breakpoint for the sidebar. Please check once against the real `_shared/app.css`.

## Small-screen safety (added later)
- Checked every screen at 320, 360, 390, 414, 600, 768, 820 and 991px, including with shared styles that give inputs a large `min-width`, for anything that sticks out past the screen edge.
- Fixes in `screen.css`: filter-bar controls may always shrink under 576px and sit one per row under 420px (so dates and dropdown labels are never cut off); anything that still spills sideways is clipped on `.staff-main` under 992px (tables and the chart image keep their own sideways scroll); long words in table cells and panel text may wrap; images and SVGs never exceed their container. The chart tiles use a real CSS grid instead of Bootstrap's negative-margin row, and on phones the stat-card ring moves to the top-right corner so labels have the full card width.
- If you still see something sticking out in the real build, send me the page name, the screen width and a screenshot.
