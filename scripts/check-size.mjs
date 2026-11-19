// NFR-02: fails if what a guest downloads (entry JS + CSS + the fetch repo chunk) exceeds 70 KB gzipped.
// The admin page, supabase-js and the demo repo are separate chunks guests never load in production.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET = 70 * 1024;
const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
const files = new Set();
const visit = (key) => {
  const c = manifest[key];
  if (!c || files.has(c.file)) return;
  files.add(c.file);
  (c.css ?? []).forEach((f) => files.add(f));
  (c.imports ?? []).forEach(visit);
};
visit('index.html');
visit('src/repo/rest.ts');

let total = 0;
for (const f of files) {
  const size = gzipSync(readFileSync('dist/' + f)).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(6)} KB  ${f}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(6)} KB  guest total (budget ${BUDGET / 1024} KB gzipped)`);
if (total > BUDGET) {
  console.error('Guest bundle over budget.');
  process.exit(1);
}
