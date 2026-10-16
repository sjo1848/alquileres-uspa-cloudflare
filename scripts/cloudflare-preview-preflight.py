#!/usr/bin/env python3
"""Read-only account/Access preflight. Never provisions or deploys anything."""
import json, os, stat, sys, tomllib, urllib.error, urllib.request
from pathlib import Path
account = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '30e8fad45f7bc1cd5bddad87e18b1aec')
token = os.environ.get('CLOUDFLARE_ACCESS_API_TOKEN') or os.environ.get('CLOUDFLARE_API_TOKEN')
token_source = 'environment' if token else None
if not token:
    credential = Path.home() / '.config/alquileres-uspa-cloudflare/api-token'
    if credential.exists():
        metadata = credential.lstat()
        if stat.S_ISLNK(metadata.st_mode) or metadata.st_uid != os.getuid() or metadata.st_mode & 0o077:
            raise SystemExit('Cloudflare credential file must be owned by the current user, not a symlink, and mode 600.')
        token = credential.read_text().strip()
        token_source = 'local_protected_file' if token else None
if not token:
    config = Path.home() / '.config/.wrangler/config/default.toml'
    if config.exists():
        token = tomllib.loads(config.read_text()).get('oauth_token')
        token_source = 'wrangler_oauth' if token else None
if not token:
    raise SystemExit('No Cloudflare credential is available. Set a scoped token locally; do not paste it in chat.')
report = {'credential_source': token_source, 'account_id': account, 'mutations': False, 'checks': {}}
for endpoint in ('subscriptions', 'access/organizations', 'access/apps'):
    request = urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{account}/{endpoint}', headers={'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.load(response)
        result = data.get('result')
        if not data.get('success'):
            report['checks'][endpoint] = {'status': 'FAILED', 'errors': data.get('errors')}
            continue
        if endpoint == 'subscriptions':
            result = [{'plan': x.get('rate_plan', {}).get('public_name'), 'plan_id': x.get('rate_plan', {}).get('id'), 'price': x.get('price'), 'state': x.get('state')} for x in result or []]
        elif endpoint == 'access/organizations':
            result = {'auth_domain': (result or {}).get('auth_domain')}
        else:
            result = [{'name': x.get('name'), 'domain': x.get('domain'), 'type': x.get('type')} for x in result or []]
        report['checks'][endpoint] = {'status': 'READ', 'result': result}
    except urllib.error.HTTPError as error:
        report['checks'][endpoint] = {'status': 'DENIED', 'http_status': error.code}
    except (urllib.error.URLError, TimeoutError):
        report['checks'][endpoint] = {'status': 'NETWORK_FAILURE'}
blocked = any(x['status'] != 'READ' for x in report['checks'].values())
report['status'] = 'BLOCKED_PERMISSIONS_OR_CONNECTIVITY' if blocked else 'INSPECT_FREE_PLAN_AND_TARGET_ACCESS_POLICY_BEFORE_PROVISIONING'
print(json.dumps(report, indent=2))
sys.exit(1 if blocked else 0)
