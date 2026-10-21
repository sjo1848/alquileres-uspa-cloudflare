# I06.4 GitHub review rework — saved catalog page out of range

- Review finding `4320588628`, PR #39, exact prior head `0f593ddfa1464d22d99841af4bbf19fd57ccbc58`, severity P2, `apps/web/src/views/HomeView.vue:100`.
- Reproduction: a URL retains `page=2` and active filters after matching results shrink to one page. API correctly returns `totalItems > 0`, `totalPages: 1`, and empty `items` for page 2; the old UI misreported no matching listings.
- Repair: when an API response shows requested page greater than `max(1,totalPages)`, replace only the page query with the last valid page (remove `page` for page 1), preserving all other filters. Route watch reloads the valid page and stale request sequencing remains active.
- Regression: `apps/web/e2e/public-journey.spec.ts`, “catálogo: una página guardada fuera del nuevo total vuelve a la última página válida”; real local D1 fixture with `maxOccupants=4`, saved page 2, verifies query normalization and all four valid cards.
- Validation after repair: `npm run typecheck` PASS; `npm run test:e2e:public` 4/4 PASS in 38.2 s. Local synthetic Worker/D1 only. No Worker runtime, API, Preview, Access, production, cost, data or source-repository changes.
- Prior Controller PASS was on the pre-fix executable SHA and is superseded for the changed frontend. Fresh exact-SHA Controller, GitHub checks/review and Pre-Critic are required before merge.
