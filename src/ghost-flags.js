// ghost-flags.js — "probably not hiring" flags for job postings, with the reasons and the evidence for each.
//
// No score and no model: four plain rules, each of which either fires with the evidence it saw, or says what it could
// not know. build.mjs puts this file in front of src/app.jsx, so the page and `node ghost-check.mjs` (the command-line
// version, which can also check whether each posting is still up) run the same rules. test/ghost-flags.test.mjs tests
// each rule, and ghost-mutants.mjs breaks each rule in a copy of this file and requires a test to fail.
//
// Input: one posting per line, a link first, then optional fields separated by " | ":
//   https://www.linkedin.com/jobs/view/4000000001 | company: Northgate Datalab | title: Data Analyst | posted: 2026-08-10 | live: expired (HTTP 410)
// `posted` takes a date (YYYY-MM-DD) or "N days/weeks/months ago" (also "30+ days ago", "today", "yesterday").
// `live` is what a liveness check found: expired, live or unknown, with a detail in brackets. ghost-check.mjs --live
// writes it; nothing in the page fetches the postings (the browser is not allowed to read other sites' pages).
//
// The rules (numbers are defaults you can pass in, chosen by hand, not learned from data):
//   liveness  the posting's page says it is closed or gone                                  -> probably not hiring
//   age       posted more than 30 days ago
//   repost    the same company and title appear more than once on the same site under different links
//   offsite   only found on a job board; no link for it on the employer's own site or applicant system (Greenhouse,
//             Lever, Workday, …) in the same list
// Verdict: liveness alone, or any two of the other three -> "probably not hiring"; one -> "check first"; none, with
// three or all four rules unable to look -> "not enough to tell"; otherwise "no warning signs found", which is not a
// promise that anyone is hiring: the flag also lists what it could not check.
const GhostFlags = (() => {
  const DEFAULTS = { maxAgeDays: 30, twoOf: 2 };

  // Job boards that list other people's postings. A posting found only here cannot be matched to the employer.
  const BOARDS = ['linkedin.com', 'indeed.com', 'indeed.ca', 'glassdoor.com', 'glassdoor.ca', 'ziprecruiter.com',
    'jobbank.gc.ca', 'monster.com', 'monster.ca', 'simplyhired.com', 'talent.com', 'workopolis.com', 'eluta.ca',
    'jooble.org', 'careerbuilder.com', 'dice.com', 'wellfound.com', 'builtin.com', 'jobillico.com', 'seek.com.au',
    'reed.co.uk', 'totaljobs.com', 'jobsdb.com', 'zhipin.com', 'liepin.com', '51job.com'];
  // Applicant systems an employer runs its own postings on: a link here counts as the employer's own site. `co` finds the
  // employer's name in the link.
  const ATS = [
    { host: 'greenhouse.io', co: (u) => u.pathname.split('/')[1] },
    { host: 'lever.co', co: (u) => u.pathname.split('/')[1] },
    { host: 'ashbyhq.com', co: (u) => u.pathname.split('/')[1] },
    { host: 'smartrecruiters.com', co: (u) => u.pathname.split('/')[1] },
    { host: 'jobvite.com', co: (u) => u.pathname.split('/')[1] },
    { host: 'workable.com', co: (u) => u.pathname.split('/')[1] },
    { host: 'myworkdayjobs.com', co: (u) => u.hostname.split('.')[0] },
    { host: 'bamboohr.com', co: (u) => u.hostname.split('.')[0] },
    { host: 'recruitee.com', co: (u) => u.hostname.split('.')[0] },
    { host: 'breezy.hr', co: (u) => u.hostname.split('.')[0] },
    { host: 'taleo.net', co: (u) => u.hostname.split('.')[0] },
    { host: 'icims.com', co: (u) => u.hostname.split('.')[0].replace(/^careers-/, '') },
  ];
  // Words a closed posting's page shows (an earlier liveness checker's markers, plus the common ATS wordings)
  const CLOSED_WORDS = /no longer accepting applications|this job (?:posting )?(?:has expired|is no longer available)|job posting (?:has )?expired|position has been filled|this (?:job|position|posting) (?:is )?(?:closed|no longer (?:open|available))|no longer (?:open|available) for applications/i;

  const hostIs = (hostname, h) => hostname === h || hostname.endsWith('.' + h);
  const norm = (s) => String(s || '').toLowerCase()
    .replace(/\b(inc|ltd|llc|llp|corp|corporation|co|company|limited|group|plc|gmbh)\b\.?/g, ' ')
    .replace(/[^a-z0-9一-鿿]+/g, '');
  const normTitle = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9一-鿿]+/g, ' ').trim();

  function classify(u) {
    const h = u.hostname.toLowerCase();
    if (BOARDS.some((b) => hostIs(h, b))) return { kind: 'board', company: companyFromBoard(u) };
    const ats = ATS.find((a) => hostIs(h, a.host));
    if (ats) return { kind: 'ats', company: ats.co(u) || '' };
    // the employer's own site: the name before the public suffix (careers.acme.com -> acme)
    const parts = h.replace(/^www\./, '').split('.');
    const two = parts.length > 2 && /^(co|com|org|gov|ac|net)$/.test(parts[parts.length - 2]);
    return { kind: 'employer', company: parts[parts.length - (two ? 3 : 2)] || '' };
  }
  // LinkedIn's readable links carry the company: /jobs/view/data-analyst-at-northgate-datalab-4000000001
  function companyFromBoard(u) {
    const m = u.pathname.match(/\/jobs\/view\/[^/]*?-at-([a-z0-9-]+?)-\d{6,}/i);
    return m ? m[1] : '';
  }

  const DAY = 86400000;
  function parseDay(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  // Days between the posting date and today, or null when the text says nothing readable
  function ageDays(text, today) {
    const t = String(text || '').trim().toLowerCase();
    if (!t) return null;
    const now = parseDay(today);
    const d = parseDay(t);
    if (!isNaN(d)) return Math.round((now - d) / DAY);
    if (/^(today|just now|\d+\s*(minutes?|hours?)\s*ago)$/.test(t)) return 0;
    if (t === 'yesterday') return 1;
    const m = /^(\d+)\s*(\+?)\s*(days?|weeks?|months?)\s*ago$/.exec(t);
    if (!m) return null;
    const n = +m[1] + (m[2] ? 1 : 0);   // "30+ days ago" is more than 30
    return m[3].startsWith('day') ? n : m[3].startsWith('week') ? n * 7 : n * 30;
  }

  function liveState(text) {
    const t = String(text || '').trim();
    const m = /^(\w+)\s*(?:\((.*)\))?$/.exec(t);
    if (!m) return { state: t ? 'unknown' : null, detail: t };
    const w = m[1].toLowerCase();
    const state = /^(expired|closed|gone|removed)$/.test(w) ? 'expired' : /^(live|open|up)$/.test(w) ? 'live' : 'unknown';
    return { state, detail: m[2] || '' };
  }

  // One line -> a posting, or { error } for a line that does not start with a link
  function parseLine(line) {
    const [first, ...rest] = String(line).split('|').map((s) => s.trim());
    let u;
    try { u = new URL(first); } catch (e) { return { error: 'not a link', line: String(line).trim() }; }
    if (!/^https?:$/.test(u.protocol)) return { error: 'not a web link', line: String(line).trim() };
    const fields = {};
    for (const f of rest) {
      const m = /^(company|title|posted|live)\s*:\s*(.*)$/i.exec(f);
      if (m) fields[m[1].toLowerCase()] = m[2].trim();
    }
    const c = classify(u);
    return {
      url: u.href, host: u.hostname.replace(/^www\./, ''), kind: c.kind,
      company: fields.company || c.company.replace(/-/g, ' '), companyFrom: fields.company ? 'given' : c.company ? 'link' : null,
      title: fields.title || '', posted: fields.posted || '', live: fields.live || '',
    };
  }

  // Many lines -> one result per line, in order. `today` is YYYY-MM-DD (the caller's local date).
  function check(text, opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    const today = o.today;
    const lines = String(text).split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
    const items = lines.map(parseLine);
    const ok = items.filter((x) => !x.error);
    const key = (x) => norm(x.company) && normTitle(x.title) ? norm(x.company) + '|' + normTitle(x.title) : '';

    return items.map((x) => {
      if (x.error) return { ...x, verdict: 'unreadable', reasons: [], unknown: [], seen: [] };
      const reasons = [], unknown = [], seen = [];

      // liveness
      const lv = liveState(x.live);
      if (lv.state === 'expired') reasons.push({ rule: 'liveness', en: `The posting's page says it is closed or gone${lv.detail ? ` (${lv.detail})` : ''}.`, zh: `职位页面显示已关闭或已下架${lv.detail ? `（${lv.detail}）` : ''}。` });
      else if (lv.state === 'live') seen.push({ rule: 'liveness', en: `Page still up${lv.detail ? ` (${lv.detail})` : ''}; that alone does not show anyone is hiring.`, zh: `页面还在${lv.detail ? `（${lv.detail}）` : ''}；这本身不能说明真在招人。` });
      else unknown.push({ rule: 'liveness', en: lv.state === 'unknown' ? `Liveness check could not tell${lv.detail ? ` (${lv.detail})` : ''}.` : 'Not checked whether the posting is still up (run ghost-check.mjs --live).', zh: lv.state === 'unknown' ? `存活检查判断不了${lv.detail ? `（${lv.detail}）` : ''}。` : '没查过职位是否还挂着（运行 ghost-check.mjs --live）。' });

      // age
      const age = today ? ageDays(x.posted, today) : null;
      if (age === null) unknown.push({ rule: 'age', en: x.posted ? `Posting date not readable ("${x.posted}").` : 'Posting date unknown.', zh: x.posted ? `发布日期读不懂（"${x.posted}"）。` : '不知道发布日期。' });
      else {
        const on = /^\d{4}-/.test(x.posted) ? ` (${x.posted})` : '', onZh = on ? `（${x.posted}）` : '';
        const days = age === 1 ? '1 day' : `${age} days`;
        if (age > o.maxAgeDays) reasons.push({ rule: 'age', en: `Posted ${days} ago${on}; more than ${o.maxAgeDays}.`, zh: `${age} 天前发布${onZh}，超过 ${o.maxAgeDays} 天。` });
        else seen.push({ rule: 'age', en: `Posted ${days} ago${on}.`, zh: `${age} 天前发布${onZh}。` });
      }

      // repost: same company + title, same site, another link
      const k = key(x);
      if (!k) unknown.push({ rule: 'repost', en: 'Company or title unknown, so reposts cannot be matched.', zh: '缺公司名或职位名，查不了重复发布。' });
      else {
        const twins = ok.filter((y) => y !== x && y.host === x.host && y.url !== x.url && key(y) === k);
        if (twins.length) reasons.push({ rule: 'repost', en: `The same role at the same company is on ${x.host} ${twins.length + 1} times, under different links.`, zh: `同一公司同一职位在 ${x.host} 上出现 ${twins.length + 1} 次，链接各不相同。`, evidence: twins.map((y) => y.url) });
        else seen.push({ rule: 'repost', en: `Only one link for this role on ${x.host} in this list.`, zh: `这份清单里该职位在 ${x.host} 上只有一个链接。` });
      }

      // offsite: a job board link with no employer-site or applicant-system link for the same company (and title, if known)
      if (x.kind !== 'board') seen.push({ rule: 'offsite', en: x.kind === 'ats' ? `On the employer's applicant system (${x.host}).` : `On the employer's own site (${x.host}).`, zh: x.kind === 'ats' ? `在雇主自己的招聘系统上（${x.host}）。` : `在雇主自己的网站上（${x.host}）。` });
      else if (!norm(x.company)) unknown.push({ rule: 'offsite', en: 'Company unknown, so the employer\'s own site cannot be matched.', zh: '不知道公司名，没法对上雇主官网。' });
      else {
        const own = ok.filter((y) => y.kind !== 'board' && norm(y.company) === norm(x.company) && (!normTitle(x.title) || !normTitle(y.title) || normTitle(y.title) === normTitle(x.title)));
        if (own.length) seen.push({ rule: 'offsite', en: `Also on the employer's site: ${own[0].host}.`, zh: `雇主自己的网站上也有：${own[0].host}。`, evidence: own.map((y) => y.url) });
        else reasons.push({ rule: 'offsite', en: `Only on a job board (${x.host}); no link for it on the employer's own site or applicant system in this list.`, zh: `只在招聘网站（${x.host}）上看到；这份清单里没有雇主官网或其招聘系统的链接。` });
      }

      const soft = reasons.filter((r) => r.rule !== 'liveness').length;
      const verdict = reasons.some((r) => r.rule === 'liveness') || soft >= o.twoOf ? 'not-hiring' : soft >= 1 ? 'check'
        : unknown.length >= 3 ? 'unknown' : 'clear';
      return { ...x, age, verdict, reasons, unknown, seen };
    });
  }

  // What a liveness check found, from one HTTP response: { state: expired|live|unknown, detail }.
  // The Job Bank and LinkedIn markers come from an earlier liveness checker (run on real postings after they came down);
  // `url` is the posting's link, `finalUrl` where redirects ended, `body` the page text.
  function livenessVerdict({ url, status, finalUrl, body }) {
    const where = (() => { try { return new URL(url).hostname; } catch (e) { return ''; } })();
    const text = String(body || '');
    if (hostIs(where, 'jobbank.gc.ca')) {
      if (status === 410 || /jobpostingexpired/.test(finalUrl || '')) return { state: 'expired', detail: status === 410 ? 'HTTP 410' : 'redirected to jobpostingexpired' };
      if (status === 200) return /jobposting-brief|Posted on|How to apply/.test(text) ? { state: 'live', detail: 'HTTP 200' } : { state: 'unknown', detail: 'HTTP 200 without the posting' };
      return { state: 'unknown', detail: `HTTP ${status}` };
    }
    if (hostIs(where, 'linkedin.com')) {   // body = LinkedIn's guest view of the posting (jobs-guest/jobs/api/jobPosting/<id>)
      if (status !== 200) return { state: 'unknown', detail: `HTTP ${status}` };
      if (!/topcard__title/.test(text)) return { state: 'unknown', detail: 'HTTP 200 without the posting' };
      return /No longer accepting applications/i.test(text) ? { state: 'expired', detail: 'No longer accepting applications' } : { state: 'live', detail: 'HTTP 200' };
    }
    if (status === 404 || status === 410) return { state: 'expired', detail: `HTTP ${status}` };
    if (/[?&]error=true\b/.test(finalUrl || '')) return { state: 'expired', detail: 'redirected to the job list with error=true' };
    if (status === 200 && CLOSED_WORDS.test(text)) return { state: 'expired', detail: `page says "${text.match(CLOSED_WORDS)[0]}"` };
    if (status === 200) return { state: 'live', detail: 'HTTP 200' };
    return { state: 'unknown', detail: status ? `HTTP ${status}` : 'no answer' };
  }

  // The demo's 20 postings. Every company is made up; employer sites use the reserved .example domain and job-board
  // links carry made-up ids. Dates are relative, so the demo reads the same on any day.
  const SAMPLE = [
    'https://www.linkedin.com/jobs/view/4000000001 | company: Northgate Datalab | title: Data Analyst | posted: 4 days ago | live: live (HTTP 200)',
    'https://careers.northgate-datalab.example/jobs/data-analyst | company: Northgate Datalab | title: Data Analyst | posted: 4 days ago | live: live (HTTP 200)',
    'https://www.linkedin.com/jobs/view/4000000002 | company: Larkspur Mutual | title: Claims Analyst | posted: 52 days ago | live: live (HTTP 200)',
    'https://www.linkedin.com/jobs/view/4000000003 | company: Larkspur Mutual | title: Claims Analyst | posted: 12 days ago | live: live (HTTP 200)',
    'https://www.jobbank.gc.ca/jobsearch/jobposting/40000001 | company: Harbourline Logistics | title: Operations Coordinator | posted: 9 days ago | live: expired (HTTP 410)',
    'https://boards.greenhouse.io/quillworks/jobs/5000001 | title: Product Analyst | posted: 6 days ago | live: live (HTTP 200)',
    'https://www.linkedin.com/jobs/view/product-analyst-at-quillworks-4000000004 | title: Product Analyst | posted: 6 days ago | live: live (HTTP 200)',
    'https://www.indeed.com/viewjob?jk=a1b2c3d4e5f60001 | company: Fernhill Health | title: Junior Data Scientist | posted: 45 days ago | live: live (HTTP 200)',
    'https://jobs.lever.co/brightmoss/00000000-0000-4000-8000-000000000001 | title: Marketing Analyst | posted: 38 days ago | live: live (HTTP 200)',
    'https://www.glassdoor.com/job-listing/business-analyst-JV_KO0,16.htm?jl=1000000001 | company: Cedarpoint Energy | title: Business Analyst | posted: 3 days ago | live: live (HTTP 200)',
    'https://www.linkedin.com/jobs/view/4000000005 | company: Oakridge Retail | title: Data Coordinator | posted: 20 days ago | live: expired (No longer accepting applications)',
    'https://tidewater.wd3.myworkdayjobs.com/en-US/careers/job/Vancouver/Reporting-Analyst_R-10001 | title: Reporting Analyst | posted: 10 days ago | live: live (HTTP 200)',
    'https://tidewater.wd3.myworkdayjobs.com/en-US/careers/job/Vancouver/Reporting-Analyst_R-10002 | title: Reporting Analyst | posted: 2 days ago | live: live (HTTP 200)',
    'https://www.ziprecruiter.com/c/Silverline-Media/Job/Content-Analyst/-in-Toronto,ON?jid=0000000000000001 | company: Silverline Media | title: Content Analyst | posted: 30+ days ago | live: unknown (HTTP 403)',
    'https://jobs.ashbyhq.com/lumenfold/00000000-0000-4000-8000-000000000002 | title: Data Engineer | posted: yesterday | live: live (HTTP 200)',
    'https://www.linkedin.com/jobs/view/4000000006 | company: Lumenfold | title: Data Engineer | posted: yesterday',
    'https://www.jobbank.gc.ca/jobsearch/jobposting/40000002 | company: Pinecrest Clinic | title: Office Administrator | posted: 5 days ago | live: live (HTTP 200)',
    'https://careers.maplebay-analytics.example/jobs/42 | company: Maple Bay Analytics | title: Junior Analyst | posted: 60 days ago | live: live (HTTP 200)',
    'https://www.linkedin.com/jobs/view/4000000007',
    'https://www.indeed.com/viewjob?jk=a1b2c3d4e5f60002 | company: Harbourline Logistics | title: Operations Coordinator | posted: 41 days ago',
  ].join('\n');

  return { DEFAULTS, BOARDS, ATS, SAMPLE, parseLine, ageDays, check, livenessVerdict };
})();
if (typeof module === 'object' && module && module.exports) module.exports = GhostFlags;
