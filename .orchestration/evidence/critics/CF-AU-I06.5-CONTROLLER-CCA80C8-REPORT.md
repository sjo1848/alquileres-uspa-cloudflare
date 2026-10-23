## Controller review — Issue #32 / CF-AU-I06.5

**Exact candidate:** `cca80c871738fa229682478769ce5164ca8e6483`
**Tree:** `a95d70f42d9479044ec3a73b2a88e368466b8c31`
**Base:** `48e4f5c4251fe939cb779698e4e51b16614be178`
**Delta reviewed:** `c848d8459f2aff10bb023cd4d14059d6604c2649..cca80c871738fa229682478769ce5164ca8e6483`

**Runtime verification:** Requested GPT-6 Luna / High / read-only. The environment’s filesystem policy is read-only, but this session does not expose verifiable model/effort or a separate-process CLI/session record. Backend identity is **UNVERIFIED**.

**Inspected:** Worker auth/media config and OWNER image routes; Vue media-strategy gating; Worker media regressions; Playwright seed/reuse changes; QA evidence; Issue #32 contract, applicable invariants, and the static-media path constraint.

**Findings:** P0: none. P1: none. P2: none. P3: none.

The new delta **passes technically**: OWNER reads of repository-managed photos are scoped through the owned listing; static paths are constrained by the `static_listing_images` CHECK and unsafe-path regressions; STATIC_ASSETS image mutations remain denied; and the D1 BLOB byte-serving branch remains intact. The mixed static+D1 BLOB seed and browser assertions cover both photos, while approved-photo controls remain read-only. Playwright now seeds before startup and sets `reuseExistingServer: false`.

**Evidence gap:** [QA.md](/output/playwright/i06.5/QA.md) records two consecutive Workerd + local D1 runs passing 2/2 each. I did not rerun them, as instructed; their results are documented evidence rather than independently reproduced in this review.

**Final verdict: BLOCKED** on required runtime model/effort verification. The reviewed code delta itself **passes**; no code rework or Human Gate is identified.