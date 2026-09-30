// ghost-mutants.mjs — shows the tests can fail: breaks each rule of src/ghost-flags.js in a temporary copy, one at a time, runs
// test/ghost-flags.test.mjs against the copy, and requires it to fail. The unbroken copy (the control) must pass.
//   node ghost-mutants.mjs
// Exit 0 only when the control passes and every mutant is caught. A mutant whose text is not found in the file is an
// error too (the file changed and this list must follow it).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SRC = readFileSync(join(ROOT, 'src/ghost-flags.js'), 'utf8');
const TESTS = join(ROOT, 'test/ghost-flags.test.mjs');

// [rule, what the break does, text in the file, replacement]
const MUTANTS = [
  ['liveness', 'a closed page no longer counts',
    "if (lv.state === 'expired') reasons.push", "if (false) reasons.push"],
  ['liveness', 'closed pages need a second reason',
    "reasons.some((r) => r.rule === 'liveness') || soft >= o.twoOf", "soft >= o.twoOf"],
  ['age', 'the age limit is ignored',
    'if (age > o.maxAgeDays) reasons.push', 'if (false) reasons.push'],
  ['age', 'off by one: 30 days counts',
    'if (age > o.maxAgeDays) reasons.push', 'if (age >= o.maxAgeDays) reasons.push'],
  ['age', '"30+ days ago" read as 30',
    "+m[1] + (m[2] ? 1 : 0)", "+m[1]"],
  ['repost', 'twins are never found',
    'if (twins.length) reasons.push', 'if (false) reasons.push'],
  ['repost', 'a different site counts as a repost',
    'y !== x && y.host === x.host && y.url !== x.url', 'y !== x && y.url !== x.url'],
  ['offsite', 'board links are never flagged',
    "else reasons.push({ rule: 'offsite'", "else seen.push({ rule: 'offsite'"],
  ['offsite', 'LinkedIn is not a job board',
    "const BOARDS = ['linkedin.com', ", 'const BOARDS = ['],
  ['offsite', 'employer site not matched by company',
    'norm(y.company) === norm(x.company)', 'norm(y.company) === norm(x.title)'],
  ['verdict', 'one soft reason is enough',
    'soft >= o.twoOf ?', 'soft >= 1 ?'],
  ['verdict', 'nothing known reads as clear',
    "unknown.length >= 3 ? 'unknown' : 'clear'", "'clear'"],
  ['livenessVerdict', 'Job Bank 410 not seen',
    "if (status === 410 || /jobpostingexpired/", "if (/jobpostingexpired/"],
  ['livenessVerdict', 'LinkedIn page without the posting counts as live',
    "if (!/topcard__title/.test(text)) return", 'if (false) return'],
  ['livenessVerdict', 'closed wording on other sites ignored',
    'if (status === 200 && CLOSED_WORDS.test(text))', 'if (false)'],
];

const dir = mkdtempSync(join(tmpdir(), 'ghost-mutants-'));
const run = (code) => {
  const file = join(dir, 'ghost-flags.js');
  writeFileSync(file, code);
  return spawnSync(process.execPath, ['--test', '--test-reporter=tap', TESTS], { env: { ...process.env, GHOST_FLAGS: file }, encoding: 'utf8' });
};
let bad = 0;
try {
  const control = run(SRC);
  console.log(`${control.status === 0 ? 'ok    ' : 'FAIL  '} control: the unbroken rules pass`);
  if (control.status !== 0) { bad++; console.log(control.stdout.slice(-2000)); }
  for (const [rule, what, from, to] of MUTANTS) {
    if (SRC.split(from).length !== 2) { bad++; console.log(`ERROR  ${rule}: ${what} — text not found exactly once: ${from}`); continue; }
    const r = run(SRC.replace(from, to));
    const failed = (r.stdout.match(/^not ok \d+ - (.*)$/gm) || []).map((l) => l.replace(/^not ok \d+ - /, ''));
    const caught = r.status !== 0 && failed.length > 0;
    if (!caught) bad++;
    console.log(`${caught ? 'caught' : 'MISSED'} ${rule}: ${what}${caught ? ` — failed: ${failed.join('; ')}` : ''}`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
console.log(bad ? `\nMUTANTS FAIL: ${bad} problem(s)` : `\nMUTANTS PASS: control green, ${MUTANTS.length} of ${MUTANTS.length} mutants caught by a failing test`);
process.exit(bad ? 1 : 0);
