// build.mjs — compiles src/app.jsx ahead of time and writes the one page the browser loads, index.html.
//
//   node build.mjs           write index.html
//   node build.mjs --check   build in memory and compare with the committed index.html (CI runs this, so a change to the
//                            source that was never built, or a built page edited by hand, turns red); and check every
//                            file in vendor/ against the sha256 that vendor/SOURCE.md pins for it (checkVendor below)
//
// Why: the page used to ship its JSX to the browser together with Babel (2.7 MB) and compile it on every visit, and it
// loaded React, ReactDOM, Tailwind, mammoth and jsPDF from two other hosts (cdn.tailwindcss.com, cdnjs.cloudflare.com).
// Now the JSX is compiled here with esbuild and inlined, and the libraries are served from vendor/ (copies, sources and
// hashes in vendor/SOURCE.md).
//
// esbuild is the only dependency, pinned: the same input must give the same page byte for byte on every machine.
// Set ESBUILD_MODULE to the path of an installed esbuild's lib/main.js to use one that is not in node_modules.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ESBUILD_VERSION = '0.27.7';
const esbuild = await import(process.env.ESBUILD_MODULE ? pathToFileURL(process.env.ESBUILD_MODULE).href : 'esbuild');
if (esbuild.version !== ESBUILD_VERSION) {
  console.error(`esbuild ${esbuild.version} found, ${ESBUILD_VERSION} required (a different version can print a different page)`);
  process.exit(2);
}

const source = readFileSync(new URL('./src/app.jsx', import.meta.url), 'utf8');
const template = readFileSync(new URL('./src/index.template.html', import.meta.url), 'utf8');

// The same JSX transform the page had in the browser (React.createElement / React.Fragment). No bundling and no
// wrapper: top-level declarations stay top-level, as they were in the old inline script.
const { code } = await esbuild.transform(source, {
  loader: 'jsx', target: 'es2020', charset: 'utf8', legalComments: 'inline', sourcefile: 'src/app.jsx',
});

// The compiled code sits inside a <script> element, where "</script" would end the element early and "<!--" changes how
// the rest of it is parsed. Neither may appear.
for (const bad of ['</script', '<!--']) {
  if (code.toLowerCase().includes(bad)) {
    console.error(`the compiled code contains "${bad}"; it cannot be inlined as it is`);
    process.exit(2);
  }
}
const MARK = '/*__APP_JS__*/';
if (template.split(MARK).length !== 2) {
  console.error(`src/index.template.html must contain ${MARK} exactly once`);
  process.exit(2);
}
const built = template.replace(MARK, () => code.trimEnd());

// The page's Content-Security-Policy (2026-09-25, #59). Scripts may come only from this site's own files ('self') and
// from the page's own inline scripts, each pinned by its sha256; there is no 'unsafe-inline' and no 'unsafe-eval'. So
// the browser itself refuses, while the page runs, what check-scripts.mjs cannot see in the source: a script from
// another host however its address was put together, and text run as code (eval, Function, a string given to
// setTimeout, a script element given text). It goes right after <meta charset>, before the first script.
const INLINE_SCRIPT = /<script>([\s\S]*?)<\/script>/g;
const hashes = [...built.matchAll(INLINE_SCRIPT)].map((m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
const CHARSET = '<meta charset="utf-8">\n';
if (!hashes.length || built.split(CHARSET).length !== 2) {
  console.error(`src/index.template.html needs ${JSON.stringify(CHARSET)} exactly once and at least one inline <script>`);
  process.exit(2);
}
const page = built.replace(CHARSET, `${CHARSET}<meta http-equiv="Content-Security-Policy" content="script-src 'self' ${hashes.join(' ')}">\n`);

// The page runs the files in vendor/ as they are, so each one must be the copy vendor/SOURCE.md describes: its table pins
// a sha256 per file. A file whose bytes differ (one byte is enough), a listed file that is missing, and a file the table
// does not list all fail. Returns the problems found, and how many files matched.
function checkVendor() {
  const dir = fileURLToPath(new URL('./vendor/', import.meta.url));
  const pinned = new Map();
  for (const m of readFileSync(join(dir, 'SOURCE.md'), 'utf8').matchAll(/^\|\s*`([^`]+)`\s*\|[^|\n]*\|\s*`([0-9a-f]{64})`\s*\|/gm)) {
    pinned.set(m[1], m[2]);
  }
  const present = readdirSync(dir).filter((f) => f !== 'SOURCE.md');
  const problems = [];
  if (!pinned.size) problems.push('vendor/SOURCE.md pins no sha256 at all (its table could not be read)');
  let matched = 0;
  for (const f of present) {
    if (!pinned.has(f)) { problems.push(`vendor/${f} is not in the table in vendor/SOURCE.md`); continue; }
    const got = createHash('sha256').update(readFileSync(join(dir, f))).digest('hex');
    if (got === pinned.get(f)) matched++;
    else problems.push(`vendor/${f} has sha256 ${got}; vendor/SOURCE.md pins ${pinned.get(f)}`);
  }
  for (const f of pinned.keys()) if (!present.includes(f)) problems.push(`vendor/${f} is in vendor/SOURCE.md but not in vendor/`);
  return { problems, matched };
}

const out = new URL('./index.html', import.meta.url);
if (process.argv.includes('--check')) {
  let failed = false;
  const committed = readFileSync(out, 'utf8');
  if (committed !== page) {
    const at = [...committed].findIndex((ch, i) => ch !== page[i]);
    console.error(`index.html is not what src/ builds to (first difference at character ${at}). Run: node build.mjs`);
    failed = true;
  } else {
    console.log(`BUILD CHECK PASS: index.html is exactly what src/ builds to (${page.length} characters, esbuild ${esbuild.version})`);
  }
  const vendor = checkVendor();
  if (vendor.problems.length) {
    for (const p of vendor.problems) console.error(`VENDOR CHECK FAIL: ${p}`);
    failed = true;
  } else {
    console.log(`VENDOR CHECK PASS: all ${vendor.matched} files in vendor/ match the sha256 in vendor/SOURCE.md`);
  }
  if (failed) process.exit(1);
} else {
  writeFileSync(out, page);
  console.log(`wrote index.html (${page.length} characters) from src/app.jsx (${source.length}) with esbuild ${esbuild.version}`);
}
