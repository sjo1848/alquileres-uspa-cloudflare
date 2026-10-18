# CF-AU-I03 — Contact, availability and assisted-management journeys

Authority: Issue #7 comment 6248758792 (2026-10-18) and the standing local synthetic delivery authorization in `CF-AU-I02-NAVIGABLE-PREVIEW.md`.

## Scope

Complete the local synthetic user journeys for public contact submission, OWNER contact inbox/state and availability confirmation, and ADMIN-assisted draft creation with audit logging. Preserve Access protection on the existing private Preview; use no Service Tokens, Access-policy changes, R2, paid services, production, real data, new Cloudflare resources, or writes to the source repository.

## Acceptance

- Public contact accepts bounded, validated input only for an approved published listing and persists an unread event.
- An OWNER can read only their contact events, update event state, and update/reconfirm availability.
- ADMIN can create an assisted DRAFT for an existing OWNER and atomically record the action in audit history.
- Focused Worker tests, local Playwright user journeys, typechecks, build and whitespace validation pass.
- Remote authenticated E2E is reported only after a user-authorized Access browser session; if unavailable, record `BLOCKED_AUTH` for remote validation only and continue local work.

## Rework acceptance

- ADMIN-assisted creation requires a valid idempotency key, binds it to the normalized request, atomically commits draft + audit + replay snapshot, and returns the exact original result on replay.
- OWNER contact inbox returns at most 30 events per page, stable descending cursor pagination, and computes unread count in SQL.
- D1 parity ledgers record migration 0011 and all three source indexes, including owner/state/created time.
