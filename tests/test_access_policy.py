"""Generator-side checks for the runtime access policy.

The allowlist is no longer build-time data: it lives in Worker / Pages
environment variables, so the only thing to assert here is that the generator
never bakes a policy in and that both backends read the documented env names.
Behavioural coverage lives in tests/backend-contract.test.mjs, which drives the
generated handlers with real HTTP requests.
"""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

POLICY_ENV_NAMES = (
    'REFERER_ENABLED',
    'REFERER_ALLOW_MISSING',
    'REFERER_ALLOW_SAME_ORIGIN',
    'REFERER_ALLOWED_HOSTS',
    'CORS_ALLOW_SAME_ORIGIN',
    'CORS_ALLOWED_ORIGINS',
    'PROTECT_ASSET_IMAGES',
)


class RuntimePolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix='srp-env-policy-')
        directory = Path(cls.temporary.name)
        for category in ('h', 'v', 'a', 'gif', 'custom', 'empty'):
            (directory / 'oriImg' / category).mkdir(parents=True)
            if category != 'empty':
                (directory / 'oriImg' / category / 'source.gif').write_bytes(bytes.fromhex('47494638396101000100'))
        result = subprocess.run(
            [sys.executable, str(ROOT / 'gen_img.py'), '--hash-length', '1', '--no-copy'],
            cwd=directory, capture_output=True, text=True,
        )
        cls.assert_generated = result
        cls.directory = directory

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def test_generation_succeeds_without_any_policy_file(self):
        self.assertEqual(self.assert_generated.returncode, 0, self.assert_generated.stderr)
        self.assertFalse((self.directory / 'access-policy.json').exists())

    def test_backends_read_every_documented_env_name(self):
        for name in ('index.js', 'functions/pic.js'):
            source = (self.directory / name).read_text(encoding='utf-8')
            for env_name in POLICY_ENV_NAMES:
                self.assertIn(env_name, source, f'{name} misses {env_name}')

    def test_no_allowlist_is_embedded(self):
        for name in ('index.js', 'functions/pic.js'):
            source = (self.directory / name).read_text(encoding='utf-8')
            self.assertNotIn('ACCESS_POLICY', source)
            self.assertNotIn('allowedHosts: [', source)
            self.assertNotIn('allowedOrigins: [', source)
            self.assertNotIn('srprolin', source)

    def test_pages_handler_reads_context_env(self):
        source = (self.directory / 'functions' / 'pic.js').read_text(encoding='utf-8')
        self.assertIn('handleRequest(context.request, context.env)', source)

    def test_worker_handler_reads_env_binding(self):
        source = (self.directory / 'index.js').read_text(encoding='utf-8')
        self.assertIn('async fetch(request, env)', source)
        self.assertIn('resolvePolicy(env)', source)

    def test_checked_in_entry_points_match_generator(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location('gen_img', ROOT / 'gen_img.py')
        gen = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = gen
        spec.loader.exec_module(gen)
        metadata = json.loads((ROOT / 'public/counts.json').read_text(encoding='utf-8'))
        pages, worker = gen.WorkerGenerator(gen.Config()).generate_worker_code(metadata)
        self.assertEqual((ROOT / 'functions/pic.js').read_text(encoding='utf-8'), pages)
        self.assertEqual((ROOT / 'index.js').read_text(encoding='utf-8'), worker)

    def test_cli_no_longer_accepts_a_policy_file(self):
        result = subprocess.run(
            [sys.executable, str(ROOT / 'gen_img.py'), '--access-policy', 'x.json'],
            cwd=self.directory, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn('unrecognized arguments', result.stderr)


if __name__ == '__main__':
    unittest.main()
