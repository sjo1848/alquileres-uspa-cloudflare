import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from unittest import mock

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
        self.assertNotIn("apply-remote", staging)
        self.assertNotIn("authorize-remote", staging)
        self.assertNotIn("rehearse", staging)
        self.assertNotIn("wrangler d1 migrations apply", staging)
        self.assertIn("migrations --require-none", staging)
        self.assertIn("schema-diff --base-sha", staging)
        self.assertIn("current-preview --sha \"$GITHUB_SHA\"", staging)
        self.assertNotIn("wrangler d1 migrations apply", staging)
        self.assertIn("WRANGLER_OUTPUT_FILE_PATH: ${{ runner.temp }}/preview-result.json", staging)
        self.assertIn("deploy-output", staging)
        self.assertIn('--file "$RUNNER_TEMP/preview-result.json"', staging)
        self.assertNotIn('>> "$GITHUB_OUTPUT"', staging)
        for step_name in ("Install web and Worker dependencies", "Build D3.1 against the pinned Preview runtime"):
            step = staging.split(f"- name: {step_name}", 1)[1].split("\n      - name:", 1)[0]
            self.assertNotIn("secrets.CF_PREVIEW_API_TOKEN", step)
        web_job = workflow.split("  web:\n", 1)[1].split("  staging-private:\n", 1)[0]
        worker_job = workflow.split("  worker:\n", 1)[1].split("  web:\n", 1)[0]
        self.assertNotIn("secrets.CF_PREVIEW_API_TOKEN", web_job)
        self.assertNotIn("secrets.CF_PREVIEW_API_TOKEN", worker_job)
        self.assertIn("issues: write", staging)
        self.assertIn("CF_PREVIEW_CD_ENABLED", staging)

    def test_exact_target_configs_pass(self):
        guard.verify_target(
            ROOT / "apps/worker/wrangler.preview-ci.jsonc",
            ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc",
        )

    def test_target_rejects_unexpected_binding_or_preview_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            preview = json.loads((ROOT / "apps/worker/wrangler.preview-ci.jsonc").read_text())
            preview["previews"]["services"] = [{"binding": "OTHER", "service": "unapproved"}]
            path = Path(directory) / "preview.json"
            path.write_text(json.dumps(preview))
            with self.assertRaisesRegex(guard.PolicyError, "unexpected Preview binding"):
                guard.verify_target(path, ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc")

            preview["previews"].pop("services")
            preview["previews"]["vars"]["ACCESS_AUD"] = "wrong-audience"
            path.write_text(json.dumps(preview))
            with self.assertRaisesRegex(guard.PolicyError, "configuration mismatch"):
                guard.verify_target(path, ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc")

            preview = json.loads((ROOT / "apps/worker/wrangler.preview-ci.jsonc").read_text())
            preview["routes"] = ["example.com/*"]
            path.write_text(json.dumps(preview))
            with self.assertRaisesRegex(guard.PolicyError, "production routes"):
                guard.verify_target(path, ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc")

    def test_target_rejects_unreviewed_entrypoint_runtime_and_migration_account(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            preview = json.loads((ROOT / "apps/worker/wrangler.preview-ci.jsonc").read_text())
            migration = json.loads((ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc").read_text())
            preview_path = root / "preview.json"
            migration_path = root / "migrations.json"

            cases = [
                (preview, "main", "src/other.ts", "entrypoint or compatibility"),
                (preview, "compatibility_date", "2026-10-13", "entrypoint or compatibility"),
                (migration, "account_id", "00000000000000000000000000000000", "migration config account"),
            ]
            for original, key, value, expected in cases:
                with self.subTest(key=key):
                    candidate_preview = json.loads((ROOT / "apps/worker/wrangler.preview-ci.jsonc").read_text())
                    candidate_migration = json.loads((ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc").read_text())
                    target = candidate_preview if original is preview else candidate_migration
                    target[key] = value
                    preview_path.write_text(json.dumps(candidate_preview))
                    migration_path.write_text(json.dumps(candidate_migration))
                    with self.assertRaisesRegex(guard.PolicyError, expected):
                        guard.verify_target(preview_path, migration_path)

    def test_generated_preview_rejects_unreviewed_environment_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            generated = json.loads((ROOT / "apps/worker/wrangler.preview-ci.jsonc").read_text())
            generated["main"] = "index.js"
            generated["assets"]["directory"] = "../client"
            generated["previews"]["services"] = []
            generated_path = Path(directory) / "generated.json"
            (Path(directory).parent / "client").mkdir(exist_ok=True)
            generated_path.write_text(json.dumps(generated))
            with self.assertRaisesRegex(guard.PolicyError, "generated Preview contains an unreviewed setting"):
                guard.verify_target(
                    ROOT / "apps/worker/wrangler.preview-ci.jsonc",
                    ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc",
                    generated_path,
                )

    def test_generated_preview_rejects_unreviewed_entrypoint_or_runtime(self):
        with tempfile.TemporaryDirectory() as directory:
            generated = json.loads((ROOT / "apps/worker/wrangler.preview-ci.jsonc").read_text())
            generated["main"] = "index.js"
            generated["assets"]["directory"] = "../client"
            generated_path = Path(directory) / "generated.json"
            (Path(directory).parent / "client").mkdir(exist_ok=True)
            for key, value in (("main", "other.js"), ("compatibility_date", "2026-10-13")):
                with self.subTest(key=key):
                    candidate = dict(generated)
                    candidate[key] = value
                    generated_path.write_text(json.dumps(candidate))
                    with self.assertRaisesRegex(guard.PolicyError, "generated Worker entrypoint or compatibility"):
                        guard.verify_target(
                            ROOT / "apps/worker/wrangler.preview-ci.jsonc",
                            ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc",
                            generated_path,
                        )

    def test_generated_preview_rejects_unreviewed_worker_vars_triggers_migrations_or_env(self):
        with tempfile.TemporaryDirectory() as directory:
            generated = json.loads((ROOT / "apps/worker/wrangler.preview-ci.jsonc").read_text())
            generated["main"] = "index.js"
            generated["assets"]["directory"] = "../client"
            generated_path = Path(directory) / "generated.json"
            cases = (
                ("vars", {"UNREVIEWED": "value"}),
                ("triggers", {"crons": ["0 * * * *"]}),
                ("migrations", [{"tag": "UNREVIEWED", "new_classes": ["Unexpected"]}]),
                ("env", {"production": {"name": "unreviewed"}}),
            )
            for key, value in cases:
                with self.subTest(key=key):
                    candidate = dict(generated)
                    candidate[key] = value
                    generated_path.write_text(json.dumps(candidate))
                    with self.assertRaisesRegex(guard.PolicyError, "unreviewed variables, triggers, or migrations|unreviewed environment"):
                        guard.verify_target(
                            ROOT / "apps/worker/wrangler.preview-ci.jsonc",
                            ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc",
                            generated_path,
                        )

    def test_publication_requires_zero_pending_migrations(self):
        guard.require_no_pending_migrations([])
        with self.assertRaisesRegex(guard.PolicyError, "zero pending migrations"):
            guard.require_no_pending_migrations(["0017_unreviewed.sql"])

    def test_latest_main_rejects_a_sha_that_is_not_current_protected_main(self):
        not_current = "a" * 40
        remote_main = "b" * 40
        result = subprocess.CompletedProcess(args=[], returncode=0, stdout=f"{remote_main}\trefs/heads/main\n", stderr="")
        with mock.patch.object(guard.subprocess, "run", return_value=result):
            with self.assertRaisesRegex(guard.PolicyError, "not the current protected main HEAD"):
                guard.verify_latest_main(not_current)
        with mock.patch.object(guard.subprocess, "run", return_value=subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr="")):
            with self.assertRaisesRegex(guard.PolicyError, "could not verify latest protected main"):
                guard.verify_latest_main(remote_main)

    def test_schema_diff_fails_for_any_migration_change_since_last_release(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "apps/worker/migrations").mkdir(parents=True)
            (root / "apps/worker/src").mkdir(parents=True)
            (root / "apps/worker/migrations/0001_core.sql").write_text("CREATE TABLE x (id TEXT);\n")
            (root / "apps/worker/src/index.ts").write_text("export const version = 1;\n")
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.email", "test@example.test"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Test"], check=True)
            subprocess.run(["git", "-C", str(root), "add", "."], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "base"], check=True)
            base = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
            (root / "apps/worker/src/index.ts").write_text("export const version = 2;\n")
            subprocess.run(["git", "-C", str(root), "add", "."], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "app change"], check=True)
            app_head = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
            with mock.patch.object(guard, "ROOT", root):
                guard.verify_no_schema_changes(base, app_head)
                (root / "apps/worker/migrations/0001_core.sql").write_text("CREATE TABLE x (id TEXT, changed TEXT);\n")
                subprocess.run(["git", "-C", str(root), "add", "."], check=True)
                subprocess.run(["git", "-C", str(root), "commit", "-qm", "schema change"], check=True)
                schema_head = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
                with self.assertRaisesRegex(guard.PolicyError, "migration/schema files changed"):
                    guard.verify_no_schema_changes(base, schema_head)

    def test_current_preview_requires_exact_published_sha_and_deployment_id(self):
        deployment_id = "f3d02d69-8aa5-4ccf-8046-815510c3f2b9"
        source_sha = "3c6837723d2d48a1710c692185aa9c1484b513db"
        preview = {"id": guard.TARGET["preview_id"], "name": "private", "urls": [guard.TARGET["stable_url"]]}
        deployment = {
            "id": deployment_id,
            "urls": [f"https://{deployment_id[:8]}-{guard.TARGET['worker_name']}.sjo1848.workers.dev"],
            "annotations": {"workers/commit_sha": source_sha},
        }
        with mock.patch.object(guard, "_cloudflare_get", side_effect=[preview, deployment]):
            stable, immutable, returned_id, returned_sha = guard.current_preview(source_sha, deployment_id)
        self.assertEqual(stable, guard.TARGET["stable_url"])
        self.assertEqual(immutable, deployment["urls"][0])
        self.assertEqual(returned_id, deployment_id)
        self.assertEqual(returned_sha, source_sha)
        with mock.patch.object(guard, "_cloudflare_get", side_effect=[preview, deployment]):
            with self.assertRaisesRegex(guard.PolicyError, "requested source SHA"):
                guard.current_preview("a" * 40)
        with mock.patch.object(guard, "_cloudflare_get", side_effect=[preview, deployment]):
            with self.assertRaisesRegex(guard.PolicyError, "deployment ID"):
                guard.current_preview(source_sha, "12345678-1234-1234-1234-1234567890ab")

    def test_codeowners_cover_deploy_and_auth_files_including_codeowners_itself(self):
        codeowners = (ROOT / ".github/CODEOWNERS").read_text(encoding="utf-8")
        for path in (
            "/.github/CODEOWNERS",
            "/.github/workflows/**",
            "/scripts/preview_cd_guard.py",
            "/apps/worker/wrangler*.jsonc",
            "/apps/worker/migrations/**",
            "/apps/worker/src/preview-auth.ts",
            "/apps/worker/src/local-owner-auth.ts",
            "/apps/web/src/session.ts",
            "/apps/web/src/views/AuthView.vue",
        ):
            self.assertRegex(codeowners, rf"(?m)^{re.escape(path)}\s+@sjo1848$")

    def test_local_preview_auth_simulation_is_absent_from_deployable_config(self):
        local = json.loads((ROOT / "apps/worker/wrangler.preview-auth-e2e.jsonc").read_text())
        deployable = json.loads((ROOT / "apps/worker/wrangler.preview-ci.jsonc").read_text())
        local_vars = local.get("vars", {})
        self.assertEqual(local_vars.get("PREVIEW_AUTH_LOCAL_TEST"), "true")
        self.assertEqual(local_vars.get("PREVIEW_AUTH_TEST_ISSUER"), "https://access-test.invalid")
        self.assertTrue(local_vars.get("PREVIEW_AUTH_TEST_JWK"))
        serialized = json.dumps(deployable)
        for key in ("PREVIEW_AUTH_LOCAL_TEST", "PREVIEW_AUTH_TEST_ISSUER", "PREVIEW_AUTH_TEST_JWK"):
            self.assertNotIn(key, serialized)
        self.assertNotIn("access-test.invalid", serialized)

    def test_placeholder_or_wrong_d1_target_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            preview = json.loads((ROOT / "apps/worker/wrangler.preview-ci.jsonc").read_text())
            preview["previews"]["d1_databases"][0]["database_id"] = "00000000-0000-0000-0000-000000000000"
            preview_path = Path(directory) / "preview.json"
            preview_path.write_text(json.dumps(preview))
            with self.assertRaisesRegex(guard.PolicyError, "placeholder"):
                guard.verify_target(preview_path, ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc")

            preview["previews"]["d1_databases"][0]["database_id"] = guard.TARGET["database_id"]
            preview["name"] = "other-worker"
            preview_path.write_text(json.dumps(preview))
            with self.assertRaisesRegex(guard.PolicyError, "Worker name mismatch"):
                guard.verify_target(preview_path, ROOT / "apps/worker/wrangler.preview-migrations-ci.jsonc")

    def test_provenance_manifest_contains_only_approved_minimal_metadata(self):
        manifest = guard._load_json(guard.PROVENANCE)
        expected = {key: manifest[key] for key in ("users", "listings", "audit_events", "counts")}
        self.assertEqual(len(expected["listings"]), 3)
        forbidden = {"address", "location", "description", "original_name", "image_bytes", "email"}
        serialized = json.dumps(expected).lower()
        for field in forbidden:
            self.assertNotIn(f'"{field}"', serialized)

    def _synthetic_snapshot(self):
        manifest = guard._load_json(guard.PROVENANCE)
        snapshot = {
            key: [dict(row) for row in manifest[key]]
            for key in ("users", "listings", "audit_events")
        }
        snapshot["listing_deletion_receipts"] = []
        for user in snapshot["users"]:
            user["is_synthetic"] = 1
        snapshot["counts"] = dict(manifest["counts"])
        snapshot["counts"]["non_synthetic_user_email_count"] = 0
        return manifest, snapshot

    def test_provenance_allows_legitimate_mutable_workflow_and_synthetic_rows(self):
        manifest, snapshot = self._synthetic_snapshot()
        snapshot["users"][0]["updated_at"] = "changed-by-valid-login"
        snapshot["listings"][0].update(status="SUBMITTED", publication_status="UNPUBLISHED", updated_at="changed-by-owner")
        snapshot["counts"]["contact_events"] += 1
        snapshot["counts"]["listing_images"] += 1
        snapshot["counts"]["admin_audit_events"] += 1
        snapshot["users"].append({"id": "new-synthetic-owner", "role": "OWNER", "created_at": "2026-10-27T12:00:00Z", "is_synthetic": 1})
        snapshot["listings"].append({"id": "new-synthetic-draft", "owner_id": "new-synthetic-owner", "status": "DRAFT", "publication_status": "UNPUBLISHED", "created_at": "2026-10-27T12:01:00Z"})
        snapshot["audit_events"].append({"id": "new-synthetic-audit", "listing_id": "new-synthetic-draft", "actor_id": "synthetic-catalog-admin", "target_owner_id": "new-synthetic-owner", "action": "ADMIN_ASSISTED_LISTING_CREATED", "created_at": "2026-10-27T12:02:00Z"})
        guard.validate_synthetic_provenance(snapshot, manifest)

    def test_provenance_still_rejects_real_identity_and_broken_ownership_anchors(self):
        manifest, snapshot = self._synthetic_snapshot()
        snapshot["users"].append({"id": "unverified-user", "role": "OWNER", "created_at": "2026-10-27T12:00:00Z", "is_synthetic": 0})
        with self.assertRaisesRegex(guard.PolicyError, "non-synthetic"):
            guard.validate_synthetic_provenance(snapshot, manifest)

        manifest, snapshot = self._synthetic_snapshot()
        snapshot["listings"][0]["owner_id"] = "unknown-owner"
        with self.assertRaisesRegex(guard.PolicyError, "identity anchors changed"):
            guard.validate_synthetic_provenance(snapshot, manifest)

    def test_provenance_allows_deletion_of_reviewed_synthetic_listing(self):
        manifest, snapshot = self._synthetic_snapshot()
        snapshot["listings"] = snapshot["listings"][1:]
        guard.validate_synthetic_provenance(snapshot, manifest)

    def test_provenance_allows_assisted_delete_audit_for_reviewed_synthetic_listing(self):
        manifest, snapshot = self._synthetic_snapshot()
        snapshot["listing_deletion_receipts"].append({
            "owner_id": "synthetic-catalog-admin",
            "scope": "ADMIN_ASSISTED_DELETE:synthetic-casa-rio",
            "resource_id": "synthetic-casa-rio",
            "state": "COMMITTED",
        })
        snapshot["audit_events"].append({
            "id": "audit-after-synthetic-delete",
            "listing_id": "synthetic-casa-rio",
            "actor_id": "synthetic-catalog-admin",
            "target_owner_id": "synthetic-catalog-owner",
            "action": "ADMIN_ASSISTED_LISTING_DELETED",
            "created_at": "2026-10-27T12:02:00Z",
        })
        guard.validate_synthetic_provenance(snapshot, manifest)

    def test_provenance_retains_owner_created_listing_after_owner_delete(self):
        manifest, snapshot = self._synthetic_snapshot()
        snapshot["audit_events"].append({
            "id": "owner-created-review",
            "listing_id": "owner-created-then-deleted",
            "actor_id": "synthetic-catalog-admin",
            "target_owner_id": "synthetic-catalog-owner",
            "action": "ADMIN_LISTING_REJECTED",
            "created_at": "2026-10-27T12:02:00Z",
        })
        snapshot["listing_deletion_receipts"].append({
            "owner_id": "synthetic-catalog-owner",
            "scope": "OWNER_LISTING_DELETE:owner-created-then-deleted",
            "resource_id": "owner-created-then-deleted",
            "state": "COMMITTED",
        })
        guard.validate_synthetic_provenance(snapshot, manifest)

    def test_provenance_rejects_invalid_listing_delete_receipts(self):
        cases = [
            ({"owner_id": "synthetic-catalog-admin", "scope": "OWNER_LISTING_DELETE:deleted-x", "resource_id": "deleted-x", "state": "COMMITTED"}, "unverified owner"),
            ({"owner_id": "synthetic-catalog-owner", "scope": "ADMIN_ASSISTED_DELETE:deleted-x", "resource_id": "deleted-x", "state": "COMMITTED"}, "unverified ADMIN"),
            ({"owner_id": "synthetic-catalog-owner", "scope": "OWNER_LISTING_DELETE:other-id", "resource_id": "deleted-x", "state": "COMMITTED"}, "invalid scope"),
            ({"owner_id": "synthetic-catalog-owner", "scope": "OWNER_LISTING_DELETE:deleted-x", "resource_id": "deleted-x", "state": "PENDING"}, "not committed"),
            ({"owner_id": "synthetic-catalog-admin", "scope": "ADMIN_ASSISTED_DELETE:other-id", "resource_id": "deleted-x", "state": "COMMITTED"}, "invalid scope"),
        ]
        for receipt, message in cases:
            manifest, snapshot = self._synthetic_snapshot()
            snapshot["listing_deletion_receipts"].append(receipt)
            with self.subTest(receipt=receipt), self.assertRaisesRegex(guard.PolicyError, message):
                guard.validate_synthetic_provenance(snapshot, manifest)

    def test_provenance_rejects_assisted_delete_with_wrong_owner(self):
        manifest, snapshot = self._synthetic_snapshot()
        snapshot["users"].append({"id": "another-synthetic-owner", "role": "OWNER", "created_at": "2026-10-27T12:00:00Z", "is_synthetic": 1})
        snapshot["listing_deletion_receipts"].append({
            "owner_id": "synthetic-catalog-admin",
            "scope": "ADMIN_ASSISTED_DELETE:synthetic-casa-rio",
            "resource_id": "synthetic-casa-rio",
            "state": "COMMITTED",
        })
        snapshot["audit_events"].append({
            "id": "wrong-owner-delete",
            "listing_id": "synthetic-casa-rio",
            "actor_id": "synthetic-catalog-admin",
            "target_owner_id": "another-synthetic-owner",
            "action": "ADMIN_ASSISTED_LISTING_DELETED",
            "created_at": "2026-10-27T12:02:00Z",
        })
        with self.assertRaisesRegex(guard.PolicyError, "does not match the listing owner"):
            guard.validate_synthetic_provenance(snapshot, manifest)

    def test_provenance_rejects_assisted_listing_audit_without_listing_or_target(self):
        cases = [
            ({"listing_id": None, "target_owner_id": None}, "must reference a listing"),
            ({"listing_id": "new-assisted-delete", "target_owner_id": None}, "must identify its OWNER target"),
            ({"listing_id": "", "target_owner_id": "synthetic-catalog-owner"}, "must reference a listing"),
        ]
        for fields, message in cases:
            manifest, snapshot = self._synthetic_snapshot()
            snapshot["audit_events"].append({
                "id": "incomplete-assisted-delete",
                "actor_id": "synthetic-catalog-admin",
                "action": "ADMIN_ASSISTED_LISTING_DELETED",
                "created_at": "2026-10-27T12:02:00Z",
                **fields,
            })
            with self.subTest(fields=fields), self.assertRaisesRegex(guard.PolicyError, message):
                guard.validate_synthetic_provenance(snapshot, manifest)

    def test_provenance_allows_new_assisted_creation_and_rejects_unknown_audit_listing(self):
        manifest, snapshot = self._synthetic_snapshot()
        snapshot["listing_deletion_receipts"].append({
            "owner_id": "synthetic-catalog-admin",
            "scope": "ADMIN_ASSISTED_DELETE:new-synthetic-assisted-listing",
            "resource_id": "new-synthetic-assisted-listing",
            "state": "COMMITTED",
        })
        snapshot["audit_events"].append({
            "id": "new-assisted-create",
            "listing_id": "new-synthetic-assisted-listing",
            "actor_id": "synthetic-catalog-admin",
            "target_owner_id": "synthetic-catalog-owner",
            "action": "ADMIN_ASSISTED_LISTING_CREATED",
            "created_at": "2026-10-27T12:02:00Z",
        })
        snapshot["audit_events"].append({
            "id": "new-assisted-delete",
            "listing_id": "new-synthetic-assisted-listing",
            "actor_id": "synthetic-catalog-admin",
            "target_owner_id": "synthetic-catalog-owner",
            "action": "ADMIN_ASSISTED_LISTING_DELETED",
            "created_at": "2026-10-27T12:03:00Z",
        })
        guard.validate_synthetic_provenance(snapshot, manifest)

        manifest, snapshot = self._synthetic_snapshot()
        snapshot["audit_events"].append({
            "id": "orphan-assisted-delete",
            "listing_id": "orphan-assisted-listing",
            "actor_id": "synthetic-catalog-admin",
            "target_owner_id": "synthetic-catalog-owner",
            "action": "ADMIN_ASSISTED_LISTING_DELETED",
            "created_at": "2026-10-27T12:02:00Z",
        })
        with self.assertRaisesRegex(guard.PolicyError, "no matching committed deletion receipt"):
            guard.validate_synthetic_provenance(snapshot, manifest)

        manifest, snapshot = self._synthetic_snapshot()
        snapshot["audit_events"].append({
            "id": "orphan-event",
            "listing_id": "unverified-listing-id",
            "actor_id": "synthetic-catalog-admin",
            "target_owner_id": "synthetic-catalog-owner",
            "action": "ADMIN_LISTING_PUBLISHED",
            "created_at": "2026-10-27T12:02:00Z",
        })
        with self.assertRaisesRegex(guard.PolicyError, "without synthetic provenance"):
            guard.validate_synthetic_provenance(snapshot, manifest)

    def test_provenance_rejects_published_nonapproved_states_and_accepts_approved(self):
        for status in ("DRAFT", "SUBMITTED", "REJECTED"):
            manifest, snapshot = self._synthetic_snapshot()
            snapshot["listings"][0].update(status=status, publication_status="PUBLISHED")
            with self.subTest(status=status), self.assertRaisesRegex(guard.PolicyError, "only an approved listing may be published"):
                guard.validate_synthetic_provenance(snapshot, manifest)

        manifest, snapshot = self._synthetic_snapshot()
        snapshot["listings"][0].update(status="APPROVED", publication_status="PUBLISHED")
        guard.validate_synthetic_provenance(snapshot, manifest)

    def test_provenance_rejects_role_and_listing_owner_mismatches(self):
        manifest, snapshot = self._synthetic_snapshot()
        snapshot["listings"].append({"id": "admin-owned-listing", "owner_id": "synthetic-catalog-admin", "status": "DRAFT", "publication_status": "UNPUBLISHED", "created_at": "2026-10-27T12:00:00Z"})
        with self.assertRaisesRegex(guard.PolicyError, "must have the OWNER role"):
            guard.validate_synthetic_provenance(snapshot, manifest)

        manifest, snapshot = self._synthetic_snapshot()
        snapshot["audit_events"].append({"id": "owner-actor", "listing_id": "synthetic-casa-rio", "actor_id": "synthetic-catalog-owner", "target_owner_id": "synthetic-catalog-owner", "action": "ADMIN_LISTING_PUBLISHED", "created_at": "2026-10-27T12:02:00Z"})
        with self.assertRaisesRegex(guard.PolicyError, "actor must have the ADMIN role"):
            guard.validate_synthetic_provenance(snapshot, manifest)

        manifest, snapshot = self._synthetic_snapshot()
        snapshot["audit_events"].append({"id": "admin-target", "listing_id": "synthetic-casa-rio", "actor_id": "synthetic-catalog-admin", "target_owner_id": "synthetic-catalog-admin", "action": "ADMIN_LISTING_PUBLISHED", "created_at": "2026-10-27T12:02:00Z"})
        with self.assertRaisesRegex(guard.PolicyError, "target identity must have the OWNER role"):
            guard.validate_synthetic_provenance(snapshot, manifest)

        manifest, snapshot = self._synthetic_snapshot()
        snapshot["users"].append({"id": "different-synthetic-owner", "role": "OWNER", "created_at": "2026-10-27T12:00:00Z", "is_synthetic": 1})
        snapshot["audit_events"].append({"id": "owner-mismatch", "listing_id": "synthetic-casa-rio", "actor_id": "synthetic-catalog-admin", "target_owner_id": "different-synthetic-owner", "action": "ADMIN_LISTING_PUBLISHED", "created_at": "2026-10-27T12:02:00Z"})
        with self.assertRaisesRegex(guard.PolicyError, "does not match the listing owner"):
            guard.validate_synthetic_provenance(snapshot, manifest)

    def test_provenance_rejects_unverified_audit_actors_and_invalid_states(self):
        manifest, snapshot = self._synthetic_snapshot()
        snapshot["audit_events"].append({"id": "new-event", "listing_id": None, "actor_id": "unknown", "target_owner_id": "synthetic-catalog-owner", "action": "ADMIN_LISTING_PUBLISHED", "created_at": "2026-10-27T12:02:00Z"})
        with self.assertRaisesRegex(guard.PolicyError, "non-synthetic identity"):
            guard.validate_synthetic_provenance(snapshot, manifest)

        manifest, snapshot = self._synthetic_snapshot()
        snapshot["listings"][0]["status"] = "IMPORTED"
        with self.assertRaisesRegex(guard.PolicyError, "unrecognized workflow state"):
            guard.validate_synthetic_provenance(snapshot, manifest)

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

    def test_exact_0014_hash_allows_only_reviewed_update_trigger_ddl(self):
        policy = guard._load_json(guard.MIGRATIONS)
        allowed = {item["name"]: item for item in policy["migrations"]}
        sql_file = ROOT / "apps/worker/migrations/0014_monthly_rental_terms.sql"
        guard.validate_pending_migrations([sql_file.name], allowed, {sql_file.name: sql_file})

        with tempfile.TemporaryDirectory() as directory:
            altered = Path(directory) / sql_file.name
            altered.write_text(sql_file.read_text() + "\n-- changed\n")
            with self.assertRaisesRegex(guard.PolicyError, "hash mismatch"):
                guard.validate_pending_migrations([sql_file.name], allowed, {sql_file.name: altered})

    def test_0014_policy_does_not_authorize_general_update_dml(self):
        policy = guard._load_json(guard.MIGRATIONS)
        allowed = {item["name"]: item for item in policy["migrations"]}
        sql_file = ROOT / "apps/worker/migrations/0014_monthly_rental_terms.sql"
        with tempfile.TemporaryDirectory() as directory:
            altered = Path(directory) / sql_file.name
            altered.write_text(sql_file.read_text() + "\nUPDATE listings SET deposit_status='NOT_REQUIRED';\n")
            policy_for_fixture = dict(allowed[sql_file.name])
            policy_for_fixture["sha256"] = __import__("hashlib").sha256(altered.read_bytes()).hexdigest()
            fixture_allowlist = {**allowed, sql_file.name: policy_for_fixture}
            with self.assertRaisesRegex(guard.PolicyError, "general data update"):
                guard.validate_pending_migrations([sql_file.name], fixture_allowlist, {sql_file.name: altered})

    def test_0014_policy_rejects_altered_update_trigger_declaration(self):
        policy = guard._load_json(guard.MIGRATIONS)
        allowed = {item["name"]: item for item in policy["migrations"]}
        sql_file = ROOT / "apps/worker/migrations/0014_monthly_rental_terms.sql"
        with tempfile.TemporaryDirectory() as directory:
            altered = Path(directory) / sql_file.name
            changed_sql = sql_file.read_text().replace(
                "BEFORE UPDATE OF deposit_status,deposit_amount,deposit_currency ON listings",
                "BEFORE UPDATE OF deposit_status ON listings",
            )
            altered.write_text(changed_sql)
            policy_for_fixture = dict(allowed[sql_file.name])
            policy_for_fixture["sha256"] = __import__("hashlib").sha256(altered.read_bytes()).hexdigest()
            fixture_allowlist = {**allowed, sql_file.name: policy_for_fixture}
            with self.assertRaisesRegex(guard.PolicyError, "trigger DDL was not found"):
                guard.validate_pending_migrations([sql_file.name], fixture_allowlist, {sql_file.name: altered})

    def test_0014_policy_rejects_extra_update_trigger_declaration(self):
        policy = guard._load_json(guard.MIGRATIONS)
        allowed = {item["name"]: item for item in policy["migrations"]}
        sql_file = ROOT / "apps/worker/migrations/0014_monthly_rental_terms.sql"
        with tempfile.TemporaryDirectory() as directory:
            altered = Path(directory) / sql_file.name
            extra = "\nCREATE TRIGGER unreviewed_rental_terms BEFORE UPDATE OF deposit_status ON listings BEGIN SELECT 1; END;\n"
            altered.write_text(sql_file.read_text() + extra)
            policy_for_fixture = dict(allowed[sql_file.name])
            policy_for_fixture["sha256"] = __import__("hashlib").sha256(altered.read_bytes()).hexdigest()
            fixture_allowlist = {**allowed, sql_file.name: policy_for_fixture}
            with self.assertRaisesRegex(guard.PolicyError, "general data update"):
                guard.validate_pending_migrations([sql_file.name], fixture_allowlist, {sql_file.name: altered})

    def test_exact_0015_hash_allows_only_reviewed_update_owner_trigger(self):
        policy = guard._load_json(guard.MIGRATIONS)
        allowed = {item["name"]: item for item in policy["migrations"]}
        sql_file = ROOT / "apps/worker/migrations/0015_listing_change_revisions.sql"
        guard.validate_pending_migrations([sql_file.name], allowed, {sql_file.name: sql_file})
        self.assertEqual(allowed[sql_file.name]["remote_authorization_env"], "CF_PREVIEW_MIGRATION_0015_AUTHORIZED_SHA")

        with tempfile.TemporaryDirectory() as directory:
            altered = Path(directory) / sql_file.name
            altered.write_text(sql_file.read_text() + "\n-- altered hash\n")
            with self.assertRaisesRegex(guard.PolicyError, "hash mismatch"):
                guard.validate_pending_migrations([sql_file.name], allowed, {sql_file.name: altered})

    def test_0015_policy_rejects_update_dml_even_with_matching_fixture_hash(self):
        policy = guard._load_json(guard.MIGRATIONS)
        allowed = {item["name"]: item for item in policy["migrations"]}
        sql_file = ROOT / "apps/worker/migrations/0015_listing_change_revisions.sql"
        with tempfile.TemporaryDirectory() as directory:
            altered = Path(directory) / sql_file.name
            altered.write_text(sql_file.read_text() + "\nUPDATE listings SET title='bypass';\n")
            import hashlib
            fixture_policy = dict(allowed[sql_file.name])
            fixture_policy["sha256"] = hashlib.sha256(altered.read_bytes()).hexdigest()
            fixture_allowlist = {**allowed, sql_file.name: fixture_policy}
            with self.assertRaisesRegex(guard.PolicyError, "general data update"):
                guard.validate_pending_migrations([sql_file.name], fixture_allowlist, {sql_file.name: altered})

    def test_0015_policy_rejects_extra_or_altered_update_trigger(self):
        policy = guard._load_json(guard.MIGRATIONS)
        allowed = {item["name"]: item for item in policy["migrations"]}
        sql_file = ROOT / "apps/worker/migrations/0015_listing_change_revisions.sql"
        variants = [
            sql_file.read_text().replace(
                "BEFORE UPDATE ON listing_change_revisions",
                "BEFORE UPDATE OF owner_id ON listing_change_revisions",
            ),
            sql_file.read_text() + "\nCREATE TRIGGER unreviewed BEFORE UPDATE ON listings BEGIN SELECT RAISE(ABORT,'no'); END;\n",
        ]
        for index, text in enumerate(variants):
            with self.subTest(variant=index), tempfile.TemporaryDirectory() as directory:
                altered = Path(directory) / sql_file.name
                altered.write_text(text)
                import hashlib
                fixture_policy = dict(allowed[sql_file.name])
                fixture_policy["sha256"] = hashlib.sha256(altered.read_bytes()).hexdigest()
                fixture_allowlist = {**allowed, sql_file.name: fixture_policy}
                expected = "trigger DDL was not found" if index == 0 else "general data update"
                with self.assertRaisesRegex(guard.PolicyError, expected):
                    guard.validate_pending_migrations([sql_file.name], fixture_allowlist, {sql_file.name: altered})

    def test_0015_does_not_authorize_unreviewed_or_destructive_migrations(self):
        policy = guard._load_json(guard.MIGRATIONS)
        allowed = {item["name"]: item for item in policy["migrations"]}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "0016_unreviewed.sql"
            path.write_text("CREATE TABLE arbitrary(id TEXT);\n")
            with self.assertRaisesRegex(guard.PolicyError, "not explicitly approved"):
                guard.validate_pending_migrations([path.name], allowed, {path.name: path})
            path = Path(directory) / "0015_listing_change_revisions.sql"
            path.write_text("DROP TABLE listings;\n")
            fixture_policy = dict(allowed[path.name])
            import hashlib
            fixture_policy["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
            with self.assertRaisesRegex(guard.PolicyError, "destructive SQL"):
                guard.validate_pending_migrations([path.name], {path.name: fixture_policy}, {path.name: path})

    def test_remote_apply_blocks_unapproved_migration_before_wrangler_side_effect(self):
        with mock.patch.object(guard, "verify_provenance"), \
             mock.patch.object(guard, "verify_migrations", side_effect=guard.PolicyError("pending migration 0016 is not approved")), \
             mock.patch.object(guard, "run_captured") as run:
            with self.assertRaisesRegex(guard.PolicyError, "not approved"):
                guard.apply_remote("wrangler.preview-migrations-ci.jsonc")
        run.assert_not_called()

    def test_remote_backup_rejects_noncanonical_target_before_export(self):
        with tempfile.TemporaryDirectory() as directory, \
             mock.patch.object(guard, "verify_provenance") as provenance, \
             mock.patch.object(guard, "verify_migrations") as migrations, \
             mock.patch.object(guard, "run_captured") as run:
            root = Path(directory)
            backup = root / "private" / "backup.sql"
            persist = root / "persist"
            with self.assertRaisesRegex(guard.PolicyError, "canonical existing Preview migration config"):
                guard.backup_and_rehearse("wrangler.production.jsonc", backup, persist)
            provenance.assert_not_called()
            migrations.assert_not_called()
            run.assert_not_called()
            self.assertFalse(backup.parent.exists())
            self.assertFalse(persist.exists())

    def test_remote_backup_requires_0015_authorization_before_export(self):
        with tempfile.TemporaryDirectory() as directory, \
             mock.patch.object(guard, "verify_target"), \
             mock.patch.object(guard, "verify_provenance"), \
             mock.patch.object(guard, "verify_migrations", return_value=["0015_listing_change_revisions.sql"]), \
             mock.patch.object(guard, "run_captured") as run, \
             mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("CF_PREVIEW_MIGRATION_0015_AUTHORIZED_SHA", None)
            os.environ.pop("GITHUB_SHA", None)
            root = Path(directory)
            backup = root / "private" / "backup.sql"
            persist = root / "persist"
            with self.assertRaisesRegex(guard.PolicyError, "separate human authorization"):
                guard.backup_and_rehearse("wrangler.preview-migrations-ci.jsonc", backup, persist)
            run.assert_not_called()
            self.assertFalse(backup.parent.exists())
            self.assertFalse(persist.exists())

    def test_remote_commands_reject_noncanonical_target_before_any_remote_read_or_write(self):
        for remote_command in (guard.apply_remote, guard.authorize_remote):
            with self.subTest(remote_command=remote_command.__name__), \
                 mock.patch.object(guard, "verify_provenance") as provenance, \
                 mock.patch.object(guard, "verify_migrations") as migrations, \
                 mock.patch.object(guard, "run_captured") as run:
                with self.assertRaisesRegex(guard.PolicyError, "canonical existing Preview migration config"):
                    remote_command("wrangler.production.jsonc")
            provenance.assert_not_called()
            migrations.assert_not_called()
            run.assert_not_called()

    def test_remote_provenance_and_migration_reads_reject_noncanonical_target_before_query(self):
        with mock.patch.object(guard, "_snapshot") as snapshot, \
             mock.patch.object(guard, "_wrangler_query") as query:
            with self.assertRaisesRegex(guard.PolicyError, "canonical existing Preview migration config"):
                guard.verify_provenance("wrangler.production.jsonc")
            with self.assertRaisesRegex(guard.PolicyError, "canonical existing Preview migration config"):
                guard.verify_migrations("wrangler.production.jsonc", guard.MIGRATIONS)
        snapshot.assert_not_called()
        query.assert_not_called()

    def test_remote_migrations_cli_verifies_synthetic_provenance_before_ledger_read(self):
        with mock.patch.object(guard.sys, "argv", ["preview_cd_guard.py", "migrations"]), \
             mock.patch.object(guard, "verify_provenance") as provenance, \
             mock.patch.object(guard, "verify_migrations", return_value=[]) as migrations:
            self.assertEqual(guard.main(), 0)
        provenance.assert_called_once_with("wrangler.preview-migrations-ci.jsonc")
        migrations.assert_called_once_with("wrangler.preview-migrations-ci.jsonc", guard.MIGRATIONS, False, None, False)

    def test_remote_authorization_preflight_fails_before_backup_when_0015_is_unapproved(self):
        current_main = "2a7562aa4301211ab3e1bab7a85017f7d18e6ba4"
        with mock.patch.object(guard, "verify_migrations", return_value=["0015_listing_change_revisions.sql"]), \
             mock.patch.object(guard, "verify_provenance"), \
             mock.patch.object(guard, "verify_latest_main") as latest_main, \
             mock.patch.dict(os.environ, {"GITHUB_SHA": current_main}, clear=False):
            os.environ.pop("CF_PREVIEW_MIGRATION_0015_AUTHORIZED_SHA", None)
            with self.assertRaisesRegex(guard.PolicyError, "separate human authorization"):
                guard.authorize_remote("wrangler.preview-migrations-ci.jsonc")
        latest_main.assert_not_called()

    def test_remote_apply_requires_separate_0015_authorization_bound_to_current_main(self):
        pending = ["0015_listing_change_revisions.sql"]
        current_main = "2a7562aa4301211ab3e1bab7a85017f7d18e6ba4"
        approval_env = "CF_PREVIEW_MIGRATION_0015_AUTHORIZED_SHA"
        cases = ((None, current_main), ("true", current_main), ("e" * 40, current_main), (current_main, "not-a-commit-sha"))
        for authorization, workflow_sha in cases:
            with self.subTest(authorization=authorization, workflow_sha=workflow_sha), \
                 mock.patch.object(guard, "verify_migrations", return_value=pending), \
                 mock.patch.object(guard, "verify_provenance"), \
                 mock.patch.object(guard, "run_captured") as run, \
                 mock.patch.dict(os.environ, {"GITHUB_SHA": workflow_sha}, clear=False):
                os.environ.pop(approval_env, None)
                if authorization is not None:
                    os.environ[approval_env] = authorization
                with self.assertRaisesRegex(guard.PolicyError, "separate human authorization"):
                    guard.apply_remote("wrangler.preview-migrations-ci.jsonc")
                run.assert_not_called()

    def test_remote_apply_accepts_only_matching_authorized_main_sha(self):
        pending = ["0015_listing_change_revisions.sql"]
        current_main = "2a7562aa4301211ab3e1bab7a85017f7d18e6ba4"
        approval_env = "CF_PREVIEW_MIGRATION_0015_AUTHORIZED_SHA"
        with mock.patch.object(guard, "verify_migrations", side_effect=[pending, []]), \
             mock.patch.object(guard, "verify_provenance") as provenance, \
             mock.patch.object(guard, "verify_latest_main") as latest_main, \
             mock.patch.object(guard, "run_captured") as run, \
             mock.patch.dict(os.environ, {"GITHUB_SHA": current_main, approval_env: current_main}, clear=False):
            guard.apply_remote("wrangler.preview-migrations-ci.jsonc")
        latest_main.assert_called_once_with(current_main)
        run.assert_called_once()
        self.assertIn("--remote", run.call_args.args[0])
        self.assertEqual(provenance.call_count, 2)
        self.assertEqual(provenance.call_args_list[0].args, ("wrangler.preview-migrations-ci.jsonc",))

    def test_remote_paths_reject_extra_or_unscoped_pending_migrations(self):
        current_main = "2a7562aa4301211ab3e1bab7a85017f7d18e6ba4"
        approval_env = "CF_PREVIEW_MIGRATION_0015_AUTHORIZED_SHA"
        cases = (
            (["0013_owner_auth_local.sql", "0015_listing_change_revisions.sql"], "only migration 0015 may be pending"),
            (["0013_owner_auth_local.sql"], "only migration 0015 may be pending"),
        )
        for pending, expected_error in cases:
            for command in ("authorize", "backup", "apply"):
                with self.subTest(pending=pending, command=command), tempfile.TemporaryDirectory() as directory, \
                     mock.patch.object(guard, "verify_target"), \
                     mock.patch.object(guard, "verify_provenance"), \
                     mock.patch.object(guard, "verify_migrations", return_value=pending), \
                     mock.patch.object(guard, "verify_latest_main") as latest_main, \
                     mock.patch.object(guard, "run_captured") as run, \
                     mock.patch.dict(os.environ, {"GITHUB_SHA": current_main, approval_env: current_main}, clear=False):
                    if command == "authorize":
                        operation = lambda: guard.authorize_remote("wrangler.preview-migrations-ci.jsonc")
                    elif command == "backup":
                        root = Path(directory)
                        operation = lambda: guard.backup_and_rehearse("wrangler.preview-migrations-ci.jsonc", root / "private" / "backup.sql", root / "persist")
                    else:
                        operation = lambda: guard.apply_remote("wrangler.preview-migrations-ci.jsonc")
                    with self.assertRaisesRegex(guard.PolicyError, expected_error):
                        operation()
                    latest_main.assert_not_called()
                    run.assert_not_called()
                    if command == "backup":
                        self.assertFalse((Path(directory) / "private").exists())
                        self.assertFalse((Path(directory) / "persist").exists())

    def test_remote_paths_reject_other_migration_even_with_its_own_sha_authorization(self):
        current_main = "2a7562aa4301211ab3e1bab7a85017f7d18e6ba4"
        environment = {
            "GITHUB_SHA": current_main,
            "CF_PREVIEW_MIGRATION_0015_AUTHORIZED_SHA": current_main,
            "CF_PREVIEW_MIGRATION_0016_AUTHORIZED_SHA": current_main,
        }
        for command in ("authorize", "backup", "apply"):
            with self.subTest(command=command), tempfile.TemporaryDirectory() as directory, \
                 mock.patch.object(guard, "verify_target"), \
                 mock.patch.object(guard, "verify_provenance"), \
                 mock.patch.object(guard, "verify_migrations", return_value=["0016_alternative.sql"]), \
                 mock.patch.object(guard, "verify_latest_main") as latest_main, \
                 mock.patch.object(guard, "run_captured") as run, \
                 mock.patch.dict(os.environ, environment, clear=False):
                if command == "authorize":
                    operation = lambda: guard.authorize_remote("wrangler.preview-migrations-ci.jsonc")
                elif command == "backup":
                    root = Path(directory)
                    operation = lambda: guard.backup_and_rehearse("wrangler.preview-migrations-ci.jsonc", root / "private" / "backup.sql", root / "persist")
                else:
                    operation = lambda: guard.apply_remote("wrangler.preview-migrations-ci.jsonc")
                with self.assertRaisesRegex(guard.PolicyError, "only migration 0015 may be pending"):
                    operation()
                latest_main.assert_not_called()
                run.assert_not_called()
                if command == "backup":
                    self.assertFalse((Path(directory) / "private").exists())
                    self.assertFalse((Path(directory) / "persist").exists())

    def test_remote_authorization_succeeds_when_no_migration_is_pending(self):
        with mock.patch.object(guard, "verify_target"), \
             mock.patch.object(guard, "verify_provenance"), \
             mock.patch.object(guard, "verify_migrations", return_value=[]):
            guard.authorize_remote("wrangler.preview-migrations-ci.jsonc")

    def test_remote_apply_fails_closed_if_0015_authorization_policy_is_removed(self):
        current_main = "2a7562aa4301211ab3e1bab7a85017f7d18e6ba4"
        approval_env = "CF_PREVIEW_MIGRATION_0015_AUTHORIZED_SHA"
        policy = guard._load_json(guard.MIGRATIONS)
        entry = next(x for x in policy["migrations"] if x["name"] == "0015_listing_change_revisions.sql")
        entry.pop("remote_authorization_env")
        with mock.patch.object(guard, "_load_json", return_value=policy), \
             mock.patch.object(guard, "verify_target"), \
             mock.patch.object(guard, "verify_provenance"), \
             mock.patch.object(guard, "verify_migrations", return_value=["0015_listing_change_revisions.sql"]), \
             mock.patch.object(guard, "run_captured") as run, \
             mock.patch.dict(os.environ, {"GITHUB_SHA": current_main, approval_env: current_main}, clear=False):
            with self.assertRaisesRegex(guard.PolicyError, "requires its separate SHA-bound authorization policy"):
                guard.apply_remote("wrangler.preview-migrations-ci.jsonc")
        run.assert_not_called()

    def test_unapproved_and_destructive_migrations_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "0014_bad.sql"
            path.write_text("DROP TABLE users;")
            with self.assertRaisesRegex(guard.PolicyError, "not explicitly approved"):
                guard.validate_pending_migrations([path.name], {}, {path.name: path})
            allow = {path.name: {"sha256": __import__("hashlib").sha256(path.read_bytes()).hexdigest()}}
            with self.assertRaisesRegex(guard.PolicyError, "destructive SQL"):
                guard.validate_pending_migrations([path.name], allow, {path.name: path})

    def test_unapproved_data_update_migration_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "0015_unreviewed.sql"
            path.write_text("UPDATE listings SET deposit_status='NOT_REQUIRED';")
            with self.assertRaisesRegex(guard.PolicyError, "not explicitly approved"):
                guard.validate_pending_migrations([path.name], {}, {path.name: path})

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
            "timestamp": "2026-10-26T13:30:00.000Z",
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "output.json"
            path.write_text(json.dumps(payload))
            stable, immutable, returned_id = guard.parse_deploy_output(path)
            for bad_id in ("12345678--123-1234-1234-1234567890ab", "12345678--1234-1234-1234-1234567890ab", "123456781234123412341234567890ab", "12345678-1234-1234-1234-1234567890zz"):
                invalid = {**payload, "deployment_id": bad_id, "deployment_urls": [f"https://{bad_id[:8]}-alquileres-uspa-lab.sjo1848.workers.dev"]}
                path.write_text(json.dumps(invalid))
                with self.assertRaisesRegex(guard.PolicyError, "expected stable URL and deployment identifier"):
                    guard.parse_deploy_output(path)
        self.assertEqual(stable, guard.TARGET["stable_url"])
        self.assertEqual(returned_id, deployment_id)
        self.assertTrue(immutable.endswith(".workers.dev"))

    def test_wrangler_jsonl_session_envelope_precedes_preview_record(self):
        deployment_id = "0ed47989-1234-1234-1234-1234567890ab"
        session = {"type": "wrangler-session", "version": 1, "timestamp": "2026-10-26T13:30:00.000Z"}
        preview = {
            "type": "preview", "version": 1, "worker_name": "alquileres-uspa-lab",
            "preview_id": guard.TARGET["preview_id"], "preview_name": "private", "preview_slug": "private",
            "preview_urls": [guard.TARGET["stable_url"]], "deployment_id": deployment_id,
            "deployment_urls": [f"https://{deployment_id[:8]}-alquileres-uspa-lab.sjo1848.workers.dev"],
            "timestamp": "2026-10-26T13:30:00.000Z",
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "output.jsonl"
            path.write_text(json.dumps(session) + "\n" + json.dumps(preview) + "\n")
            _, _, returned_id = guard.parse_deploy_output(path)
        self.assertEqual(returned_id, deployment_id)

    def test_wrangler_jsonl_rejects_duplicate_preview_or_unknown_record(self):
        preview = {"type": "preview"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "output.jsonl"
            path.write_text(json.dumps(preview) + "\n" + json.dumps(preview) + "\n")
            with self.assertRaisesRegex(guard.PolicyError, "one Preview"):
                guard.parse_deploy_output(path)
            path.write_text(json.dumps({"type": "unexpected"}) + "\n" + json.dumps(preview) + "\n")
            with self.assertRaisesRegex(guard.PolicyError, "one Preview"):
                guard.parse_deploy_output(path)
            session = {"type": "wrangler-session", "version": 1}
            path.write_text(json.dumps(session) + "\n" + json.dumps(session) + "\n" + json.dumps(preview) + "\n")
            with self.assertRaisesRegex(guard.PolicyError, "optionally preceded"):
                guard.parse_deploy_output(path)
            path.write_text(json.dumps(preview) + "\n" + json.dumps(session) + "\n")
            with self.assertRaisesRegex(guard.PolicyError, "optionally preceded"):
                guard.parse_deploy_output(path)

    def test_wrangler_combined_preview_json_output_with_human_preamble(self):
        deployment_id = "34b8467b-1234-1234-1234-1234567890ab"
        envelope = {
            "preview": {
                "id": guard.TARGET["preview_id"],
                "name": "private",
                "urls": [guard.TARGET["stable_url"]],
            },
            "deployment": {
                "id": deployment_id,
                "source": "wrangler",
                "urls": [f"https://{deployment_id[:8]}-alquileres-uspa-lab.sjo1848.workers.dev"],
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "wrangler-output.json"
            path.write_text("Publishing Preview...\n" + json.dumps(envelope, indent=2) + "\n")
            stable, immutable, returned_id = guard.parse_deploy_output(path)
            self.assertEqual(stable, guard.TARGET["stable_url"])
            self.assertEqual(immutable, envelope["deployment"]["urls"][0])
            self.assertEqual(returned_id, deployment_id)

            bad = json.loads(json.dumps(envelope))
            bad["preview"]["id"] = "wrong-preview"
            path.write_text(json.dumps(bad))
            with self.assertRaisesRegex(guard.PolicyError, "existing private Preview"):
                guard.parse_deploy_output(path)

            bad = json.loads(json.dumps(envelope))
            bad["deployment"]["urls"] = ["https://attacker.example"]
            path.write_text(json.dumps(bad))
            with self.assertRaisesRegex(guard.PolicyError, "immutable URL"):
                guard.parse_deploy_output(path)

            path.write_text(json.dumps(envelope) + "\n{}")
            with self.assertRaisesRegex(guard.PolicyError, "trailing data"):
                guard.parse_deploy_output(path)

            for record in ({"type": "unexpected"}, {"type": "preview"}):
                path.write_text(json.dumps(record) + "\n" + json.dumps(envelope, indent=2) + "\n")
                with self.assertRaisesRegex(guard.PolicyError, "structured record"):
                    guard.parse_deploy_output(path)

    def test_deployment_output_rejects_unexpected_worker_or_url(self):
        payload = {"type": "preview", "worker_name": "other-worker", "preview_name": "private"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "output.json"
            path.write_text(json.dumps(payload))
            with self.assertRaises(guard.PolicyError):
                guard.parse_deploy_output(path)


if __name__ == "__main__":
    unittest.main()
