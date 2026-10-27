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
        self.assertIn("WRANGLER_OUTPUT_FILE_PATH: ${{ runner.temp }}/preview-result.json", staging)
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

    def test_deployment_output_rejects_unexpected_worker_or_url(self):
        payload = {"type": "preview", "worker_name": "other-worker", "preview_name": "private"}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "output.json"
            path.write_text(json.dumps(payload))
            with self.assertRaises(guard.PolicyError):
                guard.parse_deploy_output(path)


if __name__ == "__main__":
    unittest.main()
