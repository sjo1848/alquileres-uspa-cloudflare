# CF-AU-I02 — ADMIN demo role published to private Preview

Date: 2026-10-18 UTC; Preview deployment created at `2026-10-18T04:20:09Z`.

## Integrated code and approval

- PR #17 protected merge commit: `fccdb43397988e5fd4c467452d80a036b9eea69a`; merged head `cf1f2cc2be41266143ede17ff3c5e50e9ce299d6`.
- Immutable A1 `CF-AU-I02-PREVIEW-ADMIN-Artifact-A1` remains at `67b3585235f3af7ef6fa9c13b6b2693d92cbeac8` and is an ancestor of `main`.
- Required `worker`/`web` checks passed on the final PR head in run `39096407610` and on merge commit in `39096543268`. Automatic review of the final PR head had no findings/unresolved findings; all review threads were resolved. Protected main required PR, strict `worker`/`web`, conversation resolution and admin enforcement; force-push/deletion disabled; required approvals 0.
- Delegated Controller bounded PASS on immutable A1 is recorded in `critics/CF-AU-I02-PREVIEW-ADMIN-A1-CONTROLLER-PASS.md`. It was a separate Codex process, GPT-6 Luna/High requested, read-only accepted; actual backend model identity UNVERIFIED.

## Existing private Preview update

- Only `wrangler preview` was used (Wrangler 4.149.0); no `wrangler deploy`.
- Existing Preview name `private`, Worker `alquileres-uspa-lab`; stable URL: `https://private-alquileres-uspa-lab.sjo1848.workers.dev`.
- This update's immutable deployment URL: `https://f5c694bb-alquileres-uspa-lab.sjo1848.workers.dev`.
- The deployed code is the protected `main` merge above. Its Preview settings reported `AUTH_STRATEGY=ACCESS_PREVIEW`, `MEDIA_STRATEGY=D1_BLOB`, the existing synthetic D1 binding, and the existing `JWT_SECRET` secret. No R2 binding, billing, paid plan, Access policy edit, new resource, production deployment or real data was used.
- The existing Preview's operator-only Cloudflare Access policy was not modified. Anonymous probes to `/`, `/login`, `/admin`, `/health` on both stable and immutable URLs returned HTTP 302 to the Access login: **8/8 denied before application access**.
- Remote authenticated browser E2E remains **BLOCKED_AUTH** in this executor; no bypass or synthetic remote PASS is claimed. The Human can now test using the already-authorized Access identity.

## Existing synthetic D1 preparation

- Existing database `alquileres-uspa-preview-synthetic`, id `74a00c52-a63b-45a3-8213-6648378ed5b1` only.
- Read-only preflight showed migrations 0008–0010 pending; applied exactly those migrations, then ran the fixed idempotent `tests/seed-preview-admin.sql` fixture after confirming the ADMIN row was absent.
- Post-apply read-only verification: all ten migrations applied/no pending migrations; `synthetic-catalog-admin` is `preview.admin@example.test`, role `ADMIN`; one OWNER row and three synthetic listings remain; two D1 BLOB images remain (21,015 bytes). Queue contains one `SUBMITTED/UNPUBLISHED` listing and two approved/published listings.
- Preview secret listing contains the `JWT_SECRET` name only; secret value is not recorded. Existing OWNER photos and data were preserved by migrations (admin audit/index only).

## Build and cost boundary

- `npm --prefix apps/web run build:preview`: PASS on merged `main@fccdb43`.
- Existing Cloudflare Workers/Access Free confirmation is recorded in `CF-AU-PRIVATE-PREVIEW-RESOURCES.json` and the Human's Issue #7 confirmation of 2026-10-16. No paid resource or billing action was used.
- User entry point: `https://private-alquileres-uspa-lab.sjo1848.workers.dev/admin`.
- Functional validation by the Human is pending. Recommended path: sign in through existing Access; choose **Entrar como administrador (demo)**; approve the submitted synthetic listing; publish it separately; verify it in the catalog; optionally switch back to OWNER. Local integrated E2E remains 8/8 PASS as previously evidenced, not remote E2E.
