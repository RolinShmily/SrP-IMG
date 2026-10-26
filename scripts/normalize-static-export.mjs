import { constants } from 'node:fs';
import { copyFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Next 16.0.10 replaces '/' with '.' in segment filenames, but its Windows
// exporter supplies path.relative() results containing '\\'. Preserve those
// files and add the flat names requested by the browser's segment prefetcher.
// Linux exports already have the expected names and need no changes.
export async function normalizeStaticExport(directory) {
  let copied = 0;

  async function copySegments(segmentDirectory, prefix, relativeParts = []) {
    for (const entry of await readdir(segmentDirectory, { withFileTypes: true })) {
      const source = path.join(segmentDirectory, entry.name);
      const parts = [...relativeParts, entry.name];
      if (entry.isDirectory()) {
        await copySegments(source, prefix, parts);
      } else if (entry.isFile() && entry.name.endsWith('.txt')) {
        const destination = `${prefix}.${parts.join('.')}`;
        try {
          await copyFile(source, destination, constants.COPYFILE_EXCL);
          copied += 1;
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
          const [existing, generated] = await Promise.all([readFile(destination), readFile(source)]);
          if (!existing.equals(generated)) {
            throw new Error(`Conflicting static route segment: ${destination}`, { cause: error });
          }
        }
      }
    }
  }

  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === '_next') continue;
      const source = path.join(current, entry.name);
      if (entry.name.startsWith('__next.')) {
        await copySegments(source, source);
      } else {
        await visit(source);
      }
    }
  }

  await visit(directory);
  return copied;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const count = await normalizeStaticExport(fileURLToPath(new URL('../out', import.meta.url)));
  console.log(`Static route segments: ${count} compatible filename${count === 1 ? '' : 's'} added.`);
}
