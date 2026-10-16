"""Regression tests for the GitHub probe/credential findings. Never contacts Cloudflare."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import runpy
import shutil
import tempfile
import unittest
from email.message import Message
from unittest.mock import Mock, patch
import urllib.error

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('probe', ROOT / 'scripts/preview-login-probe.py')
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

def response(status=200, body=b'{}', cookie=True):
    result = io.BytesIO(body)
    result.status = status
    result.headers = Message()
    if cookie and status == 200:
        result.headers['Set-Cookie'] = 'alquileres_session=synthetic; HttpOnly'
    return result

class ProbeTests(unittest.TestCase):
    def execute(self, results):
        with tempfile.TemporaryDirectory() as tmp:
            credential = Path(tmp) / 'credential.json'
            credential.write_text(json.dumps({'client_id':'fake', 'client_secret':'fake'}))
            credential.chmod(0o600)
            output = Path(tmp) / 'report.json'
            opener = Mock()
            opener.open.side_effect = results
            with patch('sys.argv', ['probe', '--access-credential-file', str(credential), '--output', str(output)]), patch.object(probe.urllib.request, 'build_opener', return_value=opener), patch.object(probe.time, 'sleep'), contextlib.redirect_stdout(io.StringIO()):
                try:
                    probe.main()
                    status = 0
                except SystemExit as error:
                    status = error.code
            return status, json.loads(output.read_text())

    def test_complete_sequence_passes(self):
        status, report = self.execute([response(body=b'{"ok":true}'), response(), response(401), response()])
        self.assertEqual(status, 0)
        self.assertTrue(report['http_expectations_passed'])

    def test_valid_password_rejection_fails(self):
        status, report = self.execute([response(body=b'{"ok":true}'), response(401)])
        self.assertEqual(status, 1)
        self.assertFalse(report['http_expectations_passed'])

    def test_valid_login_without_session_cookie_fails(self):
        status, report = self.execute([response(body=b'{"ok":true}'), response(cookie=False), response(401), response()])
        self.assertEqual(status, 1)
        self.assertFalse(report['http_expectations_passed'])

    def test_invalid_password_acceptance_fails(self):
        status, _ = self.execute([response(body=b'{"ok":true}'), response(), response()])
        self.assertEqual(status, 1)

    def test_final_network_failure_cannot_pass_complete_count(self):
        status, report = self.execute([response(body=b'{"ok":true}'), response(), response(401), urllib.error.URLError('synthetic')])
        self.assertEqual(status, 1)
        self.assertFalse(report['http_expectations_passed'])

    def test_health_failure_replaces_stale_success(self):
        status, report = self.execute([response(403), response(403), response(403)])
        self.assertEqual(status, 1)
        self.assertFalse(report['health_ready'])
        self.assertEqual(report['checks'], [])

    def test_runner_preserves_preexisting_credential(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'scripts').mkdir()
            (root / '.orchestration/evidence').mkdir(parents=True)
            runner = root / 'scripts/preview-login-probe-runner.py'
            shutil.copy(ROOT / 'scripts/preview-login-probe-runner.py', runner)
            config = root / '.config/alquileres-uspa-cloudflare'
            config.mkdir(parents=True)
            (config / 'api-token').write_text('fake-only')
            credential = config / 'access-probe.json'
            credential.write_text('must survive')
            policies = [{'id':'operator','decision':'allow'}]
            results = [response(body=json.dumps({'result':{'destinations':[{'type':'preview_worker','worker_id':'c71023df4bfa4518baeb12dfa3c67826'}]}}).encode()), response(body=json.dumps({'result':policies}).encode()), response(body=b'{"result":{"id":"temporary","client_id":"fake","client_secret":"fake"}}'), response(body=b'{"result":null,"success":true}'), response(body=json.dumps({'result':policies}).encode())]
            with patch.object(Path, 'home', return_value=root), patch('urllib.request.urlopen', side_effect=results), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit) as failure:
                    runpy.run_path(str(runner))
                self.assertEqual(failure.exception.code, 1)
            self.assertEqual(credential.read_text(), 'must survive')
            report = json.loads((root / '.orchestration/evidence/CF-AU-OWNER-TEMPORARY-ACCESS.json').read_text())
            self.assertTrue(report['cleanup']['service_token_revoked'])
            self.assertTrue(report['cleanup']['original_policies_unchanged'])
            self.assertFalse(report['probe_ran'])

if __name__ == '__main__':
    unittest.main()
