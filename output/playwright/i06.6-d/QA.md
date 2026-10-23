# I06.D prototype visual QA

Artifact based on repository `main@b901b444b5819c1861cdfdf164d33e7ce92dff0e`. Local Python static server only, synthetic content/photos; no Vue/Worker/D1 runtime, Preview, Access, API, remote image source, or real user data.

- Chromium/Playwright captured 5 views per direction (`catalog`, `detail`, `owner`, `admin`, `assist`) at 1440×1000 and 390×844. Screenshots are full-page; the prototype-only chooser is hidden in captures, and fixed mobile navigation is placed after page content to avoid obscuring information. In the interactive prototype the navigation remains available.
- At 320×844, all five views for both directions report document `scrollWidth == clientWidth == 320`.
- Verified prototype navigation, catalog state selector (including error), contact form feedback and ADMIN action feedback. These are client-only visual simulations. The contact feedback states no message was sent; ADMIN actions state no change was saved.
- Synthetic images loaded successfully. No missing-image or page-script error observed in final capture pass.
- This confirms prototype rendering/responsive behavior only; it is not application/API QA or product acceptance.
