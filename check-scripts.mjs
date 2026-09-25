// check-scripts.mjs — the CI step "no script from another host".
//
//   node check-scripts.mjs              check index.html and the page's own script files; exit 1 on any finding
//   node check-scripts.mjs --self-test  check that every form in SAMPLES is caught, that nothing in ALLOWED is, and that
//                                       the real page passes; exit 1 otherwise (CI runs this first)
//
// Every script the page runs must come from this repository. The libraries in vendor/ are pinned by sha256 (node
// build.mjs --check). This reads the page, and every script of this repository it loads outside vendor/ (appearance.js),
// for a script from anywhere else, in any of these forms:
//   1. a <script> element, in the HTML or written inside a string in the code, whose src, href or xlink:href is not a
//      plain path in this repository: any case, quotes or none, spaces or line breaks, a character reference, a
//      backslash, an address, or pieces joined in code;
//   2. a <base href>: it would move every relative path, vendor/ included, to another host;
//   3. a <link> that loads a script: modulepreload, import, or preload / prefetch as a script, worker or worklet, from
//      anything but a plain path;
//   4. an import map, or an iframe's srcdoc (its scripts run as this page);
//   5. code that loads a script by address — import(), import … from, export … from, importScripts(), new Worker,
//      new SharedWorker, serviceWorker.register(), a worklet's addModule(), a src set in code (x.src =, x['src'] =,
//      setAttribute('src', …)) or pdf.js's workerSrc — unless the address is a string that starts as a plain path (a
//      template with ${…} in it only inside vendor/, since the file it names cannot be told);
//   6. code that runs text or bytes as code, which could have come from anywhere: eval(), Function() or new Function(),
//      a string given to setTimeout or setInterval, WebAssembly.instantiate / compile;
//   7. any http(s) or protocol-relative address that ends in .js or .mjs.
// A plain path is letters, digits and . _ ~ - / only, not starting with //: no scheme, no host. It must also stay inside
// this repository and name a file in it; the page's own scripts named this way are read in turn.
// Not checked: frames, objects and embeds from another host (their code runs in that host's origin, not in this page),
// and a way of running code that is not in this list.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PLAIN = /^(?:\.{0,2}\/)?[A-Za-z0-9_~-][A-Za-z0-9._~\/-]*$/;
const TAG = (name) => new RegExp(`<${name}\\b((?:[^>"']|"[^"]*"|'[^']*')*)>`, 'gi');
const ATTR = /(?:^|[\s\/])([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function attrs(s) {
  const out = [];
  for (const m of s.matchAll(ATTR)) out.push([m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? '']);
  return out;
}
// A value a browser would load from this repository: a plain path once the spaces around it are dropped (PLAIN has no
// '&', so a character reference never passes)
const plainValue = (v) => PLAIN.test(v.trim());

// The string literal (quote, apostrophe or backtick) that starts at s[i] after spaces: its text up to the closing quote,
// or up to the first ${ of a template (cut: true). null when the code there is not a string literal.
function literalAt(s, i) {
  const m = /^\s*(['"`])/.exec(s.slice(i, i + 64));
  if (!m) return null;
  const q = m[1];
  let j = i + m[0].length, text = '';
  while (j < s.length && s[j] !== q) {
    if (q === '`' && s.startsWith('${', j)) return { text, cut: true };
    text += s[j++];
  }
  return { text, cut: false };
}

const LOADERS = [
  ['import()', /\bimport\s*\(/g],
  ['import/export … from', /\b(?:from|import)(?=\s*['"`])/g],
  ['importScripts()', /\bimportScripts\s*\(/g],
  ['new Worker / SharedWorker', /\bnew\s+(?:Shared)?Worker\s*\(/g],
  ['serviceWorker.register()', /\bserviceWorker\s*\.\s*register\s*\(/g],
  ['a worklet addModule()', /\.\s*addModule\s*\(/g],
  ['a src set in code', /\.\s*src\s*=(?![=>])/g],
  ["a src set in code (['src'])", /\[\s*(['"`])src\1\s*\]\s*=(?![=>])/g],
  ["setAttribute('src', …)", /\bsetAttribute\s*\(\s*(['"`])src\1\s*,/g],
  ["setAttributeNS(…, 'src', …)", /\bsetAttributeNS\s*\([^,]*,\s*(['"`])src\1\s*,/g],
  ['workerSrc', /\bworkerSrc\s*=(?![=>])/g],
];
const RUNS_TEXT = [
  ['eval()', /\beval\s*\(/g],
  ['Function() / new Function()', /(?<![\w$.])(?:new\s+)?Function\s*\(/g],
  ['a string given to setTimeout / setInterval', /\bset(?:Timeout|Interval)\s*\(\s*['"`]/g],
  ['WebAssembly.instantiate / compile', /\bWebAssembly\s*\.\s*(?:instantiate|compile)(?:Streaming)?\s*\(/g],
];
const JS_ADDRESS = [/\bhttps?:\/\/[^\s"'`<>()\\]+?\.m?js(?![\w$])/gi, /(?<=['"`(=]\s*)\/\/[^\s"'`<>()\\]+?\.m?js(?![\w$])/gi];
const SCRIPT_AS = new Set(['script', 'worker', 'sharedworker', 'serviceworker', 'audioworklet', 'paintworklet']);

// Every finding in one file's text: { at, form, text }. `local` collects the plain paths of this repository the text
// loads as scripts (outside vendor/), so they are read too.
function scanText(s, local) {
  const found = [];
  const add = (at, form, len = 80) => found.push({ at, form, text: s.slice(at, at + len).replace(/\s+/g, ' ') });
  const loadsLocal = (at, form, v) => {
    const p = v.trim();
    if (!/^(?:\.\/)?vendor\//.test(p)) local.push({ at, form, path: p });
  };
  for (const m of s.matchAll(TAG('script'))) {
    const a = attrs(m[1]);
    for (const [k, v] of a) {
      if (k !== 'src' && k !== 'href' && k !== 'xlink:href') continue;
      if (!plainValue(v)) add(m.index, `<script> ${k} that is not a plain path in this repository`);
      else loadsLocal(m.index, `<script> ${k}`, v);
    }
    if (a.some(([k, v]) => k === 'type' && v.trim().toLowerCase() === 'importmap')) add(m.index, 'an import map');
  }
  for (const m of s.matchAll(TAG('base'))) if (attrs(m[1]).some(([k]) => k === 'href')) add(m.index, '<base href>');
  for (const m of s.matchAll(TAG('link'))) {
    const a = Object.fromEntries(attrs(m[1]));
    const rel = String(a.rel || '').toLowerCase().split(/\s+/);
    const loadsScript = rel.includes('modulepreload') || rel.includes('import')
      || ((rel.includes('preload') || rel.includes('prefetch')) && SCRIPT_AS.has(String(a.as || '').trim().toLowerCase()));
    if (loadsScript && !plainValue(a.href || '')) add(m.index, '<link> that loads a script from another place');
  }
  for (const m of s.matchAll(TAG('iframe'))) if (attrs(m[1]).some(([k]) => k === 'srcdoc')) add(m.index, 'an iframe srcdoc');
  for (const [form, re] of LOADERS) {
    for (const m of s.matchAll(re)) {
      const lit = literalAt(s, m.index + m[0].length);
      if (!lit || !PLAIN.test(lit.text)) add(m.index, `${form} with an address that does not start as a plain path`);
      else if (lit.cut && !/^(?:\.\/)?vendor\//.test(lit.text)) add(m.index, `${form} with a path built in code outside vendor/`);
      else if (!lit.cut) loadsLocal(m.index, form, lit.text);
    }
  }
  for (const [form, re] of RUNS_TEXT) for (const m of s.matchAll(re)) add(m.index, `${form}: runs text or bytes as code`);
  for (const re of JS_ADDRESS) for (const m of s.matchAll(re)) add(m.index, 'an address that ends in .js or .mjs', m[0].length);
  return found;
}

// Scan the page and every local script it loads. `read(path)` gives a file's text, or null when there is none.
export function scan(read) {
  const findings = [], seen = new Set(), queue = ['index.html'];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const s = read(file);
    if (s == null) { findings.push({ file, line: 0, form: 'a script this page loads is not a file in this repository', text: file }); continue; }
    const local = [];
    for (const f of scanText(s, local)) findings.push({ file, line: s.slice(0, f.at).split('\n').length, form: f.form, text: f.text });
    for (const l of local) {
      const p = normalize(l.path.replace(/^\//, ''));
      if (p === '..' || p.startsWith('..' + sep) || isAbsolute(p)) findings.push({ file, line: s.slice(0, l.at).split('\n').length, form: `${l.form} outside this repository`, text: l.path });
      else queue.push(p.split(sep).join('/'));
    }
  }
  return { findings, files: [...seen] };
}

const readRepo = (p) => { const f = join(ROOT, p); return existsSync(f) ? readFileSync(f, 'utf8') : null; };

// One sample per form above; each goes into the real page (head: before </head>; code: in a <script> there) or into
// appearance.js, and must be caught. A fourth element adds files ({path: text}). Hosts are example.com; nothing here is
// loaded.
export const SAMPLES = [
  ['tag: lower case, double quotes, one line', 'head', '<script src="https://cdn.example.com/lib.js"></script>'],
  ['tag: single quotes', 'head', "<script src='https://cdn.example.com/lib'></script>"],
  ['tag: upper case', 'head', '<SCRIPT SRC="https://cdn.example.com/lib"></SCRIPT>'],
  ['tag: spaces around =', 'head', '<script src = "https://cdn.example.com/lib"></script>'],
  ['tag: no quotes', 'head', '<script src=https://cdn.example.com/lib></script>'],
  ['tag: over two lines', 'head', '<script\n  src="https://cdn.example.com/lib"></script>'],
  ['tag: protocol-relative //', 'head', '<script src="//cdn.example.com/lib"></script>'],
  ['tag: http://', 'head', '<script src="http://cdn.example.com/lib"></script>'],
  ['tag: backslashes', 'head', '<script src="\\\\cdn.example.com\\lib"></script>'],
  ['tag: character reference', 'head', '<script src="&#104;ttps://cdn.example.com/lib"></script>'],
  ['tag: space before the address', 'head', '<script src=" https://cdn.example.com/lib"></script>'],
  ['tag: / between name and attribute', 'head', '<script/src="https://cdn.example.com/lib"></script>'],
  ['tag: a ">" inside an attribute before src', 'head', '<script data-note="a>b" src="https://cdn.example.com/lib"></script>'],
  ['tag: SVG script href', 'head', '<svg><script href="https://cdn.example.com/lib"></script></svg>'],
  ['tag: SVG script xlink:href', 'head', '<svg><script xlink:href="https://cdn.example.com/lib"></script></svg>'],
  ['tag written by code', 'code', 'document.write(\'<script src="https://cdn.example.com/lib"><\\/script>\');'],
  ['tag assembled in code', 'code', 'box.innerHTML = \'<script src="\' + host + \'/lib"><\\/script>\';'],
  ['import map', 'head', '<script type="importmap">{"imports":{"lib":"https://cdn.example.com/lib"}}</script>'],
  ['<base href>', 'head', '<base href="https://cdn.example.com/">'],
  ['<link rel=modulepreload>', 'head', '<link rel="modulepreload" href="https://cdn.example.com/lib">'],
  ['<link rel=preload as=script>', 'head', '<link rel="preload" as="script" href="https://cdn.example.com/lib">'],
  ['iframe srcdoc', 'head', '<iframe srcdoc="&lt;script src=https://cdn.example.com/lib&gt;&lt;/script&gt;"></iframe>'],
  ['code: src = address', 'code', "s.src = 'https://cdn.example.com/lib';"],
  ['code: src = address + pieces', 'code', "s.src = 'https://cdn.example.com/lib/' + V + '.js';"],
  ['code: src = a name', 'code', "s.src = CDN + '/lib';"],
  ['code: src = template address', 'code', 's.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${V}/pdf.min.js`;'],
  ["code: ['src'] =", 'code', "s['src'] = 'https://cdn.example.com/lib';"],
  ["code: setAttribute('src')", 'code', "s.setAttribute('src', 'https://cdn.example.com/lib');"],
  ["code: setAttributeNS(…, 'src')", 'code', "s.setAttributeNS(null, 'src', 'https://cdn.example.com/lib');"],
  ['code: a path built in code outside vendor/', 'code', 's.src = `lib/${name}.js`;'],
  ['code: import()', 'code', "import('https://esm.sh/lib@1');"],
  ['code: import … from', 'code', "import lib from 'https://esm.sh/lib@1';"],
  ['code: importScripts()', 'code', "importScripts('https://cdn.example.com/lib');"],
  ['code: new Worker', 'code', "new Worker('https://cdn.example.com/worker');"],
  ['code: serviceWorker.register()', 'code', "navigator.serviceWorker.register(swUrl);"],
  ['code: worklet addModule()', 'code', "CSS.paintWorklet.addModule('https://cdn.example.com/paint');"],
  ['code: pdf.js workerSrc', 'code', "pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.example.com/pdf.worker';"],
  ['code: eval of fetched text', 'code', 'fetch(u).then((r) => r.text()).then((t) => eval(t));'],
  ['code: new Function', 'code', 'new Function(text)();'],
  ['code: string given to setTimeout', 'code', "setTimeout('run()', 0);"],
  ['code: WebAssembly', 'code', 'WebAssembly.instantiateStreaming(fetch(u));'],
  ['code: an address ending in .js', 'code', "const u = 'https://cdn.example.com/x/lib.min.js';"],
  ['code: a protocol-relative address ending in .mjs', 'code', "const u = '//cdn.example.com/lib.mjs';"],
  ['appearance.js: a script added by code', 'appearance.js', "var s = document.createElement('script'); s.src = 'https://cdn.example.com/lib'; document.head.appendChild(s);"],
  ['a local script that is not in the repository', 'head', '<script src="missing-file.js"></script>'],
  // the file outside is there, and harmless: caught for leaving the repository, not for being missing
  ['a local path that leaves the repository', 'head', '<script src="../other/lib.js"></script>', { '../other/lib.js': '/* outside */\n' }],
];
// Forms the page may use; none may be caught
export const ALLOWED = [
  ['tag: a vendor/ file', 'head', '<script src="vendor/react-18.3.1.production.min.js"></script>'],
  ['tag: this repository\'s own file', 'head', '<script src="appearance.js"></script>'],
  ['tag: this repository\'s own file, no quotes', 'head', '<script src=appearance.js></script>'],
  ['code: pdf.js from vendor/', 'code', 's.src = `vendor/pdf-${V}.min.js`; window.pdfjsLib.GlobalWorkerOptions.workerSrc = `vendor/pdf.worker-${V}.min.js`;'],
  ['a stylesheet from another host', 'head', '<link rel="stylesheet" href="https://fonts.example.com/css2?family=Inter">'],
  ['preconnect', 'head', '<link rel="preconnect" href="https://fonts.example.com">'],
  ['a link and an API call', 'code', "a.href = 'https://github.com/example'; fetch('https://api.example.com/v1/items');"],
];

// The repository's files with one sample applied
export function withSample(read, [, where, snippet, files = {}]) {
  return (p) => {
    if (p in files) return files[p];
    const s = read(p);
    if (where === 'appearance.js') return p === 'appearance.js' ? `${s}\n${snippet}\n` : s;
    if (p !== 'index.html') return s;
    const add = where === 'code' ? `<script>\n${snippet}\n</script>` : snippet;
    if (!s.includes('</head>')) throw new Error('index.html has no </head>');
    return s.replace('</head>', `${add}\n</head>`);
  };
}

function selfTest() {
  let ok = true;
  const real = scan(readRepo);
  console.log(`real page: ${real.findings.length} findings in ${real.files.join(', ')}`);
  if (real.findings.length) ok = false;
  for (const sample of SAMPLES) {
    const n = scan(withSample(readRepo, sample)).findings.length;
    console.log(`${n ? 'caught ' : 'MISSED '} ${sample[0]}`);
    if (!n) ok = false;
  }
  for (const sample of ALLOWED) {
    const f = scan(withSample(readRepo, sample)).findings;
    console.log(`${f.length ? 'WRONGLY CAUGHT' : 'allowed'} ${sample[0]}${f.length ? ': ' + f[0].form : ''}`);
    if (f.length) ok = false;
  }
  console.log(ok ? `SELF-TEST PASS: ${SAMPLES.length} forms caught, ${ALLOWED.length} allowed forms passed, the real page passed`
    : 'SELF-TEST FAIL');
  return ok;
}

// run as a command (not imported)
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  if (process.argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  const { findings, files } = scan(readRepo);
  for (const f of findings) console.log(`${f.file}:${f.line}: ${f.form}: ${f.text}`);
  if (findings.length) { console.log(`a script may be loaded from another host (${findings.length} findings)`); process.exit(1); }
  console.log(`0 scripts from other hosts (checked ${files.join(', ')})`);
}
