#!/usr/bin/env python3
"""Fail-closed policy and release checks for the one private Alquileres Preview."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / "apps/worker"
PROVENANCE = ROOT / ".orchestration/evidence/CF-AU-PREVIEW-D1-PROVENANCE.json"
MIGRATIONS = ROOT / ".orchestration/evidence/preview-migration-allowlist.json"
TARGET = {
    "account_id": "30e8fad45f7bc1cd5bddad87e18b1aec",
    "worker_name": "alquileres-uspa-lab",
    "preview_name": "private",
    "database_name": "alquileres-uspa-preview-synthetic",
    "database_id": "74a00c52-a63b-45a3-8213-6648378ed5b1",
    "preview_id": "145981a4991240d2a803281eb78d03b9",
    "access_aud": "adb89dd0162a19eedfefebbe4af68f741a15c68f91427dcf2b524d27c66c03cd",
    "stable_url": "https://private-alquileres-uspa-lab.sjo1848.workers.dev",
    "access_host": "sebastian-ojeda-pages.cloudflareaccess.com",
}


class PolicyError(RuntimeError):
    pass


def _load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PolicyError(f"invalid/missing JSON policy file: {path.name}") from exc


def decision(
    event: str,
    ref: str,
    enabled: str,
    provenance: str,
    plan_status: str,
    access_status: str,
    token_present: bool,
) -> tuple[bool, str]:
    if event != "push" or ref != "refs/heads/main":
        raise PolicyError("remote Preview publishing is only allowed from a push to protected main")
    if enabled.lower() != "true":
        return False, "CF_PREVIEW_CD_ENABLED is not true"
    if provenance != "verified":
        return False, "CF_PREVIEW_D1_PROVENANCE is not verified"
    if plan_status != "free":
        return False, "CF_PREVIEW_PLAN_STATUS is not verified as free"
    if access_status != "operator-only":
        return False, "CF_PREVIEW_ACCESS_STATUS is not verified as operator-only"
    if not token_present:
        return False, "CF_PREVIEW_API_TOKEN is missing"
    return True, "release gate passed"


def _assert_no_r2(config: dict) -> None:
    if config.get("r2_buckets") or config.get("previews", {}).get("r2_buckets"):
        raise PolicyError("R2 binding is forbidden in the private Preview target")


def verify_target(preview_path: Path, migration_path: Path, generated_path: Path | None = None) -> None:
    preview = _load_json(preview_path)
    migrations = _load_json(migration_path)
    _assert_no_r2(preview)
    if preview.get("name") != TARGET["worker_name"]:
        raise PolicyError("Preview Worker name mismatch")
    if preview.get("account_id") != TARGET["account_id"]:
        raise PolicyError("Preview account mismatch")
    if preview.get("workers_dev") is not False or preview.get("preview_urls") is not True:
        raise PolicyError("Preview must target the existing workers.dev Preview without a production route")
    vars_ = preview.get("previews", {}).get("vars", {})
    expected_vars = {
        "AUTH_STRATEGY": "ACCESS_PREVIEW",
        "MEDIA_STRATEGY": "D1_BLOB",
        "COOKIE_SECURE": "true",
        "ACCESS_AUD": TARGET["access_aud"],
    }
    if any(vars_.get(key) != value for key, value in expected_vars.items()):
        raise PolicyError("Preview auth/media/cookie configuration mismatch")
    d1 = preview.get("previews", {}).get("d1_databases", [])
    if len(d1) != 1 or d1[0].get("binding") != "DB":
        raise PolicyError("Preview must have exactly one D1 binding")
    if d1[0].get("database_name") != TARGET["database_name"] or d1[0].get("database_id") != TARGET["database_id"]:
        raise PolicyError("Preview D1 target mismatch or placeholder ID")
    if migrations.get("name") != "alquileres-uspa-preview-migrations":
        raise PolicyError("migration-only config name mismatch")
    md1 = migrations.get("d1_databases", [])
    if len(md1) != 1 or md1[0].get("database_name") != TARGET["database_name"] or md1[0].get("database_id") != TARGET["database_id"]:
        raise PolicyError("migration config D1 target mismatch or placeholder ID")
    if generated_path is not None:
        generated = _load_json(generated_path)
        _assert_no_r2(generated)
        if generated.get("name") != TARGET["worker_name"] or generated.get("account_id") != TARGET["account_id"]:
            raise PolicyError("Vite generated Worker target mismatch")
        generated_vars = generated.get("previews", {}).get("vars", {})
        if any(generated_vars.get(key) != value for key, value in expected_vars.items()):
            raise PolicyError("Vite generated Preview auth/media/cookie configuration mismatch")
        generated_d1 = generated.get("previews", {}).get("d1_databases", [])
        if len(generated_d1) != 1 or generated_d1[0].get("database_name") != TARGET["database_name"] or generated_d1[0].get("database_id") != TARGET["database_id"]:
            raise PolicyError("Vite generated Preview D1 target mismatch or placeholder ID")
        assets_directory = generated.get("assets", {}).get("directory")
        if not assets_directory or not (generated_path.parent / assets_directory).resolve().is_dir():
            raise PolicyError("Vite generated static asset directory is missing")
    print("PASS: exact existing private Worker/D1 target; Access Preview, D1 BLOB, secure cookies; no R2")


def _parse_wr_json(stdout: str) -> list[dict]:
    lines = [line for line in stdout.splitlines() if not line.startswith("npm notice")]
    text = "\n".join(lines).strip()
    start = text.find("[")
    end = text.rfind("]")
    if start < 0 or end < start:
        raise PolicyError("Wrangler did not return JSON query results")
    try:
        value = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise PolicyError("Wrangler returned invalid JSON query results") from exc
    if not isinstance(value, list) or not value or value[0].get("success") is not True:
        raise PolicyError("D1 read query did not succeed")
    return value[0].get("results", [])


def _wrangler_query(sql: str, config: str, local: bool = False, persist_to: str | None = None) -> list[dict]:
    command = ["npx", "--no-install", "wrangler", "d1", "execute", "DB"]
    command += ["--local" if local else "--remote", "--config", config, "--command", sql, "--json"]
    if local:
        if not persist_to:
            raise PolicyError("local D1 verification requires an isolated persistence path")
        command += ["--persist-to", persist_to]
    result = subprocess.run(command, cwd=WORKER, capture_output=True, text=True, check=False)
    if result.returncode:
        # Never echo a Wrangler export URL, SQL row content, or credentials.
        raise PolicyError(f"Wrangler D1 read failed (exit {result.returncode})")
    return _parse_wr_json(result.stdout)


def _snapshot(config: str, local: bool = False, persist_to: str | None = None) -> dict:
    users = _wrangler_query(
        "SELECT id,role,created_at,CASE WHEN lower(email) LIKE '%@example.test' THEN 1 ELSE 0 END AS is_synthetic FROM users ORDER BY id", config, local, persist_to
    )
    listings = _wrangler_query(
        "SELECT l.id,l.owner_id,l.status,l.publication_status,l.created_at "
        "FROM listings l ORDER BY l.created_at,l.id",
        config,
        local,
        persist_to,
    )
    audits = _wrangler_query(
        "SELECT id,listing_id,actor_id,target_owner_id,action,created_at FROM admin_audit_events ORDER BY created_at,id",
        config,
        local,
        persist_to,
    )
    counts = _wrangler_query(
        "SELECT (SELECT COUNT(*) FROM users) AS users,"
        "(SELECT COALESCE(SUM(CASE WHEN lower(email) LIKE '%@example.test' THEN 0 ELSE 1 END),0) FROM users) AS non_synthetic_user_email_count,"
        "(SELECT COUNT(*) FROM listings) AS listings,"
        "(SELECT COUNT(*) FROM listing_images) AS listing_images,"
        "(SELECT COUNT(*) FROM static_listing_images) AS static_listing_images,"
        "(SELECT COUNT(*) FROM contact_events) AS contact_events,"
        "(SELECT COUNT(*) FROM admin_audit_events) AS admin_audit_events,"
        "(SELECT COUNT(*) FROM idempotency_records) AS idempotency_records,"
        "(SELECT COUNT(*) FROM image_operations) AS image_operations,"
        "(SELECT COUNT(*) FROM image_reorder_operations) AS image_reorder_operations",
        config,
        local,
        persist_to,
    )
    return {"users": users, "listings": listings, "audit_events": audits, "counts": counts[0] if counts else {}}


def verify_provenance(config: str, local: bool = False, persist_to: str | None = None) -> None:
    manifest = _load_json(PROVENANCE)
    observed = _snapshot(config, local, persist_to)
    validate_synthetic_provenance(observed, manifest)
    print("PASS: D1 synthetic identities and immutable provenance anchors verified; mutable workflow metadata may change; no listing/contact/media content was selected")


def validate_synthetic_provenance(observed: dict, manifest: dict) -> None:
    """Keep the reviewed synthetic baseline while allowing normal Preview activity.

    The manifest anchors known synthetic identities and append-only audit records.
    Status, publication/availability, updated timestamps, row totals and media/contact
    operation counts are intentionally not pinned because valid staging journeys mutate them.
    No title, location, description, address, email value, image name/bytes, or contact
    content is selected for this decision.
    """
    users = observed.get("users", [])
    users_by_id = {row.get("id"): row for row in users}
    expected_users = {row.get("id"): row for row in manifest.get("users", [])}
    if not expected_users or not set(expected_users) <= set(users_by_id):
        raise PolicyError("reviewed synthetic user anchors are missing")
    if any(
        users_by_id[user_id].get("role") != baseline.get("role")
        or users_by_id[user_id].get("created_at") != baseline.get("created_at")
        for user_id, baseline in expected_users.items()
    ):
        raise PolicyError("reviewed synthetic user identity anchors changed")
    if any(row.get("is_synthetic") != 1 or row.get("role") not in {"OWNER", "ADMIN"} for row in users):
        raise PolicyError("D1 contains a non-synthetic or unrecognized user identity")
    synthetic_user_ids = set(users_by_id)

    listings = observed.get("listings", [])
    listings_by_id = {row.get("id"): row for row in listings}
    expected_listings = {row.get("id"): row for row in manifest.get("listings", [])}
    if not expected_listings:
        raise PolicyError("reviewed synthetic listing anchors are missing from the manifest")
    for listing_id, baseline in expected_listings.items():
        actual = listings_by_id.get(listing_id)
        # A reviewed synthetic listing may be legitimately deleted in staging.
        # If it remains, its stable owner/creation anchors must still match.
        if actual and (actual.get("owner_id") != baseline.get("owner_id") or actual.get("created_at") != baseline.get("created_at")):
            raise PolicyError("reviewed synthetic listing identity anchors changed")
    valid_statuses = {"DRAFT", "REJECTED", "SUBMITTED", "APPROVED"}
    valid_publication = {"UNPUBLISHED", "PUBLISHED"}
    for row in listings:
        if row.get("owner_id") not in synthetic_user_ids:
            raise PolicyError("a listing is not owned by a verified synthetic identity")
        if row.get("status") not in valid_statuses or row.get("publication_status") not in valid_publication:
            raise PolicyError("a listing has an unrecognized workflow state")
    audit_events = observed.get("audit_events", [])
    audit_by_id = {row.get("id"): row for row in audit_events}
    expected_audit = {row.get("id"): row for row in manifest.get("audit_events", [])}
    if not set(expected_audit) <= set(audit_by_id):
        raise PolicyError("reviewed synthetic audit anchors are missing")
    immutable_audit_fields = ("listing_id", "actor_id", "target_owner_id", "action", "created_at")
    for event_id, baseline in expected_audit.items():
        if any(audit_by_id[event_id].get(field) != baseline.get(field) for field in immutable_audit_fields):
            raise PolicyError("reviewed synthetic audit identity anchors changed")
    for row in audit_events:
        target_owner_id = row.get("target_owner_id")
        if row.get("actor_id") not in synthetic_user_ids or (target_owner_id is not None and target_owner_id not in synthetic_user_ids):
            raise PolicyError("an audit event refers to a non-synthetic identity")

    if observed.get("counts", {}).get("non_synthetic_user_email_count") != 0:
        raise PolicyError("D1 contains a user with a non-synthetic email domain")


def verify_migrations(config: str, allowlist_path: Path, local: bool = False, persist_to: str | None = None) -> list[str]:
    allowlist = _load_json(allowlist_path)
    allowed = {item["name"]: item for item in allowlist.get("migrations", [])}
    rows = _wrangler_query("SELECT name FROM d1_migrations ORDER BY name", config, local, persist_to)
    applied = {row["name"] for row in rows}
    sql_files = {path.name: path for path in (WORKER / "migrations").glob("*.sql")}
    if not applied <= sql_files.keys():
        raise PolicyError("remote D1 contains an unrecognized applied migration")
    pending = sorted(sql_files.keys() - applied)
    validate_pending_migrations(pending, allowed, sql_files)
    print(f"PASS: applied migration history recognized; {len(pending)} pending migration(s) explicitly allowlisted")
    return pending


def validate_pending_migrations(pending: list[str], allowed: dict, sql_files: dict[str, Path]) -> None:
    for name in pending:
        policy = allowed.get(name)
        if not policy:
            raise PolicyError(f"pending migration {name} is not explicitly approved in the functional PR")
        digest = hashlib.sha256(sql_files[name].read_bytes()).hexdigest()
        if digest != policy.get("sha256"):
            raise PolicyError(f"approved migration hash mismatch: {name}")
        sql = sql_files[name].read_text(encoding="utf-8").upper()
        if re.search(r"\bDROP\s+(TABLE|COLUMN|INDEX|TRIGGER|VIEW)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b", sql):
            raise PolicyError(f"destructive SQL is forbidden in automated Preview migrations: {name}")
        if re.search(r"\bUPDATE\b", sql) and policy.get("allow_update") is not True:
            raise PolicyError(f"general data update is not explicitly approved: {name}")


def check_access_response(status: int, location: str, expected_host: str = TARGET["access_host"]) -> None:
    if status == 302:
        if urllib.parse.urlsplit(location).hostname != expected_host:
            raise PolicyError("anonymous request redirected outside the expected Access host")
    elif status != 403:
        raise PolicyError(f"anonymous Access denial expected, received HTTP {status}")


def verify_anonymous(urls: list[str], access_host: str = TARGET["access_host"]) -> None:
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    paths = ("/", "/login", "/owner", "/admin", "/public/listings", "/health")
    for base in urls:
        parsed = urllib.parse.urlsplit(base)
        if parsed.scheme != "https" or not parsed.hostname or parsed.query or parsed.username:
            raise PolicyError("Access smoke URL is malformed")
        for path in paths:
            request = urllib.request.Request(base.rstrip("/") + path, headers={"User-Agent": "CF-AU-preview-smoke/1"})
            try:
                response = opener.open(request, timeout=15)
                status = response.status
                response.close()
                location = ""
            except urllib.error.HTTPError as exc:
                status = exc.code
                location = exc.headers.get("Location", "")
            except (urllib.error.URLError, TimeoutError) as exc:
                raise PolicyError(f"anonymous Access smoke network failure for {parsed.hostname}{path}") from exc
            try:
                check_access_response(status, location, access_host)
            except PolicyError as exc:
                raise PolicyError(f"{exc} at {parsed.hostname}{path}") from exc
    print(f"PASS: {len(urls) * len(paths)} anonymous routes denied before application access")


def _cloudflare_get(path: str) -> dict:
    token = os.environ.get("CF_PREVIEW_API_TOKEN") or os.environ.get("CLOUDFLARE_API_TOKEN")
    if not token:
        raise PolicyError("scoped Cloudflare Preview read token is missing")
    request = urllib.request.Request(
        "https://api.cloudflare.com/client/v4" + path,
        headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.load(response)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        raise PolicyError("Cloudflare Preview metadata read failed") from exc
    if payload.get("success") is not True or not isinstance(payload.get("result"), dict):
        raise PolicyError("Cloudflare Preview metadata response was not successful")
    return payload["result"]


def current_preview() -> tuple[str, str, str]:
    base = f"/accounts/{TARGET['account_id']}/workers/workers/{TARGET['worker_name']}/previews/{TARGET['preview_name']}"
    preview = _cloudflare_get(base)
    if preview.get("id") != TARGET["preview_id"] or preview.get("name") != TARGET["preview_name"]:
        raise PolicyError("Cloudflare returned a different Preview resource")
    stable_urls = preview.get("urls", [])
    expected_stable = TARGET["stable_url"]
    if stable_urls != [expected_stable]:
        raise PolicyError("existing private Preview stable URL changed")
    deployment = _cloudflare_get(base + "/deployments/latest")
    deployment_id = deployment.get("id")
    deployment_urls = deployment.get("urls", [])
    if not isinstance(deployment_id, str) or not re.fullmatch(r"[0-9a-f-]{36}", deployment_id):
        raise PolicyError("latest Preview deployment has no valid deployment ID")
    expected_immutable = f"https://{deployment_id[:8]}-{TARGET['worker_name']}.sjo1848.workers.dev"
    if deployment_urls != [expected_immutable]:
        raise PolicyError("latest immutable Preview URL does not match its deployment ID")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as stream:
            stream.write(f"stable_url={expected_stable}\nimmutable_url={expected_immutable}\ndeployment_id={deployment_id}\n")
    print(f"PASS: existing Preview {TARGET['preview_name']} verified; latest immutable deployment {deployment_id}")
    return expected_stable, expected_immutable, deployment_id


def _preview_object_from_output(path: Path) -> dict:
    """Read Wrangler's JSONL output and select its single validated Preview record.

    Wrangler 4.151 emits a `wrangler-session` object before the `preview` object.
    Accept the older single-object form too, but reject malformed/unknown records
    and duplicate Preview records rather than guessing which one was deployed.
    """
    records = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("npm notice"):
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            raise PolicyError("Wrangler Preview JSONL output contains an invalid record") from exc
        if not isinstance(record, dict):
            raise PolicyError("Wrangler Preview JSONL output contains a non-object record")
        records.append(record)
    if not records:
        raise PolicyError("Wrangler Preview output has no JSON records")
    previews = [record for record in records if record.get("type") == "preview"]
    if len(previews) != 1 or any(record.get("type") not in {"preview", "wrangler-session"} for record in records):
        raise PolicyError("Wrangler Preview JSONL output must contain one Preview record and known session records only")
    return previews[0]


def parse_deploy_output(path: Path) -> tuple[str, str, str]:
    payload = _preview_object_from_output(path)
    if payload.get("type") != "preview" or payload.get("worker_name") != TARGET["worker_name"] or payload.get("preview_name") != TARGET["preview_name"]:
        raise PolicyError("Wrangler output does not identify the existing private Preview")
    stable_urls = payload.get("preview_urls", [])
    immutable_urls = payload.get("deployment_urls", [])
    deployment_id = payload.get("deployment_id")
    if stable_urls != [TARGET["stable_url"]] or not isinstance(deployment_id, str) or not re.fullmatch(r"[0-9a-f-]{36}", deployment_id):
        raise PolicyError("Wrangler did not return the expected stable URL and deployment identifier")
    immutable = f"https://{deployment_id[:8]}-{TARGET['worker_name']}.sjo1848.workers.dev"
    if immutable_urls != [immutable]:
        raise PolicyError("Wrangler immutable URL does not match the deployment identifier")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as stream:
            stream.write(f"stable_url={stable_urls[0]}\nimmutable_url={immutable}\ndeployment_id={deployment_id}\n")
    print(f"PASS: Wrangler published the existing Preview at deployment {deployment_id}")
    return stable_urls[0], immutable, deployment_id


def verify_preview_secret(config: str, preview_name: str = TARGET["preview_name"]) -> None:
    result = subprocess.run(
        [
            "npx", "--no-install", "wrangler", "preview", "secret", "list",
            "--name", preview_name, "--worker-name", TARGET["worker_name"], "--config", config,
        ],
        cwd=ROOT / "apps/web",
        capture_output=True,
        text=True,
        check=False,
        timeout=45,
    )
    # Wrangler shows secret values masked, but we suppress all raw output regardless.
    if result.returncode or "JWT_SECRET" not in result.stdout:
        raise PolicyError("existing Preview JWT_SECRET is absent or could not be verified")
    print("PASS: JWT_SECRET exists on the existing Preview (value not read)")


def run_captured(command: list[str], cwd: Path, timeout: int = 240) -> subprocess.CompletedProcess:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False, timeout=timeout)
    if result.returncode:
        raise PolicyError(f"command failed ({Path(command[0]).name}, exit {result.returncode}); raw output suppressed")
    return result


def backup_and_rehearse(config: str, backup: Path, persist_to: Path) -> None:
    persist_to.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(persist_to, 0o700)
    backup.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(backup.parent, 0o700)
    export_cmd = ["npx", "--no-install", "wrangler", "d1", "export", "DB", "--remote", "--config", config, "--output", str(backup), "--skip-confirmation"]
    run_captured(export_cmd, WORKER, timeout=240)
    if not backup.is_file() or backup.stat().st_size < 1024:
        raise PolicyError("private D1 backup is missing or unexpectedly small")
    os.chmod(backup, 0o600)
    import_cmd = ["npx", "--no-install", "wrangler", "d1", "execute", "DB", "--local", "--config", config, "--persist-to", str(persist_to), "--file", str(backup)]
    run_captured(import_cmd, WORKER, timeout=240)
    verify_provenance(config, local=True, persist_to=str(persist_to))
    pending = verify_migrations(config, MIGRATIONS, local=True, persist_to=str(persist_to))
    if not pending:
        print(f"PASS: private D1 backup imported and provenance verified; no migration pending; backup bytes={backup.stat().st_size}; mode=0600")
        return
    apply_cmd = ["npx", "--no-install", "wrangler", "d1", "migrations", "apply", "DB", "--local", "--config", config, "--persist-to", str(persist_to)]
    run_captured(apply_cmd, WORKER, timeout=240)
    verify_provenance(config, local=True, persist_to=str(persist_to))
    remaining = verify_migrations(config, MIGRATIONS, local=True, persist_to=str(persist_to))
    if remaining:
        raise PolicyError("approved local migration rehearsal left migrations pending")
    print(f"PASS: private D1 snapshot imported; migration rehearsal succeeded; backup bytes={backup.stat().st_size}; mode=0600")


def apply_remote(config: str) -> None:
    pending = verify_migrations(config, MIGRATIONS, local=False)
    if not pending:
        print("PASS: no remote migration pending")
        return
    # Wrangler applies each migration atomically and captures its provider backup in CI.
    command = ["npx", "--no-install", "wrangler", "d1", "migrations", "apply", "DB", "--remote", "--config", config]
    run_captured(command, WORKER, timeout=240)
    if verify_migrations(config, MIGRATIONS, local=False):
        raise PolicyError("remote migration verification found unapplied migrations")
    verify_provenance(config)
    print("PASS: approved migration applied to the pinned synthetic Preview D1")


def verify_latest_main(current_sha: str) -> None:
    result = subprocess.run(["git", "ls-remote", "origin", "refs/heads/main"], cwd=ROOT, capture_output=True, text=True, check=False, timeout=30)
    if result.returncode:
        raise PolicyError("could not verify latest protected main; release aborted")
    latest = result.stdout.split()[0] if result.stdout.split() else ""
    if not re.fullmatch(r"[0-9a-f]{40}", current_sha) or latest != current_sha:
        raise PolicyError("release SHA is not the current protected main HEAD")
    print("PASS: workflow SHA is the latest main HEAD")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest="command", required=True)
    gate = subs.add_parser("gate")
    gate.add_argument("--event", required=True)
    gate.add_argument("--ref", required=True)
    gate.add_argument("--enabled", default="")
    gate.add_argument("--provenance", default="")
    gate.add_argument("--plan-status", default="")
    gate.add_argument("--access-status", default="")
    gate.add_argument("--token-present", action="store_true")
    target = subs.add_parser("target")
    target.add_argument("--preview", type=Path, default=WORKER / "wrangler.preview-ci.jsonc")
    target.add_argument("--migrations", type=Path, default=WORKER / "wrangler.preview-migrations-ci.jsonc")
    target.add_argument("--generated", type=Path)
    data = subs.add_parser("provenance")
    data.add_argument("--config", default="wrangler.preview-migrations-ci.jsonc")
    data.add_argument("--local", action="store_true")
    data.add_argument("--persist-to")
    migration = subs.add_parser("migrations")
    migration.add_argument("--config", default="wrangler.preview-migrations-ci.jsonc")
    migration.add_argument("--local", action="store_true")
    migration.add_argument("--persist-to")
    smoke = subs.add_parser("smoke")
    smoke.add_argument("urls", nargs="+")
    backup = subs.add_parser("rehearse")
    backup.add_argument("--config", default="wrangler.preview-migrations-ci.jsonc")
    backup.add_argument("--backup", type=Path, required=True)
    backup.add_argument("--persist-to", type=Path, required=True)
    remote = subs.add_parser("apply-remote")
    remote.add_argument("--config", default="wrangler.preview-migrations-ci.jsonc")
    latest = subs.add_parser("latest-main")
    latest.add_argument("--sha", required=True)
    subs.add_parser("current-preview")
    deploy_output = subs.add_parser("deploy-output")
    deploy_output.add_argument("--file", type=Path, required=True)
    preview_secret = subs.add_parser("preview-secret")
    preview_secret.add_argument("--config", default="dist/alquileres_uspa_lab/wrangler.json")

    args = parser.parse_args()
    try:
        if args.command == "gate":
            should_run, reason = decision(args.event, args.ref, args.enabled, args.provenance, args.plan_status, args.access_status, args.token_present)
            output = os.environ.get("GITHUB_OUTPUT")
            if output:
                with open(output, "a", encoding="utf-8") as stream:
                    stream.write(f"deploy={'true' if should_run else 'false'}\nreason={reason}\n")
            summary = os.environ.get("GITHUB_STEP_SUMMARY")
            if summary:
                with open(summary, "a", encoding="utf-8") as stream:
                    stream.write(f"## Private Preview CD gate\n\n{'Enabled' if should_run else 'No remote mutation'}: {reason}.\n")
            print(("PASS: " if should_run else "SAFE SKIP: ") + reason)
        elif args.command == "target":
            verify_target(args.preview, args.migrations, args.generated)
        elif args.command == "provenance":
            verify_provenance(args.config, args.local, args.persist_to)
        elif args.command == "migrations":
            verify_migrations(args.config, MIGRATIONS, args.local, args.persist_to)
        elif args.command == "smoke":
            verify_anonymous(args.urls)
        elif args.command == "rehearse":
            backup_and_rehearse(args.config, args.backup, args.persist_to)
        elif args.command == "apply-remote":
            apply_remote(args.config)
        elif args.command == "latest-main":
            verify_latest_main(args.sha)
        elif args.command == "current-preview":
            current_preview()
        elif args.command == "deploy-output":
            parse_deploy_output(args.file)
        elif args.command == "preview-secret":
            verify_preview_secret(args.config)
    except (PolicyError, OSError, subprocess.SubprocessError) as exc:
        print(f"FAIL CLOSED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
