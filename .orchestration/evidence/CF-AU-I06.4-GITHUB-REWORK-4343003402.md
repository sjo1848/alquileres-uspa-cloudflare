# I06.4 GitHub review rework — capacity above six

- Review finding `4343003402`, PR #39 exact prior head `3d0662d493f488da3e6a2e21ec53b64f5e7a18d5`, severity P2. The catalog's fixed 1–6 person select hid API-supported capacity searches for larger groups.
- Repair: restore an accessible numeric input with `min=1`, integer step, and mobile numeric keyboard; no arbitrary maximum is imposed. Existing Worker parser/contract remains unchanged.
- Regression: Playwright submits capacity 8 to the local Worker API, verifies URL `maxOccupants=8` and the truthful empty state for the current synthetic inventory, then restores capacity 4 and verifies matching results.
- Consolidated local validation after the capacity fix: Web typecheck PASS; Playwright public 4/4 in 1.5m on local Worker/Hono + synthetic D1. Suite also covers both earlier P2 repairs, listing/contact and mobile #35. No remote Preview/production, cost, real data, R2, or source repo.
- Fresh exact candidate Controller and GitHub review/checks remain required.
