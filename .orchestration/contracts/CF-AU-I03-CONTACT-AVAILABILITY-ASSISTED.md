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
