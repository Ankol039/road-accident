# Categories and settings — change notes

Route: `/admin/settings`
Mockup: `html-mockups/_screens/settings/index.html`
Editable CSS: `html-mockups/_screens/settings/screen.css`

## What changed
- Restyled the screen to match the landing page, dashboard, reports, summaries and users screens: ink-black ground, cream text, signal orange and hazard amber accents, Jost headings, orange letter-spaced eyebrow, and the caution-tape strip under the header. The sidebar is identical to the other screens (orange line icons, orange-bar active item, amber count pill).
- Page header: eyebrow, large title and a one-line subtitle.
- Layout: the three panels (Accident categories, System settings, Emergency contacts) are now stacked full width, in the original order. Before, the short categories panel sat beside the tall settings form and left an empty hole under it.
- Accident categories and Emergency contacts tables: transparent rows, small-caps headers, bold cream names with muted descriptions, orange report counts and order numbers, hover tint, outlined Edit / Hide buttons that fill orange on hover, and red-outlined Remove buttons that fill red on hover.
- "Add category" and "Add contact" forms sit in a dashed tray under their table, with small-caps labels, dark inputs with an orange focus ring and an orange primary button. "Shown" is a pill that lights up orange when checked.
- System settings: the form is three grouped cards side by side (General, Duplicate rule, Officer arrival check) with a lamp dot on each title and the Save settings button underneath. Two cards per row under 1200px, one under 768px.
- Phone (390px): table rows become cards. Categories show name + description, then "Reports: n" and the form state, then the buttons. Contacts show "#order" + name, then phone and shown state, then the buttons. All add-form fields stack full width.

## Structural changes
- Added `<header class="rr-settings-head">` around the `<h1>` with an eyebrow and a subtitle. The `<h1>` keeps its `data-rr-region="page/title"`.
- Added a decorative `<div class="rr-settings-tape" aria-hidden="true">` after the header.
- Sidebar: added a "Main menu" label and an inline SVG icon (`aria-hidden`) in each nav link. Link text, `href`, `data-rr-href`, `aria-current` and the Notifications pill are untouched.
- System settings form: the "System name" and "Photos allowed" fields are now wrapped in `<div class="rr-settings-group">` with an added `<h3 class="rr-settings-group-title">General</h3>`. The two existing `<fieldset>`s got the class `rr-settings-group`. Fields, ids, names and order are unchanged.
- Added classes to existing elements: `rr-settings-grid` (the row), `rr-settings-form` (settings form), `rr-settings-add` (both add forms), `rr-settings-categories` and `rr-settings-contacts` (the two table wrappers). The original Bootstrap column classes are kept but overridden by `rr-settings-grid`.
- No `data-rr-*` attribute, id, form field or table row/column was removed or reordered.

## New classes
- `rr-settings-nav-label`, `rr-settings-ico`
- `rr-settings-head`, `rr-settings-eyebrow`, `rr-settings-sub`, `rr-settings-tape`
- `rr-settings-grid`, `rr-settings-form`, `rr-settings-group`, `rr-settings-group-title`
- `rr-settings-add`, `rr-settings-categories`, `rr-settings-contacts`
- Custom properties are prefixed `--rr-settings-*` and defined on `.staff-shell`.

## States covered
- [x] Default
- [ ] Empty — not designed (no "no categories yet" / "no contacts yet" message)
- [ ] Loading — not designed
- [ ] Error — not designed (no inline validation or save-error styling)
- [x] Mobile (390px)
- [x] Keyboard focus — amber 2px outline on nav links, buttons and links; orange ring on inputs
- [x] Reduced motion — all transitions disabled

## Anything the integrator must know
- Only `index.html` and `screen.css` changed. Nothing in `_shared/` was edited. I did not have the real `_shared/app.css`, so I checked the page against stand-in styles; please look at it once with the real shared files. Where Bootstrap utilities win, a few rules use `!important`.
- The `rr-settings-grid` rule turns the Bootstrap `row` into a one-column CSS grid, so the `col-xl-7`, `col-xl-5` and `col-12` classes no longer matter. If the React page is rebuilt, plain full-width blocks are enough.
- The `<legend>` elements keep Bootstrap's `float: left; width: 100%` behaviour so they sit inside the card, not on its border.
- The mobile cards use `display: grid` on table rows, which can drop table semantics in some screen readers. The header row is kept as visually hidden text. Add `role="row"` / `role="cell"` in the React markup if this matters. The "Reports:" and "#" labels on phones are CSS-generated.
- A hidden category currently shows the same text as a shown one ("Shown on the form"); the mockup has no hidden example. A hidden row will probably want a muted style (for example a `rr-settings-` class on the row) in the React markup.
- The checkbox pill uses `:has(input:checked)`. In very old browsers it simply doesn't light up; the checkbox still works.
- New static copy (eyebrow, subtitle, "General" title) needs no data binding.

## Mobile burger menu (added later)
- Under 992px the sidebar turns into a sticky top bar (logo, and a menu button on the right). The navigation, the user name and Log out open from the button as a vertical list. At 992px and above nothing changes.
- Structural: added `<button class="rr-settings-burger" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">` as the first child of the `<aside class="sidebar">`, and `id="site-nav"` on the `<nav class="side-nav">`. Added a small inline `<script>` at the end of the body. The existing links, `data-rr-*` attributes and the "Main menu" label are unchanged.
- New classes: `rr-settings-burger`, `rr-settings-burger-bars`, and the state class `rr-settings-menu-open` (added to the `<aside>` while the menu is open).
- In React: keep an `open` state, put the `rr-settings-menu-open` class on the `<aside>` when it is true, and set `aria-expanded={open}` and `aria-label={open ? "Close menu" : "Open menu"}` on the button. Close it on Escape and when a nav link is chosen. The inline script in the mockup is only a stand-in.
- The CSS forces the page into a single column under 992px (`.staff-shell { display: block }`) and makes the sidebar `position: sticky`, so it does not depend on the shared breakpoint for the sidebar. Please check once against the real `_shared/app.css`.

## Small-screen safety (added later)
- Checked every screen at 320, 360, 390, 414, 600, 768, 820 and 991px, including with shared styles that give inputs a large `min-width`, for anything that sticks out past the screen edge.
- Fixes in `screen.css`: filter-bar controls may always shrink under 576px and sit one per row under 420px (so dates and dropdown labels are never cut off); anything that still spills sideways is clipped on `.staff-main` under 992px (tables and the chart image keep their own sideways scroll); long words in table cells and panel text may wrap; images and SVGs never exceed their container. The add-form columns use `minmax(min(150px, 100%), 1fr)`.
- If you still see something sticking out in the real build, send me the page name, the screen width and a screenshot.
