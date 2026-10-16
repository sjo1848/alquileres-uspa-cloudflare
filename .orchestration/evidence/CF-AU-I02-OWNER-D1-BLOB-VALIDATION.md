# CF-AU-I02 OWNER D1 BLOB — local validation checkpoint

Date: 2026-10-16 (UTC)
Authority: Issue #7 comment 6219058078; OWNER Preview was accepted 6/6 on main `f17adae431b92a4f66aecda066947b24164eb0e2`.

## Candidate under review

- Executable implementation commit: `ece1850d8c291ba7d40bc5abce4c7504a9d4ce7f`
- Git tree: `72ce6051e9377489dd2f5e0a0c17eddfffff0280`
- Branch: `work/cf-au-owner-d1-blob`
- Contract: `.orchestration/contracts/CF-AU-I02-OWNER-D1-BLOB-IMAGES.md`
- No remote Preview mutation or migration has occurred in this increment.

## Verification

All commands exited 0 against the executable tree committed above:

| Check | Result |
|---|---:|
| Worker `npm run test:media -- --reporter=dot` | 11/11 PASS |
| Worker `npm run test:owner -- --reporter=dot` | 4/4 PASS |
| Worker `npm run test:catalog -- --reporter=dot` | 7/7 PASS |
| Worker `npm run typecheck` | PASS |
| Web `npm run typecheck && npm run build` | PASS |
| Web `npm run build:preview` | PASS; generated profile is D1_BLOB, template D1 ID is placeholder |
| `git diff --check` | PASS |

The focused D1 BLOB suite covers binary signature/MIME validation, ownership, CSRF, status restrictions, request bounds, upload atomicity and same-key recovery, public visibility, replay after image deletion without recreation, quota under concurrent uploads, 20-image cap, dense reorder/delete and failed-batch rollback/retry.

## Browser integration evidence

A disposable local Vite/Workers profile with `MEDIA_STRATEGY=D1_BLOB`, password auth and synthetic D1 was used; the existing `STATIC_ASSETS` local server was not used for this test. In the browser the synthetic OWNER created a draft, uploaded two synthetic 1×1 PNG fixtures, viewed their thumbnails, reordered them and deleted one. UI confirmations and final order/count matched the API. This is local browser evidence only, not Preview deployment or Human Product Acceptance. The first attempt against the pre-existing STATIC_ASSETS local profile returned 503 because it lacked the D1 BLOB migration/profile; the correct isolated profile passed.

## Boundaries / next action

- Source repo `/home/sjo1848/dev/alquileres-uspa` remained clean and read-only.
- No R2, paid service, billing, production, real data, new remote resource or HMS/portfolio change.
- Strict Free constraints and 1.8MB/image, 20/listing, 250MB aggregate app limit remain in force. Official D1 limit references and observed date are pinned in the contract.
- **Pre-Critic checkpoint:** PASS only to push this bounded functional candidate for automated GitHub review and a separate read-only Controller review. No substantive PASS, protected merge or Preview update is implied. Next: push/open the feature PR, resolve material GitHub findings, review the exact final PR SHA with GPT-6 Luna/High/read-only Controller, then perform protected merge and update the existing private Preview with migration 0007.
