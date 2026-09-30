// ghost-check.mjs — the page's Ghost check from the command line, plus the one thing the page cannot do: open each
// posting and see whether it is still up (a browser page may not read other sites' pages; this script can).
//
//   node ghost-check.mjs links.txt                  flags from what the lines say (no network)
//   node ghost-check.mjs links.txt --live           first opens each posting that has no "live:" field yet
//   node ghost-check.mjs - --live < links.txt       read the lines from stdin
//   options: --today YYYY-MM-DD (default: today's local date)   --json (print the results as JSON)
//
// With --live it also prints every line with the "live:" field it found, ready to paste into the page's Ghost check.
// Line format and rules: src/ghost-flags.js. One request per posting, 1.5 s apart; nothing is sent anywhere else.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const GhostFlags = require('./src/ghost-flags.js');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';

function localISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// Open one posting and say what was found: { state, detail }. LinkedIn's posting pages need a login, so its public
// guest view of the same posting is read instead (as an earlier liveness checker did).
export async function liveFor(url, fetchImpl = fetch) {
  let target = url;
  const li = /linkedin\.com\/jobs\/view\/(?:[^/?]*-)?(\d{6,})/.exec(url);
  if (li) target = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${li[1]}`;
  try {
    const res = await fetchImpl(target, { redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    const body = await res.text();
    return GhostFlags.livenessVerdict({ url, status: res.status, finalUrl: res.url || target, body });
  } catch (e) {
    return { state: 'unknown', detail: `no answer: ${e.name === 'TimeoutError' ? 'timed out' : e.message}` };
  }
}

// Add "| live: …" to every line that has a link and no live field yet
export async function annotate(text, { fetchImpl = fetch, pause = 1500, log = () => {} } = {}) {
  const out = [];
  let first = true;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    const p = line && !line.startsWith('#') ? GhostFlags.parseLine(line) : null;
    if (!p || p.error || p.live) { out.push(raw); continue; }
    if (!first && pause) await new Promise((r) => setTimeout(r, pause));
    first = false;
    const v = await liveFor(p.url, fetchImpl);
    log(`${v.state.padEnd(7)} ${p.url}${v.detail ? ` (${v.detail})` : ''}`);
    out.push(`${line} | live: ${v.state}${v.detail ? ` (${v.detail})` : ''}`);
  }
  return out.join('\n');
}

const LABEL = { 'not-hiring': 'PROBABLY NOT HIRING', check: 'CHECK FIRST', clear: 'NO WARNING SIGNS FOUND', unknown: 'NOT ENOUGH TO TELL', unreadable: 'UNREADABLE LINE' };
export function report(results) {
  const lines = [];
  for (const r of results) {
    lines.push(`${LABEL[r.verdict]}  ${r.url || r.line}`);
    if (r.error) { lines.push(`  - ${r.error}`); continue; }
    for (const x of r.reasons) lines.push(`  x ${x.en}${x.evidence ? ` [${x.evidence.join(', ')}]` : ''}`);
    for (const x of r.seen) lines.push(`  . ${x.en}`);
    for (const x of r.unknown) lines.push(`  ? ${x.en}`);
  }
  const n = (v) => results.filter((r) => r.verdict === v).length;
  lines.push('', `${results.length} lines: ${n('not-hiring')} probably not hiring, ${n('check')} check first, ${n('clear')} no warning signs found, ${n('unknown')} not enough to tell, ${n('unreadable')} unreadable`);
  return lines.join('\n');
}

async function main(argv) {
  const args = argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const flag = (name) => { const i = args.indexOf(name); if (i >= 0) args.splice(i, 1); return i >= 0; };
  const today = opt('--today') || localISO(new Date());
  const live = flag('--live'), json = flag('--json');
  if (args.length !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    console.error('usage: node ghost-check.mjs <file|-> [--live] [--today YYYY-MM-DD] [--json]');
    process.exit(2);
  }
  let text = readFileSync(args[0] === '-' ? 0 : args[0], 'utf8');
  if (live) text = await annotate(text, { log: (s) => console.error(s) });
  const results = GhostFlags.check(text, { today });
  console.log(json ? JSON.stringify(results, null, 2) : report(results));
  if (live && !json) console.log('\nLines to paste into the Ghost check view:\n' + text.trim());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv);
