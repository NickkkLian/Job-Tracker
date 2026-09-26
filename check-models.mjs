/* check-models.mjs — the page asks the Messages API for Opus 5.5 or Sonnet 5 only, and reads its replies by block type.

     node check-models.mjs              checks src/ and the built index.html
     node check-models.mjs --self-test  shows that each rule goes red on a sample that breaks it, and the real files pass

   Rules, over every file in src/ and index.html:
   - every Claude model id is claude-opus-5-5 or claude-sonnet-5 (both think on every request; thinking counts toward
     max_tokens, so every max_tokens next to a model id is at least 16000);
   - no request sets budget_tokens, temperature or a forced tool_choice, which these models reject;
   - no reply is read by position (content[0]): a thinking or web-search block can come first. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ALLOWED = new Set(['claude-opus-5-5', 'claude-sonnet-5']);

function problems(text) {
  const out = [];
  for (const m of text.matchAll(/claude-[a-z0-9.-]+/g)) {
    // a URL path segment like claude.com is not a model id
    if (!ALLOWED.has(m[0])) out.push('model id not allowed: ' + m[0]);
  }
  for (const m of text.matchAll(/max_tokens\s*:\s*([0-9.e]+)/g)) {
    if (Number(m[1]) < 16000) out.push('max_tokens below 16000: ' + m[1]);
  }
  for (const k of ['budget_tokens', 'temperature\\s*:', "tool_choice"]) {
    if (new RegExp(k).test(text)) out.push('request field these models reject: ' + k.replace('\\s*:', ''));
  }
  if (/\.content\s*\[\s*0\s*\]|content\?\.\s*\[\s*0\s*\]/.test(text)) out.push('reply read by position: content[0]');
  return out;
}

const files = [...fs.readdirSync(path.join(HERE, 'src')).map((f) => path.join('src', f)), 'index.html'];
let bad = 0;
for (const f of files) {
  for (const p of problems(fs.readFileSync(path.join(HERE, f), 'utf8'))) { console.log(`FAIL ${f}: ${p}`); bad++; }
}

if (process.argv.includes('--self-test')) {
  const samples = [
    ["model:'claude-haiku-4-5-20251001'", 'model id not allowed'],
    ['model: "claude-opus-4-8"', 'model id not allowed'],
    ['max_tokens: 4e3', 'max_tokens below 16000'],
    ["max_tokens:8192", 'max_tokens below 16000'],
    ["thinking:{type:'enabled', budget_tokens: 2000}", 'budget_tokens'],
    ['temperature: 0', 'temperature'],
    ["tool_choice:{type:'any'}", 'tool_choice'],
    ['const text = data.content[0].text;', 'content[0]'],
  ];
  for (const [s, want] of samples) {
    const got = problems(s);
    const caught = got.some((p) => p.includes(want));
    console.log(`${caught ? 'caught' : 'MISSED'}  ${want}  in  ${s}`);
    if (!caught) bad++;
  }
  const clean = problems("model:'claude-sonnet-5', max_tokens:16000, content.filter(b=>b.type==='text')");
  console.log(clean.length ? 'FAIL a clean request was flagged: ' + clean.join('; ') : 'ok      a clean request passes');
  if (clean.length) bad++;
}

console.log(bad ? `${bad} problem(s)` : `ok: ${files.join(', ')} ask for Opus 5.5 / Sonnet 5 only and read replies by block type`);
process.exit(bad ? 1 : 0);
