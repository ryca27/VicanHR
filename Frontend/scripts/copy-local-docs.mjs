import { copyFile, mkdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, 'Frontend/.angular/local-docs');
const pages = ['vicanhr-update.html', 'vicanhr-frontend-handoff.html'];
const files = new Set(pages);

for (const page of pages) {
  const html = await readFile(resolve(root, page), 'utf8');
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    const path = href.split(/[?#]/, 1)[0];
    if (path === 'README.md' || /^(Backend|Frontend)\/(?:[\w.-]+\/)*[\w-][\w.-]*\.(md|py|ts|html|scss|json)$/.test(path)) {
      files.add(path);
    }
  }
}

await rm(output, { recursive: true, force: true });
for (const path of files) {
  const source = await realpath(resolve(root, path));
  const sourcePath = relative(root, source);
  if (isAbsolute(sourcePath) || sourcePath.startsWith('..') || !(await stat(source)).isFile()) {
    throw new Error(`Invalid local documentation file: ${path}`);
  }
  const destination = resolve(output, path);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}
