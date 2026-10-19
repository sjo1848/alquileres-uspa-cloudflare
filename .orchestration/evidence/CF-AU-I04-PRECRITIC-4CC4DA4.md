# CF-AU-I04 Pre-Critic addendum — audit count regression

- Executable/test candidate: `4cc4da4649e9ce75fc8007c4fc9bbffbdd3d9cca` (the application code remains as reviewed at `87f077ed3a64de36c89a6d4caf985bbd05405c29`; this commit adds a test-only audit-count assertion and records the Controller runtime result).
- Base: `774d0c747e8ecbbdb97776641becbd9e49875875` remains an ancestor.
- Latest subagent Controller process reviewed checkpoint `8981f7e` but returned `BLOCKED_MODEL_CONFIG` because model/runtime and read-only enforcement could not be verified. Its concrete P2 follow-up is addressed: after same-key replay and fresh-key 409, the Worker test now asserts exactly one `ADMIN_ASSISTED_LISTING_SUBMITTED` audit row.
- Focused verification after the regression change: `npm run test:management` **7/7 PASS**, Worker typecheck **PASS**, `git diff --check` **PASS**. Web/Worker code is unchanged from the already verified 87f077e; prior current-candidate Web typecheck, both builds, Python 25/25 and 15-check Workerd+D1 Playwright remain applicable.
- The exact subagent result and limitations are preserved at `evidence/critics/CF-AU-I04-CONTROLLER-8981F7E-BLOCKED.md`; it did not run tests or mutate files.
- Relevant invariants remain unchanged: backend OWNER/ADMIN enforcement, audit traceability, source read-only, synthetic local data, no real authentication, USD 0, no Preview/Access/deployment or production mutation.

**Gate: PASS to publish one final consolidated candidate for exact-head GitHub review/checks and a separate-process GPT-6 Luna / High / read-only Controller review.** Not a Controller PASS or merge authorization.
