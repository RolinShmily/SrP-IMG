"""Configuration/build checks; all generator output stays in temporary directories."""

import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('gen_img', ROOT / 'gen_img.py')
gen = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = gen
spec.loader.exec_module(gen)


class AccessPolicyTests(unittest.TestCase):
    def test_checked_in_defaults_and_cli(self):
        expected = gen.default_access_policy()
        self.assertEqual(gen.load_access_policy(ROOT / 'access-policy.json'), expected)
        self.assertEqual(gen.Config.from_args(['--access-policy', str(ROOT / 'access-policy.json')]).access_policy, expected)

    def test_checked_in_backends_match_generator(self):
        config = gen.Config(access_policy=gen.load_access_policy(ROOT / 'access-policy.json'))
        metadata = json.loads((ROOT / 'public/counts.json').read_text(encoding='utf-8'))
        pages, worker = gen.WorkerGenerator(config).generate_worker_code(metadata)
        self.assertEqual((ROOT / 'functions/pic.js').read_text(encoding='utf-8'), pages)
        self.assertEqual((ROOT / 'index.js').read_text(encoding='utf-8'), worker)

    def test_normalization_and_separate_lists(self):
        policy = gen.default_access_policy()
        policy['referer']['allowedHosts'] = ['EXAMPLE.com', '*.Trusted.Example', '0:0:0:0:0:0:0:1']
        policy['cors']['allowedOrigins'] = ['https://CLIENT.example:443', 'http://localhost:4321', 'http://[::1]:80']
        actual = gen.validate_access_policy(policy)
        self.assertEqual(actual['referer']['allowedHosts'], ['example.com', '*.trusted.example', '::1'])
        self.assertEqual(actual['cors']['allowedOrigins'], ['https://client.example', 'http://localhost:4321', 'http://[::1]'])
        self.assertEqual(policy['referer']['allowedHosts'][0], 'EXAMPLE.com')

    def test_rejects_invalid_policy(self):
        invalid = []
        for key, value in [('version', True), ('version', 2), ('protectAssetImages', 'false'), ('typo', True)]:
            policy = gen.default_access_policy()
            policy[key] = value
            invalid.append(policy)
        for name in ('enabled', 'allowMissing', 'allowSameOrigin'):
            policy = gen.default_access_policy()
            policy['referer'][name] = 1
            invalid.append(policy)
        for host in ['*', 'https://example.com', 'example.com:443', '*example.com', '*.127.0.0.1',
                     'example.com.evil/', 'example..com', 'example.com.', '', None, ' example.com']:
            policy = gen.default_access_policy()
            policy['referer']['allowedHosts'] = [host]
            invalid.append(policy)
        for origin in ['null', '*', 'https://*.example.com', 'https://example.com/',
                       'https://example.com/path', 'https://example.com?', 'https://example.com#',
                       'https://user@example.com', 'https://example.com:65536', 'ftp://example.com',
                       'https://example.com\\@evil.test', 'https://example.com:',
                       'https://clie\tnt.example', None, ' https://example.com']:
            policy = gen.default_access_policy()
            policy['cors']['allowedOrigins'] = [origin]
            invalid.append(policy)
        for policy in invalid + [None, [], {'version': 1}]:
            with self.subTest(policy=policy):
                with self.assertRaises(ValueError):
                    gen.validate_access_policy(policy)

    def test_cli_errors_before_touching_output(self):
        with tempfile.TemporaryDirectory(prefix='srp-policy-python-') as temporary:
            directory = Path(temporary)
            for name, content in [('bad.json', '{broken'), ('invalid.json', '{"version":2}')]:
                (directory / name).write_text(content, encoding='utf-8')
            for name in ('bad.json', 'invalid.json', 'missing.json'):
                result = subprocess.run(
                    [sys.executable, str(ROOT / 'gen_img.py'), '--access-policy', name],
                    cwd=directory, capture_output=True, text=True,
                )
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn('cannot load access policy', result.stderr)
                self.assertFalse((directory / 'public').exists())
            # Missing implicit configuration deliberately uses portable defaults.
            result = subprocess.run([sys.executable, str(ROOT / 'gen_img.py')], cwd=directory, capture_output=True)
            self.assertEqual(result.returncode, 0)

    def test_generator_embeds_validated_config_and_json_data(self):
        policy = gen.default_access_policy()
        policy['referer']['allowedHosts'] = ['*.example.com']
        worker = gen.WorkerGenerator(gen.Config(access_policy=copy.deepcopy(policy)))
        pages, assets = worker.generate_worker_code({'counts': {"custom'category": 16}})
        for code in (pages, assets):
            self.assertIn('const ACCESS_POLICY = ' + json.dumps(policy, ensure_ascii=True, indent=2), code)
            self.assertIn("custom'category", code)
            self.assertIn('const TARGETS = JSON.parse(', code)
            self.assertNotIn('srprolin', code)
        self.assertIn('assets.run_worker_first = true', assets)


if __name__ == '__main__':
    unittest.main()
