"""Regression tests for the Issue 64 read-only Controller launcher guards."""

import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts/controller_runtime.py"
spec = importlib.util.spec_from_file_location("controller_runtime", SRC)
controller_runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(controller_runtime)


class ControllerRuntimeGuardTests(unittest.TestCase):
    def test_accepts_only_runtime_confirmed_luna_high_offline_read_only(self):
        accepted = {
            "model": "gpt-6-luna",
            "reasoning_effort": "high",
            "sandbox_type": "readOnly",
            "sandbox_network_access": False,
            "approval_policy": "never",
        }
        self.assertEqual(controller_runtime.accepted_configuration_errors(accepted), [])

    def test_rejects_network_access_or_missing_network_metadata(self):
        accepted = {
            "model": "gpt-6-luna",
            "reasoning_effort": "high",
            "sandbox_type": "readOnly",
            "sandbox_network_access": True,
            "approval_policy": "never",
        }
        self.assertIn("sandbox_network_access=True", " ".join(controller_runtime.accepted_configuration_errors(accepted)))
        accepted.pop("sandbox_network_access")
        self.assertIn("sandbox_network_access=None", " ".join(controller_runtime.accepted_configuration_errors(accepted)))

    def test_rejects_changes_outside_exact_tracking_and_launcher_allowlist(self):
        allowed = [
            ".orchestration/STATE.md",
            ".orchestration/STATUS.json",
            ".orchestration/contracts/CF-AU-I64-PREVIEW-AUTH-RENEWAL.md",
            ".orchestration/evidence/CF-AU-I64-CONTROLLER-BLOCKED.md",
            ".orchestration/evidence/CF-AU-I64-CONTROLLER-RUNTIME-PROBE.json",
            ".orchestration/evidence/CF-AU-I64-FINAL-REVIEWS.md",
            "scripts/controller_runtime.py",
            "scripts/tests/test_controller_runtime.py",
        ]
        self.assertEqual(controller_runtime.disallowed_functional_delta(allowed), [])
        denied = controller_runtime.disallowed_functional_delta(
            ["apps/worker/src/auth.ts", "scripts/other.py", ".github/workflows/deploy.yml", "docs/tool.js"]
        )
        self.assertEqual(denied, [".github/workflows/deploy.yml", "apps/worker/src/auth.ts", "docs/tool.js", "scripts/other.py"])


if __name__ == "__main__":
    unittest.main()
