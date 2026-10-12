# CF-AU-I01-P0P1 Artifact A2 — REWORK-1 Closure Evidence

Date: 2026-10-12. Scope: two bounded cost-model omissions only, under the existing Task Contract. External review source: `.orchestration/reviews/CF-AU-I01-P0P1-ARTIFACT-A2-CRITIC.md`, canonical `main@66a56a193ec418e28b17ca871df2289bf706edef`.

## A2-F1 — registration route omitted

- Source route: `POST /auth/register` in read-only source `sjo1848/alquileres-uspa@267c531f3e3d5869240894063d3a194fa1f9680b`, `apps/api/src/auth/auth.controller.ts` → `AuthService.registerOwner`.
- Route work: each scenario now counts a nonzero registration Worker request. The modeled registration performs one source-compatible bcryptjs cost-12 hash; the same 10/100/600 ms *assumed provider CPU per auth operation* sensitivity as login is charged. The 600 ms case remains an elapsed-proxy sensitivity, never billed CPU evidence.
- D1: zero explicit query reads per registration because the pinned source calls `User.create` without a preceding lookup. Any engine-level unique-index probe reads are unmeasured and not counted. Three rows-written are assumed per registration (one user row + primary-key and unique-email index rows). These are explicit planning assumptions, not D1 `meta` observations. Hash generation precedes the create, so duplicate registrations can still spend bcrypt CPU; scenario counts treat registrations as successful and do not claim success ratio.
- Monthly registration scenarios: 100 / 1,500 / 50,000 for low/base/high.

## A2-F2 — image deletion/reorder lifecycle omitted

Source routes/methods are `DELETE /listings/:id/images/:imageId` → `ListingsService.removeImage` and `PATCH /listings/:id/images/:imageId` → `ListingsService.reorderImage` in the same pinned read-only source.

- Image GET: public path assumes 2 D1 rows read (image + listing); ADMIN path assumes 4 (AuthGuard user revalidation + image/listing/owner-role lookup). The traffic split is an explicit 95% public / 5% ADMIN assumption, not an observed mix.
- Delete: each operation models one Worker request, AuthGuard user reload + owned-draft listing lookup + image lookup + average position-compaction scan (5 / 7 / 11 D1 rows read for 2 / 4 / 8 shifted images), and one R2 `GetObject` Class B read before the Standard `DeleteObject` (free). D1 writes model the deleted table row plus four pinned-source image index entries and each shifted row plus two position-index writes: 11 / 17 / 29 metered rows per operation. Failure restoration `PutObject`, retries and concurrent cleanup amplification remain unresolved/unmodeled.
- Reorder: each operation models one Worker request and 4 / 6 / 8 average images in the listing. D1 read factor is `4×images + 2` (AuthGuard user + owned-draft listing + ordered load + updateMany scan + per-image update lookups + final ordered result read): 18 / 26 / 34 rows. Writes are 6×images (bulk reset and individual reassignment, each assumed one table-row plus two index-row mutations). This is an explicit cost proxy, not a D1 query-plan, concurrency or migration proof. No R2 operation is attributed to reorder because the source changes only metadata ordering.
- Monthly delete scenarios: 300 / 3,000 / 150,000. Reorder scenarios: 500 / 5,000 / 100,000.

## Reproducible result

Calculator: `.orchestration/evidence/fixtures/calculate-i01-cost.mjs`; result: `.orchestration/evidence/CF-AU-I01-P0P1-COST-RESULTS.json`; source-map and rationale: `docs/research/CF-AU-I01-P0P1-COST-MODEL.md`.

| Scenario | Worker requests/month | D1 rows read | D1 rows written | R2 Class B including delete reads | Estimated USD/month at 10 / 100 / 600 assumed auth CPU ms |
|---|---:|---:|---:|---:|---:|
| Low | 100,900 | 1,805,900 | 31,600 | 14,300 | 5.00 / 5.00 / 5.00 |
| Base | 3,009,500 | 267,586,000 | 445,500 | 1,853,000 | 5.00 / 5.00 / 5.00 |
| High | 20,300,000 | 30,381,700,000 | 17,300,000 | 11,650,000 | 23.1467 / 26.8367 / 47.3367 |

The CPU sensitivity applies once to every modeled login and registration. Actual provider CPU, traffic mix, registration success mix, image-count distribution, D1 rows-read/write counters, exact index amplification, retries, object restoration and concurrency are unmeasured. Durable Objects remain unresolved and are not assumed zero or included in these totals. No auth code, dependencies, source code, Cloudflare resource, billing setting, production service or real data changed.

## Validation and review state

The standalone validator independently reconciles Worker request totals, auth CPU, D1 reads/writes and R2 delete-prefetch reads for all 3×3 scenario/sensitivity outputs; it also enforces the distinct public/ADMIN image read factors and source-derived delete/reorder scan assumptions. Four mutation checks ensure the guards reject a zero registration driver, removal of the delete prefetch read, a zero reorder driver, and equalized public/ADMIN image-read factors. Exact output comparison and syntax/whitespace checks are recorded in `CF-AU-I01-P0P1-VALIDATION.md`.

The independent cost-method critic recalculated all nine final scenario/sensitivity points, confirmed the source mapping and four mutation rejections, and recorded a bounded internal PASS in `.orchestration/evidence/critics/i01-cost-method-critic.md`. Integration Review and Pre-Critic are complete for A3 publication. This remains neither an External Independent Critic verdict nor a cost/product/security acceptance.
