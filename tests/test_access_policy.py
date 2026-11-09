"""Checks for the runtime access policy and the generated Worker data module.

The allowlist is runtime configuration: it lives in the Worker environment,
so these tests assert that the hand-written runtime never bakes a policy in,
that the entry reads the documented env names, and that
``worker/targets.js`` still matches the committed manifest.
Behavioural coverage lives in tests/backend-contract.test.mjs, which drives the
checked-in handlers with real HTTP requests.
"""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pipeline.config import Config  # noqa: E402
from pipeline.worker_targets import render_targets  # noqa: E402

POLICY_ENV_NAMES = (
    'REFERER_ENABLED',
    'REFERER_ALLOW_MISSING',
    'REFERER_ALLOW_SAME_ORIGIN',
    'REFERER_ALLOWED_HOSTS',
    'CORS_ALLOW_SAME_ORIGIN',
    'CORS_ALLOWED_ORIGINS',
    'PROTECT_ASSET_IMAGES',
)

RUNTIME_SOURCES = (
    'worker/index.js',
    'worker/policy.js',
    'worker/targets.js',
)


def run_pipeline(cwd: Path, *args: str):
    """Run ``python -m pipeline`` with the repository importable from any cwd."""
    env = dict(os.environ)
    env['PYTHONPATH'] = str(ROOT)
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    return subprocess.run(
        [sys.executable, '-m', 'pipeline', *args],
        cwd=cwd, env=env, capture_output=True, text=True, encoding='utf-8',
    )


class RuntimePolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix='srp-env-policy-')
        directory = Path(cls.temporary.name)
        for category in ('h', 'v', 'a', 'gif', 'custom', 'empty'):
            (directory / 'assets' / 'original' / category).mkdir(parents=True)
            if category != 'empty':
                (directory / 'assets' / 'original' / category / 'source.gif').write_bytes(bytes.fromhex('47494638396101000100'))
        cls.assert_generated = run_pipeline(directory, '--hash-length', '1', '--no-copy')
        cls.directory = directory

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def test_generation_succeeds_without_any_policy_file(self):
        self.assertEqual(self.assert_generated.returncode, 0, self.assert_generated.stderr)
        self.assertFalse((self.directory / 'access-policy.json').exists())
        targets = (self.directory / 'worker' / 'targets.js').read_text(encoding='utf-8')
        self.assertIn('export const TARGETS = JSON.parse(', targets)
        self.assertNotIn('function ', targets)

    def test_backends_read_every_documented_env_name(self):
        policy = (ROOT / 'worker' / 'policy.js').read_text(encoding='utf-8')
        for env_name in POLICY_ENV_NAMES:
            self.assertIn(env_name, policy, f'worker/policy.js misses {env_name}')
        # The entry must route requests through that shared policy engine.
        source = (ROOT / 'worker' / 'index.js').read_text(encoding='utf-8')
        self.assertIn('./policy.js', source, 'worker/index.js')

    def test_no_allowlist_is_embedded(self):
        for name in RUNTIME_SOURCES:
            source = (ROOT / name).read_text(encoding='utf-8')
            self.assertNotIn('ACCESS_POLICY', source)
            self.assertNotIn('allowedHosts: [', source)
            self.assertNotIn('allowedOrigins: [', source)
            self.assertNotIn('srprolin', source)

    def test_worker_handler_reads_env_binding(self):
        source = (ROOT / 'worker' / 'index.js').read_text(encoding='utf-8')
        self.assertIn('async fetch(request, env)', source)
        self.assertIn('resolvePolicy(env)', source)

    def test_targets_module_matches_the_manifest(self):
        metadata = json.loads((ROOT / 'assets/generated/counts.json').read_text(encoding='utf-8'))
        expected = render_targets(Config(), metadata)
        self.assertEqual((ROOT / 'worker' / 'targets.js').read_text(encoding='utf-8'), expected)

    def test_metadata_reserves_slot_geometry(self):
        """The gallery reserves each tile from these ratios; a gap would reintroduce reflow."""
        meta = json.loads((self.directory / 'assets' / 'generated' / 'counts.json').read_text(encoding='utf-8'))
        self.assertIn('slot_ratios', meta)
        for key, slots in meta['counts'].items():
            ratios = meta['slot_ratios'][key]
            self.assertEqual(len(ratios), slots, key)
            for ratio in ratios:
                self.assertIsInstance(ratio, (int, float))
                self.assertGreater(ratio, 0, key)

    def test_cli_no_longer_accepts_a_policy_file(self):
        result = run_pipeline(self.directory, '--access-policy', 'x.json')
        self.assertEqual(result.returncode, 2)
        self.assertIn('unrecognized arguments', result.stderr)


if __name__ == '__main__':
    unittest.main()
