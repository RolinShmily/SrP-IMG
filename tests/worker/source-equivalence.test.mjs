// Differential HTTP matrix: the hand-written runtime must answer exactly like
// the generated entry point it replaced.
//
// The "before" side is `git show HEAD:index.js` — the self-contained file that
// `pipeline/worker_codegen.py` used to emit. The "after" side is the checked-in
// `worker/index.js`. Both are driven with the same requests, env objects and
// ASSETS stub; only the Location value of a 302 is compared by shape, because
// the slot is random by design.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, before, test } from 'node:test';
import { SLOT_FORMATS } from '../../worker/slot_formats.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SELF = 'https://img.example.com';
const directories = [];
let legacy = null;
let modern = null;

const TARGETS = {
  a: { slots: 256, ext: '.jpeg' },
  gif: { slots: 256, ext: '.gif' },
  h: { slots: 256, ext: '.jpg' },
  v: { slots: 256, ext: '.jpg' },
};

// Real slot format codes, as emitted by `python -m pipeline`.
const SLOT_MIME = { j: 'image/jpeg', p: 'image/png', g: 'image/gif', w: 'image/webp' };
const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.json': 'application/json',
};

const ASSETS = {
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (pathname.endsWith('/missing.jpg')) return new Response('missing', { status: 404 });
    const body = pathname === '/counts.json' ? '{"counts":{"h":16}}' : 'fixture asset';
    // A real asset binding derives Content-Type from the file suffix, which is
    // exactly the (sometimes wrong) header the Worker corrects.
    const extension = pathname.slice(pathname.lastIndexOf('.')).toLowerCase();
    return new Response(request.method === 'HEAD' ? null : body, {
      headers: {
        Vary: 'Accept-Encoding',
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': MIME_BY_EXT[extension] || 'text/plain',
      },
    });
  },
};

const TRUSTED = {
  REFERER_ALLOWED_HOSTS: 'example.com, *.trusted.example',
  CORS_ALLOWED_ORIGINS: 'https://client.example,http://localhost:4321',
};

const ENVS = [
  ['defaults', {}],
  ['trusted', TRUSTED],
  ['referer-off', { ...TRUSTED, REFERER_ENABLED: '0' }],
  ['missing-referer-denied', { ...TRUSTED, REFERER_ALLOW_MISSING: '0', REFERER_ALLOW_SAME_ORIGIN: 'false' }],
  ['assets-unprotected', { ...TRUSTED, PROTECT_ASSET_IMAGES: '0' }],
  ['invalid-boolean', { REFERER_ENABLED: 'maybe' }],
  ['invalid-host', { REFERER_ALLOWED_HOSTS: 'https://example.com' }],
  ['invalid-wildcard-ip', { REFERER_ALLOWED_HOSTS: '*.127.0.0.1' }],
  ['invalid-origin', { CORS_ALLOWED_ORIGINS: 'null' }],
  ['invalid-origin-wildcard', { CORS_ALLOWED_ORIGINS: 'https://*.example.com' }],
];

const PATHS = [
  '/pic?img=h',
  '/pic?img=v',
  '/pic?img=a',
  '/pic?img=gif',
  '/pic?img=bogus',
  '/h/00.jpg',
  // 01 is a WebP payload under the .jpeg suffix; 00 happens to match.
  '/a/01.jpeg',
  '/a/ff.jpeg',
  '/gif/00.gif',
  '/h/%30%30.jpg',
  '/h/missing.jpg',
  '/counts.json',
  '/',
  '/nope',
];

const HEADER_VARIANTS = [
  ['none', () => ({})],
  ['same-origin-referer', () => ({ Referer: SELF + '/gallery/' })],
  ['allowed-referer', () => ({ Referer: 'https://example.com/page' })],
  ['wildcard-referer', () => ({ Referer: 'https://a.b.trusted.example/' })],
  ['blocked-referer', () => ({ Referer: 'https://outside.example/page' })],
  ['invalid-referer', () => ({ Referer: 'not a URL' })],
  ['same-origin', () => ({ Origin: SELF })],
  ['cross-allowed-origin', () => ({ Origin: 'https://client.example' })],
  ['cross-blocked-origin', () => ({ Origin: 'https://outside.example' })],
  ['invalid-origin', () => ({ Origin: 'https://user@client.example' })],
];

const METHOD_CASES = [
  ['HEAD', '/pic?img=h', {}],
  ['HEAD', '/h/00.jpg', { Origin: 'https://client.example' }],
  ['POST', '/pic?img=h', {}],
  ['OPTIONS', '/pic?img=h', { Origin: 'https://client.example' }],
  ['OPTIONS', '/pic?img=h', { Origin: 'https://client.example', 'Access-Control-Request-Method': 'GET' }],
  ['OPTIONS', '/pic?img=h', { Origin: 'https://client.example', 'Access-Control-Request-Method': 'HEAD' }],
  ['OPTIONS', '/pic?img=h', { Origin: 'https://client.example', 'Access-Control-Request-Method': 'POST' }],
  ['OPTIONS', '/pic?img=h', { Origin: 'https://client.example', 'Access-Control-Request-Headers': 'X-Request-ID, Content-Type' }],
  ['OPTIONS', '/pic?img=h', { Origin: 'https://client.example', 'Access-Control-Request-Headers': 'invalid header' }],
  ['OPTIONS', '/pic?img=h', { Origin: 'https://outside.example' }],
  ['OPTIONS', '/h/00.jpg', { Origin: 'https://client.example' }],
];

const UA_CASES = [
  ['mobile-ui', 'Mozilla Android'],
  ['desktop-ui', 'desktop browser'],
];

before(async () => {
  // The comparison only makes sense while the generated entry point is still
  // reachable from HEAD; once P2 is merged this test turns into a no-op.
  const shown = spawnSync('git', ['show', 'HEAD:index.js'], { cwd: root, encoding: 'utf8' });
  if (shown.status === 0) {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'srp-legacy-index-'));
    directories.push(directory);
    const file = path.join(directory, 'legacy-index.mjs');
    await writeFile(file, shown.stdout);
    legacy = await import(pathToFileURL(file).href);
  }
  modern = await import(pathToFileURL(path.join(root, 'worker', 'index.js')).href);
});

after(async () => {
  await Promise.all(directories.map(directory => rm(directory, { recursive: true, force: true })));
});

async function call(impl, { pathname, method = 'GET', headers = {}, env = {} }) {
  const request = new Request(SELF + pathname, { method, headers });
  return impl.default.fetch(request, { ...env, ASSETS });
}

async function snapshot(response) {
  const headers = [...response.headers.entries()]
    .map(([name, value]) => [name.toLowerCase(), value])
    .filter(([name]) => name !== 'location')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    status: response.status,
    headers,
    body: await response.text(),
    location: response.headers.get('location'),
  };
}

function assertLocation(before, after) {
  const shape = location => {
    const match = /^\/(a|gif|h|v)\/([0-9a-f]+)(\.(?:jpe?g|gif))$/.exec(location);
    assert.ok(match, 'unexpected Location: ' + location);
    return { category: match[1], hex: match[2], ext: match[3] };
  };
  const expected = shape(before);
  const actual = shape(after);
  assert.equal(actual.category, expected.category);
  assert.equal(actual.ext, expected.ext);
  assert.equal(actual.hex.length, expected.hex.length);
  const target = TARGETS[actual.category];
  assert.equal(actual.ext, target.ext);
  assert.ok(Number.parseInt(actual.hex, 16) < target.slots, 'slot out of range: ' + after);
}

let checks = 0;
let rewrites = 0;

// Mirrors `parseCategoryImage` + `withSlotContentType`: which header does the
// Worker have to rewrite, and is that rewrite a deliberate difference from the
// legacy bundle (which never touched Content-Type)?
function slotExpectation(pathname) {
  let parts;
  try {
    parts = decodeURIComponent(pathname).split('/');
  } catch {
    return null;
  }
  if (parts.length !== 3 || !Object.prototype.hasOwnProperty.call(TARGETS, parts[1])) return null;
  const match = /^([0-9a-f]+)(\.[^./]+)$/i.exec(parts[2]);
  if (!match) return null;
  const suffixMime = MIME_BY_EXT[match[2].toLowerCase()];
  if (!suffixMime) return null;
  const formats = SLOT_FORMATS[parts[1]];
  const slot = Number.parseInt(match[1], 16);
  if (typeof formats !== 'string' || slot >= formats.length) return null;
  const mime = SLOT_MIME[formats[slot]];
  if (!mime) return null;
  return { mime, suffixMime, deliberate: mime !== suffixMime };
}

function headerValue(headers, name) {
  const entry = headers.find(([key]) => key === name);
  return entry ? entry[1] : null;
}

async function same(caseLabel, spec) {
  const [before, after] = await Promise.all([call(legacy, spec), call(modern, spec)]);
  const [a, b] = await Promise.all([snapshot(before), snapshot(after)]);
  assert.equal(b.status, a.status, caseLabel + ' status');
  const expectation = slotExpectation(spec.pathname);
  // Policy denials and preflights never reach the asset, so their headers are
  // still byte-identical; only a served image can carry the correction.
  const served = b.status === 200 && a.status === 200;
  if (expectation && expectation.deliberate && served) {
    // The single intentional divergence: the fixed bundle describes the real
    // bytes, the legacy bundle repeats the suffix-derived header.
    const withoutContentType = headers => headers.filter(([name]) => name !== 'content-type');
    assert.deepEqual(withoutContentType(b.headers), withoutContentType(a.headers), caseLabel + ' headers');
    assert.equal(headerValue(a.headers, 'content-type'), expectation.suffixMime,
      caseLabel + ' legacy header');
    assert.equal(headerValue(b.headers, 'content-type'), expectation.mime, caseLabel + ' rewritten header');
    rewrites++;
  } else {
    assert.deepEqual(b.headers, a.headers, caseLabel + ' headers');
    if (expectation && served) {
      assert.equal(headerValue(b.headers, 'content-type'), expectation.mime, caseLabel + ' header');
    }
  }
  assert.equal(b.body, a.body, caseLabel + ' body');
  if (a.location === null || b.location === null) {
    assert.equal(b.location, a.location, caseLabel + ' location presence');
  } else {
    assertLocation(a.location, b.location);
  }
  checks++;
}

test('checked-in runtime matches the pre-P2 generated entry point', async t => {
  if (!legacy) return t.skip('HEAD no longer contains the generated index.js');
  const errors = t.mock.method(console, 'error', () => {});

  for (const [envName, env] of ENVS) {
    for (const pathname of PATHS) {
      for (const [headerName, buildHeaders] of HEADER_VARIANTS) {
        await same(`${envName} ${pathname} ${headerName}`, {
          pathname, headers: buildHeaders(), env,
        });
      }
    }
    for (const [method, pathname, headers] of METHOD_CASES) {
      await same(`${envName} ${method} ${pathname}`, { pathname, method, headers, env });
    }
    for (const [uaName, userAgent] of UA_CASES) {
      await same(`${envName} ua ${uaName}`, {
        pathname: '/pic?img=ua', headers: { 'User-Agent': userAgent }, env,
      });
    }
  }

  assert.ok(errors.mock.callCount() >= ENVS.length, 'invalid env must log the reason');
  assert.ok(checks >= 300, `matrix too small: ${checks}`);
  // Every deliberate rewrite path must actually have been exercised.
  assert.ok(rewrites >= ENVS.length * 2, `too few Content-Type rewrites: ${rewrites}`);
});

test('mismatched slots answer with the real format, matched slots keep the suffix header', async () => {
  const defaultCase = { pathname: '/a/01.jpeg', headers: {} };
  assert.equal(SLOT_FORMATS.a[1], 'w', 'fixture assumption: slot 01 of `a` is WebP bytes');
  assert.equal(SLOT_FORMATS.h[0], 'j', 'fixture assumption: slot 00 of `h` is JPEG bytes');

  const protectedResponse = await call(modern, defaultCase);
  assert.equal(protectedResponse.status, 200);
  assert.equal(protectedResponse.headers.get('content-type'), 'image/webp');
  assert.match(protectedResponse.headers.get('cache-control'), /no-store/);

  const matchedResponse = await call(modern, { pathname: '/h/00.jpg', headers: {} });
  assert.equal(matchedResponse.headers.get('content-type'), 'image/jpeg');

  const unprotected = await call(modern, {
    pathname: '/a/01.jpeg', headers: {}, env: { PROTECT_ASSET_IMAGES: '0' },
  });
  assert.equal(unprotected.status, 200);
  assert.equal(unprotected.headers.get('content-type'), 'image/webp');
  // The static-asset cache policy is untouched when protection is off.
  assert.match(unprotected.headers.get('cache-control'), /public/);

  const head = await call(modern, { pathname: '/a/01.jpeg', method: 'HEAD', headers: {} });
  assert.equal(head.headers.get('content-type'), 'image/webp');
  assert.equal(await head.text(), '');
});
