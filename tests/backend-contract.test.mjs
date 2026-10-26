import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = {};
const temporary = [];
const servers = [];
const defaults = JSON.parse(await readFile(path.join(root, 'access-policy.json'), 'utf8'));
const configured = {
  version: 1,
  referer: { enabled: true, allowMissing: true, allowSameOrigin: true, allowedHosts: ['example.com', '*.trusted.example'] },
  cors: { allowSameOrigin: true, allowedOrigins: ['https://client.example', 'http://localhost:4321'] },
  protectAssetImages: true,
};

async function importCode(code) {
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

async function generate(name, policy, explicit = false) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'srp-policy-http-'));
  temporary.push(directory);
  for (const category of ['h', 'v', 'a', 'gif', 'custom', 'empty']) {
    const source = path.join(directory, 'oriImg', category);
    await mkdir(source, { recursive: true });
    if (category !== 'empty') {
      // Minimal GIF dimension header; --no-copy writes the valid image placeholders.
      await writeFile(path.join(source, 'source.gif'), Buffer.from('47494638396101000100', 'hex'));
    }
  }
  const args = [path.join(root, 'gen_img.py'), '--hash-length', '1', '--no-copy'];
  if (policy) {
    const filename = explicit ? 'custom-policy.json' : 'access-policy.json';
    await writeFile(path.join(directory, filename), JSON.stringify(policy));
    if (explicit) args.push('--access-policy', filename);
  }
  const generated = spawnSync(process.env.PYTHON || 'python', args, { cwd: directory, encoding: 'utf8' });
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  const codes = {
    worker: await readFile(path.join(directory, 'index.js'), 'utf8'),
    pages: await readFile(path.join(directory, 'functions', 'pic.js'), 'utf8'),
  };
  for (const code of Object.values(codes)) {
    assert.ok(code.includes('const ACCESS_POLICY = '));
    assert.ok(!code.includes('srprolin'));
  }
  fixtures[name] = { codes, worker: await importCode(codes.worker), pages: await importCode(codes.pages) };
}

async function start(backend, mode) {
  let assetsCalls = 0;
  const env = {
    ASSETS: {
      async fetch(request) {
        assetsCalls++;
        const pathname = new URL(request.url).pathname;
        if (pathname.endsWith('/failed.jpg')) throw new Error('fixture asset failure');
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
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      const request = new Request('http://' + incoming.headers.host + incoming.url, {
        method: incoming.method,
        headers: incoming.headers,
      });
      const response = mode === 'pages'
        ? await backend.onRequest({ request })
        : await backend.default.fetch(request, env);
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
    request: (pathname = '/pic?img=h', headers = {}, method = 'GET') => fetch(base + pathname, { headers, method, redirect: 'manual' }),
    assetCalls: () => assetsCalls,
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

before(async () => {
  await generate('default', null);
  await generate('configured', configured, true);
  await generate('strict', {
    ...configured,
    referer: { ...configured.referer, allowMissing: false, allowSameOrigin: false },
    cors: { ...configured.cors, allowSameOrigin: false },
  });
  await generate('disabled', { ...configured, referer: { ...configured.referer, enabled: false } });
  await generate('unprotected', { ...configured, protectAssetImages: false });
  fixtures.checkedIn = {
    worker: await importCode(await readFile(path.join(root, 'index.js'), 'utf8')),
    pages: await importCode(await readFile(path.join(root, 'functions', 'pic.js'), 'utf8')),
  };
});

after(async () => {
  await Promise.all(servers.map(server => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  })));
  await Promise.all(temporary.map(directory => rm(directory, { recursive: true, force: true })));
});

for (const mode of ['worker', 'pages']) {
  test(mode + ': default generated and checked-in policies allow direct/same-origin only', async () => {
    assert.deepEqual(defaults, { version: 1, referer: { enabled: true, allowMissing: true, allowSameOrigin: true, allowedHosts: [] }, cors: { allowSameOrigin: true, allowedOrigins: [] }, protectAssetImages: true });
    for (const name of ['default', 'checkedIn']) {
      const api = await start(fixtures[name][mode], mode);
      let response = await api.request();
      assert.equal(response.status, 302);
      assert.match(response.headers.get('location'), /^\/h\/[0-9a-f]+\.jpg$/);
      checkPolicyHeaders(response);
      response = await api.request('/pic?img=h', { Origin: api.base, Referer: api.base + '/gallery/' });
      assert.equal(response.status, 302);
      checkPolicyHeaders(response, api.base);
      for (const headers of [{ Origin: 'https://outside.example' }, { Referer: 'https://outside.example/page' }]) {
        response = await api.request('/pic?img=h', headers);
        assert.equal(response.status, 403);
        checkPolicyHeaders(response);
      }
    }
  });

  test(mode + ': exact Referer hosts, wildcard boundary, parsing, and independent Origin rules', async () => {
    const api = await start(fixtures.configured[mode], mode);
    for (const referer of ['https://example.com/page', 'http://example.com:8080/page', 'https://a.trusted.example/', 'https://a.b.trusted.example/', 'https://EXAMPLE.COM/']) {
      const response = await api.request('/pic?img=h', { Referer: referer });
      assert.equal(response.status, 302, referer);
    }
    for (const referer of ['https://sub.example.com/', 'https://trusted.example/', 'https://eviltrusted.example/', 'https://example.com.evil.test/', 'https://a.trusted.example.evil.test/', 'https://example.com@evil.test/', 'https://user@example.com/', 'https:example.com', 'https://example.com\\evil', 'not a URL', 'ftp://example.com/', 'null']) {
      const response = await api.request('/pic?img=h', { Referer: referer, Origin: 'https://client.example' });
      assert.equal(response.status, 403, referer);
      checkPolicyHeaders(response, 'https://client.example');
    }
    for (const origin of ['null', '', 'not a URL', 'https://client.example.evil.test', 'https://example.com', 'https://client.example/', 'https://client.example/path', 'https://user@client.example', 'https://client.example:444', 'http://client.example', 'https://CLIENT.example']) {
      const response = await api.request('/pic?img=h', { Origin: origin, Referer: 'https://example.com/' });
      assert.equal(response.status, 403, origin);
      checkPolicyHeaders(response);
    }
    for (const origin of ['https://client.example', 'http://localhost:4321']) {
      const response = await api.request('/pic?img=h', { Origin: origin });
      assert.equal(response.status, 302);
      checkPolicyHeaders(response, origin);
    }
    // CORS membership alone does not grant embedding via Referer.
    assert.equal((await api.request('/pic?img=h', { Origin: 'https://client.example', Referer: 'https://client.example/page' })).status, 403);
  });

  test(mode + ': missing Referer, same-origin switches, and disabling Referer only', async () => {
    const strict = await start(fixtures.strict[mode], mode);
    assert.equal((await strict.request()).status, 403);
    assert.equal((await strict.request('/pic?img=h', { Referer: '' })).status, 403);
    assert.equal((await strict.request('/pic?img=h', { Referer: strict.base + '/gallery' })).status, 403);
    assert.equal((await strict.request('/pic?img=h', { Origin: strict.base, Referer: 'https://example.com/' })).status, 403);
    assert.equal((await strict.request('/pic?img=h', { Referer: 'https://example.com/' })).status, 302);
    const disabled = await start(fixtures.disabled[mode], mode);
    assert.equal((await disabled.request('/pic?img=h', { Referer: 'bad referer' })).status, 302);
    assert.equal((await disabled.request('/pic?img=h', { Origin: 'https://outside.example' })).status, 403);
  });

  test(mode + ': OPTIONS validates Origin/method/headers without requiring Referer', async () => {
    const api = await start(fixtures.strict[mode], mode);
    let response = await api.request('/pic?img=h', { Origin: 'https://client.example', 'Access-Control-Request-Method': 'HEAD', 'Access-Control-Request-Headers': 'X-Request-ID, Content-Type' }, 'OPTIONS');
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
    assert.equal(response.headers.get('access-control-allow-headers'), 'X-Request-ID, Content-Type');
    checkPolicyHeaders(response, 'https://client.example', true);
    response = await api.request('/pic?img=h', { Origin: 'https://outside.example' }, 'OPTIONS');
    assert.equal(response.status, 403);
    checkPolicyHeaders(response, null, true);
    response = await api.request('/pic?img=h', { Origin: 'https://client.example', 'Access-Control-Request-Method': 'POST' }, 'OPTIONS');
    assert.equal(response.status, 405);
    checkPolicyHeaders(response, 'https://client.example', true);
    response = await api.request('/pic?img=h', { Origin: 'https://client.example', 'Access-Control-Request-Headers': 'invalid header' }, 'OPTIONS');
    assert.equal(response.status, 400);
    checkPolicyHeaders(response, 'https://client.example', true);
    assert.equal((await api.request('/pic?img=h', {}, 'OPTIONS')).status, 204);
  });

  test(mode + ': HEAD, errors, categories, UA, methods, and no-cache redirects', async context => {
    const errors = context.mock.method(console, 'error', () => {});
    const api = await start(fixtures.configured[mode], mode);
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
    let response = await api.request('/pic?img=h', { Origin: 'https://client.example' }, 'POST');
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, HEAD, OPTIONS');
    checkPolicyHeaders(response, 'https://client.example');
    response = await api.request('/pic?img=h', { Origin: 'https://outside.example' }, 'HEAD');
    assert.equal(response.status, 403);
    assert.equal(await response.text(), '');
    const broken = await importCode(fixtures.configured.codes[mode].replace('const slot = Math.floor(Math.random() * target.slots);', "throw new Error('fixture redirect failure');"));
    const failure = await start(broken, mode);
    for (const method of ['GET', 'HEAD']) {
      response = await failure.request('/pic?img=h', { Origin: 'https://client.example' }, method);
      assert.equal(response.status, 500);
      checkPolicyHeaders(response, 'https://client.example');
      if (method === 'HEAD') assert.equal(await response.text(), '');
    }
    assert.equal(errors.mock.callCount(), 2);
  });
}

test('Worker: both API routes, category assets, encoded paths, and public page/metadata boundary', async context => {
  const errors = context.mock.method(console, 'error', () => {});
  const api = await start(fixtures.configured.worker, 'worker');
  assert.equal((await api.request('/api/pic?img=h')).status, 302);
  for (const pathname of ['/h/0.jpg', '/a/0.jpeg', '/gif/0.gif', '/custom/0.gif', '/%68/0%2ejpg']) {
    const before = api.assetCalls();
    const denied = await api.request(pathname, { Referer: 'https://outside.example/' });
    assert.equal(denied.status, 403, pathname);
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
  let response = await api.request('/h/0.jpg', { Origin: 'https://outside.example' });
  assert.equal(response.status, 403);
  response = await api.request('/h/0.jpg', { Origin: 'https://client.example' }, 'OPTIONS');
  assert.equal(response.status, 204);
  checkPolicyHeaders(response, 'https://client.example', true);
  response = await api.request('/h/0.jpg', {}, 'HEAD');
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  checkPolicyHeaders(response);
  for (const [pathname, status] of [['/h/missing.jpg', 404], ['/h/failed.jpg', 500]]) {
    response = await api.request(pathname, { Origin: 'https://client.example' });
    assert.equal(response.status, status);
    checkPolicyHeaders(response, 'https://client.example');
  }
  const unprotected = await start(fixtures.unprotected.worker, 'worker');
  assert.equal((await unprotected.request('/h/0.jpg', { Origin: 'https://outside.example', Referer: 'https://outside.example/' })).status, 200);
  assert.equal((await unprotected.request('/pic?img=h', { Origin: 'https://outside.example' })).status, 403);
  assert.equal(errors.mock.callCount(), 1);
});

test('Worker deployment runs script before static assets', async () => {
  const config = JSON.parse(await readFile(path.join(root, 'wrangler.jsonc'), 'utf8'));
  assert.equal(config.assets.run_worker_first, true);
});
