# Login — change notes

Route: `/login`
Mockup: `html-mockups/_screens/login/index.html`
Editable CSS: `html-mockups/_screens/login/screen.css`

## What changed
- Redesigned the sign-in screen to match the public landing page: ink-black ground with a soft orange glow, a caution-tape strip across the top, a CSS-only perspective road with orange and cream speed streaks rising from the bottom, cream text, Jost headings and an orange letter-spaced eyebrow ("Bulacan admin portal").
- The card is a rounded dark panel with an orange-to-amber top accent line and a tiny traffic light in the corner (amber lit, red and green dim), echoing the landing page's "No Lost Reports" section.
- Labels are small-caps and muted; inputs are dark with an orange focus ring; "Log in" is a large orange button with a soft glow; "Forgot password" is amber and "← Back to home" is muted.
- **Show / hide password:** an eye button sits inside the password field. Clicking it (or pressing Enter or Space on it) switches the field between hidden and visible text. The icon changes between an eye and a crossed-out eye, and the button is amber while the password is visible.
- A footer line ("© RoadReport · Bulacan, Philippines · For authorized administrators and traffic officers") sits at the bottom, in the style of the landing page footer. It names both account types on purpose, since officers (created by an administrator) also sign in here.
- Phone (390px): the card fills the width with slightly smaller padding and title; the road is shorter.

## Structural changes
- Added three decorative, `aria-hidden` elements inside `.auth-page`: `rr-login-tape`, `rr-login-road`, and the footer `<p class="rr-login-foot">`. They are absolutely positioned and do not affect the layout of the card.
- Added classes `rr-login-page` to `.auth-page` and `rr-login-card` to the form. Added a decorative `div.rr-login-lamps` (`aria-hidden`) as the first child of the form, and `span.rr-login-eyebrow` before the `<h1>`.
- The password `<input>` is now wrapped in `<div class="rr-login-field">` together with the new toggle `<button type="button" id="password-toggle" class="rr-login-toggle" aria-controls="password" aria-pressed="false" aria-label="Show password">` holding two inline SVGs (`rr-login-eye`, `rr-login-eye-off`). The input keeps its id, name, `type`, `autocomplete` and `required`.
- Added a small inline `<script>` at the end of the body that switches the input between `type="password"` and `type="text"` and updates `aria-pressed` and `aria-label` ("Show password" / "Hide password").
- The `<h1>` (keeps `data-rr-region="page/title"`), email field, Log in button, Forgot password button, Back to home link and toast box are unchanged.

## New classes
- `rr-login-page`, `rr-login-card`, `rr-login-tape`, `rr-login-road`, `rr-login-lamps`, `rr-login-eyebrow`, `rr-login-foot`
- `rr-login-field`, `rr-login-toggle`, `rr-login-eye`, `rr-login-eye-off`
- Custom properties are prefixed `--rr-login-*` and defined on `.rr-login-page`.

## States covered
- [x] Default
- [ ] Empty — not applicable
- [ ] Loading — not designed (no spinner or disabled state on the Log in button)
- [ ] Error — not designed (no "wrong email or password" message; the shared toast box is untouched)
- [x] Mobile (390px)
- [x] Keyboard focus — amber 2px outline on the toggle, button and links; orange ring on inputs
- [x] Reduced motion — nothing animates; transitions are disabled

## Anything the integrator must know
- Only `index.html` and `screen.css` changed. Nothing in `_shared/` was edited. I did not have the real `_shared/app.css`, so I checked the page against stand-in styles; please look at it once with the real shared files. The card sets its own `border`, `background`, `padding` and `width`, so it replaces the shared `.auth-card` look (including its orange top border).
- **Password toggle in React:** keep the input `type` in state (`show ? "text" : "password"`), toggle it from the button, and set `aria-pressed={show}` and `aria-label={show ? "Hide password" : "Show password"}`. The inline script in the mockup is only a stand-in. The button is `type="button"`, so it never submits the form. Keep the input's `autocomplete="current-password"` so password managers still work.
- The toggle is positioned inside `.rr-login-field`, so keep that wrapper (or any `position: relative` wrapper) around the input.
- The road and tape are pure CSS and can be dropped without affecting the form if they are not wanted.
- No error styling exists yet. If the app shows a login error, use red `#e5483a` on the same dark surface, above the Log in button.
- **Copy changed for two account types:** administrators and traffic officers (created by an administrator) both sign in here, so the heading now reads "Staff log in", the paragraph reads "This portal is for authorized administrators and traffic officers. Reporters use the RoadReport mobile app.", and the footer reads "For authorized administrators and traffic officers". The landing page footer ("Administrator access only") was not part of this screen and still needs the same wording change.
