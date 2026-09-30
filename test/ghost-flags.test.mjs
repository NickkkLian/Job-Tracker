// Tests for the Ghost check's rules (src/ghost-flags.js) and the command line's liveness check (ghost-check.mjs).
//   node --test test/ghost-flags.test.mjs
// GHOST_FLAGS=<path> loads another copy of the rules instead; ghost-mutants.mjs uses it to show each rule's tests fail
// when that rule is broken.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const G = require(process.env.GHOST_FLAGS ? resolve(process.env.GHOST_FLAGS) : '../src/ghost-flags.js');
const TODAY = '2026-09-29';
const one = (line, today = TODAY) => G.check(line, { today })[0];
const rules = (r) => r.reasons.map((x) => x.rule).sort();

// ── liveness ──
test('liveness: a closed posting is "probably not hiring" on its own', () => {
  const r = one('https://careers.acme.example/jobs/1 | company: Acme | title: Analyst | posted: 2 days ago | live: expired (HTTP 410)');
  assert.deepEqual(rules(r), ['liveness']);
  assert.equal(r.verdict, 'not-hiring');
  assert.match(r.reasons[0].en, /HTTP 410/);
});
test('liveness: a page still up is recorded as seen, not as proof of hiring', () => {
  const r = one('https://careers.acme.example/jobs/1 | company: Acme | title: Analyst | posted: 2 days ago | live: live (HTTP 200)');
  assert.equal(r.verdict, 'clear');
  assert.ok(r.seen.some((x) => x.rule === 'liveness' && /does not show anyone is hiring/.test(x.en)));
});
test('liveness: no live field is listed as not checked', () => {
  const r = one('https://careers.acme.example/jobs/1 | company: Acme | title: Analyst | posted: 2 days ago');
  assert.ok(r.unknown.some((x) => x.rule === 'liveness'));
});

// ── age ──
test('age: more than 30 days is a reason, 30 is not', () => {
  const base = 'https://careers.acme.example/jobs/1 | company: Acme | title: Analyst | live: live | posted: ';
  assert.deepEqual(rules(one(base + '31 days ago')), ['age']);
  assert.deepEqual(rules(one(base + '30 days ago')), []);
  assert.deepEqual(rules(one(base + '2026-08-30')), []);          // 30 days before TODAY
  assert.deepEqual(rules(one(base + '2026-08-29')), ['age']);     // 31 (August has 31 days)
});
test('age: dates and the usual relative wordings', () => {
  assert.equal(G.ageDays('2026-09-01', TODAY), 28);
  assert.equal(G.ageDays('30+ days ago', TODAY), 31);
  assert.equal(G.ageDays('3 weeks ago', TODAY), 21);
  assert.equal(G.ageDays('2 months ago', TODAY), 60);
  assert.equal(G.ageDays('yesterday', TODAY), 1);
  assert.equal(G.ageDays('5 hours ago', TODAY), 0);
  assert.equal(G.ageDays('last spring', TODAY), null);
});
test('age: an unreadable date is listed as unknown, not guessed', () => {
  const r = one('https://careers.acme.example/jobs/1 | company: Acme | title: Analyst | posted: a while back | live: live');
  assert.ok(r.unknown.some((x) => x.rule === 'age' && /a while back/.test(x.en)));
  assert.deepEqual(rules(r), []);
});

// ── repost ──
test('repost: the same company and title twice on one site, under different links', () => {
  const rs = G.check([
    'https://jobs.lever.co/acme/1 | title: Data Analyst | posted: 3 days ago | live: live',
    'https://jobs.lever.co/acme/2 | title: Data  analyst | posted: 1 day ago | live: live',
  ].join('\n'), { today: TODAY });
  for (const r of rs) {
    assert.deepEqual(rules(r), ['repost']);
    assert.equal(r.verdict, 'check');
    assert.equal(r.reasons[0].evidence.length, 1);
  }
});
test('repost: the same posting on a board and on the employer site is not a repost', () => {
  const rs = G.check([
    'https://www.linkedin.com/jobs/view/4000000001 | company: Acme | title: Data Analyst | posted: 3 days ago | live: live',
    'https://jobs.lever.co/acme/1 | title: Data Analyst | posted: 3 days ago | live: live',
  ].join('\n'), { today: TODAY });
  assert.deepEqual(rs.map(rules), [[], []]);
});
test('repost: another title at the same company is not a repost', () => {
  const rs = G.check('https://jobs.lever.co/acme/1 | title: Data Analyst | posted: 3 days ago | live: live\nhttps://jobs.lever.co/acme/2 | title: Data Engineer | posted: 3 days ago | live: live', { today: TODAY });
  assert.deepEqual(rs.map(rules), [[], []]);
});

// ── offsite ──
test('offsite: a board link with nothing on the employer side is a reason', () => {
  const r = one('https://www.indeed.com/viewjob?jk=1 | company: Acme Inc. | title: Analyst | posted: 2 days ago | live: live');
  assert.deepEqual(rules(r), ['offsite']);
});
test('offsite: an employer-site or ATS link for the same company clears it (names matched loosely)', () => {
  const rs = G.check([
    'https://www.indeed.com/viewjob?jk=1 | company: Acme Inc. | title: Analyst | posted: 2 days ago | live: live',
    'https://careers.acme.example/jobs/9 | title: Analyst | posted: 2 days ago | live: live',
  ].join('\n'), { today: TODAY });
  assert.deepEqual(rules(rs[0]), []);
  assert.ok(rs[0].seen.some((x) => x.rule === 'offsite' && x.evidence[0].includes('careers.acme.example')));
});
test('offsite: the company is read from LinkedIn and ATS links', () => {
  assert.equal(G.parseLine('https://www.linkedin.com/jobs/view/data-analyst-at-acme-labs-4000000001').company, 'acme labs');
  assert.equal(G.parseLine('https://boards.greenhouse.io/acmelabs/jobs/1').company, 'acmelabs');
  assert.equal(G.parseLine('https://acme.wd3.myworkdayjobs.com/en-US/x/job/y').company, 'acme');
  assert.equal(G.parseLine('https://www.indeed.com/viewjob?jk=1').kind, 'board');
  assert.equal(G.parseLine('https://jobs.lever.co/acme/1').kind, 'ats');
  assert.equal(G.parseLine('https://careers.acme.co.uk/1').company, 'acme');
});
test('offsite: a board link with no company is unknown, not a reason', () => {
  const r = one('https://www.linkedin.com/jobs/view/4000000007');
  assert.deepEqual(rules(r), []);
  assert.ok(r.unknown.some((x) => x.rule === 'offsite'));
});

// ── verdict ──
test('verdict: two soft reasons are "probably not hiring", one is "check first"', () => {
  const two = one('https://www.indeed.com/viewjob?jk=1 | company: Acme | title: Analyst | posted: 45 days ago | live: live');
  assert.deepEqual(rules(two), ['age', 'offsite']);
  assert.equal(two.verdict, 'not-hiring');
  const single = one('https://www.indeed.com/viewjob?jk=1 | company: Acme | title: Analyst | posted: 5 days ago | live: live');
  assert.equal(single.verdict, 'check');
});
test('verdict: a line that tells almost nothing is "not enough to tell", never "clear"', () => {
  assert.equal(one('https://www.linkedin.com/jobs/view/4000000007').verdict, 'unknown');
});
test('verdict: every flag carries its reasons (no bare verdicts)', () => {
  for (const r of G.check(G.SAMPLE, { today: TODAY })) {
    if (r.verdict === 'not-hiring' || r.verdict === 'check') assert.ok(r.reasons.length > 0, r.url);
    for (const x of [...r.reasons, ...r.seen, ...r.unknown]) assert.ok(x.en && x.zh, r.url);
  }
});
test('the sample: 20 links, 7 probably not hiring, 6 check first, 1 not enough to tell, 6 clear', () => {
  const rs = G.check(G.SAMPLE, { today: TODAY });
  const n = (v) => rs.filter((r) => r.verdict === v).length;
  assert.deepEqual([rs.length, n('not-hiring'), n('check'), n('unknown'), n('clear')], [20, 7, 6, 1, 6]);
});
test('lines that are not links are reported, not dropped silently', () => {
  const rs = G.check('# a comment\nnot a link\nftp://x.example/1\nhttps://careers.acme.example/1', { today: TODAY });
  assert.deepEqual(rs.map((r) => r.verdict).slice(0, 2), ['unreadable', 'unreadable']);
  assert.equal(rs.length, 3);
});

// ── liveness verdict from one HTTP response (the command line's --live) ──
test('livenessVerdict: Job Bank (expired page and 410)', () => {
  const u = 'https://www.jobbank.gc.ca/jobsearch/jobposting/1';
  assert.equal(G.livenessVerdict({ url: u, status: 410, finalUrl: u, body: '' }).state, 'expired');
  assert.equal(G.livenessVerdict({ url: u, status: 200, finalUrl: 'https://www.jobbank.gc.ca/jobsearch/jobpostingexpired/1', body: '' }).state, 'expired');
  assert.equal(G.livenessVerdict({ url: u, status: 200, finalUrl: u, body: '<div class="jobposting-brief">' }).state, 'live');
  assert.equal(G.livenessVerdict({ url: u, status: 200, finalUrl: u, body: '<p>maintenance</p>' }).state, 'unknown');
});
test('livenessVerdict: LinkedIn guest view', () => {
  const u = 'https://www.linkedin.com/jobs/view/4000000001';
  assert.equal(G.livenessVerdict({ url: u, status: 200, body: '<h2 class="topcard__title">A</h2> No longer accepting applications' }).state, 'expired');
  assert.equal(G.livenessVerdict({ url: u, status: 200, body: '<h2 class="topcard__title">A</h2>' }).state, 'live');
  assert.equal(G.livenessVerdict({ url: u, status: 200, body: '<html></html>' }).state, 'unknown');
  assert.equal(G.livenessVerdict({ url: u, status: 404, body: '' }).state, 'unknown');
});
test('livenessVerdict: other sites', () => {
  const u = 'https://boards.greenhouse.io/acme/jobs/1';
  assert.equal(G.livenessVerdict({ url: u, status: 404, body: '' }).state, 'expired');
  assert.equal(G.livenessVerdict({ url: u, status: 200, finalUrl: 'https://boards.greenhouse.io/acme?error=true', body: '' }).state, 'expired');
  assert.equal(G.livenessVerdict({ url: u, status: 200, body: 'Sorry, this position has been filled.' }).state, 'expired');
  assert.equal(G.livenessVerdict({ url: u, status: 200, body: 'Apply now' }).state, 'live');
  assert.equal(G.livenessVerdict({ url: u, status: 503, body: '' }).state, 'unknown');
});

// ── the command line's fetch path, against a local server (no real site is contacted) ──
test('ghost-check.mjs --live: annotates each line from what the server answered', async () => {
  const { annotate } = await import('../ghost-check.mjs');
  const server = createServer((req, res) => {
    if (req.url === '/gone') { res.writeHead(404); res.end('not found'); return; }
    if (req.url === '/filled') { res.writeHead(200); res.end('This position has been filled'); return; }
    res.writeHead(200); res.end('<h1>Analyst</h1><a>Apply</a>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const out = await annotate(`${base}/gone | company: Acme\n${base}/filled\n${base}/open\n${base}/kept | live: live (given)`, { pause: 0 });
    assert.deepEqual(out.split('\n').map((l) => /live: (\w+)/.exec(l)[1]), ['expired', 'expired', 'live', 'live']);
    assert.match(out.split('\n')[3], /\(given\)$/);
  } finally { server.close(); }
});
