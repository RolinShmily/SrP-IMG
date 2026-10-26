import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { normalizeStaticExport } from '../scripts/normalize-static-export.mjs';

async function fixture(context) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'srp-static-export-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('Windows route segments are available at the URLs requested by Next prefetch', async context => {
  const directory = await fixture(context);
  const nested = path.join(directory, 'gallery', '__next.gallery', 'nested');
  await mkdir(nested, { recursive: true });
  await writeFile(path.join(nested, '__PAGE__.txt'), 'nested Flight payload');
  await writeFile(path.join(path.dirname(nested), '__PAGE__.txt'), 'gallery Flight payload');
  assert.equal(await normalizeStaticExport(directory), 2);
  assert.equal(await readFile(path.join(directory, 'gallery', '__next.gallery.__PAGE__.txt'), 'utf8'), 'gallery Flight payload');
  assert.equal(await readFile(path.join(directory, 'gallery', '__next.gallery.nested.__PAGE__.txt'), 'utf8'), 'nested Flight payload');
  assert.equal(await normalizeStaticExport(directory), 0);
});

test('Linux exports and unrelated assets remain unchanged', async context => {
  const directory = await fixture(context);
  await mkdir(path.join(directory, 'gallery'));
  await writeFile(path.join(directory, 'gallery', '__next.gallery.__PAGE__.txt'), 'existing Flight payload');
  await mkdir(path.join(directory, '_next', '__next.test'), { recursive: true });
  await writeFile(path.join(directory, '_next', '__next.test', 'asset.txt'), 'unrelated asset');
  assert.equal(await normalizeStaticExport(directory), 0);
  assert.equal(await readFile(path.join(directory, 'gallery', '__next.gallery.__PAGE__.txt'), 'utf8'), 'existing Flight payload');
});

test('Conflicting route payloads fail the build rather than overwrite existing data', async context => {
  const directory = await fixture(context);
  await mkdir(path.join(directory, '__next.gallery'));
  await writeFile(path.join(directory, '__next.gallery', '__PAGE__.txt'), 'new payload');
  await writeFile(path.join(directory, '__next.gallery.__PAGE__.txt'), 'other payload');
  await assert.rejects(normalizeStaticExport(directory), /Conflicting static route segment/);
  assert.equal(await readFile(path.join(directory, '__next.gallery.__PAGE__.txt'), 'utf8'), 'other payload');
});
