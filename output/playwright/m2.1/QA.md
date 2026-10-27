# M2.1 — local QA evidence

- **Base:** `main@de412467e10b386b74120c035de453ca165e1637`
- **Environment:** local Vue + Vite / Worker + Hono / Workerd + synthetic D1. The Owner E2E runner applied migrations locally and seeded synthetic identities. No remote D1, Preview, Access, production or real data was used.
- **Worker:** `tsc --noEmit` PASS; 5 relevant Vitest files PASS, 34 tests total (`rental-terms`, OWNER lifecycle, public listings, contact workflow, ADMIN moderation). The dedicated M2.1 suite is 3/3 PASS.
- **Web:** `vue-tsc --noEmit` PASS; Worker + client production build PASS.
- **Integrated browser:** Playwright M2.1 1/1 PASS. OWNER created a monthly draft, persisted and reloaded terms, submitted it; synthetic ADMIN approved/published through the existing API; public detail showed the declared values and disclaimers. Owner form and public detail had no horizontal overflow at 320, 390 or 1440 CSS px. E2E uses local D1, not remote authenticated evidence.
- **Coverage:** fixed deposit amount/currency and nonzero rule; utility price-inclusion meanings; pets; strict estimated date; unknown/optional values; legacy SQL NULL public detail; pre-M2.1 create replay with its original idempotency fingerprint; new create replay and changed-body conflict; OWNER A/B isolation; ADMIN cannot write M2.1 fields through assisted update; approved listing remains non-editable by OWNER; unrelated public contact/moderation regressions.
- **Limits:** no remote migration or deployment; migration `0014_monthly_rental_terms.sql` is additive and only exercised locally. Full historical/production migration and remote E2E are not claimed.

## Captures

- OWNER form: [1440 desktop](owner-terms-desktop-1440.png), [390 mobile](owner-terms-mobile-390.png), [320 mobile](owner-terms-mobile-320.png).
- Public listing detail: [1440 desktop](detail-terms-desktop-1440.png), [390 mobile](detail-terms-mobile-390.png), [320 mobile](detail-terms-mobile-320.png).

## GitHub P2 rework

The automated review of PR #59 found that adding default term values to the OWNER create fingerprint broke replay of committed/pending pre-M2.1 creates. The Worker now uses the exact legacy fingerprint when the incoming body has no M2.1 fields and fingerprints declared terms when present. Regression seeds a pre-upgrade row and idempotency receipt, proves same-key replay returns the original result, changed-body reuse remains 409, and no duplicate row is created. Focused Worker typecheck and M2.1 Vitest passed after the repair; exact-head GitHub checks/review and Controller are pending for the repaired candidate.
