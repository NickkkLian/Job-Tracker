// build.mjs — compiles src/app.jsx ahead of time and writes the one page the browser loads, index.html.
//
//   node build.mjs           write index.html
//   node build.mjs --check   build in memory and compare with the committed index.html (CI runs this, so a change to the
//                            source that was never built, or a built page edited by hand, turns red)
//
// Why: the page used to ship its JSX to the browser together with Babel (2.7 MB) and compile it on every visit, and it
// loaded React, ReactDOM, Tailwind, mammoth and jsPDF from four other hosts. Now the JSX is compiled here with esbuild and
// inlined, and the libraries are served from vendor/ (copies, sources and hashes in vendor/SOURCE.md).
//
// esbuild is the only dependency, pinned: the same input must give the same page byte for byte on every machine.
// Set ESBUILD_MODULE to the path of an installed esbuild's lib/main.js to use one that is not in node_modules.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

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
const page = template.replace(MARK, () => code.trimEnd());

const out = new URL('./index.html', import.meta.url);
if (process.argv.includes('--check')) {
  const committed = readFileSync(out, 'utf8');
  if (committed !== page) {
    const at = [...committed].findIndex((ch, i) => ch !== page[i]);
    console.error(`index.html is not what src/ builds to (first difference at character ${at}). Run: node build.mjs`);
    process.exit(1);
  }
  console.log(`BUILD CHECK PASS: index.html is exactly what src/ builds to (${page.length} characters, esbuild ${esbuild.version})`);
} else {
  writeFileSync(out, page);
  console.log(`wrote index.html (${page.length} characters) from src/app.jsx (${source.length}) with esbuild ${esbuild.version}`);
}
