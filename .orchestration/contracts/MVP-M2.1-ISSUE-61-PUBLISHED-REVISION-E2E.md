# M2.1 — Issue #61 published-listing revision E2E

## Authority and boundary

- Authorized Issue: [#61](https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/61).
- Base: `main@4e4af22535594a9c4f3c8a419e47408661575140`.
- Extend the existing loopback-only local Chromium harness and command. No product behavior or production code changes unless the test reproduces a functional defect.
- All D1 writes occur in the command's disposable local synthetic database. No remote D1, Preview, Access, CD, production or M3 work.

## Acceptance

1. OWNER creates and submits a synthetic listing; ADMIN approves and explicitly publishes it.
2. The listing has repository-managed synthetic image metadata and a real synthetic public contact before the revision.
3. OWNER changes availability, edits the already-published listing and saves/submits a private revision.
4. The public API continues returning the original title and price after save and after ADMIN approval.
5. ADMIN explicitly publishes the approved revision; the public API now returns the changed fields under the same listing ID.
6. Image metadata, contact ID/content/state, availability and last-confirmed timestamp remain unchanged across the revision lifecycle.
7. Existing auth renewal, independent OWNER/ADMIN sessions and per-session logout assertions still pass.
8. The one-command local E2E, relevant Worker regressions, Web typecheck/build, GitHub CI and exact-head code review pass before protected merge.

## Execution

- Command: `cd apps/web && npm run test:e2e:preview-auth:local`.
- The harness uses bundled Playwright Chromium, a fresh temporary local D1 and synthetic data. A UUID-validated fixture helper attaches an existing repository-managed SVG only inside that disposable D1; it does not enable image uploads or modify assets.
- The wrapper removes the D1, browser profile and Playwright output on success or failure.
