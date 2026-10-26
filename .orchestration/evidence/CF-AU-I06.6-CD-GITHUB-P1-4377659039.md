# GitHub review finding 4377659039 — resolved

- Finding on PR #50 HEAD `4ef69d4132cf562657aa5f140b1d259d735a1c0a`: `deploy-output` diagnostics were redirected to `$GITHUB_OUTPUT`. The helper already writes valid outputs itself, so the extra `PASS:` line could make Actions reject its output file after Preview publication.
- Fixed in `9fb26aa3be6bb17c1f7cf427577423d126c0ac6c` (tree `e580d373761dcb319a4129cba94be1d2a2cef090`): removed the shell redirection. `parse_deploy_output()` continues to write the validated `stable_url`, `immutable_url`, and `deployment_id` outputs directly; its human-readable diagnostic goes only to the step log.
- Added a workflow regression asserting the deploy step does not append diagnostics to `$GITHUB_OUTPUT`.
- Rechecks on the fix: Preview guard 13/13, Python suite 38/38, actionlint v1.7.7, `git diff --check`: PASS. No Preview publication was run.
- The Controller PASS covers pre-fix executable `ffb040244cbb2cad78b460cc7a02a9609f9a11c5`. The repair is limited to this output-redirection line plus its regression; the consolidated exact-head GitHub review and required checks must pass before integration. Do not treat the prior Controller as a review of the new SHA.
