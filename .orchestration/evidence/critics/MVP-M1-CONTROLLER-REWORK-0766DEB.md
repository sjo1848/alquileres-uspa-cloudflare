# M1 Controller REWORK — stale executable pointer

- Reviewed tracking SHA/tree: `0766deb68ab5b4db2f4ee72fff171e162ca2a0cd` / `1fb7a52f996bd97cce853ec39fd1d60b2bf9daa6`.
- Executable candidate: `99ef502a01e7073f7e0973b6d574d193ce8d8018`; base `d5a26a0c6f1ad68dd77a13459ade1c15573a15cf`.
- Bounded verdict: **REWORK** for one canonical-state inconsistency. STATUS `pull_request.executable_sha/tree` still identified `57dcd4f`, while `candidate_review` and `current_functional_increment` identified `99ef502`. No code defect was found; the P2 UI repair and regression were considered consistent.
- Corrected in Event 248: all active candidate fields now identify `99ef502` and its tree. Historical Event 245 retains its contemporaneous SHA as history.
- Reviewer inspected exact files/diff read-only, ran no tests and changed no files. Runtime: separate Codex CLI invocation requested `gpt-6-luna`, High, `--sandbox read-only`; process completed; backend identity UNVERIFIED; no cryptographic or sandbox attestation is claimed.
- Exact-head run `40448238889`: worker/web SUCCESS; staging-private SKIPPED. GitHub automated review exact executable `99ef502` had no findings.
