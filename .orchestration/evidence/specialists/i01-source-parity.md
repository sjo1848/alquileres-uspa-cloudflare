# CF-AU-I01-P0P1 source/parity specialist report

Role: independent source/parity/data investigation; no implementation or source repository edits.
Source repository current main pin: `267c531f3e3d5869240894063d3a194fa1f9680b`; accepted I13 candidate: `8e11bebdb197321d500678f06233d6f174f03438`.

## Observations

- `main` at the source repo points to `267c531…`, parent `5bcde39…`; current commit only adds `docs/issue-24-recruiter-demo-discovery-design.md`.
- Comparing accepted I13 to current `main` yields no changed `apps/api/**` paths. Auth routes/guards/services, route controllers, Prisma schema, ten migration files and API tests remain unchanged from the accepted API semantics.
- Source auth: trim/lowercase email, bcryptjs hash/compare cost 12, duplicate registration maps P2002 to 409, invalid credentials to 401, JWT default 15 minutes, `alquileres_session`, DB reload by ID and current-role use. Bearer prefix takes precedence over cookie. Cookie clear repeats cookie options.
- Existing model consists of users, listings, listing_images, contact_events and admin_audit_logs with seven enum domains, unique/index constraints, audit JSON and CASCADE/RESTRICT relations. I13 preserves legacy rental values without semantic inference. Ten SQL migrations are PostgreSQL-specific.
- Owner listings/images, admin review/publication/assisted/audit, public catalog/detail/images/contact and health routes form the wider parity surface. Existing listing image mutation uses transaction-scoped PostgreSQL advisory locks; D1 concurrency parity is not demonstrated.
- Source Issue #24 comment `5891503272` is the Human I13 Product Acceptance PASS for accepted candidate `8e11beb…`; source runtime status remains stale and must be reconciled in a separate reviewable action before migration.

## Conclusions and scope

The current source pin does not indicate API/domain drift after I13; it does not prove Worker compatibility. Auth/security/data findings are preserved in `docs/research/CF-AU-I01-P0P1-BASELINE.md`. No source tree files were written. No claims are made about full API, D1, R2, concurrency or frontend parity.
