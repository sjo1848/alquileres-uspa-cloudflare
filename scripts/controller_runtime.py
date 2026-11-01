#!/usr/bin/env python3
"""Launch a private, read-only Controller through Codex app-server.

The accepted ThreadStartResponse is the runtime evidence. CLI arguments are
recorded separately as requested configuration and never treated as acceptance.
Raw session IDs and reviewer output remain in mode-0600 local evidence files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
from datetime import datetime, timezone

ALLOWED_POST_CANDIDATE_PATHS = {
    ".orchestration/STATE.md",
    ".orchestration/STATUS.json",
    ".orchestration/contracts/CF-AU-I64-PREVIEW-AUTH-RENEWAL.md",
    ".orchestration/evidence/CF-AU-I64-CONTROLLER-BLOCKED.md",
    ".orchestration/evidence/CF-AU-I64-CONTROLLER-RUNTIME-PROBE.json",
    ".orchestration/evidence/CF-AU-I64-FINAL-REVIEWS.md",
    "scripts/controller_runtime.py",
    "scripts/tests/test_controller_runtime.py",
}


def accepted_configuration_errors(accepted: dict) -> list[str]:
    expected = {
        "model": "gpt-6-luna",
        "reasoning_effort": "high",
        "sandbox_type": "readOnly",
        "sandbox_network_access": False,
        "approval_policy": "never",
    }
    return [
        f"{key}={accepted.get(key)!r}, expected {value!r}"
        for key, value in expected.items()
        if accepted.get(key) != value
    ]


def disallowed_functional_delta(paths: list[str]) -> list[str]:
    """Only Issue 64 orchestration/evidence and its launcher may differ from f559."""
    return sorted(set(paths) - ALLOWED_POST_CANDIDATE_PATHS)


def jsonl_reader(stream, target: queue.Queue):
    for line in iter(stream.readline, ""):
        target.put(line)
    target.put(None)


def private_write(path: Path, content: str) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    path.chmod(0o600)


class AppServer:
    def __init__(self, cwd: Path):
        codex = shutil.which("codex")
        if not codex:
            raise RuntimeError("Codex CLI is not on PATH")
        self.home_tmp = tempfile.TemporaryDirectory(prefix="codex-controller-")
        self.home = Path(self.home_tmp.name)
        self.home.chmod(0o700)
        source_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
        auth = source_home / "auth.json"
        if not auth.is_file():
            raise RuntimeError("Local Codex auth file is unavailable")
        (self.home / "auth.json").symlink_to(auth)
        config = (
            'model = "gpt-6-luna"\n'
            'model_reasoning_effort = "high"\n'
            "[analytics]\n"
            "enabled = false\n"
            "[otel]\n"
            'exporter = "none"\n'
            'metrics_exporter = "none"\n'
            'trace_exporter = "none"\n'
            "log_user_prompt = false\n"
        )
        private_write(self.home / "config.toml", config)
        env = os.environ.copy()
        env["CODEX_HOME"] = str(self.home)
        env["TMPDIR"] = str(self.home)
        self.proc = subprocess.Popen(
            [codex, "app-server", "--listen", "stdio://", "--strict-config"],
            cwd=cwd,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        self.lines: queue.Queue = queue.Queue()
        self.reader = threading.Thread(
            target=jsonl_reader, args=(self.proc.stdout, self.lines), daemon=True
        )
        self.reader.start()
        self.next_id = 1
        self.send(
            {
                "method": "initialize",
                "id": self.id(),
                "params": {
                    "clientInfo": {
                        "name": "alquileres-issue64-controller",
                        "title": "Alquileres Issue 64 Controller",
                        "version": "1",
                    }
                },
            }
        )
        response = self.receive(self.next_id - 1)
        if "error" in response:
            raise RuntimeError("app-server initialize was rejected")
        self.send({"method": "initialized", "params": {}})

    def id(self) -> int:
        current = self.next_id
        self.next_id += 1
        return current

    def send(self, message: dict) -> None:
        assert self.proc.stdin is not None
        self.proc.stdin.write(json.dumps(message, separators=(",", ":")) + "\n")
        self.proc.stdin.flush()

    def receive(self, request_id: int, timeout: float = 90) -> dict:
        while True:
            try:
                line = self.lines.get(timeout=timeout)
            except queue.Empty as exc:
                raise TimeoutError("app-server protocol response timed out") from exc
            if line is None:
                raise RuntimeError("app-server closed before protocol response")
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            if item.get("id") == request_id:
                return item

    def request(self, method: str, params: dict) -> dict:
        request_id = self.id()
        self.send({"method": method, "id": request_id, "params": params})
        response = self.receive(request_id)
        if "error" in response:
            raise RuntimeError(f"app-server {method} request was rejected")
        return response["result"]

    def start_thread(self, cwd: Path) -> tuple[dict, dict]:
        result = self.request(
            "thread/start",
            {
                "model": "gpt-6-luna",
                "cwd": str(cwd),
                "approvalPolicy": "never",
                "sandbox": "read-only",
                "ephemeral": True,
                "serviceName": "alquileres-issue64-controller",
            },
        )
        thread = result.get("thread") or {}
        sandbox = result.get("sandbox") or {}
        accepted = {
            "model": result.get("model"),
            "reasoning_effort": result.get("reasoningEffort"),
            "model_provider": result.get("modelProvider"),
            "sandbox_type": sandbox.get("type") if isinstance(sandbox, dict) else None,
            "sandbox_network_access": sandbox.get("networkAccess") if isinstance(sandbox, dict) else None,
            "approval_policy": result.get("approvalPolicy"),
            "thread_id": thread.get("id"),
            "session_id": thread.get("sessionId"),
            "ephemeral": thread.get("ephemeral"),
            "cli_version": thread.get("cliVersion"),
        }
        mismatch = accepted_configuration_errors(accepted)
        if mismatch or not accepted["session_id"] or not accepted["thread_id"]:
            raise RuntimeError(f"app-server accepted configuration mismatch: {mismatch or 'missing session metadata'}")
        return result, accepted

    def run_turn(self, thread_id: str, prompt: str, timeout: float = 1200) -> tuple[str, dict]:
        request_id = self.id()
        self.send(
            {
                "method": "turn/start",
                "id": request_id,
                "params": {"threadId": thread_id, "input": [{"type": "text", "text": prompt}]},
            }
        )
        response = self.receive(request_id)
        if "error" in response:
            raise RuntimeError("app-server rejected the Controller turn")
        turn_id = (response.get("result", {}).get("turn") or {}).get("id")
        if not turn_id:
            raise RuntimeError("app-server did not return a Controller turn ID")
        deltas: dict[str, str] = {}
        final_messages: list[str] = []
        deadline = __import__("time").monotonic() + timeout
        while __import__("time").monotonic() < deadline:
            try:
                line = self.lines.get(timeout=min(1, max(0.05, deadline - __import__("time").monotonic())))
            except queue.Empty:
                if self.proc.poll() is not None:
                    break
                continue
            if line is None:
                break
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            if item.get("method") == "item/agentMessage/delta":
                params = item.get("params", {})
                item_id = params.get("itemId", "agent-message")
                deltas[item_id] = deltas.get(item_id, "") + params.get("delta", "")
            elif item.get("method") == "item/completed":
                completed_item = item.get("params", {}).get("item") or {}
                if completed_item.get("type") == "agentMessage":
                    content = completed_item.get("content") or []
                    final_messages.append("".join(part.get("text", "") for part in content if part.get("type") == "text"))
            elif item.get("method") == "turn/completed":
                turn = item.get("params", {}).get("turn") or {}
                text = "\n".join(message for message in final_messages if message.strip())
                if not text:
                    text = "\n".join(deltas.values())
                return text.strip(), turn
        raise TimeoutError("Controller turn did not complete")

    def close(self) -> None:
        if getattr(self, "proc", None) and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait(timeout=5)
        self.home_tmp.cleanup()


def evidence_record(accepted: dict, args: argparse.Namespace) -> dict:
    sid = accepted.pop("session_id")
    thread_id = accepted.pop("thread_id")
    record = {
        "captured_at_utc": datetime.now(timezone.utc).isoformat(),
        "evidence_source": "Codex app-server JSON-RPC ThreadStartResponse",
        "evidence_format": "filtered JSON; fields copied from response.result",
        "cli_version": accepted.get("cli_version"),
        "configuration_requested": {
            "model": "gpt-6-luna",
            "reasoning_effort": "high",
            "sandbox": "read-only",
            "approval_policy": "never",
        },
        "configuration_accepted_by_runtime": accepted,
        "session_correlation_sha256": hashlib.sha256(sid.encode()).hexdigest(),
        "thread_correlation_sha256": hashlib.sha256(thread_id.encode()).hexdigest(),
        "backend_model_identity": "UNVERIFIED; app-server metadata is runtime configuration, not provider attestation",
        "telemetry": "disabled; no OTLP exporter configured",
        "probe_only": args.probe_only,
    }
    if args.artifact_sha:
        record["artifact_sha"] = args.artifact_sha
    if args.base_sha:
        record["base_sha"] = args.base_sha
    if args.functional_sha:
        record["functional_candidate_sha"] = args.functional_sha
    return record


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cwd", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    parser.add_argument("--probe-only", action="store_true")
    parser.add_argument("--artifact-sha")
    parser.add_argument("--functional-sha")
    parser.add_argument("--base-sha")
    parser.add_argument("--review-output", type=Path)
    args = parser.parse_args()
    cwd = args.cwd.resolve(strict=True)
    if not args.probe_only:
        if not args.artifact_sha or not args.functional_sha or not args.base_sha or not args.review_output:
            parser.error("review mode requires artifact/functional/base SHA and --review-output")
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain"], cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()
        if head != args.artifact_sha or dirty:
            parser.error("review cwd must be clean and at the exact artifact SHA")
        subprocess.run(
            ["git", "merge-base", "--is-ancestor", args.base_sha, "HEAD"],
            cwd=cwd,
            capture_output=True,
            check=True,
        )
        subprocess.run(
            ["git", "merge-base", "--is-ancestor", args.functional_sha, "HEAD"],
            cwd=cwd,
            capture_output=True,
            check=True,
        )
        delta = subprocess.run(
            ["git", "diff", "--name-only", f"{args.functional_sha}..HEAD"],
            cwd=cwd,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.splitlines()
        disallowed_paths = disallowed_functional_delta(delta)
        if disallowed_paths:
            parser.error("unapproved files changed after the stable functional candidate: " + ", ".join(disallowed_paths))
    controller = None
    try:
        controller = AppServer(cwd)
        result, accepted = controller.start_thread(cwd)
        record = evidence_record(accepted.copy(), args)
        private_write(args.evidence, json.dumps(record, indent=2) + "\n")
        if args.probe_only:
            print(json.dumps(record, indent=2))
            return 0
        prompt = sys.stdin.read()
        if not prompt.strip():
            parser.error("review prompt must be supplied on stdin")
        report, turn = controller.run_turn(accepted["thread_id"], prompt)
        private_write(args.review_output, report + "\n")
        record["turn_status"] = turn.get("status")
        record["turn_id_sha256"] = hashlib.sha256(str(turn.get("id", "")).encode()).hexdigest()
        private_write(args.evidence, json.dumps(record, indent=2) + "\n")
        if turn.get("status") != "completed":
            return 2
        print(report)
        return 0
    except Exception as exc:
        print(f"controller runtime capture failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2
    finally:
        if controller:
            controller.close()


if __name__ == "__main__":
    raise SystemExit(main())
