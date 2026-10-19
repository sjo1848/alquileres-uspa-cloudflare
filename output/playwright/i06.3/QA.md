# I06.3 — Responsive shell QA

Local synthetic runtime, Vite + Cloudflare dev plugin, Chromium via Playwright CLI. No Preview, remote resource, production, real data or auth changes.

## Results

- Web TypeScript check: PASS (`npm run typecheck`).
- Web build (Worker and client): PASS (`npm run build`).
- Canonical state consistency validator: PASS (`python3 scripts/check_orchestration_state.py`).
- Desktop shell screenshot: `catalog-desktop-1440x1000.png`.
- Mobile shell screenshot: `catalog-mobile-390x844.png`.
- Mobile menu open: `mobile-navigation-open-390x844.png`.
- 320px viewport: document width 320px; no horizontal overflow. All text filters render labels before their full-width controls.
- Keyboard: first Tab reveals the skip link; mobile menu opens with its button; Escape closes it, sets `aria-expanded=false`, and returns focus to the menu button.
- Navigation: selecting “Ingresar” from the open mobile menu reached `/login` and closed the menu. Existing route records and role conditions were not changed.
- Reduced-motion rule is present for all transitions/animations.

## Environment limitation

The local runtime returned HTTP 503 for `/api/auth/config` and `/api/auth/me` because local synthetic PASSWORD auth is not enabled by the generic Vite dev command. The login page therefore displayed its existing unavailable state. Auth/session behavior is outside this increment and was not changed; role-specific navigation still uses the existing authenticated OWNER/ADMIN session conditions. No credentials or real identities were used.
