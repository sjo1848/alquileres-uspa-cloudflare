# CF-AU-I02 — Preview OWNER/ADMIN demo identity switch

Authority: Issue #7 comment 6245079462 and the Human instruction in this session. Scope is one existing, Access-protected, synthetic Preview only. No production-auth change, Access policy change, new identity/provider/resource, R2, billing, or real data.

The current Access operator may explicitly choose one of two fixed synthetic D1 identities, OWNER or ADMIN, for the purpose of testing the full listing-review journey. Every exchange must verify the signed Cloudflare Access app JWT, pinned issuer and audience, operator email, non-empty subject, token time claims, exact Preview origin, and current expected synthetic D1 role. The client may select only a fixed demo role; it cannot submit a user id/email or create/change a D1 role. Sessions remain HttpOnly/Secure/SameSite, short-lived and revalidated against D1. OWNER and ADMIN route authorization stays separate.

The selector is exposed only after `/auth/config` returns `ACCESS_PREVIEW`; password login and production auth semantics remain unchanged. Local Playwright may adapt the synthetic Preview exchange to two local-only seeded accounts while Worker tests independently verify real RS256/JWKS validation and role isolation. No such adapter or fixture is deployed.

Acceptance: focused Worker auth tests, Vue typecheck/build, Playwright OWNER-submit → explicit ADMIN switch → approve → separately publish → public-catalog journey, quick CI, material GitHub review resolved, one scoped read-only GPT-6 Luna High Controller PASS on the exact candidate, protected merge, synthetic Preview Admin fixture only, same Preview updated, anonymous Access denial rechecked. Record remote UI authentication separately if this executor lacks a legitimate operator session.
