import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directories = [];
const servers = [];
let code = {};
let modules = {};

async function importCode(source) {
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

// The allowlist is runtime configuration now, so every case shares one build
// and differs only in the env object handed to the handler.
before(async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'srp-env-policy-'));
  directories.push(directory);
  for (const category of ['h', 'v', 'a', 'gif', 'custom', 'empty']) {
    const source = path.join(directory, 'oriImg', category);
    await mkdir(source, { recursive: true });
    if (category !== 'empty') {
      await writeFile(path.join(source, 'source.gif'), Buffer.from('47494638396101000100', 'hex'));
    }
  }
  const generated = spawnSync(
    process.env.PYTHON || 'python',
    [path.join(root, 'gen_img.py'), '--hash-length', '1', '--no-copy'],
    { cwd: directory, encoding: 'utf8' },
  );
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  code = {
    worker: await readFile(path.join(directory, 'index.js'), 'utf8'),
    pages: await readFile(path.join(directory, 'functions', 'pic.js'), 'utf8'),
  };
  // No deployment-specific value may be baked into the shipped bundle.
  for (const source of Object.values(code)) {
    assert.equal(source.includes('ACCESS_POLICY'), false);
    assert.equal(source.includes('srprolin'), false);
    assert.ok(source.includes('REFERER_ALLOWED_HOSTS'));
  }
  modules = { worker: await importCode(code.worker), pages: await importCode(code.pages) };
});

after(async () => {
  await Promise.all(servers.map(server => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  })));
  await Promise.all(directories.map(directory => rm(directory, { recursive: true, force: true })));
});

function handlerFor(mode, impl) {
  return mode === 'pages'
    ? request => impl.onRequest({ request, env: request.__env })
    : request => impl.default.fetch(request, request.__env);
}

async function start(mode, env, { failingAssets = false, impl = null } = {}) {
  let assetCalls = 0;
  const bindings = {
    ...env,
    ASSETS: {
      async fetch(request) {
        assetCalls++;
        if (failingAssets) throw new Error('fixture asset failure');
        const pathname = new URL(request.url).pathname;
        if (pathname.endsWith('/missing.jpg')) return new Response('missing', { status: 404 });
        const body = pathname === '/counts.json' ? '{"counts":{"h":16}}' : 'fixture asset';
        return new Response(request.method === 'HEAD' ? null : body, {
          headers: {
            Vary: 'Accept-Encoding',
            'Cache-Control': 'public, max-age=31536000',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Content-Type': pathname === '/counts.json' ? 'application/json' : 'text/plain',
          },
        });
      },
    },
  };
  const handle = handlerFor(mode, impl || modules[mode]);
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      const request = new Request('http://' + incoming.headers.host + incoming.url, {
        method: incoming.method,
        headers: incoming.headers,
      });
      request.__env = bindings;
      const response = await handle(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.writeHead(599);
      outgoing.end(String(error));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const base = 'http://127.0.0.1:' + server.address().port;
  return {
    base,
    request: (pathname = '/pic?img=h', headers = {}, method = 'GET') =>
      fetch(base + pathname, { headers, method, redirect: 'manual' }),
    assetCalls: () => assetCalls,
  };
}

function checkPolicyHeaders(response, origin = null, preflight = false) {
  assert.match(response.headers.get('cache-control'), /no-store/);
  const vary = response.headers.get('vary').toLowerCase().split(',').map(s => s.trim());
  assert.ok(vary.includes('origin'));
  assert.ok(vary.includes('referer'));
  if (preflight) {
    assert.ok(vary.includes('access-control-request-method'));
    assert.ok(vary.includes('access-control-request-headers'));
  }
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
}

const TRUSTED_ENV = {
  REFERER_ALLOWED_HOSTS: 'example.com, *.trusted.example',
  CORS_ALLOWED_ORIGINS: 'https://client.example,http://localhost:4321',
};

for (const mode of ['worker', 'pages']) {
  test(mode + ': unset env keeps the portable defaults', async () => {
    const api = await start(mode, {});
    let response = await api.request();
    assert.equal(response.status, 302);
    assert.match(response.headers.get('location'), /^\/h\/[0-9a-f]+\.jpg$/);
    checkPolicyHeaders(response);
    response = await api.request('/pic?img=h', { Origin: api.base, Referer: api.base + '/gallery/' });
    assert.equal(response.status, 302);
    checkPolicyHeaders(response, api.base);
    for (const headers of [{ Origin: 'https://outside.example' }, { Referer: 'https://outside.example/page' }]) {
      response = await api.request('/pic?img=h', headers);
      assert.equal(response.status, 404);
      checkPolicyHeaders(response);
    }
  });

  test(mode + ': env lists accept commas, whitespace, wildcards and mixed case', async () => {
    const api = await start(mode, {
      REFERER_ALLOWED_HOSTS: 'Example.COM,\n  *.Trusted.Example   example.com ',
      CORS_ALLOWED_ORIGINS: 'https://Client.Example , http://localhost:4321',
    });
    for (const referer of ['https://example.com/page', 'http://example.com:8080/page', 'https://a.trusted.example/', 'https://a.b.trusted.example/']) {
      assert.equal((await api.request('/pic?img=h', { Referer: referer })).status, 302, referer);
    }
    for (const referer of ['https://sub.example.com/', 'https://trusted.example/', 'https://eviltrusted.example/', 'https://example.com.evil.test/', 'https://example.com@evil.test/', 'https:example.com', 'not a URL', 'ftp://example.com/', 'null']) {
      const response = await api.request('/pic?img=h', { Referer: referer, Origin: 'https://client.example' });
      assert.equal(response.status, 404, referer);
      checkPolicyHeaders(response, 'https://client.example');
    }
    for (const origin of ['https://client.example', 'http://localhost:4321']) {
      const response = await api.request('/pic?img=h', { Origin: origin });
      assert.equal(response.status, 302);
      checkPolicyHeaders(response, origin);
    }
    for (const origin of ['https://client.example.evil.test', 'https://client.example/', 'https://user@client.example', 'https://client.example:444', 'http://client.example']) {
      assert.equal((await api.request('/pic?img=h', { Origin: origin })).status, 404, origin);
    }
    // CORS membership alone does not grant embedding via Referer.
    assert.equal((await api.request('/pic?img=h', { Origin: 'https://client.example', Referer: 'https://client.example/page' })).status, 404);
  });

  test(mode + ': booleans switch behaviour and accept 1/0 and true/false', async () => {
    const strict = await start(mode, { ...TRUSTED_ENV, REFERER_ALLOW_MISSING: '0', REFERER_ALLOW_SAME_ORIGIN: 'false' });
    assert.equal((await strict.request()).status, 404);
    assert.equal((await strict.request('/pic?img=h', { Referer: '' })).status, 404);
    assert.equal((await strict.request('/pic?img=h', { Referer: strict.base + '/gallery' })).status, 404);
    assert.equal((await strict.request('/pic?img=h', { Referer: 'https://example.com/' })).status, 302);

    const off = await start(mode, { ...TRUSTED_ENV, REFERER_ENABLED: '0' });
    assert.equal((await off.request('/pic?img=h', { Referer: 'bad referer' })).status, 302);
    assert.equal((await off.request('/pic?img=h', { Origin: 'https://outside.example' })).status, 404);

    const noCors = await start(mode, { CORS_ALLOW_SAME_ORIGIN: 'no' });
    assert.equal((await noCors.request('/pic?img=h', { Origin: noCors.base })).status, 404);
  });

  test(mode + ': invalid env fails closed with 500 instead of opening up', async context => {
    const errors = context.mock.method(console, 'error', () => {});
    for (const env of [
      { REFERER_ENABLED: 'maybe' },
      { REFERER_ALLOWED_HOSTS: 'https://example.com' },
      { REFERER_ALLOWED_HOSTS: 'example.com/path' },
      { REFERER_ALLOWED_HOSTS: '*.127.0.0.1' },
      { CORS_ALLOWED_ORIGINS: 'https://example.com/path' },
      { CORS_ALLOWED_ORIGINS: 'https://*.example.com' },
      { CORS_ALLOWED_ORIGINS: 'null' },
      { PROTECT_ASSET_IMAGES: '2' },
    ]) {
      const api = await start(mode, env);
      const response = await api.request('/pic?img=h', { Referer: 'https://example.com/' });
      assert.equal(response.status, 500, JSON.stringify(env));
      assert.equal(await response.text(), '500 Internal Error');
      assert.equal((await api.request('/pic?img=h', { Origin: 'https://client.example' }, 'OPTIONS')).status, 500);
    }
    assert.ok(errors.mock.callCount() >= 8);
  });

  test(mode + ': OPTIONS validates Origin/method/headers without requiring Referer', async () => {
    const api = await start(mode, { ...TRUSTED_ENV, REFERER_ALLOW_MISSING: '0' });
    let response = await api.request('/pic?img=h', { Origin: 'https://client.example', 'Access-Control-Request-Method': 'HEAD', 'Access-Control-Request-Headers': 'X-Request-ID, Content-Type' }, 'OPTIONS');
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
    assert.equal(response.headers.get('access-control-allow-headers'), 'X-Request-ID, Content-Type');
    checkPolicyHeaders(response, 'https://client.example', true);
    assert.equal((await api.request('/pic?img=h', { Origin: 'https://outside.example' }, 'OPTIONS')).status, 404);
    assert.equal((await api.request('/pic?img=h', { Origin: 'https://client.example', 'Access-Control-Request-Method': 'POST' }, 'OPTIONS')).status, 405);
    assert.equal((await api.request('/pic?img=h', { Origin: 'https://client.example', 'Access-Control-Request-Headers': 'invalid header' }, 'OPTIONS')).status, 400);
  });

  test(mode + ': HEAD, methods, categories, UA and no-store redirects', async context => {
    const errors = context.mock.method(console, 'error', () => {});
    const api = await start(mode, TRUSTED_ENV);
    for (const [query, status] of [['h', 302], ['a', 302], ['gif', 302], ['custom', 302], ['empty', 404], ['unknown', 404], ['__proto__', 404], ['', 404]]) {
      for (const method of ['GET', 'HEAD']) {
        const response = await api.request('/pic?img=' + query, { Origin: 'https://client.example' }, method);
        assert.equal(response.status, status, query);
        checkPolicyHeaders(response, 'https://client.example');
        if (method === 'HEAD') assert.equal(await response.text(), '');
      }
    }
    for (const [ua, category] of [['Mozilla Android', 'v'], ['desktop browser', 'h']]) {
      const response = await api.request('/pic?img=ua', { 'User-Agent': ua });
      assert.equal(response.status, 302);
      assert.ok(response.headers.get('location').startsWith('/' + category + '/'));
    }
    const post = await api.request('/pic?img=h', { Origin: 'https://client.example' }, 'POST');
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD, OPTIONS');
    const deniedHead = await api.request('/pic?img=h', { Origin: 'https://outside.example' }, 'HEAD');
    assert.equal(deniedHead.status, 404);
    assert.equal(await deniedHead.text(), '');

    // A runtime failure must still produce the policy headers, not a bare 599.
    const broken = await importCode(code[mode].replace(
      'const slot = Math.floor(Math.random() * target.slots);',
      "throw new Error('fixture redirect failure');",
    ));
    const failure = await start(mode, TRUSTED_ENV, { impl: broken });
    const response = await failure.request('/pic?img=h', { Origin: 'https://client.example' });
    assert.equal(response.status, 500);
    checkPolicyHeaders(response, 'https://client.example');
    assert.ok(errors.mock.callCount() >= 1);
  });
}

test('Worker: both API routes, category assets, encoded paths, and public boundary', async context => {
  const errors = context.mock.method(console, 'error', () => {});
  const api = await start('worker', TRUSTED_ENV);
  assert.equal((await api.request('/api/pic?img=h')).status, 302);
  for (const pathname of ['/h/0.jpg', '/a/0.jpeg', '/gif/0.gif', '/custom/0.gif', '/%68/0%2ejpg']) {
    const before = api.assetCalls();
    const denied = await api.request(pathname, { Referer: 'https://outside.example/' });
    assert.equal(denied.status, 404, pathname);
    assert.equal(api.assetCalls(), before);
    checkPolicyHeaders(denied);
    const allowed = await api.request(pathname, { Origin: 'https://client.example' });
    assert.equal(allowed.status, 200);
    assert.equal(await allowed.text(), 'fixture asset');
    checkPolicyHeaders(allowed, 'https://client.example');
    assert.match(allowed.headers.get('vary'), /Accept-Encoding/);
  }
  for (const pathname of ['/', '/gallery/', '/settings/', '/counts.json', '/h/meta.json', '/h/index.html', '/icon.svg', '/_next/static/app.js', '/unrelated/image.jpg']) {
    const response = await api.request(pathname, { Origin: 'https://outside.example', Referer: 'https://outside.example/' });
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get('cache-control'), /public/);
  }
  const head = await api.request('/h/0.jpg', { Origin: 'https://client.example' }, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const missing = await api.request('/h/missing.jpg', { Origin: 'https://client.example' });
  assert.equal(missing.status, 404);
  checkPolicyHeaders(missing, 'https://client.example');

  const failing = await start('worker', TRUSTED_ENV, { failingAssets: true });
  const failed = await failing.request('/h/0.jpg', { Origin: 'https://client.example' });
  assert.equal(failed.status, 500);
  assert.ok(errors.mock.callCount() >= 1);

  const unprotected = await start('worker', { ...TRUSTED_ENV, PROTECT_ASSET_IMAGES: '0' });
  assert.equal((await unprotected.request('/h/0.jpg', { Origin: 'https://outside.example', Referer: 'https://outside.example/' })).status, 200);
  assert.equal((await unprotected.request('/pic?img=h', { Origin: 'https://outside.example' })).status, 404);
});

test('policy denials are indistinguishable from a missing image', async () => {
  const api = await start('worker', TRUSTED_ENV);
  const missing = await api.request('/pic?img=unknown');
  const deniedReferer = await api.request('/pic?img=h', { Referer: 'https://outside.example/' });
  const deniedOrigin = await api.request('/pic?img=h', { Origin: 'https://outside.example' });
  const bodies = await Promise.all([missing.text(), deniedReferer.text(), deniedOrigin.text()]);
  // Same status and same body: a caller cannot tell "you are not allowed" from
  // "there is no such image", so probing cannot map the allowlist rule by rule.
  assert.deepEqual(bodies, ['404 Not Found', '404 Not Found', '404 Not Found']);
  assert.deepEqual(
    [missing.status, deniedReferer.status, deniedOrigin.status],
    [404, 404, 404],
  );
  for (const response of [deniedReferer, deniedOrigin]) {
    assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
  }
});

test('Worker deployment runs script before static assets', async () => {
  // wrangler.jsonc allows comments; strip them before asserting on the object.
  const source = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
  const config = JSON.parse(source.replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(config.assets.run_worker_first, true);
  // Keep the shipped config free of baked-in policy values.
  assert.equal('vars' in config, false);
});
