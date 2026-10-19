# I06.3 — Responsive shell QA

Local synthetic runtime, Vite + Cloudflare dev plugin, Chromium via Playwright CLI. No Preview, remote resource, production, real data or auth changes.

## Results

- Web TypeScript check: PASS (`npm run typecheck`).
- Web build (Worker and client): PASS (`npm run build`).
- Canonical state consistency validator: PASS (`python3 scripts/check_orchestration_state.py`).
- Desktop shell screenshot: `catalog-desktop-1440x1000.png`.
- Mobile shell screenshot: `catalog-mobile-390x844.png`.
- Mobile menu open (guest/OWNER/ADMIN): `mobile-navigation-open-390x844.png`, `mobile-navigation-owner-390x844.png`, `mobile-navigation-admin-390x844.png`.
- 320px viewport: document width 320px; no horizontal overflow. All text filters render labels before their full-width controls.
- Keyboard: first Tab reveals the skip link; mobile menu opens with its button; Escape closes it, sets `aria-expanded=false`, and returns focus to the menu button.
- Navigation: selecting “Ingresar” from the open mobile menu reached `/login`, closed the menu and moved focus to the `main` landmark. Route links to OWNER and ADMIN do the same. Existing route records and role conditions were not changed.
- Logout focus: with a synthetic ADMIN response on `/`, opening the mobile menu and signing out against a synthetic HTTP 200 logout response removed role links and placed focus on `main` even though the URL did not change.
- OWNER/ADMIN shell smoke used Playwright-only synthetic `/api/auth/me` responses (no real credentials): OWNER saw “Mis publicaciones” only, reached `/owner`, and focus moved to `main`; ADMIN saw “Revisión” and “Gestión asistida” without OWNER links, reached `/admin`, and focus moved to `main`. This verifies client navigation/conditional rendering, not backend authentication.
- The catalog, detail, login, owner, admin review and assisted-admin route views expose a level-one page title. Section/card headings follow h1→h2→h3 without skipping levels; snapshots confirmed the catalog and ADMIN review headings.
- Playwright computed contrast on rendered controls: muted brand caption/footer 4.89:1 on canvas, text/select borders 4.09:1 on paper (3.63:1 against canvas), and hovered `.secondary` 9.99:1. Light controls retain dark text on sage.
- OWNER contact heading selectors were retargeted after the semantic update: section `h2` remains 1.6rem and each visitor-name `h3` remains 1.05rem.
- Reduced-motion rule is present for all transitions/animations.

## Environment limitation

Without Playwright interception, local Vite returns HTTP 503 for `/api/auth/config` and `/api/auth/me` because synthetic PASSWORD auth is not enabled by the generic dev command. For the role shell smoke, Playwright intercepted only these reads with synthetic OWNER/ADMIN session responses. That confirms client navigation and conditional links; it does not test authentication or backend authorization. Auth/session behavior was not changed. No credentials or real identities were used.
