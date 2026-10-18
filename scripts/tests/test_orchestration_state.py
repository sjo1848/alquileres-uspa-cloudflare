"""Regression fixtures for the review-churn defects in PR #20."""

import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

SRC = Path(__file__).resolve().parents[1] / "check_orchestration_state.py"
spec = importlib.util.spec_from_file_location("orchestration_check", SRC)
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)
SHA = "a" * 40
OTHER = "b" * 40
EVIDENCE = ".orchestration/evidence/critics/current.md"


class CanonicalStateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / ".orchestration/evidence/critics").mkdir(parents=True)
        (self.root / EVIDENCE).write_text(f"# A2 PASS\nExact reviewed artifact: {SHA}\n", encoding="utf-8")
        (self.root / ".orchestration/STATE.md").write_text("State: \u0060READY_TO_RESUME\u0060\nPhase: \u0060LAB\u0060\nActive task: \u0060next task\u0060\n\n## Event 42 — integrated\n", encoding="utf-8")
        self.state = {
            "phase": "LAB", "runtime_status": "READY_TO_RESUME", "active_task": "next task", "event": {"seq": 42},
            "next_action": "Continue authorized product work",
            "preview_delivery": {"application_sha": OTHER, "remote_admin_e2e": "BLOCKED_AUTH"},
            "integration_commit": OTHER,
            "pull_request": {"number": 20, "state": "MERGED", "merge_commit": OTHER},
            "external_review": {"artifact_sha": SHA, "artifact_tag": "A2", "controller_report": EVIDENCE},
            "review_authority": {"artifact_sha": SHA, "artifact_tag": "A2", "report": EVIDENCE},
            "candidate_review": {"artifact_sha": SHA, "artifact_tag": "A2", "controller_reviewed_sha": SHA, "controller_evidence": EVIDENCE},
        }

    def check(self):
        (self.root / ".orchestration/STATUS.json").write_text(json.dumps(self.state), encoding="utf-8")
        return check.state_errors(self.root)

    def test_good_canonical_state(self):
        self.assertEqual(self.check(), [])

    def test_old_preview_is_not_parallel_active_state(self):
        self.state["preview"] = {"deployment_id": "old"}
        self.assertIn("duplicate active preview", " ".join(self.check()))

    def test_artifact_sha_mismatch(self):
        self.state["candidate_review"]["controller_reviewed_sha"] = OTHER
        self.assertIn("SHAs disagree", " ".join(self.check()))

    def test_controller_evidence_mismatch(self):
        self.state["candidate_review"]["controller_evidence"] = ".orchestration/evidence/critics/old.md"
        self.assertIn("evidence paths disagree", " ".join(self.check()))

    def test_evidence_at_wrong_artifact(self):
        (self.root / EVIDENCE).write_text(f"# old artifact {OTHER}\n", encoding="utf-8")
        self.assertIn("does not identify current artifact", " ".join(self.check()))

    def test_stale_pr_action(self):
        self.state["next_action"] = "If PR #20 remains open, merge it"
        self.assertIn("stale or completed PR #20", " ".join(self.check()))

    def test_preview_sha_mismatch(self):
        self.state["preview_delivery"]["application_sha"] = SHA
        self.assertIn("application_sha differs", " ".join(self.check()))

    def test_missing_evidence(self):
        (self.root / EVIDENCE).unlink()
        self.assertIn("missing evidence", " ".join(self.check()))

    def test_auth_pass_not_conflated_with_blocked(self):
        self.state["candidate_review"]["remote_admin_e2e"] = "PASS"
        self.assertIn("PASS and BLOCKED_AUTH", " ".join(self.check()))

    def test_event_must_be_in_state_ledger(self):
        self.state["event"]["seq"] = 41
        self.assertIn("event sequence missing", " ".join(self.check()))

    def test_linear_history_claim_in_changed_document(self):
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        subprocess.run(["git", "config", "user.email", "test@example.test"], cwd=self.root, check=True)
        subprocess.run(["git", "config", "user.name", "QA"], cwd=self.root, check=True)
        (self.root / "claim.md").write_text("main exigía historial lineal estricto\n", encoding="utf-8")
        subprocess.run(["git", "add", "claim.md"], cwd=self.root, check=True)
        self.assertIn("unsupported linear-history", " ".join(check.diff_errors(self.root, None)))

    def test_staged_new_file_trailing_whitespace(self):
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        (self.root / "new.md").write_text("bad trailing whitespace  \n", encoding="utf-8")
        subprocess.run(["git", "add", "new.md"], cwd=self.root, check=True)
        self.assertIn("diff whitespace check failed", " ".join(check.diff_errors(self.root, None)))


if __name__ == "__main__":
    unittest.main()
