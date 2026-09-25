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
//      setAttribute('src', …) in any case, setAttributeNS(…, 'src', …)) or pdf.js's workerSrc — unless the address is
//      a string that starts as a plain path (a template with ${…} in it only inside vendor/, since the file it names
//      cannot be told);
//      and a src set through Object.assign(x, { src: … }) or Reflect.set(x, 'src', …), whatever its value;
//   6. code that runs text or bytes as code, which could have come from anywhere: eval and Function named in any way
//      (eval(), (0, eval)(), window['eval'], new Function(), Function(), (0, Function)()), a function's .constructor(),
//      a string given to setTimeout or setInterval, WebAssembly.instantiate / compile, a javascript: URL;
//   7. any http(s) or protocol-relative address that ends in .js or .mjs;
//   8. a script element made in code: it must be `const|let|var x = document.createElement('script')` (any case, any
//      quote), and x may then get no text, no children and no Object.assign (that would run text as code); any other
//      call with 'script' as its first argument (a helper that makes elements, an unnamed createElement) is a finding;
//   9. HTML that runs the scripts in it: document.write / writeln, createContextualFragment, setHTMLUnsafe /
//      parseHTMLUnsafe, and an iframe's srcdoc set in code.
//  10. the page's Content-Security-Policy (build.mjs writes it): exactly one <meta http-equiv>, before the first
//      <script>, that is exactly script-src 'self' followed by sha256 hashes of the page's own inline scripts. No host,
//      scheme or wildcard, no 'unsafe-inline', no 'unsafe-eval', no other directive. (node build.mjs --check makes sure
//      the hashes are those of the page's scripts.)
// A plain path is letters, digits and . _ ~ - / only, not starting with //: no scheme, no host. It must also stay inside
// this repository and name a file in it; the page's own scripts named this way are read in turn.
// Not checked here — a static check cannot be complete, and these get past it. Since 2026-09-25 the browser blocks them
// while the page runs, through the policy in check 10 (no 'unsafe-eval', no inline script without its hash, no other
// host): a string held in a variable and given
// to setTimeout / setInterval (setTimeout(code)); names built while the page runs (window['ev' + 'al'],
// document['create' + 'Element']('scr' + 'ipt')); a script loaded through a library in vendor/ (those are trusted by
// their sha256); frames, objects and embeds from another host (their code runs in that host's origin, not in this
// page); and any other way that is not in this list.
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
  ["setAttribute('src', …) in any case", /\bsetAttribute\s*\(\s*(['"`])src\1\s*,/gi],
  // setAttributeNS keeps the case of the name, and 'SRC' is not the src attribute, so only 'src' loads anything
  ["setAttributeNS(…, 'src', …)", /\bsetAttributeNS\s*\([^,]*,\s*(['"`])src\1\s*,/g],
  ['workerSrc', /\bworkerSrc\s*=(?![=>])/g],
];
const RUNS_TEXT = [
  ['eval, named in any way', /\beval\b/g],
  ['Function, named in any way', /(?<![\w$.])Function\b/g],
  ["a function's constructor called (Function by another name)", /\.\s*constructor\s*\(/g],
  ['a string given to setTimeout / setInterval', /\bset(?:Timeout|Interval)\s*\(\s*['"`]/g],
  ['WebAssembly.instantiate / compile', /\bWebAssembly\s*\.\s*(?:instantiate|compile)(?:Streaming)?\s*\(/g],
  ['a javascript: URL', /\bjavascript\s*:/gi],
];
// Found wherever they are, whatever their arguments
const ALWAYS = [
  ['Object.assign() that sets a src', /\bObject\s*\.\s*assign\s*\([^;]{0,300}?[{,]\s*['"]?src['"]?\s*:/g],
  ["Reflect.set(…, 'src', …)", /\bReflect\s*\.\s*set\s*\([^,;]*,\s*(['"`])src\1/gi],
  ['document.write / writeln: runs the scripts in what it writes', /\bdocument\s*\.\s*write(?:ln)?\b/g],
  ['createContextualFragment: runs the scripts in its HTML', /\bcreateContextualFragment\b/g],
  ['setHTMLUnsafe / parseHTMLUnsafe', /\b(?:set|parse)HTMLUnsafe\b/g],
  ['an iframe srcdoc set in code', /\.\s*srcdoc\s*=(?![=>])/g],
  ["setAttribute('srcdoc', …)", /\bsetAttribute\s*\(\s*(['"`])srcdoc\1/gi],
];
// 'script' as the first argument of a call, and the one form of it this check can follow
const SCRIPT_CALL = /\(\s*(['"`])script\1\s*[,)]/gi;
const NAMED_SCRIPT = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*document\s*\.\s*createElement\s*$/;
// what would put code into the script element held in `name`
const scriptFill = (name) => {
  const v = name.replace(/\$/g, '\\$');
  return new RegExp(`(?<![\\w$.])${v}\\s*\\.\\s*(?:(?:text|textContent|innerText|innerHTML|outerHTML)\\s*=(?![=>])`
    + `|(?:append|appendChild|prepend|insertBefore|replaceChildren|insertAdjacent\\w*)\\s*\\()`
    + `|\\bObject\\s*\\.\\s*assign\\s*\\(\\s*${v}(?![\\w$])`, 'g');
};
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
  for (const [form, re] of ALWAYS) for (const m of s.matchAll(re)) add(m.index, form);
  for (const m of s.matchAll(SCRIPT_CALL)) {
    const named = NAMED_SCRIPT.exec(s.slice(Math.max(0, m.index - 160), m.index));
    if (!named) { add(Math.max(0, m.index - 40), "a script element made in a way this check cannot follow (not const x = document.createElement('script'))"); continue; }
    for (const k of s.matchAll(scriptFill(named[1]))) add(k.index, `code put into the script element ${named[1]}: runs text as code`);
  }
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

// 10. The page's Content-Security-Policy. Returns findings like scan()'s.
export const CSP_META = /<meta\s+http-equiv\s*=\s*["']?Content-Security-Policy["']?\s+content\s*=\s*"([^"]*)"\s*\/?>/gi;
export function checkCsp(page) {
  const metas = [...page.matchAll(CSP_META)];
  if (metas.length !== 1) {
    return [{ file: 'index.html', line: 0, form: `the page needs exactly one Content-Security-Policy <meta> (found ${metas.length})`, text: '' }];
  }
  const m = metas[0], line = page.slice(0, m.index).split('\n').length, found = [];
  const firstScript = page.search(/<script\b/i);
  if (firstScript !== -1 && m.index > firstScript) {
    found.push({ file: 'index.html', line, form: 'the Content-Security-Policy comes after a <script>, which runs without it', text: m[0] });
  }
  const t = m[1].trim().split(/\s+/);
  if (t[0] !== 'script-src' || t[1] !== "'self'" || t.length < 3 || !t.slice(2).every((x) => /^'sha256-[A-Za-z0-9+\/]{43}='$/.test(x))) {
    found.push({ file: 'index.html', line, form: "the Content-Security-Policy is not exactly script-src 'self' plus sha256 hashes", text: m[1] });
  }
  return found;
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
  ["code: setAttribute('SRC') in upper case", 'code', "s.setAttribute('SRC', 'https://cdn.example.com/lib');"],
  ['code: Object.assign(el, { src })', 'code', "Object.assign(el, { async: true, src: 'https://cdn.example.com/lib' });"],
  ["code: Reflect.set(el, 'src', …)", 'code', "Reflect.set(el, 'src', u);"],
  ['code: indirect eval', 'code', '(0, eval)(code);'],
  ['code: eval by name', 'code', "window['eval'](code);"],
  ['code: Function by another name', 'code', 'const F = Function; F(code)();'],
  ["code: a function's constructor", 'code', '(() => {}).constructor(code)();'],
  ['code: a javascript: URL', 'code', "location.href = 'javascript:' + code;"],
  ['code: code put into a script element (.text)', 'code', "const s = document.createElement('script'); s.text = code; document.head.appendChild(s);"],
  ['code: code put into a script element (a child)', 'code', "const n = document.createElement('SCRIPT'); n.appendChild(document.createTextNode(code)); document.body.append(n);"],
  ['code: Object.assign on a script element', 'code', "const s2 = document.createElement('script'); Object.assign(s2, { text: code }); document.head.appendChild(s2);"],
  ['code: a script element not kept in a variable', 'code', "document.head.appendChild(document.createElement('script')).text = code;"],
  ['code: a helper that makes a script element', 'code', "el('script', { src: u });"],
  ['code: a split tag written by document.write', 'code', "document.write('<scr' + 'ipt src=\"' + u + '\"></scr' + 'ipt>');"],
  ['code: createContextualFragment', 'code', 'document.body.append(document.createRange().createContextualFragment(html));'],
  ['code: setHTMLUnsafe', 'code', 'box.setHTMLUnsafe(html);'],
  ['code: an iframe srcdoc set in code', 'code', 'frame.srcdoc = html;'],
  ["code: setAttribute('srcdoc')", 'code', "frame.setAttribute('srcdoc', html);"],
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
  ['code: the pdf.js loader as the page has it', 'code', 'const s = document.createElement("script"); s.src = `vendor/pdf-${V}.min.js`; s.onload = () => res(); document.head.appendChild(s);'],
  ['code: a src in element props (an iframe, not a script)', 'code', 'React.createElement("iframe", { className: "pdf-view", src: blobUrl, title: label });'],
  ['code: text and children on other elements', 'code', "box.setAttribute('data-src', u); tip.textContent = t; ov.appendChild(box); document.body.appendChild(ov);"],
  ['words that only contain eval or Function', 'code', 'const retrieval = evaluate(interval); // a function that returns'],
];

// Ways this check does not catch (the "Not checked" list at the top), printed by the self-test so that CI output says
// so too. They do not change its result; one that starts being caught is printed as such.
export const KNOWN_MISSED = [
  ['code text in a variable given to setTimeout', 'code', 'setTimeout(code, 0);'],
  ['eval under a name built while the page runs', 'code', "window['ev' + 'al'](code);"],
  ['a script element under a name built while the page runs', 'code', "document['create' + 'Element']('scr' + 'ipt').text = code;"],
];

// Changes to the real page's policy; check 10 must catch each one
const ADD = (src) => (p) => p.replace("script-src 'self' ", `script-src 'self' ${src} `);
export const CSP_BROKEN = [
  ['no policy', (p) => p.replace(CSP_META, '')],
  ["'unsafe-eval' added", ADD("'unsafe-eval'")],
  ["'unsafe-inline' added", ADD("'unsafe-inline'")],
  ['another host added', ADD('https://cdn.example.com')],
  ['any https host', ADD('https:')],
  ['a wildcard', ADD('*')],
  ['another directive added', (p) => p.replace(/(content="script-src[^"]*)"/, '$1; object-src *"')],
  ["'self' taken out", (p) => p.replace("script-src 'self' ", 'script-src ')],
  ['no hash left', (p) => p.replace(/(content="script-src 'self')[^"]*"/, '$1"')],
  ['the policy moved after the first script', (p) => { const m = p.match(CSP_META)[0]; const q = p.replace(m, ''); return q.replace('</head>', `${m}\n</head>`); }],
  ['two policies', (p) => p.replace(CSP_META, (m) => `${m}\n${m}`)],
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
  const page = readRepo('index.html');
  const own = checkCsp(page);
  console.log(own.length ? `REAL PAGE POLICY FAILS: ${own[0].form}` : "real page policy: script-src 'self' + hashes, before the first script");
  if (own.length) ok = false;
  for (const [name, change] of CSP_BROKEN) {
    const changed = change(page);
    const n = changed === page ? 0 : checkCsp(changed).length;
    console.log(`${n ? 'caught ' : 'MISSED '} policy: ${name}${changed === page ? ' (the change did not apply)' : ''}`);
    if (!n) ok = false;
  }
  for (const sample of KNOWN_MISSED) {
    const n = scan(withSample(readRepo, sample)).findings.length;
    console.log(`${n ? 'now caught (known gap closed)' : 'not caught (known gap)'} ${sample[0]}`);
  }
  console.log(ok ? `SELF-TEST PASS: ${SAMPLES.length} forms caught, ${ALLOWED.length} allowed forms passed, the real page passed`
    + `, ${CSP_BROKEN.length} broken policies caught (${KNOWN_MISSED.length} known gaps of the static check listed above;`
    + ' the policy blocks them at run time)' : 'SELF-TEST FAIL');
  return ok;
}

// run as a command (not imported)
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  if (process.argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  const { findings, files } = scan(readRepo);
  findings.push(...checkCsp(readRepo('index.html')));
  for (const f of findings) console.log(`${f.file}:${f.line}: ${f.form}: ${f.text}`);
  if (findings.length) { console.log(`a script may be loaded from another host (${findings.length} findings)`); process.exit(1); }
  console.log(`0 scripts from other hosts (checked ${files.join(', ')}); the Content-Security-Policy allows only this site and the page's own scripts`);
}
