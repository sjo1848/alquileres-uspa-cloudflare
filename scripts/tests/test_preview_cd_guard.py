import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts/preview_cd_guard.py"
spec = importlib.util.spec_from_file_location("preview_cd_guard", SRC)
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class PreviewCdGuardTests(unittest.TestCase):
    def test_remote_release_requires_protected_main_and_all_gates(self):
        ok, _ = guard.decision("push", "refs/heads/main", "true", "verified", "free", "operator-only", True)
        self.assertTrue(ok)

    def test_pull_request_never_reaches_remote_release(self):
        with self.assertRaises(guard.PolicyError):
            guard.decision("pull_request", "refs/pull/10/merge", "true", "verified", "free", "operator-only", True)

    def test_default_disabled_gate_skips_without_mutation(self):
        ok, reason = guard.decision("push", "refs/heads/main", "", "verified", "free", "operator-only", True)
        self.assertFalse(ok)
        self.assertIn("not true", reason)

    def test_missing_provenance_plan_access_or_token_skips(self):
        cases = [
            ("true", "", "free", "operator-only", True),
            ("true", "verified", "paid", "operator-only", True),
            ("true", "verified", "free", "changed", True),
            ("true", "verified", "free", "operator-only", False),
        ]
        for enabled, provenance, plan, access, token in cases:
            with self.subTest(provenance=provenance, plan=plan, access=access, token=token):
                ok, _ = guard.decision("push", "refs/heads/main", enabled, provenance, plan, access, token)
                self.assertFalse(ok)

    def test_workflow_remote_mutations_are_main_only_and_fail_closed(self):
        workflow = (ROOT / ".github/workflows/quick-checks.yml").read_text(encoding="utf-8")
        staging = workflow.split("  staging-private:\n", 1)[1]
        self.assertIn("if: github.event_name == 'push' && github.ref == 'refs/heads/main'", staging)
        self.assertIn("needs: [worker, web]", staging)
        self.assertIn("cancel-in-progress: false", staging)
        self.assertIn("if: steps.gate.outputs.deploy == 'true'", staging)
        self.assertIn("--name private --worker-name alquileres-uspa-lab", staging)
        self.assertIn("wrangler preview", staging)
        self.assertNotIn("wrangler deploy", staging)
        self.assertIn("deploy-output", staging)
        self.assertIn('--file "$RUNNER_TEMP/preview-result.json"', staging)
        self.assertNotIn('>> "$GITHUB_OUTPUT"', staging)

    def test_exact_target_configs_pass(self):
        guard.verify_target(
            ROOT / "apps/worker/wrangler.preview-ci.jsonc",
            ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc",
        )

    def test_placeholder_or_wrong_d1_target_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            preview = json.loads((ROOT / "apps/worker/wrangler.preview-ci.jsonc").read_text())
            preview["previews"]["d1_databases"][0]["database_id"] = "00000000-0000-0000-0000-000000000000"
            preview_path = Path(directory) / "preview.json"
            preview_path.write_text(json.dumps(preview))
            with self.assertRaisesRegex(guard.PolicyError, "placeholder"):
                guard.verify_target(preview_path, ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc")

    def test_provenance_manifest_contains_only_approved_minimal_metadata(self):
        manifest = guard._load_json(guard.PROVENANCE)
        expected = {key: manifest[key] for key in ("users", "listings", "audit_events", "counts")}
        self.assertEqual(len(expected["listings"]), 3)
        forbidden = {"address", "location", "description", "original_name", "image_bytes", "email"}
        serialized = json.dumps(expected).lower()
        for field in forbidden:
            self.assertNotIn(f'"{field}"', serialized)

    def test_migration_allowlist_requires_exact_reviewed_hash(self):
        policy = guard._load_json(guard.MIGRATIONS)
        allowed = {item["name"]: item for item in policy["migrations"]}
        sql_file = ROOT / "apps/worker/migrations/0013_owner_auth_local.sql"
        guard.validate_pending_migrations([sql_file.name], allowed, {sql_file.name: sql_file})
        with tempfile.TemporaryDirectory() as directory:
            altered = Path(directory) / sql_file.name
            altered.write_text(sql_file.read_text() + "\n-- changed\n")
            with self.assertRaisesRegex(guard.PolicyError, "hash mismatch"):
                guard.validate_pending_migrations([sql_file.name], allowed, {sql_file.name: altered})

    def test_unapproved_and_destructive_migrations_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "0014_bad.sql"
            path.write_text("DROP TABLE users;")
            with self.assertRaisesRegex(guard.PolicyError, "not explicitly approved"):
                guard.validate_pending_migrations([path.name], {}, {path.name: path})
            allow = {path.name: {"sha256": __import__("hashlib").sha256(path.read_bytes()).hexdigest()}}
            with self.assertRaisesRegex(guard.PolicyError, "destructive SQL"):
                guard.validate_pending_migrations([path.name], allow, {path.name: path})

    def test_access_denial_accepts_only_access_redirect_or_forbidden(self):
        guard.check_access_response(302, "https://sebastian-ojeda-pages.cloudflareaccess.com/cdn-cgi/access/login")
        guard.check_access_response(403, "")
        with self.assertRaises(guard.PolicyError):
            guard.check_access_response(200, "")
        with self.assertRaises(guard.PolicyError):
            guard.check_access_response(302, "https://attacker.example/callback")

    def test_deployment_output_must_match_private_preview_urls_and_id(self):
        deployment_id = "12345678-1234-1234-1234-1234567890ab"
        payload = {
            "type": "preview",
            "version": 1,
            "worker_name": "alquileres-uspa-lab",
            "preview_id": guard.TARGET["preview_id"],
            "preview_name": "private",
            "preview_slug": "private",
            "preview_urls": [guard.TARGET["stable_url"]],
            "deployment_id": deployment_id,
            "deployment_urls": [f"https://{deployment_id[:8]}-alquileres-uspa-lab.sjo1848.workers.dev"],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "output.json"
            path.write_text(json.dumps(payload))
            stable, immutable, returned_id = guard.parse_deploy_output(path)
        self.assertEqual(stable, guard.TARGET["stable_url"])
        self.assertEqual(returned_id, deployment_id)
        self.assertTrue(immutable.endswith(".workers.dev"))

    def test_deployment_output_rejects_unexpected_worker_or_url(self):
        payload = {"type": "preview", "worker_name": "other-worker", "preview_name": "private"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "output.json"
            path.write_text(json.dumps(payload))
            with self.assertRaises(guard.PolicyError):
                guard.parse_deploy_output(path)


if __name__ == "__main__":
    unittest.main()
