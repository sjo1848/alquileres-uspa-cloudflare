#!/usr/bin/env python3
"""Cheap, offline consistency gate for active orchestration records.

Run before pushing, and in CI. Historical event prose is deliberately not treated
as current state; only the active JSON records and the STATE.md event tip are.
"""

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys

SHA = re.compile(r"^[0-9a-f]{40}$")
PATH_FIELDS = (
    ("review_authority", "report"),
    ("external_review", "controller_report"),
    ("candidate_review", "controller_evidence"),
)
LINEAR_CLAIM = re.compile(r"(?i)(?:require[sd]? linear history|historial lineal estricto)")


def state_errors(root: Path) -> list[str]:
    errors: list[str] = []
    try:
        state = json.loads((root / ".orchestration/STATUS.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"STATUS.json missing or invalid: {exc}"]
    try:
        narrative = (root / ".orchestration/STATE.md").read_text(encoding="utf-8")
    except OSError as exc:
        return [f"STATE.md missing: {exc}"]

    def get(section: str, key: str):
        value = state.get(section)
        return value.get(key) if isinstance(value, dict) else None

    if "preview" in state and "preview_delivery" in state:
        errors.append("duplicate active preview and preview_delivery; keep one canonical deployment")

    artifact_values = {
        "external_review.artifact_sha": get("external_review", "artifact_sha"),
        "review_authority.artifact_sha": get("review_authority", "artifact_sha"),
        "candidate_review.artifact_sha": get("candidate_review", "artifact_sha"),
        "candidate_review.controller_reviewed_sha": get("candidate_review", "controller_reviewed_sha"),
    }
    present = {key: value for key, value in artifact_values.items() if value is not None}
    if present and (len(set(present.values())) != 1 or any(not isinstance(s, str) or not SHA.fullmatch(s) for s in present.values())):
        errors.append("active artifact/review SHAs disagree or are invalid: " + repr(present))
    expected_sha = next((s for s in present.values() if isinstance(s, str) and SHA.fullmatch(s)), None)

    tags = {get(s, k) for s, k in (("external_review", "artifact_tag"), ("review_authority", "artifact_tag"), ("candidate_review", "artifact_tag"))}
    tags.discard(None)
    if len(tags) > 1:
        errors.append("active artifact tags disagree")

    refs = {f"{section}.{field}": get(section, field) for section, field in PATH_FIELDS}
    actual_refs = {k: v for k, v in refs.items() if v is not None}
    if actual_refs and len(set(actual_refs.values())) != 1:
        errors.append("active Controller evidence paths disagree: " + repr(actual_refs))
    for field, path in actual_refs.items():
        if not isinstance(path, str) or not path.startswith(".orchestration/evidence/") or ".." in Path(path).parts:
            errors.append(f"{field}: invalid evidence path")
            continue
        file = root / path
        if not file.is_file():
            errors.append(f"{field}: missing evidence file {path}")
            continue
        if expected_sha and expected_sha not in file.read_text(encoding="utf-8"):
            errors.append(f"{field}: evidence file does not identify current artifact {expected_sha}")

    integration = state.get("integration_commit")
    pr_merge = get("pull_request", "merge_commit")
    if integration is not None and pr_merge is not None and integration != pr_merge:
        errors.append("active integration_commit differs from pull_request.merge_commit")
    app_sha = get("preview_delivery", "application_sha")
    if app_sha is not None and integration is not None and app_sha != integration:
        errors.append("preview_delivery.application_sha differs from integration_commit")

    # An old PR reference in an active instruction caused repeated PR #20 reviews.
    active_number = get("pull_request", "number")
    next_action = state.get("next_action", "")
    for matched in re.finditer(r"\bPR\s*#(\d+)\b", next_action, re.IGNORECASE):
        if active_number is None or int(matched.group(1)) != active_number or get("pull_request", "state") == "MERGED":
            errors.append(f"next_action names stale or completed PR #{matched.group(1)}")

    # Access denials are not authenticated UI E2E evidence.
    for field in ("remote_authenticated_e2e", "remote_admin_e2e"):
        values = [get("candidate_review", field), get("preview_delivery", field)]
        if any(isinstance(v, str) and "BLOCKED_AUTH" in v for v in values) and any(isinstance(v, str) and re.search(r"\bPASS\b", v) for v in values):
            errors.append(f"{field} simultaneously claims PASS and BLOCKED_AUTH")

    event = state.get("event") or {}
    seq = event.get("seq") if isinstance(event, dict) else None
    if not isinstance(seq, int) or not re.search(rf"(?m)^## Event {seq}\b", narrative):
        errors.append("STATUS.json event sequence missing from STATE.md")
    if f"State: \u0060{state.get('runtime_status')}\u0060" not in narrative[:500]:
        errors.append("STATE.md header runtime state differs from STATUS.json")
    if f"Phase: \u0060{state.get('phase')}\u0060" not in narrative[:500]:
        errors.append("STATE.md header phase differs from STATUS.json")
    if f"Active task: \u0060{state.get('active_task')}\u0060" not in narrative[:500]:
        errors.append("STATE.md header active task differs from STATUS.json")
    return list(dict.fromkeys(errors))


def diff_errors(root: Path, base: str | None) -> list[str]:
    """Check final committed diff (or staged diff locally), not just working tree."""
    if not (root / ".git").exists():
        return []
    cmd = ["git", "diff", "--check"]
    if base:
        cmd += [base, "HEAD"]
    else:
        cmd.append("--cached")
    result = subprocess.run(cmd, cwd=root, capture_output=True, text=True, check=False)
    errors = [f"diff whitespace check failed: {result.stdout.strip()} {result.stderr.strip()}"] if result.returncode else []
    if result.returncode:
        return errors
    if base:
        changed = subprocess.run(["git", "diff", "--name-only", "--diff-filter=ACMR", base, "HEAD"], cwd=root, capture_output=True, text=True, check=False)
        if changed.returncode:
            return [f"unable to enumerate changed files: {changed.stderr.strip()}"]
        files = changed.stdout.splitlines()
    else:
        changed = subprocess.run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"], cwd=root, capture_output=True, text=True, check=False)
        files = changed.stdout.splitlines() if not changed.returncode else []
    for name in files:
        if not name.endswith((".md", ".json")):
            continue
        file = root / name
        if file.is_file() and LINEAR_CLAIM.search(file.read_text(encoding="utf-8")):
            errors.append(f"{name}: unsupported linear-history protection assertion in changed document; verify against actual merge parents before claiming")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--base", help="Git base SHA for a committed PR diff check")
    args = parser.parse_args()
    errors = state_errors(args.root) + diff_errors(args.root, args.base)
    if errors:
        for error in errors:
            print("FAIL:", error, file=sys.stderr)
        return 1
    print("PASS: canonical active state and final diff are consistent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
