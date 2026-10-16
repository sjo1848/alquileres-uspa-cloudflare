#!/usr/bin/env python3
"""Bounded synthetic login probe. Requires separately authorized temporary Access identity."""
import argparse
import json
import os
from pathlib import Path
import re
import stat
import time
import urllib.error
import urllib.request

PREVIEW = 'https://private-alquileres-uspa-lab.sjo1848.workers.dev'

def finish(output, checks, health_ready=True):
    passed = health_ready and len(checks) == 3 and all(
        x.get('status') in (200, 401) and x.get('status') == x.get('expected_status') and not x.get('provider_resource_limit_error')
        for x in checks)
    report = {'url': PREVIEW, 'synthetic_only': True, 'checks': checks,
        'health_ready': health_ready, 'http_expectations_passed': passed, 'cpu_telemetry_measured': False,
        'limitation': 'Elapsed time is wall time. Successful responses alone do not establish CPU <=10ms or reliable Free compatibility.'}
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return passed

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args):
        return None

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--access-credential-file', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    credential = args.access_credential_file
    metadata = credential.lstat()
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != os.getuid() or metadata.st_mode & 0o077:
        raise SystemExit('Access credential must be an owned regular private file (600).')
    access = json.loads(credential.read_text())
    opener = urllib.request.build_opener(NoRedirect())
    access_headers = {'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json',
        'CF-Access-Client-Id': access['client_id'], 'CF-Access-Client-Secret': access['client_secret']}
    # Wait briefly for the new policy to propagate before spending CPU on login.
    for attempt in range(3):
        try:
            with opener.open(urllib.request.Request(PREVIEW + '/api/health', headers=access_headers), timeout=25) as health:
                if health.status == 200 and json.load(health) == {'ok': True}:
                    break
        except (urllib.error.HTTPError, urllib.error.URLError, ValueError):
            pass
        if attempt == 2:
            finish(args.output, [], health_ready=False)
            raise SystemExit(1)
        time.sleep(2)
    checks = []
    for password, expected in [('synthetic-owner-password-1', 200), ('incorrect-password', 401), ('synthetic-owner-password-1', 200)]:
        request = urllib.request.Request(PREVIEW + '/api/auth/login', method='POST',
            headers={**access_headers, 'Origin': PREVIEW, 'Content-Type': 'application/json'},
            data=json.dumps({'email': 'preview.owner@example.test', 'password': password}).encode())
        started = time.monotonic()
        try:
            response = opener.open(request, timeout=25)
        except urllib.error.HTTPError as error:
            response = error
        except urllib.error.URLError as error:
            checks.append({'network_error': type(error.reason).__name__})
            break
        with response:
            body = response.read(65536).decode(errors='replace')
            cpu_failure = bool(re.search(r'(?:error\s*(?:code\s*)?1102|exceeded (?:CPU time|resource) limits)', body, re.I))
            checks.append({'status': response.status, 'expected_status': expected,
                'elapsed_wall_ms': round((time.monotonic() - started) * 1000, 2),
                'provider_resource_limit_error': cpu_failure,
                'session_cookie_present': any(value.startswith('alquileres_session=') for value in response.headers.get_all('Set-Cookie', [])),
                'same_origin_rejected': 'same-origin request required' in body,
                'cf_ray': response.headers.get('CF-Ray')})
        # No response body, password, session cookie or Access credential is written to evidence.
        if cpu_failure or response.status != expected:
            break
    if not finish(args.output, checks):
        raise SystemExit(1)

if __name__ == '__main__':
    main()
