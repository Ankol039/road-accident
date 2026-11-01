# Summaries and export — change notes

Route: `/admin/summaries`
Mockup: `html-mockups/_screens/summaries/index.html`
Editable CSS: `html-mockups/_screens/summaries/screen.css`

## What changed
- Restyled the screen to match the landing page, dashboard and reports screens: ink-black ground, cream text, signal orange and hazard amber accents, Jost headings, orange letter-spaced eyebrow, caution-tape strip under the header, rounded raised panels with an orange lamp dot on each panel title. The sidebar is identical to the other screens (orange line icons, orange-bar active item, amber count pill).
- Page header: eyebrow, large title, one-line subtitle, and the Download CSV / Print buttons moved up to the right of the title as outlined orange buttons.
- Filter bar is one raised panel with small-caps labels above each field (Group by, Count, From, To), dark inputs with an orange focus ring, and an orange Show button.
- "Accidents per period" panel: lamp-dot title, muted subtitle, chart sits on the panel with no extra frame.
- Summary table: small-caps headers, tabular numerals, right-aligned numbers, the Total column in bold cream, orange hover tint, and a **sticky first column** (Period) so it stays visible when the table scrolls sideways. The Total row is a warm orange band with an orange "TOTAL" label.
- Export panel: lamp-dot title, muted copy with an amber "Accident reports" link, the "Verified accident records only" checkbox as a pill that lights up orange when checked, and outlined orange Download CSV / Download PDF buttons.
- Phone (390px): the filter fields sit two per row (Count gets its own row because its label is long), the chart image scrolls sideways at a readable size with a small hint, and the table scrolls sideways with the Period column pinned.

## Structural changes
- Added `<header class="rr-summaries-head">` around the `<h1>`, with an eyebrow and subtitle (both `no-print`). The `<h1>` keeps its classes and `data-rr-region="page/title"`, and still prints.
- The Download CSV and Print buttons were moved from inside `#summary-form` to the header (same buttons, now in a `div` with `rr-summaries-actions no-print`). They are `type="button"`, so nothing about the form's behaviour changes.
- Added a decorative `<div class="rr-summaries-tape no-print" aria-hidden="true">` after the header.
- Sidebar: added a "Main menu" label and an inline SVG icon (`aria-hidden`) in each nav link. Link text, `href`, `data-rr-href`, `aria-current` and the Notifications pill are untouched.
- Added classes to existing elements: `rr-summaries-filters` (form), `rr-summaries-table` (table panel), `rr-summaries-export` (export panel).
- No `data-rr-*` attribute, id, form field or table row/column was removed or reordered.

## New classes
- `rr-summaries-nav-label`, `rr-summaries-ico`
- `rr-summaries-head`, `rr-summaries-head-text`, `rr-summaries-eyebrow`, `rr-summaries-sub`, `rr-summaries-tape`, `rr-summaries-actions`
- `rr-summaries-filters`, `rr-summaries-table`, `rr-summaries-export`
- Custom properties are prefixed `--rr-summaries-*` and defined on `.staff-shell`.

## States covered
- [x] Default
- [ ] Empty — not designed (no "no data in this range" message or empty chart state)
- [ ] Loading — not designed
- [ ] Error — not designed
- [x] Mobile (390px)
- [x] Keyboard focus — amber 2px outline on nav links, buttons, links and the checkbox pill; orange ring on inputs
- [x] Reduced motion — all transitions disabled

## Anything the integrator must know
- Only `index.html` and `screen.css` changed. Nothing in `_shared/` was edited. I did not have the real `_shared/app.css`, so I checked the page against stand-in styles; please look at it once with the real shared files. Where Bootstrap utilities win, a few rules use `!important`.
- The chart is still the static PNG. The real chart should use the dashboard palette: bars `#e4572e`, grid `rgba(236,232,223,.09)`, tick labels cream/muted (`#8d979b`). On phones the chart box scrolls sideways with the image at 800px wide; if the live chart is a responsive canvas, give it a similar `min-width` or let it shrink and rotate its labels.
- The "Scroll sideways to see every period" hint under the chart on phones is CSS-generated text.
- At about 1300px wide or less (with the sidebar), the table scrolls sideways inside its panel instead of widening the page. The Period column is pinned with `position: sticky` and needs an opaque background (it has one).
- `.table-dark` on the Total row is kept; its look is overridden in `screen.css`.
- The checkbox pill uses `:has(input:checked)`. In very old browsers it simply doesn't light up; the checkbox still works.
- Print: the header title, chart and table print as a plain light document (white background, black text, no card styling, first column not sticky). I could only test this without the shared `.no-print` rules, so please check one real print preview.
- New static copy (eyebrow, subtitle) needs no data binding.

## Mobile burger menu (added later)
- Under 992px the sidebar turns into a sticky top bar (logo, and a menu button on the right). The navigation, the user name and Log out open from the button as a vertical list. At 992px and above nothing changes.
- Structural: added `<button class="rr-summaries-burger" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">` as the first child of the `<aside class="sidebar">`, and `id="site-nav"` on the `<nav class="side-nav">`. Added a small inline `<script>` at the end of the body. The existing links, `data-rr-*` attributes and the "Main menu" label are unchanged.
- New classes: `rr-summaries-burger`, `rr-summaries-burger-bars`, and the state class `rr-summaries-menu-open` (added to the `<aside>` while the menu is open).
- In React: keep an `open` state, put the `rr-summaries-menu-open` class on the `<aside>` when it is true, and set `aria-expanded={open}` and `aria-label={open ? "Close menu" : "Open menu"}` on the button. Close it on Escape and when a nav link is chosen. The inline script in the mockup is only a stand-in.
- The CSS forces the page into a single column under 992px (`.staff-shell { display: block }`) and makes the sidebar `position: sticky`, so it does not depend on the shared breakpoint for the sidebar. Please check once against the real `_shared/app.css`.

## Small-screen safety (added later)
- Checked every screen at 320, 360, 390, 414, 600, 768, 820 and 991px, including with shared styles that give inputs a large `min-width`, for anything that sticks out past the screen edge.
- Fixes in `screen.css`: filter-bar controls may always shrink under 576px and sit one per row under 420px (so dates and dropdown labels are never cut off); anything that still spills sideways is clipped on `.staff-main` under 992px (tables and the chart image keep their own sideways scroll); long words in table cells and panel text may wrap; images and SVGs never exceed their container.
- If you still see something sticking out in the real build, send me the page name, the screen width and a screenshot.
