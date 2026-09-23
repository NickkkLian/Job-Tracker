const { useState, useEffect, useRef, useMemo } = React;

// ════════════════════════════════════════════════════════════════
// Bilingual engine — the preference is kept in localStorage under `pha-lang`.
// English by default, 中文 via the toggle. T(zh, en) picks the string; stored enum values
// (status / region ids) and the AI prompt templates are never translated.
// ════════════════════════════════════════════════════════════════
let lang = (() => { try { return localStorage.getItem('pha-lang') === 'zh' ? 'zh' : 'en'; } catch (e) { return 'en'; } })();
const T = (zh, en) => lang === 'en' ? en : zh;
let _langSubs = [];
function toggleLang() {
  lang = lang === 'en' ? 'zh' : 'en';
  try { localStorage.setItem('pha-lang', lang); } catch (e) {}
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh';
  _langSubs.slice().forEach(fn => { try { fn(); } catch (e) {} });
}
// One top-level subscription is enough: re-rendering App cascades through the whole tree
// (components aren't memoised), so every T() is re-evaluated.
/* Close modals on Esc (accessibility: click-to-close on the backdrop is unusable from the
   keyboard; the right answer is Esc, not a tabindex on a full-screen overlay that creates
   one giant fake focus stop). */
function useEscapeClose(onClose) {
  useEffect(() => {
    if (!onClose) return;
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
}

function useLangToggle() {
  const [, f] = useState(0);
  useEffect(() => {
    const fn = () => f(x => x + 1);
    _langSubs.push(fn);
    return () => { _langSubs = _langSubs.filter(x => x !== fn); };
  }, []);
}

// ════════════════════════════════════════════════════════════════
// GITHUB STORAGE
// ════════════════════════════════════════════════════════════════

const LOCAL_PRE  = 'jobapp:';

// ?demo=1 — sample data, nothing saved: lets a visitor try the UI without a GitHub repo.
// ?tab=tracker|insights|… — open a tab directly.
const DEMO = /[?&]demo=1\b/.test(location.search);
const URL_TAB = new URLSearchParams(location.search).get('tab') || '';
// Demo data, per region, every company made up. Canada tells the whole story: two part-time jobs that overlap for a few
// weeks and together pass 30 hours a week (so the hours ledger shows the weekly cap at work), an offer, an interested
// role whose deadline has passed. Two more regions have a few rows; the rest are empty, which shows the empty state.
function sampleJobs(region = 'canada') {
  const ago = n => new Date(Date.now() - n * 86400000).toISOString();
  const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  if (region === 'usa') return [
    { id:'demo-us1', dateAdded:ago(3),  status:'interested',   priority:'T1', company:'Northgate Datalab',   role:'Junior Data Scientist',  location:'Boston, MA',        salaryRange:'$95k – $110k', applicationDeadline:day(12), noc:'', empType:'', applyMethod:'Greenhouse', weeklyHours:'', startDate:'', endDate:'', notes:'', jdText:'Forecasting and experimentation for a logistics marketplace: Python, SQL, causal inference basics.' },
    { id:'demo-us2', dateAdded:ago(9),  status:'applied',      priority:'T2', company:'Larkspur Mutual',     role:'Data Analyst',           location:'Chicago, IL',       salaryRange:'$78k – $88k',  applicationDeadline:'', noc:'', empType:'', applyMethod:'Workday', weeklyHours:'', startDate:'', endDate:'', notes:'', jdText:'Claims analytics: SQL, Tableau, quarterly loss-ratio reviews with actuaries.' },
    { id:'demo-us3', dateAdded:ago(16), status:'interviewing', priority:'T1', company:'Bluefin Parcel',      role:'Analytics Engineer',     location:'Remote (US)',       salaryRange:'$105k',        applicationDeadline:'', noc:'', empType:'', applyMethod:'Direct', weeklyHours:'', startDate:'', endDate:'', notes:'Take-home due Monday.', jdText:'Own the dbt project behind delivery-time reporting; partner with operations.' },
    { id:'demo-us4', dateAdded:ago(25), status:'rejected',     priority:'T3', company:'Juniper Row Health',  role:'Business Analyst',       location:'Philadelphia, PA',  salaryRange:'',             applicationDeadline:'', noc:'', empType:'', applyMethod:'Easy Apply', weeklyHours:'', startDate:'', endDate:'', notes:'', jdText:'Requirements, process maps and KPI definitions for a clinic network.' },
  ];
  if (region === 'uk') return [
    { id:'demo-uk1', dateAdded:ago(4),  status:'interested',         priority:'T1', company:'Brackenmoor Water',  role:'Data Analyst',       location:'Leeds',       salaryRange:'£34k – £38k', applicationDeadline:day(20), noc:'', empType:'', applyMethod:'Direct', weeklyHours:'', startDate:'', endDate:'', notes:'', jdText:'Leakage and demand dashboards; Power BI, SQL Server.' },
    { id:'demo-uk2', dateAdded:ago(11), status:'applied',            priority:'T2', company:'Quillfeather Retail', role:'Insight Analyst',   location:'London',      salaryRange:'£40k',        applicationDeadline:'', noc:'', empType:'', applyMethod:'Workday', weeklyHours:'', startDate:'', endDate:'', notes:'', jdText:'Basket analysis and promotion read-outs for a grocery chain.' },
    { id:'demo-uk3', dateAdded:ago(19), status:'applied',            priority:'T3', company:'Osprey & Finch Logistics', role:'Reporting Analyst', location:'Glasgow', salaryRange:'',          applicationDeadline:'', noc:'', empType:'', applyMethod:'Easy Apply', weeklyHours:'', startDate:'', endDate:'', notes:'', jdText:'Weekly warehouse KPI packs; Excel and SQL.' },
    { id:'demo-uk4', dateAdded:ago(33), status:'interview_rejected', priority:'T2', company:'Tallowby Fintech',   role:'Product Analyst',    location:'Manchester',  salaryRange:'£45k',        applicationDeadline:'', noc:'', empType:'', applyMethod:'Lever', weeklyHours:'', startDate:'', endDate:'', notes:'Final round; they hired internally.', jdText:'Funnel analysis and experiment design for a payments app.' },
  ];
  if (region !== 'canada') return [];
  return [
    { id:'demo1', dateAdded:ago(2),  status:'interested',         priority:'T1', company:'Northwind Analytics', role:'Data Analyst',                 location:'Vancouver, BC',          salaryRange:'$65k – $75k', applicationDeadline:day(9), noc:'21223', empType:'', applyMethod:'Greenhouse', weeklyHours:'', startDate:'', endDate:'', notes:'Referred by a former classmate.', jdText:'Own reporting for the growth team: SQL, Python (pandas), Looker dashboards and experiment read-outs. To apply, tell us about one analysis that changed a decision.' },
    { id:'demo2', dateAdded:ago(6),  status:'applied',            priority:'T2', company:'Fathom Robotics',     role:'Junior Software Engineer',     location:'Toronto, ON (hybrid)',   salaryRange:'$80k – $95k', applicationDeadline:'',     noc:'21232', empType:'', applyMethod:'Workday',    weeklyHours:'', startDate:'', endDate:'', notes:'', jdText:'Build internal tooling in TypeScript and Python for a fleet-operations team. Tests, code review, on-call rotation after six months.' },
    { id:'demo3', dateAdded:ago(14), status:'interviewing',       priority:'T1', company:'Cascade Health',      role:'Business Intelligence Analyst', location:'Burnaby, BC',           salaryRange:'$70k – $82k', applicationDeadline:'',     noc:'21223', empType:'', applyMethod:'Direct',     weeklyHours:'', startDate:'', endDate:'', notes:'Second round on Thursday — case study on readmission rates.', jdText:'Maintain the clinical operations data mart (dbt, BigQuery) and ship weekly KPI packs to regional directors.' },
    { id:'demo4', dateAdded:ago(150),status:'working',            priority:'',   company:'Harbourline Logistics', role:'Operations Analyst',         location:'Richmond, BC',           salaryRange:'$58k',        applicationDeadline:'',     noc:'21231', empType:'T4 employee', applyMethod:'Referral', weeklyHours:'20', startDate:ago(120).slice(0,10), endDate:'', notes:'', jdText:'Route optimisation, dock scheduling, weekly throughput reporting.' },
    { id:'demo5', dateAdded:ago(21), status:'rejected',           priority:'T3', company:'Glacier Capital',     role:'Investment Analyst',           location:'Vancouver, BC',          salaryRange:'',            applicationDeadline:'',     noc:'11101', empType:'', applyMethod:'Easy Apply', weeklyHours:'', startDate:'', endDate:'', notes:'Auto-rejection after 3 days.', jdText:'Support the public-equities team with models, screens and memo drafts.' },
    { id:'demo6', dateAdded:ago(30), status:'interview_rejected', priority:'T2', company:'Pinecrest Software',  role:'Product Analyst',              location:'Remote (Canada)',        salaryRange:'$72k',        applicationDeadline:'',     noc:'21223', empType:'', applyMethod:'Lever',      weeklyHours:'', startDate:'', endDate:'', notes:'Got to the final round; they went with an internal candidate.', jdText:'Define product metrics, instrument events, run funnel analyses and write decision memos.' },
    { id:'demo7', dateAdded:ago(70), status:'working',            priority:'',   company:'Saltmarsh Policy Lab', role:'Research Assistant (part-time)', location:'Vancouver, BC', salaryRange:'$28/h', applicationDeadline:'', noc:'41200', empType:'T4 employee', applyMethod:'Direct', weeklyHours:'15', startDate:ago(60).slice(0,10), endDate:ago(18).slice(0,10), notes:'Contract ended after the survey project.', jdText:'Survey data cleaning and literature summaries for a housing-policy project.' },
    { id:'demo8', dateAdded:ago(40), status:'offered',            priority:'T2', company:'Kittiwake Freight',    role:'Data Engineer',                 location:'Delta, BC',     salaryRange:'$84k',  applicationDeadline:'', noc:'21223', empType:'', applyMethod:'Referral', weeklyHours:'', startDate:'', endDate:'', notes:'Offer in hand — answer due next Friday.', jdText:'Airflow pipelines for container tracking; Python, SQL, a little Terraform.' },
    { id:'demo9', dateAdded:ago(12), status:'interested',         priority:'T3', company:'Tidewrack Energy Co-op', role:'Analytics Intern',            location:'Victoria, BC',  salaryRange:'$24/h', applicationDeadline:day(-3), noc:'', empType:'', applyMethod:'Direct', weeklyHours:'', startDate:'', endDate:'', notes:'', jdText:'Summer internship: metering data, Python notebooks, one presentation to the board.' },
  ];
}

// If token/repo are empty, pre-fill them from a `pha-config` entry in localStorage when one exists; never overwrites values already set
try {
  const _pha = JSON.parse(localStorage.getItem('pha-config') || 'null');
  if (_pha && _pha.token) {
    if (!localStorage.getItem('jobapp:githubRepo') && _pha.owner && _pha.repo)
      localStorage.setItem('jobapp:githubRepo', _pha.owner + '/' + _pha.repo);
    if (!localStorage.getItem('jobapp:githubToken'))
      localStorage.setItem('jobapp:githubToken', _pha.token);
  }
} catch (e) {}

const PATHS = {
  resumeDb:       'data/resumeDb.txt',
  resumeSections: 'data/resumeSections.json',
  formatting:     'data/formatting.txt',
  glossary:       'data/glossary.txt',
  watchdogProfile:'data/watchdogProfile.txt',
  library:        'data/library.json',
  canadaJobs:     'data/canada_jobs.json',
  hongkongJobs:   'data/hongkong_jobs.json',
  chinaJobs:      'data/china_jobs.json',
  diagnosis:      'data/diagnosis.json',
};

const KEY_TO_PATH = {
  resumeDb:        PATHS.resumeDb,
  resumeSections:  PATHS.resumeSections,
  formatting:      PATHS.formatting,
  glossary:        PATHS.glossary,
  watchdogProfile: PATHS.watchdogProfile,
  library:         PATHS.library,
  'canada:jobs':   PATHS.canadaJobs,
  'hongkong:jobs': PATHS.hongkongJobs,
  'china:jobs':    PATHS.chinaJobs,
  diagnosis:       PATHS.diagnosis,
};

// Any region maps to data/<id>_jobs.json; adding a region needs no change here
function keyToPath(key){
  if (KEY_TO_PATH[key]) return KEY_TO_PATH[key];
  const m = String(key).match(/^([a-z0-9_-]+):jobs$/i);
  return m ? `data/${m[1]}_jobs.json` : KEY_TO_PATH[key];
}

const shaCache = {};

function ghCfg() {
  return {
    token: localStorage.getItem(LOCAL_PRE + 'githubToken') || '',
    repo:  localStorage.getItem(LOCAL_PRE + 'githubRepo')  || '',
  };
}

function ghHdrs(tok) {
  return { Authorization: `Bearer ${tok}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
}

function toB64(s) { return btoa(unescape(encodeURIComponent(s))); }
function frB64(b) { return decodeURIComponent(escape(atob(b.replace(/\n/g,'')))); }

function ghConfigured() {
  const { token, repo } = ghCfg();
  return !!(token && repo && repo.includes('/'));
}

async function ghRead(path) {
  const { token, repo } = ghCfg();
  if (!token || !repo) return null;
  const [o, r] = repo.split('/');
  const res = await fetch(`https://api.github.com/repos/${o}/${r}/contents/${path}`, { headers: ghHdrs(token) });
  if (res.status === 404) return null;
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`GitHub ${res.status}: ${e.message||'error'}`); }
  const d = await res.json();
  shaCache[path] = d.sha;
  return frB64(d.content);
}

async function ghWrite(path, content) {
  const { token, repo } = ghCfg();
  if (!token || !repo) throw new Error('GitHub not configured');
  const [o, r] = repo.split('/');
  const url = `https://api.github.com/repos/${o}/${r}/contents/${path}`;

  // Fetch current SHA if not cached
  if (!shaCache[path]) {
    const c = await fetch(url, { headers: ghHdrs(token) });
    if (c.ok) { const d = await c.json(); shaCache[path] = d.sha; }
  }

  const doWrite = async () => {
    const body = { message: `jobapp: update ${path}`, content: toB64(content), ...(shaCache[path] ? {sha: shaCache[path]} : {}) };
    return fetch(url, { method:'PUT', headers: ghHdrs(token), body: JSON.stringify(body) });
  };

  let res = await doWrite();

  // 409 = SHA mismatch (file changed on GitHub since last read) — re-fetch SHA and retry once
  if (res.status === 409) {
    const fresh = await fetch(url, { headers: ghHdrs(token) });
    if (fresh.ok) { const d = await fresh.json(); shaCache[path] = d.sha; }
    else delete shaCache[path];
    res = await doWrite();
  }

  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`GitHub ${res.status}: ${e.message||'error'}`); }
  const d = await res.json();
  shaCache[path] = d.content.sha;
}

async function testGhConnection() {
  const { token, repo } = ghCfg();
  if (!token || !repo) throw new Error('Not configured');
  const [o, r] = repo.split('/');
  const res = await fetch(`https://api.github.com/repos/${o}/${r}`, { headers: ghHdrs(token) });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`${res.status}: ${e.message||'error'}`); }
  return res.json();
}

// ── Binary / data-URL file operations (for PDF and HTML resume files) ──

// Convert pdfKey to a GitHub path — always .pdf
function pdfGhPath(pdfKey) {
  return `data/files/${pdfKey.replace(/:/g,'_')}.pdf`;
}

// Write a data URL as a binary file to GitHub (raw base64, not re-encoded)
async function ghWriteDataUrl(path, dataUrl) {
  const base64 = (dataUrl||'').split(',')[1];
  if (!base64) throw new Error('Invalid data URL');
  const { token, repo } = ghCfg();
  if (!token || !repo) throw new Error('GitHub not configured');
  const [o, r] = repo.split('/');
  const url = `https://api.github.com/repos/${o}/${r}/contents/${path}`;

  if (!shaCache[path]) {
    const c = await fetch(url, { headers: ghHdrs(token) });
    if (c.ok) { const d = await c.json(); shaCache[path] = d.sha; }
  }

  const doWrite = async () => {
    const body = { message: `jobapp: update ${path}`, content: base64, ...(shaCache[path] ? {sha: shaCache[path]} : {}) };
    return fetch(url, { method:'PUT', headers: ghHdrs(token), body: JSON.stringify(body) });
  };

  let res = await doWrite();
  if (res.status === 409) {
    const fresh = await fetch(url, { headers: ghHdrs(token) });
    if (fresh.ok) { const d = await fresh.json(); shaCache[path] = d.sha; }
    else delete shaCache[path];
    res = await doWrite();
  }
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`GitHub ${res.status}: ${e.message||'error'}`); }
  const d = await res.json();
  shaCache[path] = d.content.sha;
}

// Read a binary file from GitHub and return as a data URL
async function ghReadDataUrl(path, mimeType) {
  const { token, repo } = ghCfg();
  if (!token || !repo) return null;
  const [o, r] = repo.split('/');
  const res = await fetch(`https://api.github.com/repos/${o}/${r}/contents/${path}`, { headers: ghHdrs(token) });
  if (res.status === 404) return null;
  if (!res.ok) return null; // fail silently, fall back to localStorage
  const d = await res.json();
  shaCache[path] = d.sha;
  return `data:${mimeType};base64,${d.content.replace(/\n/g,'')}`;
}

// Delete a file from GitHub (best-effort — used when deleting jobs)
async function ghDeleteFile(path) {
  const { token, repo } = ghCfg();
  if (!token || !repo) return;
  const [o, r] = repo.split('/');
  const url = `https://api.github.com/repos/${o}/${r}/contents/${path}`;
  if (!shaCache[path]) {
    const c = await fetch(url, { headers: ghHdrs(token) });
    if (!c.ok) return; // file doesn't exist — nothing to delete
    const d = await c.json();
    shaCache[path] = d.sha;
  }
  const body = { message: `jobapp: delete ${path}`, sha: shaCache[path] };
  const res = await fetch(url, { method:'DELETE', headers: ghHdrs(token), body: JSON.stringify(body) });
  if (res.ok) delete shaCache[path];
}

// Storage helpers
async function loadText(key)  { try { return await ghRead(keyToPath(key)) || ''; } catch { return ''; } }
async function saveText(key, v){ if (DEMO && !ghConfigured()) return; try { await ghWrite(keyToPath(key), v); } catch(e){ console.error(e); dispatchSaveErr(e); } }
async function loadJson(key)  { try { const t = await ghRead(keyToPath(key)); return t ? JSON.parse(t) : []; } catch { return []; } }
async function saveJson(key, v){ if (DEMO && !ghConfigured()) return; try { await ghWrite(keyToPath(key), JSON.stringify(v)); } catch(e){ console.error(e); dispatchSaveErr(e); } }

function dispatchSaveErr(e) { window.dispatchEvent(new CustomEvent('jobapp:saveerror', {detail: e})); }

// Combine all profile sections into one string for AI prompts
function combineSections(sections) {
  if (!sections || !sections.length) return '';
  if (sections.length === 1) return sections[0].content || '';
  return sections.map(s => `[${s.name}]\n${s.content || ''}`).join('\n\n---\n\n');
}

function lsGet(k)  { return localStorage.getItem(LOCAL_PRE + k) || ''; }
function lsSet(k,v){ localStorage.setItem(LOCAL_PRE + k, v); }
function lsDel(k)  { localStorage.removeItem(LOCAL_PRE + k); }

// ════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════

const REGIONS = [
  { id:'canada',      name:'Canada',          zh:'加拿大',      flag:'🇨🇦', accent:'bg-red-50 border-red-300 text-red-900',       dot:'bg-red-500',     contactNote:'include a Canadian phone (+1) and email only — leave out phone numbers from other countries.', phoneTip:'Exclude non-local phone numbers from the contact line' },
  { id:'usa',         name:'United States',   zh:'美国',        flag:'🇺🇸', accent:'bg-blue-50 border-blue-300 text-blue-900',    dot:'bg-blue-500',    contactNote:'include a US phone (+1), email and city/state; leave out non-local numbers.' },
  { id:'uk',          name:'United Kingdom',  zh:'英国',        flag:'🇬🇧', accent:'bg-indigo-50 border-indigo-300 text-indigo-900', dot:'bg-indigo-500', contactNote:'include a UK phone (+44), email and city; leave out non-local numbers.' },
  { id:'australia',   name:'Australia',       zh:'澳大利亚',    flag:'🇦🇺', accent:'bg-emerald-50 border-emerald-300 text-emerald-900', dot:'bg-emerald-500', contactNote:'include an Australian phone (+61), email and city; leave out non-local numbers.' },
  { id:'singapore',   name:'Singapore',       zh:'新加坡',      flag:'🇸🇬', accent:'bg-rose-50 border-rose-300 text-rose-900',    dot:'bg-rose-500',    contactNote:'include a Singapore phone (+65) and email.' },
  { id:'hongkong',    name:'Hong Kong',       zh:'香港',        flag:'🇭🇰', accent:'bg-pink-50 border-pink-300 text-pink-900',    dot:'bg-pink-500' },
  { id:'china',       name:'Mainland China',  zh:'中国大陆',    flag:'🇨🇳', accent:'bg-amber-50 border-amber-300 text-amber-900', dot:'bg-amber-500' },
  { id:'germany',     name:'Germany',         zh:'德国',        flag:'🇩🇪', accent:'bg-slate-50 border-slate-300 text-slate-900', dot:'bg-slate-500',   contactNote:'include a German phone (+49), email and city; leave out non-local numbers.' },
  { id:'netherlands', name:'Netherlands',     zh:'荷兰',        flag:'🇳🇱', accent:'bg-orange-50 border-orange-300 text-orange-900', dot:'bg-orange-500', contactNote:'include a Dutch phone (+31), email and city.' },
  { id:'japan',       name:'Japan',           zh:'日本',        flag:'🇯🇵', accent:'bg-red-50 border-red-300 text-red-900',       dot:'bg-red-400',     contactNote:'include a Japan phone (+81) and email.' },
  { id:'uae',         name:'UAE',             zh:'阿联酋',      flag:'🇦🇪', accent:'bg-teal-50 border-teal-300 text-teal-900',    dot:'bg-teal-500',    contactNote:'include a UAE phone (+971) and email.' },
  { id:'remote',      name:'Remote / Global', zh:'远程 / 全球', flag:'🌍', accent:'bg-violet-50 border-violet-300 text-violet-900', dot:'bg-violet-500', contactNote:'include email and the best phone number; note open to remote / relocation.' },
];
const REGION_BY = Object.fromEntries(REGIONS.map(r => [r.id, r]));
// Display name for a region (the id is the stable key used for storage and AI search; never changes)
const rName = r => r ? T(r.zh || r.name, r.name) : '';
function regionContact(region){ const r = REGION_BY[region]; return (r && r.contactNote) || 'include all phone numbers, email, and location.'; }

const STATUSES = [
  { id:'interested',       label:'Interested',          zh:'感兴趣',       cls:'bg-purple-100 text-purple-800 border-purple-200' },
  { id:'applied',          label:'Applied',             zh:'已投递',       cls:'bg-blue-100 text-blue-800 border-blue-200'   },
  { id:'interviewing',     label:'Interviewing',        zh:'面试中',       cls:'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id:'offered',          label:'Offered',             zh:'已获 Offer',   cls:'bg-green-100 text-green-800 border-green-200'  },
  { id:'working',          label:'Working (CEC hours)', zh:'在职·计工时',  cls:'bg-teal-100 text-teal-800 border-teal-200'    },
  { id:'rejected',         label:'Rejected',            zh:'已被拒',       cls:'bg-red-100 text-red-800 border-red-200'      },
  { id:'interview_rejected', label:'Interviewed, Rejected', zh:'面试后被拒', cls:'bg-orange-100 text-orange-800 border-orange-200' },
];
// Display only: the stored value is the id (interested/applied…); label/zh are presentation
// ── CEC hours ledger: hours above 30/week don't count; only status='working' jobs with a start date and weekly hours are counted
const CEC_TARGET = 1560;
// Application tiers: the `priority` field stores T1..T4; empty = unranked
const TIERS = [
  { id:'T1', zh:'第一梯队 · 立刻投', en:'Tier 1 — apply now',   cls:'bg-red-100 text-red-800 border-red-200' },
  { id:'T2', zh:'第二梯队 · 优先',   en:'Tier 2 — high',        cls:'bg-orange-100 text-orange-800 border-orange-200' },
  { id:'T3', zh:'第三梯队 · 常规',   en:'Tier 3 — normal',      cls:'bg-sky-100 text-sky-800 border-sky-200' },
  { id:'T4', zh:'第四梯队 · 备选',   en:'Tier 4 — backup',      cls:'bg-gray-100 text-gray-700 border-gray-200' },
];
const tierMeta = id => TIERS.find(t => t.id === id) || null;
const teerOf = noc => (noc && /^\d{5}$/.test(noc.trim())) ? noc.trim()[1] : '';
const teerOk  = noc => ['1','2','3'].includes(teerOf(noc));
function cecHours(jobs){
  // ⚠ IRCC's 30 h/week cap applies to **all jobs combined**, not to each job separately.
  // Approach: slice by week, sum every active job's hours for that week, then cap at 30.
  const now = new Date(); const MS = 7*24*3600*1000;
  const live = (jobs||[]).filter(j => j.status==='working' && j.startDate && j.weeklyHours &&
      !isNaN(new Date(j.startDate)) && teerOk(j.noc||'12200'));
  if (!live.length) return { total:0, per:[], weeklyRate:0, remain:CEC_TARGET, eta:null, capped:0 };
  const starts = live.map(j=>new Date(j.startDate).getTime());
  const t0 = Math.min(...starts);
  const t1 = Math.max(...live.map(j => j.endDate && !isNaN(new Date(j.endDate)) ? new Date(j.endDate).getTime() : now.getTime()));
  let total = 0, capped = 0;
  const per = live.map(j => ({ id:j.id, role:j.role, company:j.company, noc:j.noc||'', weekly:parseFloat(j.weeklyHours)||0, hours:0 }));
  for (let t = t0; t < t1; t += MS) {
    const frac = Math.min(1, (t1 - t) / MS);
    let raw = 0; const active = [];
    live.forEach((j, i) => {
      const st = new Date(j.startDate).getTime();
      const en = j.endDate && !isNaN(new Date(j.endDate)) ? new Date(j.endDate).getTime() : now.getTime();
      if (t >= st && t < en) { raw += (parseFloat(j.weeklyHours)||0); active.push(i); }
    });
    const eff = Math.min(raw, 30);
    if (raw > 30) capped += (raw - 30) * frac;
    total += eff * frac;
    if (raw > 0) active.forEach(i => { per[i].hours += (parseFloat(live[i].weeklyHours)||0) / raw * eff * frac; });
  }
  const weeklyRate = Math.min(30, live.filter(j => !j.endDate || new Date(j.endDate) > now)
                                      .reduce((a,j)=>a+(parseFloat(j.weeklyHours)||0),0));
  const remain = Math.max(0, CEC_TARGET - total);
  const eta = weeklyRate > 0 ? new Date(Date.now() + remain/weeklyRate*7*24*3600*1000) : null;
  return { total, per, weeklyRate, remain, eta, capped };
}
const statusLabel = id => { const s = STATUSES.find(x => x.id === id) || STATUSES[0]; return T(s.zh, s.label); };

// The navigation: four views follow the region picked above them (each region keeps its own job list and tailored
// resumes, data/<region>_jobs.json); three are shared by every region (one profile, one resume library, one diagnosis).
// Ids are the ?tab= values and never change.
const TABS = [
  { id:'addjob',   label:'Add job',    zh:'添加职位',   icon:'plus',    scope:'region' },
  { id:'tracker',  label:'Tracker',    zh:'追踪',       icon:'list',    scope:'region' },
  { id:'insights', label:'Insights',   zh:'数据',       icon:'flow',    scope:'region' },
  { id:'watchdog', label:'Alerts',     zh:'提醒',       icon:'mail',    scope:'region' },
  { id:'profile',  label:'My profile', zh:'我的资料',   icon:'person',  scope:'shared' },
  { id:'diagnosis',label:'Diagnosis',  zh:'诊断',       icon:'compass', scope:'shared' },
  { id:'library',  label:'Resumes',    zh:'简历库',     icon:'file',    scope:'shared' },
];
const tabFromUrl = () => { const t = new URLSearchParams(location.search).get('tab') || ''; return TABS.some(x => x.id === t) ? t : 'addjob'; };
// A view's address keeps every other parameter (demo=1 in particular) and changes only tab=
function tabHref(id) { const q = new URLSearchParams(location.search); q.set('tab', id); return '?' + q.toString(); }

// ════════════════════════════════════════════════════════════════
// PROMPT GENERATORS  (no AI needed — user pastes into Claude.ai)
// ════════════════════════════════════════════════════════════════

const CLAUDE_URL = 'https://claude.ai/new';
// Prompts are pasted into Claude.ai (200K token context) — no length limits needed.

function promptTailorResume(resumeDb, job, formatting, region) {
  return `Generate a one-page Letter PDF resume using Claude's Analysis Tool (reportlab). Extract the candidate's first and last name from the PROFILE below and save the file as /mnt/user-data/outputs/{Firstname}_{Lastname}_Resume.pdf (e.g. Jane_Doe_Resume.pdf). Present it as a downloadable file. Do NOT output HTML, markdown, or wrap code in fences without running it. After the file is generated, add ONE short confirming sentence — no more.

PROFILE:
${resumeDb||''}

JOB: ${job.role||'(role)'} at ${job.company||'(company)'}${job.location?` · ${job.location}`:''}${job.salaryRange?` · ${job.salaryRange}`:''}

JD:
${job.jdText||''}

CONTACT LINE: ${regionContact(region)}

REPORTLAB LAYOUT (Platypus — SimpleDocTemplate + story list):
• Letter; margins L/R 0.6", T/B 0.5"; Helvetica throughout.
• Header: Paragraph(name, 16pt-bold ALL CAPS centered, spaceAfter=4) then Paragraph(contact, 9.5pt centered, " · " separator, spaceAfter=8). The spaceAfter=4 on the name style is mandatory — without it the name and contact line visually merge into one block.
• Each section is ONE Table with the section title as a spanning first row:

  data = [
    [Paragraph("EDUCATION", section_style), ''],       # row 0: header
    [Paragraph("2022–2026", date_style), content_list], # row 1+: entries
  ]
  t = Table(data, colWidths=[78, None])
  t.setStyle(TableStyle([
    ('SPAN', (0,0), (1,0)),
    ('LINEBELOW', (0,0), (1,0), 0.75, colors.black),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LEFTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ('RIGHTPADDING', (0,1), (0,-1), 8),  # 8pt gap after date/label — prevents merging with content
    ('TOPPADDING', (0,0), (-1,-1), 0),
    ('TOPPADDING', (0,1), (-1,1), 6),  # gap below the section divider line — keeps first row off the line
    ('BOTTOMPADDING', (0,0), (-1,0), 4),
    ('BOTTOMPADDING', (0,1), (-1,-1), 5),
  ]))
  story.append(Spacer(1, 6))
  story.append(t)

This guarantees alignment — the section title and dates are in the same Table, so they share the same x=0. No separate HRFlowable needed (use LINEBELOW instead).

• ALL section tables — education, certifications, experience, projects, skills — must use colWidths=[78, None] without exception. Never let any table auto-size or use a different first-column width. Inconsistent colWidths across sections make the date column appear to jump left and right.
• Date format: always "Month YYYY" or "Season YYYY" — e.g. "Summer 2025", "Feb 2026", "2022–2026". Never invert to "2025, Summer" or "2024, Summer".
• Define ALL ParagraphStyles from scratch — do NOT use getSampleStyleSheet(). Set leftIndent=0, firstLineIndent=0 on every style.
• Section title: 10pt Helvetica-Bold ALL CAPS.
• Date column: 9.5pt Helvetica, 78pt wide with 8pt right padding — ensures "Summer 2025" never visually runs into the content column.
• Content column: title 10pt-bold, subtitle 9.5pt, link 9pt, bullets 9.5pt with "• " prefix and leftIndent=11.
• Skills section: same Table with colWidths=[78, None]. Each row is [Paragraph(category_label, bold_style), Paragraph(values, normal_style)] — the label MUST be in the LEFT cell and values in the RIGHT cell. Do NOT put both in a single cell. Do NOT use inline bold inside a single paragraph. Example row: [Paragraph('Technical:', label_style), Paragraph('Python, SQL, Excel...', body_style)].
• Section order: EDUCATION, CERTIFICATIONS (skip if none), EXPERIENCE, PROJECTS, SKILLS.

IMPORTANT — avoid these common bugs:
• Do NOT use HRFlowable (leftIndent is not a valid parameter and it misaligns with Tables). Use LINEBELOW in TableStyle instead.
• Do NOT implement a "tighten" function that mutates TableStyle._cmds — it corrupts the PDF. Instead, just build the resume ONCE with already-trimmed content.
• Do NOT call getSampleStyleSheet() — its Heading styles have hidden leftIndent that causes misalignment.

ONE PAGE — MANDATORY (two pages = failure):
Before writing code, mentally estimate if all content fits. If borderline, CUT the weakest bullets or remove one project entirely. Build the PDF ONCE with already-trimmed content — do NOT generate a 2-page PDF and then try to shrink it programmatically.
Verify page count after doc.build() using len(PdfReader(buffer).pages).
If it overflows to 2 pages: binary-search the spacing — try BOTTOMPADDING=3, spaceBefore=4; if still 2 pages, cut one more bullet and retry. If it fits with room to spare, binary-search upward (see FILL THE PAGE below).

FILL THE PAGE — if content fits with more than ~0.8" empty at the bottom, spread it out: binary-search larger spacing values — increase section spaceBefore up to 16pt, entry BOTTOMPADDING up to 12pt, Spacer before each section up to 10pt — rebuild and check until the content fills the page naturally. A resume that uses the full page looks more intentional than one that ends halfway down.

CONTENT:
- Tailor to this JD; mirror its keywords.
- Quantify with REAL numbers from my profile only — never invent metrics.
- Past tense for completed roles and education.
- For courses and skills: include directly relevant ones first, then adjacent ones that show transferable capability or intellectual range — e.g. a quant role values stats/ML courses even if the JD says "finance"; an AM role values Python/data skills even if it says "research". Don't omit something just because it's not an exact keyword match — include it if a thoughtful hiring manager would see the connection.
- Course listing rules: never append grades next to course names (no "(A+)", no "A", no grade at all — keep the list clean). Select courses by relevance to the role, not by grade — the only exception is to silently omit a course where the grade was poor AND the course is directly relevant to a quantitative or analytical claim in the resume (e.g. a weak math grade when applying for a quant role).
${(formatting||'').trim() ? `- Custom requirements: ${formatting.trim()}` : ''}

TONE — I'm a recent graduate seeking entry-level roles:
- BANNED words: leveraged, spearheaded, drove, transformed, revolutionized, championed, orchestrated, pioneered, optimized (vague), strategic, dynamic, innovative, passionate, results-driven, thought leader, go-getter, value-add.
- USE plain verbs: built, wrote, analyzed, tested, presented, supported, contributed to, helped, researched, prepared, modeled, documented, automated, implemented, debugged.
- "Built" not "led". "Helped develop" not "delivered". "Supported" not "drove".
- Internships are 3 months — describe specific deliverables, not long-term strategic impact.
- Don't inflate scope. Don't claim ownership of team outcomes.
- Modest specificity beats inflated claims. Bullets sounding measured is fine.`.trim();
}

function promptCoverLetter(resumeDb, job) {
  return `Generate a PDF cover letter using Claude's Analysis Tool (reportlab). Extract the candidate's first and last name from the profile/conversation context and save the file as /mnt/user-data/outputs/{Firstname}_{Lastname}_Cover_Letter.pdf (e.g. Jane_Doe_Cover_Letter.pdf). Present it as a downloadable file. ONE short confirming sentence after generating — no more.

CONTEXT: If you already generated my tailored resume earlier in this conversation, use that resume content and background — you don't need to re-read the PROFILE below. If this is a fresh chat, use PROFILE:

PROFILE (skip if resume context already exists in this conversation):
${resumeDb||''}

JOB: ${job.role||'(role)'} at ${job.company||'(company)'}${job.location?` · ${job.location}`:''}

JD:
${job.jdText||''}

LAYOUT:
- Letter; margins T/B 0.85", L/R 0.95"; Helvetica or Times-Roman; 11pt body; 1.45 leading; 13pt paragraph spacing.
- No header, salutation, sign-off, or contact block — body paragraphs only.

CONTENT (300–380 words, 3–4 paragraphs):
- Para 1: Open with something specific to ${job.company||'this firm'} — their strategy, investment philosophy, track record, firm size, or a recent initiative. Connect it directly and concretely to why my background fits. No generic openers. Never "I am writing to express my interest..."
- Para 2: Pick 2 achievements that specifically match THIS role type (discretionary vs. quant, finance vs. engineering, client-facing vs. analytical). For each, explain the "so what" — not just the number but what it shows about my judgment, capability, or work style. Real numbers only — never invent.
- Para 3: Acknowledge briefly that I'm early-career, then redirect to what I bring — specific preparation (CFA, relevant coursework, hands-on projects), directly applicable skills, and genuine interest in this firm's specific approach. Don't apologize; reframe.
- Para 4 (only if Para 3 feels overloaded): short, direct call to action. Otherwise fold it into Para 3.

COMBINED PDF (only if explicitly needed):
If the application asks you to email everything together, or the job posting specifies one file: generate a single 2-page PDF — tailored resume on page 1, cover letter on page 2 — and save it as /mnt/user-data/outputs/{Firstname}_{Lastname}_Resume_Cover_Letter.pdf.
Otherwise (most online portals have separate upload fields): generate only the cover letter as a standalone one-page PDF saved to /mnt/user-data/outputs/{Firstname}_{Lastname}_Cover_Letter.pdf.

TONE — recent graduate seeking entry-level roles:
- BANNED: leveraged, spearheaded, drove, transformed, championed, passionate, results-driven, thought leader, dynamic, innovative, value-add, synergized.
- No claims of leadership or ownership of team outcomes.
- No dashes (— or –) in the body paragraphs. Use commas, semicolons, or restructure the sentence instead.
- Plain language, short sentences, no filler. It's OK to be early-career — show concrete fit.`.trim();
}

function promptInterviewPrep(resumeDb, job) {
  return `Please help me prepare for an interview for this role.

MY BACKGROUND:
${resumeDb||''}

TARGET ROLE: ${job.role||'(role)'} at ${job.company||'(company)'}

JOB DESCRIPTION:
${job.jdText||''}

Please provide:

1. **My strengths for this role** — summarize the concrete strengths from my background that match this role. Cover all four angles, with specific examples drawn from my actual experience:
   - **Geographic / regional fit**: any work authorization, cultural familiarity, regional networks, or local language skills relevant to ${job.location ? job.location : 'this role\'s location'}
   - **Language abilities**: which of my languages are useful here, and how (e.g. client-facing in Cantonese, internal Mandarin documentation, English business communication)
   - **Interdisciplinary skills**: combinations across my domains (finance + AI, business + technical, etc.) that map to the role's stated needs
   - **Practical / hands-on abilities**: specific tools, models, or deliverables I have actually produced — quoting concrete examples from my background
   For each angle, also flag any *gap* honestly so I can prepare a thoughtful answer if asked.

2. **8 likely interview questions** — mix of behavioral, technical, and role-specific
3. For each question, one sentence on what they are really testing
4. **3 specific areas I should study or prepare** before the interview
5. **Any red flags or challenges** to be aware of in this JD
6. ${job.location ? `Any tips specific to interviewing in ${job.location}` : 'General interview etiquette tips for this type of role'}`.trim();
}

function promptNetworking(resumeDb, job) {
  return `Please suggest a LinkedIn networking strategy for this job application.

TARGET ROLE: ${job.role||'(role)'} at ${job.company||'(company)'}
LOCATION: ${job.location||''}

JOB DESCRIPTION:
${job.jdText||''}

MY BACKGROUND:
${resumeDb||''}

Please provide:
1. 4 specific types of people I should connect with on LinkedIn — be specific about their titles
2. For each: exact LinkedIn search keywords to find them, and what to write in the connection request
3. What to ask or discuss once connected (specific, not generic)
4. Any tips for networking in this specific region/industry for this role`.trim();
}

function promptJobAnalysis(job) {
  return `Please analyze this job description for me.

ROLE: ${job.role||'(role)'} at ${job.company||'(company)'}
LOCATION: ${job.location||''}

JOB DESCRIPTION:
${job.jdText||''}

Please provide:
1. What this role actually does day-to-day (not just what the JD says)
2. What success looks like in the first 3–6 months
3. The 5 most important requirements (ranked by importance)
4. Any red flags or things that seem unusual in this JD
5. Realistic salary range for this role and location (if not stated)
6. How competitive this role likely is and what would make a candidate stand out`.trim();
}

function promptTranslateResume(resumeContent, targetLang, glossary) {
  const isSimplified = targetLang === 'simplified';
  const glossaryBlock = (glossary||'').trim()
    ? `\nPERSONAL TRANSLATION GLOSSARY (use these exact translations — do not deviate):\n${glossary.trim()}\n`
    : '';

  const simplified = `Please translate the following resume into Simplified Chinese (简体中文) and reformat it to match the standard Mainland China 简历 format.

RESUME TO TRANSLATE AND REFORMAT:
${resumeContent||''}
${glossaryBlock}
TRANSLATION REQUIREMENTS:
1. Translate all text into Simplified Chinese — keep proper nouns in English (company names, school names, tools, programming languages, product names) UNLESS a preferred Chinese translation is listed in the glossary above
2. Use standard Mainland China professional terminology (e.g. 工作经历 not 工作經歷, 教育背景, 技能, 项目经历, 自我评价)
3. Keep all numbers, dates, metrics, and quantified achievements accurate
4. For technical terms with no natural translation, keep English and add Chinese in parentheses if helpful

MAINLAND CHINA 简历 FORMAT REQUIREMENTS (apply after translating):
- Header: Full name (large, centered) → contact line with phone | email | city | LinkedIn or GitHub if relevant
- Personal information block directly under header: 性别 | 出生年月 | 籍贯 (use placeholder values like "男/女 | 199X年XX月 | [省份]" if not in source — note these as placeholders)
- Section order: 求职意向 (target role) → 教育背景 → 工作经历 → 项目经历 → 专业技能 → 获奖情况 (if any) → 自我评价
- 求职意向: one line stating the target role and city preference
- 教育背景: institution → degree → graduation year → GPA or awards if present
- 工作经历: company | location | dates (right-aligned) → job title → bullet points starting with action verbs
- 项目经历: project name | date → role → bullet points with outcomes and tech stack
- 专业技能: grouped by category with label, e.g. 编程语言：Python、R、SQL
- 自我评价: 3–4 sentences, first-person, confident tone summarising strengths
- Dates: use Chinese format — XXXX年XX月 or XXXX年XX月–XXXX年XX月
- Bullet points: use • or ·, start with action verb in Chinese, quantify outcomes
- Output clean Markdown — no commentary before or after`;

  const traditional = `Please translate the following resume into Traditional Chinese (繁體中文) and reformat it to match the standard Hong Kong professional CV format.

RESUME TO TRANSLATE AND REFORMAT:
${resumeContent||''}
${glossaryBlock}
TRANSLATION REQUIREMENTS:
1. Translate all text into Traditional Chinese — keep proper nouns in English (company names, school names, tools, programming languages, product names) UNLESS a preferred Chinese translation is listed in the glossary above
2. Use standard Hong Kong professional terminology (e.g. 工作經驗 not 工作经历, 學歷, 技能, 項目經驗, 個人簡介)
3. Keep all numbers, dates, metrics, and quantified achievements accurate
4. For technical terms with no natural translation, keep English and add Chinese in parentheses if helpful

HONG KONG PROFESSIONAL CV FORMAT REQUIREMENTS (apply after translating):
- Header: Full name in English AND Chinese characters (大名) centered at top → contact line: phone | email | LinkedIn/GitHub
- Personal details block: 性別 | 出生日期 | 居住地區 | 國籍/居留權 (use placeholder values if not in source — note these as placeholders)
- No photo placeholder needed in text format
- Section order: 個人簡介 → 學歷 → 工作經驗 → 項目經驗 → 技能 → 語言能力 → 證書及獎項 (if any)
- 個人簡介: 3–4 sentences, professional tone, summarising background and value proposition
- 學歷: institution (include both English and Chinese name if known) → degree → year → relevant awards or distinctions
- 工作經驗: company | location | date range → job title → 3–4 bullet points with quantified achievements
- 項目經驗: project name → date → brief description → bullet points on contribution and outcome
- 技能: grouped by category, e.g. 程式語言：Python、R、SQL
- 語言能力: list each language with proficiency, e.g. 英語（雅思8.0）、廣東話（母語）、普通話（流利）
- Dates: Month YYYY format or YYYY年MM月 in Chinese
- Bullet points: use •, open with strong action verb in Traditional Chinese, quantify outcomes
- Output clean Markdown — no commentary before or after`;

  return isSimplified ? simplified : traditional;
}

// ════════════════════════════════════════════════════════════════
// FILE UTILITIES
// ════════════════════════════════════════════════════════════════

let pdfjsPromise = null;
// pdf.js is loaded the first time a .pdf is read, from vendor/ like every other library (see vendor/SOURCE.md)
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsPromise) return pdfjsPromise;
  const V = '3.11.174';
  pdfjsPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = `vendor/pdf-${V}.min.js`;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `vendor/pdf.worker-${V}.min.js`;
      res(window.pdfjsLib);
    };
    s.onerror = () => rej(new Error('Failed to load PDF library'));
    document.head.appendChild(s);
  });
  return pdfjsPromise;
}

async function extractPdfText(file) {
  const lib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buf }).promise;
  const parts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.map(it => ({ str: it.str, y: it.transform?.[5] ?? 0, x: it.transform?.[4] ?? 0 }));
    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));
    const lines = [];
    let cy = null, cl = [];
    for (const it of items) {
      if (cy === null || Math.abs(it.y - cy) > 2) { if (cl.length) lines.push(cl.join(' ').trim()); cl = [it.str]; cy = it.y; }
      else cl.push(it.str);
    }
    if (cl.length) lines.push(cl.join(' ').trim());
    parts.push(lines.filter(Boolean).join('\n'));
  }
  return parts.join('\n\n').trim();
}

async function readFileAsText(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (['txt','md','markdown'].includes(ext)) return file.text();
  if (ext === 'docx') {
    const buf = await file.arrayBuffer();
    const r = await mammoth.extractRawText({ arrayBuffer: buf });
    return (r?.value || '').trim();
  }
  if (ext === 'pdf') {
    const t = await extractPdfText(file);
    if (!t || t.length < 10) throw new Error('Could not extract text — PDF may be scanned/image-based');
    return t;
  }
  if (ext === 'doc') throw new Error('.doc not supported — save as .docx first');
  throw new Error(`Unsupported: .${ext} — use .txt, .md, .docx, or .pdf`);
}

function downloadText(filename, content, mime='text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Read file as base64 data URL (for HTML/PDF binary storage)
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// PDF/HTML localStorage helpers (device-local, not synced to GitHub)
const PDF_LS_PRE = 'jobapp-pdf:';
function savePdfLocal(key, dataUrl) {
  try { localStorage.setItem(PDF_LS_PRE + key, dataUrl); return true; }
  catch(e) { console.warn('localStorage quota exceeded:', e); return false; }
}
function loadPdfLocal(key) { return localStorage.getItem(PDF_LS_PRE + key) || null; }
function deletePdfLocal(key) { localStorage.removeItem(PDF_LS_PRE + key); }

function safeName(s) { return (s||'file').replace(/[^\w\s-]/g,'').replace(/\s+/g,'_').slice(0,60) || 'file'; }
function stripMd(md) {
  return (md||'').replace(/^#{1,6}\s+/gm,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1')
    .replace(/^[-*]\s+/gm,'• ').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1');
}

// ════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ════════════════════════════════════════════════════════════════

function newId() { return `${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
// Dates follow the page's language, not the browser's (the Chinese page used to show "9 Sept 2026")
function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return String(iso); return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-GB', {year:'numeric',month:'short',day:'numeric'}); }
function fmtNum(n) { return Math.round(n).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-GB'); }

// ════════════════════════════════════════════════════════════════
// JD FIELD EXTRACTOR  (heuristic, no AI)
// ════════════════════════════════════════════════════════════════

function parseJdFields(text) {
  const t = text || '';
  const lines = t.split('\n').map(l => l.trim()).filter(Boolean);

  // ── Strip noise lines before parsing structured fields ────────
  // Remove lines that are clearly company contact/boilerplate, not job info.
  // This only affects field extraction — the raw JD text is stored unmodified.
  const NOISE_PATTERNS = [
    /^\s*(?:tel|phone|fax|email|e-mail|website|web|url|www\.)\s*[:\-]/i,
    /^\s*(?:apply (?:now|here|online|via|through|at)|how to apply|to apply)/i,
    /^\s*(?:equal opportunity|eeo|diversity|we are an|we welcome|we do not discriminate)/i,
    /^\s*(?:copyright|all rights reserved|privacy policy|terms)/i,
    /^\+?[\d\s\-().]{7,}$/,                          // phone number lines
    /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/, // email-only lines
    /^https?:\/\//i,                                  // URL-only lines
    /^\s*(?:p\.?o\.?\s*box|suite|floor|unit)\s+\d/i, // PO box / suite lines
    /^\s*(?:confidential|disclaimer|note:|please note)/i,
  ];
  const cleanLines = lines.filter(l => !NOISE_PATTERNS.some(p => p.test(l)));
  const head = cleanLines.slice(0, 80).join('\n');

  // For salary/deadline, search the full text (deadlines can be at the bottom)
  // but skip noise lines
  const all = cleanLines.join('\n');

  // ── Helpers ──────────────────────────────────────────────────
  const firstMatch = (patterns, src) => {
    for (const p of patterns) {
      const m = src.match(p);
      if (m) return m[1]?.trim() || m[0]?.trim();
    }
    return '';
  };
  const clean = s => s ? s.replace(/\s+/g,' ').replace(/[|·–—:]+$/,'').trim() : '';

  // ── Role ─────────────────────────────────────────────────────
  const roleRaw = firstMatch([
    /(?:job title|position|role|title)\s*[:\-]\s*(.+)/i,
    /^#+\s*(.+)$/m,
    /^\*\*(.+?)\*\*/m,
  ], head) || clean(cleanLines[0]);
  const role = clean(roleRaw.replace(/\s+(?:at|@)\s+.+$/i, '').slice(0, 80));

  // ── Company ───────────────────────────────────────────────────
  const company = clean(firstMatch([
    /(?:company|employer|organisation|organization|hiring company)\s*[:\-]\s*(.+)/i,
    /(?:about|join)\s+([A-Z][A-Za-z0-9 &.,'-]{1,50})(?:\s*[–—-]|\s*$)/m,
    /(?:at|@)\s+([A-Z][A-Za-z0-9 &.,'-]{1,50})(?:\s|$)/,
    /^([A-Z][A-Za-z0-9 &,.']+(?:Inc\.?|Ltd\.?|Corp\.?|Co\.?|Limited|Group|Bank|Technologies|Solutions|Consulting|Capital|Partners))(?:\s|$)/m,
  ], head));

  // ── Location ─────────────────────────────────────────────────
  const location = clean(firstMatch([
    /(?:location|city|based in|office)\s*[:\-]\s*(.+)/i,
    /(?:remote|hybrid)\s*(?:[-–—,/|]\s*([A-Za-z ,]+))?/i,
    /([A-Z][a-z]+(?: [A-Z][a-z]+)?,\s*(?:BC|AB|ON|QC|MB|SK|NS|NB|PE|NL|NT|NU|YT|CA|NY|TX|WA|HK|SG|London|Tokyo|Shanghai|Beijing|Shenzhen|Hong Kong)[^,\n]{0,30})/,
  ], head));

  // ── Salary range ─────────────────────────────────────────────
  const salary = clean(firstMatch([
    /(?:salary|compensation|pay|remuneration|package)\s*[:\-]\s*(.+)/i,
    /(?:CAD|HKD|CNY|USD|RMB|HK\$|\$|¥)\s*[\d,]+(?:k|K)?(?:\s*[-–—to]+\s*(?:CAD|HKD|CNY|USD|RMB|HK\$|\$|¥)?\s*[\d,]+(?:k|K)?)?/,
    /[\d,]+(?:k|K)?\s*[-–—to]+\s*[\d,]+(?:k|K)?\s*(?:CAD|HKD|USD|CNY|per year|per month|annually|\/yr|\/mo)?/i,
  ], all));

  // ── Application deadline ──────────────────────────────────────
  const deadlineRaw = firstMatch([
    /(?:apply by|deadline|closing date|application closes?|due date|submit by)\s*[:\-]?\s*([A-Za-z]+\s+\d{1,2}[,\s]+\d{2,4}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
    /(?:apply by|deadline)\s*[:\-]?\s*(\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2})/i,
  ], all);

  let deadline = '';
  if (deadlineRaw) {
    const d = new Date(deadlineRaw);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2020) {
      deadline = d.toISOString().slice(0, 10);
    }
  }

  return { role, company, location, salaryRange: salary, applicationDeadline: deadline };
}

// ════════════════════════════════════════════════════════════════
// UI PRIMITIVES — family components (app.css); colours come from design tokens only
// ════════════════════════════════════════════════════════════════

// Line icons: 24-unit box, 2px round strokes in currentColor (drawn like the family's gear)
const ICON_PATHS = {
  plus:    <path d="M12 5v14M5 12h14"/>,
  list:    <path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10M5 6.5h.01M5 12h.01M5 17.5h.01"/>,
  flow:    <path d="M3 12h5c3.5 0 4.5-6.5 8-6.5h5M8 12h13M8 12c3.5 0 4.5 6.5 8 6.5h5"/>,
  mail:    <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></>,
  person:  <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5"/></>,
  compass: <><circle cx="12" cy="12" r="8.5"/><path d="M15 9l-1.8 4.2L9 15l1.8-4.2z"/></>,
  file:    <path d="M6.5 3.5h7l4 4v13h-11zM13.5 3.5v4h4M9.5 12.5h5M9.5 16h5"/>,
  trash:   <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>,
  edit:    <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>,
  open:    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>,
  eye:     <><path d="M2.5 12c2.2-4 5.5-6.5 9.5-6.5s7.3 2.5 9.5 6.5c-2.2 4-5.5 6.5-9.5 6.5S4.7 16 2.5 12z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff:  <><path d="M2.5 12c2.2-4 5.5-6.5 9.5-6.5s7.3 2.5 9.5 6.5c-2.2 4-5.5 6.5-9.5 6.5S4.7 16 2.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></>,
  x:       <path d="M6 6l12 12M18 6L6 18"/>,
  chevron: <path d="M9 6l6 6-6 6"/>,
  down:    <path d="M6 9l6 6 6-6"/>,
};
function Icon({ name, size=18, className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{ICON_PATHS[name]}</svg>
  );
}
// The product mark: the family frame and seal, and three bars that get shorter (applications narrowing to offers)
function DocketMark() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" focusable="false">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="currentColor" strokeWidth="2"/>
      <rect x="14" y="6" width="4" height="4" rx="1" fill="var(--point)"/>
      <path d="M7.5 17V9M11.5 17v-5M15.5 17v-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function Card({ children, className='' }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function Btn({ children, onClick, variant='secondary', disabled=false, className='', title, type='button' }) {
  const v = { primary:'btn-primary', secondary:'', danger:'btn-danger', ghost:'btn-ghost' };
  return <button type={type} onClick={onClick} disabled={disabled} title={title} className={`btn ${v[variant] || ''} ${className}`}>{children}</button>;
}

// Status colours: interested is a draft (dashed, not sent yet), applied waits (info), interviewing needs attention
// (warning), offered and working went well (success), the two rejections are over (neutral: a rejection is the most
// common outcome of a job search, not an error, and red is kept for errors and destructive actions)
const STATUS_TAG = { interested:'tag-draft', applied:'tag-info', interviewing:'tag-warning', offered:'tag-success', working:'tag-success', rejected:'tag-neutral', interview_rejected:'tag-neutral' };
function StatusPill({ status }) {
  const s = STATUSES.find(x => x.id === status);
  return <span className={`tag ${STATUS_TAG[status] || 'tag-neutral'}`}>{s ? T(s.zh, s.label) : String(status || '')}</span>;
}

function TierPill({ tier }) {
  const t = tierMeta(tier);
  if (!t) return null;
  return <span className="chip">{T(t.zh, t.en)}</span>;
}

// A status label that is also the control that changes it. A stored value this version does not know keeps an option
// of its own, shown as it is, so opening the row never rewrites it.
function StatusField({ value, onChange, name }) {
  const known = STATUSES.some(s => s.id === value);
  return (
    <label className="status-field" data-status={known ? value : 'unknown'}>
      {name && <span className="sr-only">{name}</span>}
      <select value={value || ''} onChange={e => onChange(e.target.value)}>
        {!known && <option value={value || ''}>{String(value || '—')}</option>}
        {STATUSES.map(s => <option key={s.id} value={s.id}>{T(s.zh, s.label)}</option>)}
      </select>
      <Icon name="down" size={12} className="chev" />
    </label>
  );
}
function StatusSelect({ value, onChange }) {
  return <StatusField value={value} onChange={onChange} name={T('状态','Status')} />;
}

function SectionHdr({ title, action }) {
  return <div className="card-head"><h2>{title}</h2>{action}</div>;
}

// Messages: one status bar per kind (info, warning, error, done); the kind shows in colour and words, not a symbol
function Alert({ type='warning', children }) {
  const k = { warning:'warn', error:'error', info:'', success:'done' }[type] ?? '';
  return <div className={`note ${k}`} role={type === 'error' ? 'alert' : undefined}>{children}</div>;
}

// A view's heading row: the region (or "shared by all regions"), the view's name, and the screen's one primary action
function PageHead({ eyebrow, title, sub, action }) {
  return (
    <div className="page-head">
      <div className="titles">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 tabIndex={-1}>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {action && <div className="acts">{action}</div>}
    </div>
  );
}

// The name of an icon-only button, on mouse hover, keyboard focus or a long press. Ported from Clipbind (initTips in
// content-organizer/js/app.js) unchanged but for where it keeps its handle: it listens on document and finds [data-tip],
// so it does not care that React draws the buttons.
function initTips(){
  var tip = document.createElement('div');
  tip.className = 'tip'; tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);
  var hoverTimer = null, pressTimer = null, pressClear = null, pressShown = false, current = null, via = null;
  function tipFor(el){ return el && el.closest ? el.closest('[data-tip]') : null; }
  function overlaps(a, b){ return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
  function place(btn){
    var r = btn.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, gap = 6, pad = 8;
    var left = Math.min(Math.max(pad, r.left + r.width / 2 - w / 2), window.innerWidth - w - pad);
    var others = Array.prototype.filter.call(document.querySelectorAll('button, a, input, select'), function (o) { return o !== btn && o.offsetParent; })
      .map(function (o) { return o.getBoundingClientRect(); });
    var bars = Array.prototype.filter.call(document.querySelectorAll('.topbar'), function (b) { return b.offsetParent; })
      .map(function (b) { return b.getBoundingClientRect(); });
    function placeAt(top){ return { left: left, right: left + w, top: top, bottom: top + h }; }
    var above = placeAt(r.top - gap - h), below = placeAt(r.bottom + gap);
    var free = function (box) { return box.top >= pad && box.bottom <= window.innerHeight - pad && !bars.some(function (o) { return overlaps(box, o); }); };
    var clear = function (box) { return free(box) && !others.some(function (o) { return overlaps(box, o); }); };
    var box = clear(above) ? above : clear(below) ? below : free(above) ? above : free(below) ? below : (r.top - gap - h >= pad ? above : below);
    tip.style.left = Math.round(box.left) + 'px'; tip.style.top = Math.round(box.top) + 'px';
  }
  function show(btn, why){
    clearTimeout(hoverTimer);
    if (!btn.isConnected) return;
    current = btn; via = why;
    tip.textContent = btn.getAttribute('data-tip') || '';
    tip.classList.add('is-on');
    place(btn);
  }
  function hide(){ clearTimeout(hoverTimer); current = null; via = null; tip.classList.remove('is-on'); }
  function keyboardFocus(el){ try { return el.matches(':focus-visible'); } catch (err) { return true; } }
  function follow(){ if (via === 'focus' && current && document.activeElement === current) place(current); else hide(); }
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'touch') return;
    var b = tipFor(e.target); if (!b || b === current) return;
    clearTimeout(hoverTimer); hoverTimer = setTimeout(function () { show(b, 'hover'); }, 120);
  });
  document.addEventListener('pointerout', function (e) {
    if (e.pointerType === 'touch') return;
    var b = tipFor(e.target); if (!b || b.contains(e.relatedTarget)) return;
    clearTimeout(hoverTimer); if (current === b && via === 'hover') hide();
  });
  document.addEventListener('focusin', function (e) { var b = tipFor(e.target); if (b && keyboardFocus(b)) show(b, 'focus'); });
  document.addEventListener('focusout', function (e) { var b = tipFor(e.target); if (b && current === b && via === 'focus') hide(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', follow, true);
  window.addEventListener('resize', follow);
  document.addEventListener('touchstart', function (e) {
    clearTimeout(pressTimer); clearTimeout(pressClear); pressShown = false;
    var b = tipFor(e.target); if (!b) return;
    pressTimer = setTimeout(function () { pressShown = true; show(b, 'press'); }, 450);
  }, { passive: true });
  document.addEventListener('touchmove', function () { clearTimeout(pressTimer); }, { passive: true });
  document.addEventListener('touchend', function () {
    clearTimeout(pressTimer);
    if (!pressShown) return;
    setTimeout(function () { if (via === 'press') hide(); }, 1400);
    pressClear = setTimeout(function () { pressShown = false; }, 800);
  }, { passive: true });
  // capture phase: a long press names the button and does not also run its action; any other click hides the name
  document.addEventListener('click', function (e) {
    if (pressShown && tipFor(e.target)) { e.preventDefault(); e.stopPropagation(); pressShown = false; clearTimeout(pressClear); return; }
    hide();
  }, true);
  window.__docketTips = { show: show, hide: hide, el: tip };   // for the evidence probes
}

// ════════════════════════════════════════════════════════════════
// COPY / DOWNLOAD / UPLOAD BUTTONS
// ════════════════════════════════════════════════════════════════

// Two small buttons instead of a menu: the family has no menu component, and two choices do not need one
function DownloadMenu({ content, baseFilename }) {
  const fn = safeName(baseFilename);
  return (
    <span className="dl-pair">
      <Btn className="btn-sm" onClick={()=>downloadText(`${fn}.md`, content||'','text/markdown')}>{T('下载 .md','Download .md')}</Btn>
      <Btn className="btn-sm" onClick={()=>downloadText(`${fn}.txt`, stripMd(content||''))}>{T('下载 .txt','Download .txt')}</Btn>
    </span>
  );
}

function FileUploadButton({ onFile, label=T('上传文件…','Upload file…'), primary=false, accept='.txt,.md,.markdown,.docx,.pdf' }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const handle = async e => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setErr(''); setBusy(true);
    try { const t = await readFileAsText(file); if (!t.trim()) { setErr(T('文件为空或无法读取','File is empty or unreadable')); return; } onFile(t, file.name); }
    catch(e) { setErr(e.message||T('读取文件失败','Failed to read file')); }
    finally { setBusy(false); }
  };
  return (
    <span className="upload">
      <Btn variant={primary?'primary':'secondary'} onClick={()=>ref.current?.click()} disabled={busy}>
        {busy ? T('读取中…','Reading…') : label}
      </Btn>
      <input ref={ref} type="file" accept={accept} onChange={handle} className="hidden" />
      {err && <span className="field-err" role="alert">{err}</span>}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════
// PROMPT MODAL
// ════════════════════════════════════════════════════════════════

function PromptModal({ title, prompt, onClose }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(()=>setCopied(false),2000); } catch {}
  };
  useEscapeClose(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mt-8 mb-8" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">✨ {title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">&times;</button>
        </div>
        <div className="p-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 mb-3 space-y-1">
            <div className="font-semibold">{T('使用方法：','How to use:')}</div>
            <div>{T('1. 点击下方的 ','1. Click ')}<strong>{T('复制提示词','Copy prompt')}</strong>{T(' 按钮',' below')}</div>
            <div>{T('2. 点击 ','2. Click ')}<strong>{T('打开 Claude.ai','Open Claude.ai')}</strong>{T(' — 会在新标签页打开',' — it opens in a new tab')}</div>
            <div>{T('3. 粘贴提示词（⌘V / Ctrl+V）并发送','3. Paste the prompt (⌘V / Ctrl+V) and press Send')}</div>
            <div>4. <strong>{T('定制简历 / 求职信：','Tailor Resume / Cover Letter:')}</strong>{T(' 确保 Analysis 工具已开启 → Claude 运行 Python 生成 PDF 文件 → 点击文件下载 → 在下方上传',' make sure the Analysis tool is on → Claude runs Python and generates a PDF file → click the file to download it → upload below')}</div>
            <div>5. <strong>{T('其他提示词：','Other prompts:')}</strong>{T(" 直接阅读并使用 Claude 的回复"," read and use Claude's response directly")}</div>
          </div>
          <textarea
            value={prompt}
            readOnly
            className="w-full h-64 p-3 text-xs font-mono border border-gray-300 rounded-md bg-gray-50 resize-y focus:outline-none"
            onClick={e => e.target.select()}
          />
          <div className="flex gap-2 mt-3 justify-end flex-wrap">
            <Btn onClick={handleCopy}>{copied ? T('✅ 已复制!','✅ Copied!') : T('📋 复制提示词','📋 Copy prompt')}</Btn>
            <a href={CLAUDE_URL} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600">
              {T('打开 Claude.ai →','Open Claude.ai →')}
            </a>
          </div>
          <p className="mt-2 text-xs text-gray-400">{T('使用你现有的 Claude.ai 订阅 — 无额外费用。','Uses your existing Claude.ai subscription — no extra cost.')}</p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TRANSLATE SOURCE PICKER MODAL
// ════════════════════════════════════════════════════════════════

function TranslatePickerModal({ targetLang, tailoredResume, library, glossary, onClose }) {
  const langLabel = targetLang === 'simplified' ? T('简体中文','Simplified Chinese (简体中文)') : T('繁體中文','Traditional Chinese (繁體中文)');
  const langIcon  = targetLang === 'simplified' ? '🇨🇳' : '🇭🇰';

  const sources = [
    ...(tailoredResume?.trim() ? [{ id:'tailored', label:T('定制简历（已为此职位保存）','Tailored resume (saved for this job)') }] : []),
    ...(library||[]).map(r => ({ id:`lib:${r.id}`, label:T('简历库：','Resume library: ')+r.name })),
    { id:'custom', label:T('粘贴 / 输入我自己的文本','Paste / type my own text') },
  ];

  const [sel, setSel]             = useState(sources[0]?.id || 'custom');
  const [customText, setCustomText] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied]       = useState(false);

  const getContent = () => {
    if (sel === 'tailored') return tailoredResume || '';
    if (sel === 'custom')   return customText;
    const libId = sel.replace('lib:', '');
    return (library||[]).find(r => r.id === libId)?.content || '';
  };

  const content = getContent();
  const prompt  = promptTranslateResume(content, targetLang, glossary);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  useEscapeClose(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mt-8 mb-8" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{langIcon} {T('翻译简历 →','Translate Resume →')} {langLabel}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">&times;</button>
        </div>
        <div className="p-4 space-y-4">

          {/* Source picker */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">{T('你想翻译哪份简历？','Which resume do you want to translate?')}</label>
            <div className="space-y-2">
              {sources.map(s => (
                <label key={s.id} className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  sel === s.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input type="radio" name="translateSource" value={s.id}
                    checked={sel === s.id} onChange={() => { setSel(s.id); setShowPrompt(false); }} className="shrink-0" />
                  <span className="text-sm text-gray-800 flex-1">{s.label}</span>
                  {sel === s.id && s.id !== 'custom' && content && (
                    <span className="text-xs text-gray-400">{content.length.toLocaleString()} {T('字符','chars')}</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Custom text area */}
          {sel === 'custom' && (
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{T('在此粘贴你的简历','Paste your resume here')}</label>
              <textarea value={customText} onChange={e => { setCustomText(e.target.value); setShowPrompt(false); }}
                placeholder={T('粘贴你想翻译的简历文本…','Paste the resume text you want to translate…')}
                className="w-full h-40 p-3 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                autoFocus />
              <div className="text-xs text-gray-400 mt-0.5">{customText.length.toLocaleString()} {T('字符','chars')}</div>
            </div>
          )}

          {/* Collapsible source preview */}
          {sel !== 'custom' && content && (
            <details className="border border-gray-200 rounded-md">
              <summary className="cursor-pointer px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-md">
                {T('预览来源内容','Preview source content')}
              </summary>
              <div className="px-3 pb-3 max-h-40 overflow-y-auto text-xs font-mono text-gray-700 whitespace-pre-wrap border-t border-gray-100 pt-2">
                {content.slice(0, 1000)}{content.length > 1000 ? '\n…' : ''}
              </div>
            </details>
          )}

          {/* Generate prompt */}
          {!showPrompt ? (
            <div className="flex justify-end">
              <Btn variant="primary" disabled={!content.trim()} onClick={() => setShowPrompt(true)}>
                {T('生成提示词 →','Generate prompt →')}
              </Btn>
            </div>
          ) : (
            <div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 mb-2 space-y-0.5">
                <div className="font-semibold">{T('使用方法：','How to use:')}</div>
                <div>{T('1. 点击 ','1. Click ')}<strong>{T('复制提示词','Copy prompt')}</strong>{T(' → 点击 ',' → click ')}<strong>{T('打开 Claude.ai','Open Claude.ai')}</strong></div>
                <div>{T('2. 粘贴（⌘V / Ctrl+V）并发送','2. Paste (⌘V / Ctrl+V) and press Send')}</div>
                <div>{T('3. Claude 以 Markdown 返回翻译后的简历 — 复制并按需使用（粘贴到 Word、自行排版，或再用一条提示词转成 PDF）','3. Claude returns the translated resume in Markdown — copy and use it however you need (paste into a Word doc, format yourself, or run another prompt to convert to PDF)')}</div>
              </div>
              <textarea value={prompt} readOnly
                className="w-full h-52 p-3 text-xs font-mono border border-gray-300 rounded-md bg-gray-50 resize-y focus:outline-none"
                onClick={e => e.target.select()} />
              <div className="flex gap-2 mt-3 justify-end flex-wrap">
                <Btn onClick={handleCopy}>{copied ? T('✅ 已复制!','✅ Copied!') : T('📋 复制提示词','📋 Copy prompt')}</Btn>
                <a href={CLAUDE_URL} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600">
                  {T('打开 Claude.ai →','Open Claude.ai →')}
                </a>
              </div>
              <p className="mt-2 text-xs text-gray-400">{T('使用你现有的 Claude.ai 订阅 — 无额外费用。','Uses your existing Claude.ai subscription — no extra cost.')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AI PROMPT BUTTONS (reused in AddJobTab and JobDetail)
// ════════════════════════════════════════════════════════════════

function AiPromptSection({ resumeDb, job, formatting, glossary, tailoredResume, library, region }) {
  const [modal, setModal]             = useState(null);
  const [translateLang, setTranslateLang] = useState(null); // 'simplified' | 'traditional'

  const hasResume = !!(resumeDb || '').trim();
  const hasJd     = !!(job?.jdText || '').trim();

  const open = (title, promptFn) => {
    if (!hasResume) { alert(T('请先在「我的资料」标签页添加你的资料/背景 — 能让提示词效果好很多。','Add your profile/background in My Profile tab first — it makes the prompts much better.')); return; }
    setModal({ title, prompt: promptFn() });
  };

  const mainBtns = [
    { label:T('📝 定制简历','📝 Tailor Resume'),    fn: () => promptTailorResume(resumeDb, job, formatting, region) },
    { label:T('✉️ 求职信','✉️ Cover Letter'),     fn: () => promptCoverLetter(resumeDb, job)               },
    { label:T('🎯 面试准备','🎯 Interview Prep'),   fn: () => promptInterviewPrep(resumeDb, job)             },
    { label:T('👥 人脉拓展','👥 Networking'),       fn: () => promptNetworking(resumeDb, job)                },
    { label:T('🔍 分析此职位','🔍 Analyze This Job'), fn: () => promptJobAnalysis(job)                         },
  ];

  return (
    <Card className="p-4">
      <SectionHdr icon="✨" title={T('通过 Claude.ai 获取 AI 帮助','AI Help via Claude.ai')} />
      <p className="text-xs text-gray-600 mb-3">
        {T('这些按钮会为 Claude.ai 生成一段可直接粘贴的提示词。简历和求职信由 Claude 通过 Analysis 工具直接生成 PDF — 下载后在下方上传。其他提示词（面试、人脉、分析）可直接在 Claude.ai 中阅读。','These buttons generate a ready-to-paste prompt for Claude.ai. For Resume and Cover Letter, Claude generates a PDF directly via the Analysis Tool — download and upload below. Other prompts (Interview, Networking, Analysis) can be read directly in Claude.ai.')}
        {!hasResume && <span className="block mt-1 text-amber-700">{T('先添加你的资料以获得最佳效果。','Add your profile first for best results.')}</span>}
        {!hasJd && hasResume && <span className="block mt-1 text-gray-500">{T('添加 JD 以生成针对该职位的提示词。','Add a JD for job-specific prompts.')}</span>}
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {mainBtns.map(b => (
          <Btn key={b.label} variant="secondary"
            onClick={() => open(b.label.replace(/^\S+\s/, ''), b.fn)}>
            {b.label}
          </Btn>
        ))}
      </div>
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 mb-2">{T("把简历翻译成中文 — 你将选择使用哪一份简历。","Translate a resume to Chinese — you'll choose which resume to use.")}</p>
        <div className="flex flex-wrap gap-2">
          <Btn variant="secondary" onClick={() => setTranslateLang('simplified')}>{T('🇨🇳 → 简体中文','🇨🇳 → Simplified Chinese')}</Btn>
          <Btn variant="secondary" onClick={() => setTranslateLang('traditional')}>{T('🇭🇰 → 繁體中文','🇭🇰 → Traditional Chinese')}</Btn>
        </div>
      </div>
      {modal && <PromptModal title={modal.title} prompt={modal.prompt} onClose={() => setModal(null)} />}
      {translateLang && (
        <TranslatePickerModal
          targetLang={translateLang}
          tailoredResume={tailoredResume || ''}
          library={library || []}
          glossary={glossary || ''}
          onClose={() => setTranslateLang(null)}
        />
      )}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// MARKDOWN RENDERER (simple, for resume preview)
// ════════════════════════════════════════════════════════════════

function MdView({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const out = []; let listBuf = [];
  const flushList = () => {
    if (!listBuf.length) return;
    out.push(<ul key={out.length} className="list-disc pl-5 my-1 space-y-0.5">{listBuf.map((li,i)=><li key={i} className="text-sm text-gray-700">{renderInline(li)}</li>)}</ul>);
    listBuf = [];
  };
  const renderInline = s => s.split(/(\*\*[^*]+\*\*)/).map((p,i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2,-2)}</strong> : <span key={i}>{p}</span>
  );
  lines.forEach((raw,i) => {
    const l = raw.replace(/\r$/,'');
    if (/^#\s/.test(l))      { flushList(); out.push(<h1 key={i} className="text-xl font-bold mt-3 mb-1">{l.slice(2)}</h1>); }
    else if (/^##\s/.test(l)){ flushList(); out.push(<h2 key={i} className="text-base font-semibold mt-3 mb-1 text-gray-800">{l.slice(3)}</h2>); }
    else if (/^###\s/.test(l)){ flushList(); out.push(<h3 key={i} className="text-sm font-semibold mt-2 mb-0.5 text-gray-700">{l.slice(4)}</h3>); }
    else if (/^\s*[-*]\s/.test(l)){ listBuf.push(l.replace(/^\s*[-*]\s/,'')); }
    else if (l.trim()==='')  { flushList(); out.push(<div key={i} className="h-1.5"/>); }
    else                     { flushList(); out.push(<p key={i} className="text-sm text-gray-700 my-0.5">{renderInline(l)}</p>); }
  });
  flushList();
  return <div>{out}</div>;
}

// ════════════════════════════════════════════════════════════════
// SETTINGS PANEL (GitHub only)
// ════════════════════════════════════════════════════════════════

// Settings: two sections inside the family Settings dialog. appearance.js draws the dialog with its Theme and
// Appearance groups and a Done button; App renders these sections into it. Keys stay in this browser and go only to
// their own APIs. The dialog is no longer opened on first load (a visitor opening the public address is "not
// connected", and a modal on arrival hid the whole page); a connect card on every view opens it instead.
function SettingsSections({ ghOk, onGhChange }) {
  const [tok, setTok]         = useState(lsGet('githubToken'));
  const [repo, setRepo]       = useState(lsGet('githubRepo'));
  const [key, setKey]         = useState(lsGet('anthropicKey'));
  const [showTok, setShowTok] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [connected, setConnected] = useState(ghOk);
  const [status, setStatus]   = useState(null);   // { ok, msg } — the line under the token field
  const [testing, setTesting] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  const save = () => {
    lsSet('githubToken', tok.trim()); lsSet('githubRepo', repo.trim());
    const ok = ghConfigured(); setConnected(ok); onGhChange?.(ok);
    setStatus({ ok:true, msg: T('已保存。','Saved.') });
  };
  const test = async () => {
    lsSet('githubToken', tok.trim()); lsSet('githubRepo', repo.trim());
    setTesting(true); setStatus(null);
    try {
      const d = await testGhConnection();
      setStatus({ ok:true, msg: `✓ ${T('已连接','Connected')} — ${d.full_name} (${d.private ? T('私有','private') : T('公开','public')})` });
      setConnected(true); onGhChange?.(true);
    } catch(e) {
      setStatus({ ok:false, msg: `✗ ${T('连接失败','Couldn’t connect')} — ${e.message}. ${T('请确认令牌勾选了 repo 权限。','Check that the token has the repo scope.')}` });
    } finally { setTesting(false); }
  };
  const clear = () => {
    if (!window.confirm(T('移除 GitHub 凭证？','Remove GitHub credentials?'))) return;
    lsDel('githubToken'); lsDel('githubRepo'); setTok(''); setRepo(''); setConnected(false); setStatus(null); onGhChange?.(false);
  };
  const saveKey = () => { lsSet('anthropicKey', key.trim()); setKeySaved(true); setTimeout(() => setKeySaved(false), 2000); };
  const tokName = showTok ? T('隐藏令牌','Hide token') : T('显示令牌','Show token');
  const keyName = showKey ? T('隐藏密钥','Hide key') : T('显示密钥','Show key');

  return (
    <div className="set-stack">
      <section className="set-sec" aria-labelledby="set-repo-h">
        <h3 id="set-repo-h">{T('私有数据仓库','Private data repo')}</h3>
        <details open={!connected}>
          <summary>{T('怎么设置','How to set it up')}</summary>
          <ol>
            <li>{T('新建一个私有 GitHub 仓库，例如 ','Create a private GitHub repo, for example ')}<code>your-username/jobapp-data</code></li>
            <li>{T('打开 ','Open ')}<a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer">github.com/settings/tokens/new</a></li>
            <li>{T('勾选 repo 权限，生成并复制令牌','Tick the repo scope, generate the token and copy it')}</li>
            <li>{T('把仓库名和令牌填在下面，保存','Fill in the repository and the token below, then save')}</li>
          </ol>
        </details>
        <div className="fld">
          <label htmlFor="set-repo">{T('仓库（owner/repo-name）','Repository (owner/repo-name)')}</label>
          <input id="set-repo" type="text" value={repo} onChange={e=>setRepo(e.target.value)} placeholder="your-username/jobapp-data" autoComplete="off" spellCheck="false" />
        </div>
        <div className="fld">
          <label htmlFor="set-token">{T('个人访问令牌','Personal access token')}</label>
          <div className="secret">
            <input id="set-token" type={showTok?'text':'password'} value={tok} onChange={e=>setTok(e.target.value)} placeholder="ghp_…" autoComplete="off" spellCheck="false"
              aria-invalid={status && !status.ok ? 'true' : undefined} aria-describedby="set-status" />
            <button type="button" className="btn btn-ghost btn-icon" aria-pressed={showTok} aria-label={tokName} data-tip={tokName} onClick={()=>setShowTok(s=>!s)}>
              <Icon name={showTok ? 'eyeOff' : 'eye'} />
            </button>
          </div>
        </div>
        <p id="set-status" className={`status${status ? (status.ok ? ' ok' : ' bad') : ''}`} role="status">{status ? status.msg : ''}</p>
        <div className="row">
          <Btn variant="primary" onClick={save} disabled={!tok.trim()||!repo.trim()}>{T('保存','Save')}</Btn>
          <Btn onClick={test} disabled={testing||!tok.trim()||!repo.trim()}>{testing ? T('测试中…','Testing…') : T('测试连接','Test connection')}</Btn>
          {connected && <Btn variant="danger" onClick={clear}>{T('移除凭证','Remove credentials')}</Btn>}
        </div>
      </section>
      <section className="set-sec" aria-labelledby="set-key-h">
        <h3 id="set-key-h">{T('Anthropic API 密钥（可选）','Anthropic API key (optional)')}</h3>
        <p>{T('供「提醒」与「批量定制」使用，每次扫描约 $0.01–0.05。在 ','Used by Alerts and Batch tailor, about $0.01–0.05 per scan. Get one at ')}<a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a>{T(' 获取。','.')}</p>
        <div className="fld">
          <label htmlFor="set-key">{T('密钥','Key')}</label>
          <div className="secret">
            <input id="set-key" type={showKey?'text':'password'} value={key} onChange={e=>setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" spellCheck="false" />
            <button type="button" className="btn btn-ghost btn-icon" aria-pressed={showKey} aria-label={keyName} data-tip={keyName} onClick={()=>setShowKey(s=>!s)}>
              <Icon name={showKey ? 'eyeOff' : 'eye'} />
            </button>
          </div>
        </div>
        <div className="row"><Btn onClick={saveKey}>{keySaved ? T('已保存','Saved') : T('保存密钥','Save key')}</Btn></div>
      </section>
      <p className="set-note">{T('密钥只存在这个浏览器里，只发给各自的 API。','Keys stay in this browser and are sent only to their own APIs.')}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PROFILE TAB
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// TEMPLATES — profile skeleton + per-role skills blocks (one click to insert, then edit freely)
// ════════════════════════════════════════════════════════════════
const PROFILE_STARTER = [
  { name:'Contact & Links', content:'Full name:\nLocation (city, country):\nPhone(s):\nEmail:\nLinkedIn:\nPortfolio / GitHub / personal site:\nWork authorization (per region, e.g. citizen / PR / visa / open to sponsorship):' },
  { name:'Professional Summary', content:'2–3 sentences: who you are, years of experience, 2–3 top strengths, and the role/industry you target.\n\ne.g. "Data analyst with 3 years turning messy data into decisions; strong in SQL, Python and dashboarding; targeting analytics roles in fintech."' },
  { name:'Work Experience', content:'Company — Job Title (City) | Mon YYYY – Mon YYYY (or Present)\n• Bullet = strong verb + what you did + measurable impact (%, $, #, time saved)\n• …\n\nCompany — Job Title (City) | Mon YYYY – Mon YYYY\n• …' },
  { name:'Education', content:'School — Degree, Major (City) | Graduated YYYY\n• GPA / honors / relevant coursework / thesis (optional)' },
  { name:'Skills', content:'Core / hard skills: \nTools & software: \nProgramming / technical: \nSpoken languages (with level): \nSoft skills: ' },
  { name:'Projects', content:'Project name — your role | link (if any)\n• What it does · your contribution · tools/tech used · result.\n\nProject name — …' },
  { name:'Certifications & Awards', content:'Certification — Issuer | YYYY\nAward / Scholarship — Body | YYYY' },
];
const SKILL_TEMPLATES = [
  { role:'Software / Web Developer', icon:'💻', content:'Languages: Python, JavaScript/TypeScript, Java, Go, SQL\nFrontend: React, Vue, HTML/CSS, Tailwind\nBackend: Node.js, Django/Flask, Spring, REST & GraphQL APIs\nDevOps & cloud: Git, Docker, Kubernetes, CI/CD, AWS/GCP/Azure\nConcepts: data structures & algorithms, system design, testing/TDD, Agile/Scrum' },
  { role:'Data Analyst / Scientist', icon:'📊', content:'Analysis: SQL, Python (pandas, NumPy), R, Excel (advanced)\nViz/BI: Tableau, Power BI, Looker, matplotlib\nStats/ML: A/B testing, regression, classification, clustering, scikit-learn\nData eng: ETL, dbt, Airflow, BigQuery/Snowflake, data modeling\nSoft: storytelling with data, stakeholder communication' },
  { role:'Product Manager', icon:'🧭', content:'Discovery: user research, interviews, JTBD, market/competitor analysis\nExecution: roadmapping, PRDs, backlog grooming, Agile/Scrum, Jira\nData: KPIs/OKRs, funnel & cohort analysis, SQL, A/B testing, amplitude/mixpanel\nDesign: wireframing (Figma), prototyping, UX collaboration\nSoft: prioritization, cross-functional leadership, stakeholder management' },
  { role:'Digital Marketing', icon:'📣', content:'Channels: SEO/SEM, Google Ads, Meta/TikTok ads, email, content marketing\nAnalytics: GA4, Google Tag Manager, attribution, conversion optimization\nTools: HubSpot, Mailchimp, Hootsuite, Semrush/Ahrefs, Canva\nSkills: copywriting, A/B testing, campaign management, budget management' },
  { role:'Finance / Accounting', icon:'💰', content:'Core: financial modeling, valuation (DCF/comps), forecasting & budgeting, variance analysis\nReporting: GAAP/IFRS, financial statements, month-end close, AP/AR\nTools: Excel (advanced), QuickBooks, SAP, Oracle, Bloomberg\nSkills: FP&A, audit support, reconciliation, attention to detail' },
  { role:'UX / UI Designer', icon:'🎨', content:'Design: Figma, Sketch, Adobe XD, design systems, prototyping\nResearch: user interviews, usability testing, personas, journey mapping\nSkills: wireframing, interaction design, accessibility (WCAG), responsive design\nNice to have: HTML/CSS, motion, basic frontend handoff' },
  { role:'Sales / Business Dev', icon:'🤝', content:'Cycle: prospecting, lead gen, discovery, demos, negotiation, closing\nCRM/tools: Salesforce, HubSpot, Outreach, LinkedIn Sales Navigator\nMetrics: pipeline, quota attainment, win rate, ARR/MRR\nSkills: relationship building, consultative selling, account management' },
  { role:'Operations / Project Mgmt', icon:'⚙️', content:'PM: project planning, Gantt/roadmaps, risk management, stakeholder updates\nMethod: Agile/Scrum, Kanban, Lean/Six Sigma, process improvement\nTools: Jira, Asana, Trello, MS Project, Excel\nSkills: vendor management, budgeting, cross-functional coordination' },
  { role:'HR / Recruiting', icon:'👥', content:'Recruiting: sourcing, screening, interviewing, ATS (Greenhouse/Lever)\nHR ops: onboarding, performance management, HRIS (Workday/BambooHR)\nSkills: employer branding, compensation basics, employment law awareness, DEI' },
  { role:'Customer Success / Support', icon:'🎧', content:'Tools: Zendesk, Intercom, Salesforce Service Cloud\nMetrics: CSAT, NPS, churn, retention, time-to-resolution\nSkills: onboarding, account health, upsell/renewal, troubleshooting, empathy' },
];

function ProfileTab({ sections, updateSections, formatting, setFormatting, glossary, setGlossary, region, resumeDb }) {
  const [showTpl, setShowTpl] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [editName, setEditName]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [fmtDraft, setFmtDraft]     = useState(formatting || '');
  const [fmtSaved, setFmtSaved]     = useState(false);
  const [glsDraft, setGlsDraft]     = useState(glossary || '');
  const [glsSaved, setGlsSaved]     = useState(false);

  // Keep drafts in sync if values change from outside (e.g. on first load)
  useEffect(() => { setFmtDraft(formatting || ''); }, [formatting]);
  useEffect(() => { setGlsDraft(glossary  || ''); }, [glossary]);

  const handleUpload = (text, filename) => {
    const name = filename.replace(/\.[^.]+$/, '') || 'Untitled';
    const section = { id: newId(), name, content: text, source: 'upload', filename, addedAt: new Date().toISOString() };
    updateSections([...sections, section], false); // false = don't save to GitHub yet
  };

  const handleAddManual = () => {
    const section = { id: newId(), name: 'New section', content: '', source: 'manual', addedAt: new Date().toISOString() };
    const updated = [...sections, section];
    updateSections(updated, false);
    setExpandedId(section.id);
    setEditingId(section.id);
    setEditName('New section');
  };

  const insertSection = (name, content) => {
    updateSections([...sections, { id:newId(), name, content, source:'template', addedAt:new Date().toISOString() }], false);
  };
  const insertStarter = () => {
    const now = new Date().toISOString();
    const adds = PROFILE_STARTER.map(t => ({ id:newId(), name:t.name, content:t.content, source:'template', addedAt:now }));
    updateSections([...sections, ...adds], false);
    setShowTpl(false);
  };

  const handleDelete = id => {
    if (!window.confirm(T('从你的资料中移除此部分？','Remove this section from your profile?'))) return;
    updateSections(sections.filter(s => s.id !== id), false);
  };

  const handleContentChange = (id, val) => {
    updateSections(sections.map(s => s.id === id ? {...s, content: val} : s), false);
  };

  const startRename = (s) => { setEditingId(s.id); setEditName(s.name); };
  const commitRename = (id) => {
    if (editName.trim()) updateSections(sections.map(s => s.id === id ? {...s, name: editName.trim()} : s), false);
    setEditingId(null);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    await updateSections(sections, true); // true = save to GitHub
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const totalChars = sections.reduce((n, s) => n + (s.content || '').length, 0);

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <SectionHdr icon="📝" title={T('我的资料 — 给 AI 提示词的参考文件','My profile — reference files for AI prompts')}
          action={
            <div className="flex flex-wrap gap-2 items-center">
              <FileUploadButton onFile={handleUpload} label={T('上传文件','Upload file')} />
              <Btn onClick={()=>setShowTpl(v=>!v)}>{T('📋 模板','📋 Templates')}</Btn>
              <Btn onClick={handleAddManual}>{T('➕ 添加部分','➕ Add section')}</Btn>
              <Btn variant="primary" onClick={handleSaveAll} disabled={saving}>
                {saving ? T('⏳ 保存中…','⏳ Saving…') : saved ? T('✅ 已保存','✅ Saved') : T('💾 全部保存','💾 Save all')}
              </Btn>
            </div>
          }
        />
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 mb-3">
          <strong>{T('使用 AI 提示词时，下面所有部分会被合并发送给 Claude。','All sections below are combined and sent to Claude when you use AI prompts.')}</strong>{' '}
          {T('逐个上传文件 — 工作经历、简历模板、技能，任何你想让 Claude 参考的内容。支持 .txt、.md、.docx、.pdf。','Upload each file separately — work history, resume templates, skills, anything you want Claude to reference. Accepts .txt, .md, .docx, .pdf.')} <strong>{T('所有地区共享。','Shared across all regions.')}</strong>
          {totalChars > 0 && <span className="ml-1 text-blue-700">{T('共 ','Total: ')}{totalChars.toLocaleString()}{T(' 个字符，分布在 ',' characters across ')}{sections.length}{T(' 个部分。', sections.length !== 1 ? ' sections.' : ' section.')}</span>}
        </div>

        {showTpl && (
          <div className="mb-3 p-3 border border-purple-200 bg-purple-50 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-purple-900">{T('📋 模板 — 一键插入，之后自由编辑','📋 Templates — one click to insert, then edit freely')}</span>
              <button onClick={()=>setShowTpl(false)} className="text-xs text-purple-700 hover:underline">{T('✕ 关闭','✕ close')}</button>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Btn variant="primary" onClick={insertStarter}>{T('🧱 生成个人资料库骨架','🧱 Generate personal-database skeleton')}</Btn>
              <span className="text-xs text-purple-800">{T('添加 联系方式 · 概述 · 经历 · 教育 · 技能 · 项目 · 证书 等可编辑部分供填写。','Adds Contact · Summary · Experience · Education · Skills · Projects · Certifications as editable sections to fill in.')}</span>
            </div>
            <div className="text-xs font-medium text-purple-900 mb-1.5">{T('按岗位添加一组精选技能：','Add a curated skills block by role:')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {SKILL_TEMPLATES.map(t => (
                <button key={t.role} onClick={()=>insertSection('Skills — '+t.role, t.content)}
                  className="text-left text-xs px-2.5 py-2 rounded-md border border-purple-200 bg-white hover:bg-purple-100 transition-colors">
                  <span className="font-medium text-gray-800">{t.icon} {t.role}</span>
                  <span className="block text-purple-600 mt-0.5">{T('+ 作为部分插入','+ insert as section')}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-purple-700">{T('作为新部分插入 — 可自由重命名 / 编辑 / 删除，然后点击 💾 全部保存 同步。','Inserted as new sections — rename / edit / delete them freely, then click 💾 Save all to sync.')}</div>
          </div>
        )}

        {sections.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-md">
            {T('还没有任何部分。点击 ','No sections yet. Click ')}<strong>{T('上传文件','Upload file')}</strong>{T(' 添加第一个，或点击 ',' to add your first one, or ')}<strong>{T('添加部分','Add section')}</strong>{T(' 手动编写。',' to write manually.')}
          </div>
        ) : (
          <div className="space-y-2">
            {sections.map((s) => (
              <div key={s.id} className="border border-gray-200 rounded-md overflow-hidden">
                {/* Section header row */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <button className="text-gray-400 text-xs w-4 shrink-0" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                    {expandedId === s.id ? '▼' : '▶'}
                  </button>
                  <span className="text-xs">{s.source === 'upload' ? '📄' : '✍️'}</span>

                  {/* Inline rename */}
                  {editingId === s.id ? (
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => commitRename(s.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 text-sm font-medium px-1 border border-blue-400 rounded focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <button className="flex-1 text-left text-sm font-medium text-gray-900 truncate" onClick={() => startRename(s)}>
                      {s.name}
                    </button>
                  )}

                  <span className="text-xs text-gray-400 shrink-0">{(s.content || '').length.toLocaleString()} {T('字符','chars')}</span>
                  <button onClick={() => startRename(s)} className="text-xs text-gray-400 hover:text-gray-700 shrink-0" title={T('重命名','Rename')}>✏️</button>
                  <button onClick={() => handleDelete(s.id)} className="text-xs text-gray-400 hover:text-red-600 shrink-0" title={T('移除','Remove')}>🗑</button>
                </div>

                {/* Expanded editor */}
                {expandedId === s.id && (
                  <div className="p-2 border-t border-gray-200">
                    <textarea
                      value={s.content || ''}
                      onChange={e => handleContentChange(s.id, e.target.value)}
                      placeholder={T('此部分的内容…','Content of this section…')}
                      className="w-full h-48 p-2 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {sections.length > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            {T('点击部分名称可重命名。点击 ▶ 展开并编辑内容。完成后点击 💾 全部保存。','Click a section name to rename it. Click ▶ to expand and edit the content. Click 💾 Save all when done.')}
          </p>
        )}
      </Card>

      {/* Translation glossary card */}
      <Card className="p-4">
        <SectionHdr icon="📖" title={T('翻译词汇表','Translation glossary')}
          action={
            <Btn variant="primary" onClick={async () => {
              setGlossary(glsDraft);
              await saveText('glossary', glsDraft);
              setGlsSaved(true); setTimeout(() => setGlsSaved(false), 1500);
            }}>
              {glsSaved ? T('✅ 已保存','✅ Saved') : T('💾 保存','💾 Save')}
            </Btn>
          }
        />
        <p className="text-xs text-gray-600 mb-3">
          {T('为你的姓名、公司名、学校名以及其他术语指定精确的中文翻译。它们会被注入每一条','Specify exact Chinese translations for your name, company names, school names, and any other terms. These are injected into every')} <strong>{T('翻译','Translate')}</strong> {T('提示词，让 Claude 始终使用你偏好的翻译 — 每行一条。','prompt so Claude always uses your preferred translations — one entry per line.')}
        </p>
        <textarea
          value={glsDraft}
          onChange={e => setGlsDraft(e.target.value)}
          placeholder={`One entry per line, format: English term → Chinese translation\n\nExamples:\nYour Name → 你的中文名\nYour University → 大学名称\nYour Company → 公司名称\nProject Name → 项目名称\nVancouver → 温哥华`}
          className="w-full h-40 p-3 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
        <p className="mt-1 text-xs text-gray-400">
          {glsDraft.trim()
            ? T(`✅ ${glsDraft.trim().split('\n').filter(Boolean).length} 条词条 — 已注入所有翻译提示词。`, `✅ ${glsDraft.trim().split('\n').filter(Boolean).length} entr${glsDraft.trim().split('\n').filter(Boolean).length !== 1 ? 'ies' : 'y'} — injected into all translate prompts.`)
            : T('暂无词汇表 — Claude 将自行判断姓名翻译。','No glossary entries yet — Claude will use its best judgment for names.')}
        </p>
      </Card>

      {/* Formatting instructions card */}
      <Card className="p-4">
        <SectionHdr icon="🎨" title={T('简历格式要求','Resume formatting requirements')}
          action={
            <Btn variant="primary" onClick={async () => {
              setFormatting(fmtDraft);
              await saveText('formatting', fmtDraft);
              setFmtSaved(true); setTimeout(() => setFmtSaved(false), 1500);
            }}>
              {fmtSaved ? T('✅ 已保存','✅ Saved') : T('💾 保存','💾 Save')}
            </Btn>
          }
        />
        <p className="text-xs text-gray-600 mb-3">
          {T('准确描述你希望的简历排版方式。它会被包含进每一条','Describe exactly how you want your resume laid out. This is included in every')} <strong>{T('定制简历','Tailor Resume')}</strong> {T("提示词，让 Claude 始终遵循你偏好的格式 — 即使它无法读取你上传文件的视觉样式。","prompt so Claude always follows your preferred format — even though it can't read the visual styling of your uploaded files.")}
        </p>
        <textarea
          value={fmtDraft}
          onChange={e => setFmtDraft(e.target.value)}
          placeholder={T(`在这里写什么的示例：\n\n- 最多一页\n- 章节顺序：概述、经历、教育、技能\n- 每段角色下用项目符号，最多 4 条\n- 日期靠右，公司和职位靠左\n- 不写求职目标陈述\n- 公司名和职位用加粗\n- 技能部分：逗号分隔，按类别分组\n- 香港格式：顶部加一行照片占位\n- 使用英式英语拼写`,`Examples of what to write here:\n\n- One page maximum\n- Sections in this order: Summary, Experience, Education, Skills\n- Bullet points under each role, max 4 bullets\n- Dates on the right side, company and title on the left\n- No objective statement\n- Use bold for company names and job titles\n- Skills section: list as comma-separated, grouped by category\n- Hong Kong format: include a photo placeholder line at the top\n- Use British English spelling`)}
          className="w-full h-48 p-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
        />
        <p className="mt-1 text-xs text-gray-400">
          {fmtDraft.trim()
            ? T(`✅ 已保存 ${fmtDraft.trim().split('\n').filter(Boolean).length} 条格式规则 — 已包含进定制简历提示词。`, `✅ ${fmtDraft.trim().split('\n').filter(Boolean).length} formatting rule${fmtDraft.trim().split('\n').filter(Boolean).length !== 1 ? 's' : ''} saved — included in Tailor Resume prompts.`)
            : T('尚未设置格式规则 — Claude 将使用其默认排版。','No formatting rules set yet — Claude will use its default layout.')}
        </p>
      </Card>

      {/* Generate General Resume */}
      <Card className="p-4">
        <SectionHdr icon="📄" title={T('生成通用简历','Generate general resume')} />
        <GeneralResumeSection resumeDb={resumeDb} formatting={formatting} glossary={glossary} region={region} />
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// GENERAL RESUME GENERATOR
// ════════════════════════════════════════════════════════════════

function GeneralResumeSection({ resumeDb, formatting, glossary, region }) {
  const [showModal, setShowModal] = useState(false);
  const REGION_CFG = {
    canada:   { label:T('🇨🇦 英文简历','🇨🇦 English Resume') },
    hongkong: { label:T('🇭🇰 繁體中文 + 英文（2 页）','🇭🇰 繁體中文 + English (2 pages)') },
    china:    { label:T('🇨🇳 简体中文简历','🇨🇳 Simplified Chinese resume') },
  };
  const cfg = REGION_CFG[region] || { label: `${(REGION_BY[region]||{}).flag||'🌍'} ${T('英文简历','English Resume')} — ${rName(REGION_BY[region])||T('地区','Region')}` };

  function buildPrompt() {
    if (region === 'canada') {
      return `Generate a one-page Letter PDF general resume (NOT tailored to any specific job) using Claude's Analysis Tool (reportlab). Extract the candidate's name and save as /mnt/user-data/outputs/{Firstname}_{Lastname}_Resume.pdf (e.g. Jane_Doe_Resume.pdf).

PROFILE:
${resumeDb||''}

REPORTLAB LAYOUT (Platypus — SimpleDocTemplate + story list):
• Letter; margins L/R 0.6", T/B 0.5"; Helvetica throughout.
• Header: Paragraph(name, 16pt-bold ALL CAPS centered, spaceAfter=4) then Paragraph(contact, 9.5pt centered, " · " separator, spaceAfter=8).
• ALL section tables use colWidths=[78, None] without exception.
• Each section is ONE Table with section title as spanning first row:
  ('SPAN', (0,0), (1,0)), ('LINEBELOW', (0,0), (1,0), 0.75, colors.black)
  ('TOPPADDING', (0,1), (-1,1), 6), ('BOTTOMPADDING', (0,0), (-1,0), 4)
  ('RIGHTPADDING', (0,1), (0,-1), 8)
• Define ALL ParagraphStyles from scratch — no getSampleStyleSheet(). leftIndent=0, firstLineIndent=0 on every style.
• Date format: "Month YYYY" or "Season YYYY" — never inverted.
• Skills: each row is [Paragraph(label, bold), Paragraph(values, normal)] — label in LEFT cell, all values on ONE line.
• Section order: EDUCATION, CERTIFICATIONS (skip if none), EXPERIENCE, PROJECTS, SKILLS.
• No HRFlowable. No tighten functions. Verify page count with PdfReader.
• FILL THE PAGE if extra space — binary-search spacing upward.

CONTENT:
- General resume — showcase breadth and strongest work.
- Select the most impressive content. Cut weaker items to fit one page. 2-3 bullets per entry.
- Courses: select broadly. Never show grades.
${(formatting||'').trim() ? `- Custom: ${formatting.trim()}` : ''}

ONE PAGE — MANDATORY. Cut weakest first. FILL THE PAGE if space remains. Verify page count.

TONE: Recent graduate. No buzzwords. Plain verbs. Modest specificity.`.trim();

    } else if (region === 'hongkong') {
      return `Generate a TWO-PAGE A4 PDF using Claude's Analysis Tool (reportlab). Page 1: Traditional Chinese. Page 2: English. Save as /mnt/user-data/outputs/{Firstname}_{Lastname}_Resume.pdf (e.g. Jane_Doe_Resume.pdf).

Use the content below. Page 1: make a Hong Kong Traditional Chinese professional resume — use your own professional HK-style layout and formatting, do NOT copy the structure or formatting from the profile text, only use the content.
Page 2: standard English resume using the same content.

CONTENT TO USE:
${resumeDb||''}
${glossary ? `\nTRANSLATION GLOSSARY (use these translations for proper nouns):\n${glossary}\n` : ''}
FONT (critical — no pip install, no font download):
import glob
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
paths = glob.glob('/usr/share/fonts/**/Noto*CJK*.ttc', recursive=True) + \
        glob.glob('/usr/share/fonts/**/Noto*CJK*.ttf', recursive=True) + \
        glob.glob('/usr/share/fonts/**/*wqy*.ttf', recursive=True) + \
        glob.glob('/usr/share/fonts/**/*wqy*.ttc', recursive=True)
if not paths: raise Exception('No CJK font found on system')
pdfmetrics.registerFont(TTFont('CJK', paths[0]))

CRITICAL RULES:
1. Contact line: local phone ｜ secondary phone (if any) ｜ email — NO home address
2. Line breaks in bullet text: set wordWrap='CJK' on all paragraph styles for page 1. This prevents reportlab from inserting line breaks at every English word or number that appears inside Chinese sentences. Without this, "DCF" or "20+" causes an unwanted newline.
3. Spacing: use generous spacing — spaceBefore/spaceAfter on section headers at least 10pt, between entries at least 8pt. If page has blank space at the bottom, increase spacing further to fill naturally.
4. Page 1 uses fontName='CJK' for all text. Page 2 uses fontName='Helvetica'.
5. No AI Workflows as a separate skill section — include relevant items in Technical.
6. Order projects by relevance to the target role, strongest first.
7. Both pages must fill a full A4 page. Use 3 bullets for experience, 2 per project, include all courses.
8. Separate pages with PageBreak(). Verify page count = 2 with PdfReader.`.trim();

        } else {
      return `Generate a one-page A4 PDF resume in Simplified Chinese using Claude's Analysis Tool (reportlab). Save as /mnt/user-data/outputs/{Firstname}_{Lastname}_Resume.pdf (e.g. Jane_Doe_Resume.pdf).

PROFILE:
${resumeDb||''}
${glossary ? `\nTRANSLATION GLOSSARY:\n${glossary}\n` : ''}
FONT SETUP (do this FIRST — do NOT use UnicodeCIDFont or STSong/MSung):
import glob
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
cjk_paths = glob.glob('/usr/share/fonts/**/Noto*CJK*.ttc', recursive=True) + \
            glob.glob('/usr/share/fonts/**/Noto*CJK*.ttf', recursive=True) + \
            glob.glob('/usr/share/fonts/**/*WenQuanYi*.ttf', recursive=True) + \
            glob.glob('/usr/share/fonts/**/*wqy*.ttc', recursive=True)
if cjk_paths:
    pdfmetrics.registerFont(TTFont('CJK', cjk_paths[0]))
    CJK_FONT = 'CJK'
else:
    raise Exception('No CJK font found — install fonts-noto-cjk')

LAYOUT — EXACT same Platypus structure as a standard English resume:
• A4 page, margins 2cm all sides
• Each section is ONE Table with section title as spanning first row:
  ('SPAN', (0,0), (1,0)), ('LINEBELOW', (0,0), (1,0), 0.75, colors.black)
  ('VALIGN', (0,0), (-1,-1), 'TOP'), ('LEFTPADDING', (0,0), (-1,-1), 0)
  ('RIGHTPADDING', (0,0), (-1,-1), 0), ('RIGHTPADDING', (0,1), (0,-1), 8)
  ('TOPPADDING', (0,0), (-1,-1), 0), ('TOPPADDING', (0,1), (-1,1), 6), ('BOTTOMPADDING', (0,0), (-1,0), 4), ('BOTTOMPADDING', (0,1), (-1,-1), 5)
• colWidths=[78, None] for ALL tables
• Define ALL ParagraphStyles from scratch (leftIndent=0, firstLineIndent=0) — no getSampleStyleSheet()
• ALL styles use fontName=CJK_FONT
• Header: name 14pt bold centered (spaceAfter=4), contact 10pt centered (spaceAfter=8)
• Section title: 11pt bold; body: 10pt; skills ONE line per category

CONTENT:
- Write ENTIRELY in Simplified Chinese. English only for proper nouns and technical terms.
- Do NOT mix Chinese and English randomly — translate everything with a standard Chinese equivalent
- 简历格式：个人信息、教育背景、实习经历、项目经历、技能特长、语言能力
- 2-3 strongest bullets per entry. ONE PAGE mandatory.
- Courses: never show grades. Skills: one line per category.
- FILL THE PAGE if space remains. Verify page count with PdfReader.`.trim();
        }
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        {T('从你的资料生成一份通用简历 — 不针对任何特定职位。','Generate a general-purpose resume from your profile — not tailored to any specific job.')}
        {region === 'canada' ? T(' Claude 通过 Analysis 工具生成一页 PDF。',' Claude generates a one-page PDF via the Analysis Tool.')
         : region === 'hongkong' ? T(' 两页 PDF：第 1 页繁體中文，第 2 页英文。',' Two-page PDF: Traditional Chinese page 1, English page 2.')
         : T(' 通过 Analysis 工具生成一页简体中文 PDF。',' One-page PDF in Simplified Chinese via the Analysis Tool.')}
      </p>
      <div className="flex items-center gap-3">
        <Btn variant="primary" onClick={()=>setShowModal(true)} disabled={!resumeDb?.trim()}>
          📄 {cfg.label}
        </Btn>
        <span className="text-xs text-gray-400">{T('复制粘贴到 Claude.ai','Copy-paste to Claude.ai')}</span>
      </div>
      {!resumeDb?.trim() && <p className="text-xs text-amber-700 mt-2">{T('请先添加你的资料部分。','Add your profile sections first.')}</p>}
      {showModal && <PromptModal title={cfg.label} prompt={buildPrompt()} onClose={()=>setShowModal(false)} />}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════
// RESUME LIBRARY TAB
// ════════════════════════════════════════════════════════════════

function LibraryTab({ library, setLibrary, updateSections }) {
  const [expandedId, setExpandedId] = useState(null);

  const handleUpload = async (text, filename) => {
    const entry = { id: newId(), name: filename.replace(/\.[^.]+$/,'') || 'Untitled', content: text, uploadedAt: new Date().toISOString() };
    const updated = [entry, ...library];
    setLibrary(updated); await saveJson('library', updated);
  };

  const handleDelete = async id => {
    if (!window.confirm(T('删除这份简历？','Delete this resume?'))) return;
    const updated = library.filter(r=>r.id!==id); setLibrary(updated); await saveJson('library', updated);
  };

  const handleRename = async id => {
    const cur = library.find(r=>r.id===id); if (!cur) return;
    const next = window.prompt(T('重命名：','Rename:'), cur.name); if (!next||next===cur.name) return;
    const updated = library.map(r=>r.id===id?{...r,name:next}:r); setLibrary(updated); await saveJson('library', updated);
  };

  const handleUseAsProfile = async entry => {
    if (!window.confirm(T(`用「${entry.name}」替换你的整个资料？\n\n这会用此简历中的一个部分替换所有现有部分。`,`Replace your entire profile with "${entry.name}"?\n\nThis replaces all existing sections with one section from this resume.`))) return;
    const section = { id: newId(), name: entry.name, content: entry.content, source: 'library', addedAt: new Date().toISOString() };
    await updateSections([section], true);
  };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{T('📚 简历库','📚 Resume library')}</h3>
            <p className="text-xs text-gray-600">{T('存储多个简历版本。','Store multiple resume versions. ')}<strong>{T('所有地区共享。','Shared across all regions.')}</strong> .txt, .md, .docx, .pdf</p>
          </div>
          <FileUploadButton onFile={handleUpload} label={T('上传简历','Upload resume')} primary />
        </div>
      </Card>
      {library.length === 0 ? (
        <Card className="p-8 text-center text-sm text-gray-500">{T('还没有简历。点击上方的「上传简历」。','No resumes yet. Click Upload resume above.')}</Card>
      ) : (
        <div className="space-y-2">
          {library.map(r => (
            <Card key={r.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <button className="flex-1 text-left min-w-0" onClick={()=>setExpandedId(expandedId===r.id?null:r.id)}>
                  <div className="text-sm font-semibold text-gray-900 truncate">{r.name}</div>
                  <div className="text-xs text-gray-500">{fmtDate(r.uploadedAt)} · {r.content.length.toLocaleString()} {T('字符','chars')}</div>
                </button>
                <div className="flex gap-1 flex-wrap shrink-0">
                  <Btn onClick={()=>handleUseAsProfile(r)}>{T('👤 用作资料','👤 Use as profile')}</Btn>
                  <DownloadMenu content={r.content} baseFilename={r.name} />
                  <Btn onClick={()=>handleRename(r.id)}>✏️</Btn>
                  <Btn variant="danger" onClick={()=>handleDelete(r.id)}>🗑</Btn>
                </div>
              </div>
              {expandedId===r.id && (
                <div className="mt-3 p-3 bg-gray-50 rounded-md max-h-96 overflow-y-auto"><MdView text={r.content} /></div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ADD JOB TAB
// ════════════════════════════════════════════════════════════════

function AddJobTab({ resumeDb, formatting, glossary, library, jobs, setJobs, region, onSaved }) {
  const empty = { company:'', role:'', location:'', salaryRange:'', applicationDeadline:'', status:'interested', jdText:'', notes:'', noc:'', weeklyHours:'', empType:'', applyMethod:'', startDate:'', endDate:'', priority:'' };
  const [form, setForm]       = useState(empty);
  const [saved, setSaved]     = useState(false);
  const [extracted, setExtracted] = useState(null); // fields extracted from upload, for the hint banner

  const set = (k, v) => setForm(f => ({...f, [k]:v}));

  const handleJdUpload = (text, filename) => {
    const parsed = parseJdFields(text);
    // Compute which fields to fill using current form snapshot (single action — no stale state risk)
    const update = { jdText: text };
    const filled = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && !form[k]) { update[k] = v; filled[k] = v; }
    }
    setForm(f => ({ ...f, ...update }));
    setExtracted(Object.keys(filled).length > 0 ? filled : null);
  };

  const handleSave = async () => {
    if (!form.company.trim() && !form.role.trim()) { alert(T('请至少填写公司名称或职位。','Please enter at least a company name or role.')); return; }
    const job = { id: newId(), dateAdded: new Date().toISOString(), ...form };
    const updated = [job, ...jobs];
    setJobs(updated); await saveJson(`${region}:jobs`, updated);
    setSaved(true); setTimeout(()=>setSaved(false), 1200);
    setForm(empty);
    setExtracted(null);
    onSaved?.(job.id);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionHdr icon="➕" title={T('添加一个职位申请','Add a job application')} />
        {/* JD textarea with upload */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-700">{T('职位描述','Job description')}</label>
            <FileUploadButton
              onFile={handleJdUpload}
              label={T('上传 JD 文件','Upload JD file')}
              accept=".txt,.md,.markdown,.docx,.pdf"
            />
          </div>
          <textarea value={form.jdText} onChange={e=>set('jdText',e.target.value)}
            placeholder={T('在此粘贴完整的职位描述，或在上方上传文件。下方字段会根据内容自动填充。','Paste the full job description here, or upload a file above. Fields below will be auto-filled from the content.')}
            className="w-full h-36 p-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
          <div className="text-xs text-gray-400 mt-0.5">{form.jdText.length.toLocaleString()} {T('字符','chars')}</div>
        </div>

        {/* Auto-fill hint banner */}
        {extracted && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-xs text-green-900">
            <strong>{T('✅ 已从文件自动填充：','✅ Auto-filled from file:')}</strong>{' '}
            {Object.entries(extracted).map(([k,v]) => (
              <span key={k} className="inline-block mr-2">
                <span className="font-medium capitalize">{T({company:'公司',role:'职位',location:'地点',salaryRange:'薪资',applicationDeadline:'截止日期'}[k]||k, k === 'salaryRange' ? 'salary' : k === 'applicationDeadline' ? 'deadline' : k)}</span>: {v}
              </span>
            ))}
            <span className="text-green-700 ml-1">{T('— 请在下方检查并更正任何错误。','— Review and correct any errors below.')}</span>
          </div>
        )}

        {/* Form fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {[['company',T('公司 *','Company *'),'Google'],['role',T('职位名称 *','Job Title *'),T('软件工程师','Software Engineer')],['location',T('地点','Location'),T('多伦多 / 远程','Toronto, ON / Remote')],['salaryRange',T('薪资范围','Salary Range'),'$120k – $150k'],
            ['noc',T('NOC 编码（第二位＝TEER）','NOC code'),'12200'],
            ['weeklyHours',T('周工时','Weekly hours'),'30'],
            ['empType',T('雇佣类型','Employment type'),T('T4雇员 / 承包人 / 未确认','T4 employee / contractor / unknown')],
            ['applyMethod',T('投递方式','Apply method'),T('Easy Apply / 站内直投 / ATS','Easy Apply / direct / ATS')],
            ['startDate',T('入职日期（算工时用）','Start date'),'YYYY-MM-DD'],
            ['endDate',T('离职日期（空＝在职）','End date'),''],
            ['priority',T('投递梯队（T1–T4）','Tier'),'T1']].map(([k,lbl,ph]) => (
            <div key={k}>
              <label className="text-xs font-medium text-gray-700 mb-1 block">{lbl}</label>
              <input value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={ph}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">{T('申请截止日期','Application Deadline')}</label>
            <input type="date" value={form.applicationDeadline} onChange={e=>set('applicationDeadline',e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">{T('状态','Status')}</label>
            <select value={form.status} onChange={e=>set('status',e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {STATUSES.map(s=><option key={s.id} value={s.id}>{T(s.zh,s.label)}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-700 mb-1 block">{T('备注','Notes')}</label>
          <textarea value={form.notes} onChange={e=>set('notes',e.target.value)}
            placeholder={T('招聘者姓名、你如何找到它、第一印象…','Recruiter name, how you found it, first impressions…')}
            className="w-full h-20 p-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
        </div>
        <div className="flex justify-end">
          <Btn variant="primary" onClick={handleSave} className="px-4 py-2 text-sm">
            {saved ? T('✅ 已保存!','✅ Saved!') : T('💾 保存到追踪','💾 Save to Tracker')}
          </Btn>
        </div>
      </Card>

      {/* AI Help section */}
      <AiPromptSection resumeDb={resumeDb} job={form} formatting={formatting} glossary={glossary} tailoredResume="" library={library} region={region} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TRACKER TAB
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// BATCH TAILOR — prompt + jsPDF renderer + modal
// ════════════════════════════════════════════════════════════════

function promptBatchTailor(resumeDb, job, formatting, region) {
  return `You are tailoring a resume for a specific job application. Return ONLY a JSON object — no other text, no markdown fences.

CANDIDATE PROFILE:
${resumeDb||''}

JOB DETAILS:
Company: ${job.company||''}
Role: ${job.role||''}
Location: ${job.location||''}
Job Description:
${job.jdText||''}

${(formatting||'').trim() ? `CUSTOM FORMATTING RULES:\n${formatting.trim()}\n\n` : ''}TAILORING RULES:
- Select and reword bullets to match the JD's language and priorities
- Emphasise skills/experiences the JD asks for; deprioritise unrelated ones
- Never invent metrics or experience. Never use: leveraged, spearheaded, drove, transformed, oversaw
- Prefer: built, wrote, designed, implemented, analysed, supported, assisted
- Treat the candidate as a recent graduate — no long-term strategic impact claims
- Courses: select those relevant to this role. Never show grades.
- ${(REGION_BY[region]&&REGION_BY[region].phoneTip)||'Use phone numbers appropriate to the target region'}
- ONE PAGE — select only strongest and most relevant content

Return this exact JSON structure:
{
  "name": "Full Name",
  "contact": "phone · email · location",
  "sections": [
    {
      "title": "EDUCATION",
      "entries": [{"date":"2022–2026","org":"University Name","role":"Degree","bullets":["Course or award line"]}]
    },
    {
      "title": "CERTIFICATIONS",
      "entries": [{"date":"Feb 2026","org":"CFA Institute","role":"Passed Level I of the CFA Program","bullets":[]}]
    },
    {
      "title": "EXPERIENCE",
      "entries": [{"date":"Summer 2025","org":"Company Name","role":"Job Title · Location","bullets":["bullet 1","bullet 2","bullet 3"]}]
    },
    {
      "title": "PROJECTS",
      "entries": [{"date":"2026","org":"Project Name","role":"stack · github link if any","bullets":["bullet 1","bullet 2"]}]
    },
    {
      "title": "SKILLS",
      "type": "skills",
      "entries": [{"label":"Technical","items":"Python, SQL, ..."},{"label":"Professional","items":"..."},{"label":"Languages","items":"..."}]
    }
  ]
}`;
}

// ── jsPDF resume renderer ────────────────────────────────────────

function renderResumePDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'letter' });
  const PW=612, PH=792, ML=43.2, MR=43.2, MT=36, MB=36;
  const CW = PW-ML-MR;          // content width = 525.6
  const DATE_W = 78;             // date column width
  const CONTENT_X = ML+DATE_W;  // content starts at 121.2
  const CONTENT_W = CW-DATE_W;  // 447.6pt

  let y = MT;

  function checkPage(need=12) {
    if (y+need > PH-MB) { doc.addPage(); y=MT; }
  }


  // ── Header ───────────────────────────────────────────────────
  doc.setFont('Helvetica','bold'); doc.setFontSize(16); doc.setTextColor('#111');
  doc.text((data.name||'').toUpperCase(), PW/2, y, {align:'center'});
  y += 20;
  doc.setFont('Helvetica','normal'); doc.setFontSize(9.5);
  doc.text(data.contact||'', PW/2, y, {align:'center'});
  y += 16;

  // ── Sections ─────────────────────────────────────────────────
  for (const sec of (data.sections||[])) {
    checkPage(24);
    y += 8;

    // Section title + rule
    doc.setFont('Helvetica','bold'); doc.setFontSize(10); doc.setTextColor('#111');
    doc.text(sec.title||'', ML, y);
    y += 3;
    doc.setLineWidth(0.75); doc.setDrawColor('#111');
    doc.line(ML, y, PW-MR, y);
    y += 8;

    if (sec.type==='skills') {
      // Skills: "Label:  item1, item2"
      for (const e of (sec.entries||[])) {
        checkPage(14);
        doc.setFont('Helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor('#111');
        doc.text((e.label||'')+': ', ML, y);
        const labelW = doc.getTextWidth((e.label||'')+':  ');
        doc.setFont('Helvetica','normal');
        const lines = doc.splitTextToSize(e.items||'', CW-labelW);
        doc.text(lines[0]||'', ML+labelW, y);
        for (let i=1;i<lines.length;i++) { y+=11; checkPage(); doc.text(lines[i], ML+labelW, y); }
        y += 13;
      }
    } else {
      // Regular entries
      for (const e of (sec.entries||[])) {
        checkPage(16);

        // Org name (bold) + date right-aligned
        const orgY = y;
        doc.setFont('Helvetica','bold'); doc.setFontSize(10); doc.setTextColor('#111');
        const orgLines = doc.splitTextToSize(e.org||'', CONTENT_W-80);
        doc.text(orgLines[0]||'', CONTENT_X, y);
        doc.setFont('Helvetica','normal'); doc.setFontSize(9.5);
        doc.text(e.date||'', PW-MR, orgY, {align:'right'});
        for (let i=1;i<orgLines.length;i++) { y+=11; doc.setFont('Helvetica','bold'); doc.text(orgLines[i], CONTENT_X, y); }
        y += 12;

        // Role/subtitle
        if (e.role) {
          checkPage(11);
          doc.setFont('Helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor('#333');
          const roleLines = doc.splitTextToSize(e.role, CONTENT_W);
          roleLines.forEach((ln,i) => { if(i>0){y+=11;checkPage();} doc.text(ln, CONTENT_X, y); });
          y += 12;
        }

        // Bullets
        for (const b of (e.bullets||[])) {
          if (!b.trim()) continue;
          checkPage(11);
          doc.setFont('Helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor('#111');
          const blines = doc.splitTextToSize(b, CONTENT_W-12);
          blines.forEach((ln, i) => {
            checkPage(11);
            doc.text(i===0 ? '• ' : '  ', CONTENT_X, y);
            doc.text(ln, CONTENT_X+11, y);
            y += 11;
          });
        }
        y += 6; // entry gap
      }
    }
  }
  return doc;
}

// ── Batch Tailor Modal ───────────────────────────────────────────

function BatchTailorModal({ region, jobs, setJobs, resumeDb, formatting, onClose }) {
  const [selected, setSelected] = useState(new Set());
  const [progress, setProgress] = useState({}); // id → 'queued'|'running'|'done'|'error'|'skip'
  const [running, setRunning]   = useState(false);
  const [log, setLog]           = useState([]);

  const eligible = jobs.filter(j => j.status === 'interested' && (j.jdText||'').trim().length > 50 && !loadPdfLocal(`${region}:${j.id}:resume`));
  const noJd     = jobs.filter(j => j.status === 'interested' && (j.jdText||'').trim().length <= 50);
  const haveResume = jobs.filter(j => j.status === 'interested' && loadPdfLocal(`${region}:${j.id}:resume`)).length;

  useEffect(() => {
    setSelected(new Set(eligible.map(j=>j.id)));
  }, []);

  function addLog(msg) { setLog(l => [...l, msg]); }

  async function startBatch() {
    const toProcess = eligible.filter(j=>selected.has(j.id));
    if (!toProcess.length) return;
    const key = lsGet('anthropicKey');
    if (!key) { addLog(T('❌ 没有 Anthropic API 密钥 — 请在 ⚙️ 设置中添加。','❌ No Anthropic API key — add it in ⚙️ Settings.')); return; }

    setRunning(true);
    const initProg = {};
    toProcess.forEach(j => { initProg[j.id]='queued'; });
    setProgress(initProg);

    let updatedJobs = [...jobs];

    for (let i=0; i<toProcess.length; i++) {
      const job = toProcess[i];
      addLog(`[${i+1}/${toProcess.length}] ${job.company} — ${job.role} …`);
      setProgress(p=>({...p,[job.id]:'running'}));

      try {
        const prompt = promptBatchTailor(resumeDb, job, formatting, region);
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'x-api-key': key,
            'anthropic-version':'2023-06-01',
            'anthropic-dangerous-direct-browser-access':'true',
          },
          body: JSON.stringify({
            model:'claude-sonnet-5',
            max_tokens:4000,
            system:'Return ONLY valid JSON. No markdown fences, no explanation.',
            messages:[{role:'user',content:prompt}],
          }),
        });

        if (!res.ok) {
          const e = await res.json().catch(()=>({}));
          throw new Error(`API ${res.status}: ${e.error?.message||'error'}`);
        }

        const apiData = await res.json();
        const text = (apiData.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
        const clean = text.replace(/```json|```/g,'').trim();
        const resumeJson = JSON.parse(clean);

        // Render PDF
        const doc = renderResumePDF(resumeJson);
        const dataUrl = doc.output('datauristring');

        // Save to localStorage + GitHub
        const pdfKey = `${region}:${job.id}:resume`;
        savePdfLocal(pdfKey, dataUrl);
        await ghWriteDataUrl(pdfGhPath(pdfKey), dataUrl);

        setProgress(p=>({...p,[job.id]:'done'}));
        addLog(T('  ✅ 已保存','  ✅ Saved'));

        // Brief pause between calls
        if (i < toProcess.length-1) await new Promise(r=>setTimeout(r,2000));

      } catch(e) {
        setProgress(p=>({...p,[job.id]:'error'}));
        addLog(`  ❌ ${e.message}`);
        if (e.message.includes('429')) {
          addLog(T('  ⏳ 触发限流 — 等待 30 秒…','  ⏳ Rate limited — waiting 30s…'));
          await new Promise(r=>setTimeout(r,30000));
        }
      }
    }

    addLog(T(`\n完成。定制简历已保存 — 打开各职位查看。`,`\nDone. Tailored resumes saved — open each job to view.`));
    setRunning(false);
  }

  const statusIcon = s => ({ queued:'⏳', running:'🔄', done:'✅', error:'❌', skip:'⏭' }[s]||'');

  useEscapeClose(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full mt-8 mb-8" onClick={e=>e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{T('🎯 批量定制简历','🎯 Batch Tailor Resumes')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{T('通过 Anthropic API 为每个职位生成一份定制简历 PDF（每份约 $0.02–0.04）','Generates a tailored PDF resume for each job via Anthropic API (~$0.02–0.04 per resume)')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg">&times;</button>
        </div>
        <div className="p-4 space-y-3">
          {/* Job list */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-medium text-gray-700">{eligible.length} {T('个「感兴趣」职位待定制', `Interested job${eligible.length!==1?'s':''} to tailor`)}</p>
              <div className="flex gap-3">
                <button onClick={()=>setSelected(new Set(eligible.map(j=>j.id)))} className="text-xs text-blue-600 hover:underline">{T('全选','Select all')}</button>
                <button onClick={()=>setSelected(new Set())} className="text-xs text-gray-500 hover:underline">{T('清除','Clear')}</button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {eligible.map(j => (
                <label key={j.id} className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer text-xs ${selected.has(j.id)?'border-blue-200 bg-blue-50':'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={selected.has(j.id)} disabled={running}
                    onChange={()=>{ const s=new Set(selected); s.has(j.id)?s.delete(j.id):s.add(j.id); setSelected(s); }} />
                  <span className="flex-1 font-medium text-gray-900">{j.role} <span className="font-normal text-gray-500">· {j.company}</span></span>
                  {progress[j.id] && <span className="shrink-0">{statusIcon(progress[j.id])}</span>}
                </label>
              ))}
              {!eligible.length && <p className="text-xs text-gray-400 p-2">{T('没有 ','No ')}<strong>{T('「感兴趣」','Interested')}</strong>{T(' 的职位包含 JD 文本。请先添加状态为「感兴趣」的职位并粘贴其 JD。',' jobs have JD text. Add jobs with status Interested and paste their JD first.')}</p>}
            </div>
            {noJd.length > 0 && <p className="text-xs text-gray-400 mt-1">⚠ {noJd.length} {T('个「感兴趣」职位没有 JD 文本 — 打开它们并先粘贴 JD', `Interested job${noJd.length!==1?'s':''} have no JD text — open them and paste the JD first`)}</p>}
            {haveResume > 0 && <p className="text-xs text-gray-400 mt-1">📄 {haveResume} {T('个「感兴趣」职位已定制（已排除）。在职位中删除简历可重新定制。', `Interested job${haveResume!==1?'s':''} already tailored (excluded). Delete the resume in the job to re-tailor.`)}</p>}
          </div>

          {/* Log */}
          {log.length > 0 && (
            <div className="bg-gray-900 text-green-400 rounded-md p-3 text-xs font-mono max-h-36 overflow-y-auto">
              {log.map((l,i)=><div key={i}>{l}</div>)}
            </div>
          )}

          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-400">{selected.size} {T('个职位已选', `job${selected.size!==1?'s':''} selected`)}</p>
            <div className="flex gap-2">
              <Btn onClick={onClose} disabled={running}>{T('取消','Cancel')}</Btn>
              <Btn variant="primary" onClick={startBatch} disabled={running||!selected.size||!eligible.length}>
                {running ? T('⏳ 处理中…','⏳ Processing…') : T(`🎯 定制 ${selected.size} 份简历`, `🎯 Tailor ${selected.size} resume${selected.size!==1?'s':''}`)}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function TrackerTab({ region, jobs, setJobs, onOpen, resumeDb, formatting, initialStatus, onAdd }) {
  const [filter, setFilter] = useState(initialStatus || 'all');
  const [tierFilter, setTierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showBatch, setShowBatch] = useState(false);
  const regionLabel = rName(REGION_BY[region]);

  const filtered = useMemo(() => jobs.filter(j => {
    if (filter!=='all' && j.status!==filter) return false;
    if (tierFilter!=='all' && (j.priority||'') !== tierFilter) return false;
    if (search) { const q=search.toLowerCase(); if (!`${j.company} ${j.role} ${j.location}`.toLowerCase().includes(q)) return false; }
    return true;
  }).sort((a,b)=>{
    const r=t=>({T1:1,T2:2,T3:3,T4:4}[t||'']||9);
    return r(a.priority)-r(b.priority) || String(a.company||'').localeCompare(String(b.company||''));
  }), [jobs, filter, tierFilter, search]);

  const counts = useMemo(() => { const c = {}; jobs.forEach(j => { c[j.status] = (c[j.status]||0) + 1; }); return c; }, [jobs]);

  const updateStatus = async (id, status) => {
    const updated = jobs.map(j=>j.id===id?{...j,status}:j); setJobs(updated); await saveJson(`${region}:jobs`, updated);
  };

  const deleteJob = async id => {
    if (!window.confirm(T('删除这条投递？它的定制简历和求职信 PDF 也会一起删除。','Delete this application? Its tailored resume and cover-letter PDFs are deleted too.'))) return;
    // Clean up localStorage cache
    deletePdfLocal(`${region}:${id}:resume`);
    deletePdfLocal(`${region}:${id}:cover`);
    // Clean up GitHub files (both possible extensions, silent fail)
    for (const type of ['resume','cover']) {
      for (const ext of ['html','pdf']) {
        ghDeleteFile(`data/files/${region}_${id}_${type}.${ext}`).catch(()=>{});
      }
    }
    const updated = jobs.filter(j=>j.id!==id);
    setJobs(updated); await saveJson(`${region}:jobs`, updated);
  };
  const clearFilters = () => { setFilter('all'); setTierFilter('all'); setSearch(''); };
  const title = T('追踪','Tracker');

  if (!jobs.length) return (
    <>
      <PageHead eyebrow={regionLabel} title={title} />
      <div className="empty">
        <h2>{T(`${regionLabel}还没有投递`, `No applications in ${regionLabel} yet`)}</h2>
        <p>{T('从「添加职位」贴一段职位描述开始。','Start from a job description in Add job.')}</p>
        <Btn variant="primary" onClick={onAdd}>{T('添加职位','Add job')}</Btn>
      </div>
    </>
  );

  // one group per tier, in tier order; the list inside a group is already sorted by company
  const groups = [...TIERS.map(t => t.id), ''].map(id => ({ id, items: filtered.filter(j => (j.priority || '') === id) })).filter(g => g.items.length);
  const tierCount = id => jobs.filter(j => (j.priority || '') === id).length;
  const now = new Date();

  return (
    <>
      {showBatch && <BatchTailorModal region={region} jobs={jobs} setJobs={setJobs} resumeDb={resumeDb} formatting={formatting} onClose={()=>setShowBatch(false)} />}
      <PageHead eyebrow={regionLabel} title={title} action={<Btn variant="primary" onClick={onAdd}>{T('添加职位','Add job')}</Btn>} />
      <div className="toolbar">
        <label htmlFor="trk-search" className="sr-only">{T('搜索投递','Search applications')}</label>
        <input id="trk-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={T('搜索公司、职位或地点','Search company, role or location')} />
        <label htmlFor="trk-tier" className="sr-only">{T('按梯队筛选','Filter by tier')}</label>
        <select id="trk-tier" value={tierFilter} onChange={e=>setTierFilter(e.target.value)}>
          <option value="all">{T('全部梯队','All tiers')} ({jobs.length})</option>
          {TIERS.map(t=><option key={t.id} value={t.id}>{T(t.zh,t.en)} ({tierCount(t.id)})</option>)}
          <option value="">{T('未分级','Unranked')} ({tierCount('')})</option>
        </select>
        {lsGet('anthropicKey') && <Btn onClick={()=>setShowBatch(true)}>{T('批量定制…','Batch tailor…')}</Btn>}
        <span className="showing" role="status">{T(`显示 ${filtered.length} / ${jobs.length}`, `${filtered.length} of ${jobs.length}`)}</span>
      </div>
      <div className="filters" role="group" aria-label={T('按状态筛选','Filter by status')}>
        <button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>{T('全部','All')} <b>{jobs.length}</b></button>
        {STATUSES.filter(s => counts[s.id] || filter === s.id).map(s => (
          <button key={s.id} type="button" aria-pressed={filter===s.id} onClick={()=>setFilter(s.id)}>{T(s.zh,s.label)} <b>{counts[s.id] || 0}</b></button>
        ))}
      </div>
      {groups.map(g => {
        const t = tierMeta(g.id);
        const hid = `tier-${g.id || 'none'}`;
        return (
          <section key={g.id || 'none'} className="tier-group" aria-labelledby={hid}>
            <h2 id={hid} className="eyebrow">{t ? T(t.zh, t.en) : T('未分级','Unranked')} <span className="n">· {g.items.length}</span></h2>
            <ul className="jobs">
              {g.items.map(j => {
                const role = j.role || T('（无职位名）','(no title)');
                const company = j.company || T('（无公司）','(no company)');
                const ready = j.status==='interested' && !!loadPdfLocal(`${region}:${j.id}:resume`);
                const late = j.status==='interested' && j.applicationDeadline && new Date(j.applicationDeadline) < now;
                const openName = T(`打开：${role}，${company}`, `Open: ${role} at ${company}`) + (ready ? T('，简历就绪', ', resume ready') : '') + (late ? T('，已过截止', ', deadline passed') : '');
                const delName = T('删除这条投递','Delete application');
                return (
                  <li key={j.id} className="job">
                    <button type="button" className="job-open" onClick={()=>onOpen(j.id)} aria-label={openName}>
                      <span className="job-title"><span className="role">{role}</span>
                        {ready && <span className="chip">{T('简历就绪','resume ready')}</span>}
                        {late && <span className="reason">{T('已过截止','Deadline passed')}</span>}
                      </span>
                      <span className="job-sub">{company}{j.location ? ` · ${j.location}` : ''}</span>
                    </button>
                    <StatusField value={j.status} onChange={s=>updateStatus(j.id,s)} name={T(`状态：${role}`, `Status: ${role}`)} />
                    <span className="job-dates">
                      <span>{T('添加于 ','added ')}{fmtDate(j.dateAdded)}</span>
                      {j.applicationDeadline && <span className={late ? 'late' : undefined}>{T('截止 ','due ')}{fmtDate(j.applicationDeadline)}</span>}
                    </span>
                    <button type="button" className="btn btn-ghost btn-icon btn-quiet" aria-label={delName} data-tip={delName} onClick={()=>deleteJob(j.id)}><Icon name="trash" /></button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {!filtered.length && (
        <div className="empty">
          <h2>{T('没有符合这些筛选条件的投递。','No applications match these filters.')}</h2>
          <Btn onClick={clearFilters}>{T('清除筛选','Clear filters')}</Btn>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// PDF / HTML UPLOAD + PREVIEW FIELD
// ════════════════════════════════════════════════════════════════

function PdfUploadField({ label, pdfKey, icon='📄' }) {
  const [dataUrl, setDataUrl] = useState(() => loadPdfLocal(pdfKey));
  const [blobUrl, setBlobUrl] = useState(null);
  const [busy, setBusy]       = useState(false);
  const [ghSaving, setGhSaving] = useState(false);
  const [err, setErr]         = useState('');
  const ref = useRef(null);

  // Convert data URL → blob URL for iframe (works in Safari, Chrome, Firefox)
  useEffect(() => {
    if (!dataUrl) { setBlobUrl(null); return; }
    try {
      const [header, b64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'application/pdf';
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: mime });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch { setBlobUrl(null); }
  }, [dataUrl]);

  // On mount: if nothing cached locally, pull from GitHub (enables cross-device sync)
  // Try .html first for backward compat with any previously stored files, then .pdf
  useEffect(() => {
    if (dataUrl || !ghConfigured()) return;
    (async () => {
      for (const [ext, mime] of [['pdf','application/pdf'],['html','text/html']]) {
        try {
          const path = `data/files/${pdfKey.replace(/:/g,'_')}.${ext}`;
          const url = await ghReadDataUrl(path, mime);
          if (url) { setDataUrl(url); savePdfLocal(pdfKey, url); return; }
        } catch {}
      }
    })();
  }, [pdfKey]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'pdf') { setErr(T('请上传 PDF 文件。「定制简历 / 求职信」提示词会让 Claude 通过 Analysis 工具直接生成 PDF — 那就是要在这里上传的文件。','Please upload a PDF file. Tailor Resume / Cover Letter prompts ask Claude to generate a PDF directly via the Analysis Tool — that\'s the file to upload here.')); return; }
    setBusy(true); setErr('');
    try {
      const url = await readFileAsDataUrl(file);
      // Save locally first for immediate preview
      savePdfLocal(pdfKey, url);
      setDataUrl(url);
      // Then sync to GitHub
      setGhSaving(true);
      await ghWriteDataUrl(pdfGhPath(pdfKey), url);
    } catch(e) {
      const msg = e.message || T('上传失败','Upload failed');
      if (msg.includes('GitHub') || msg.includes('configured')) {
        setErr(T(`已保存到本地。GitHub 同步失败：${msg}`,`Saved locally. GitHub sync failed: ${msg}`));
      } else {
        setErr(msg);
      }
    }
    finally { setBusy(false); setGhSaving(false); }
  };

  const handleDelete = () => {
    if (!window.confirm(T('移除此文件？','Remove this file?'))) return;
    deletePdfLocal(pdfKey);
    // Delete from GitHub — try both extensions for backward compat
    for (const ext of ['pdf','html']) {
      ghDeleteFile(`data/files/${pdfKey.replace(/:/g,'_')}.${ext}`).catch(()=>{});
    }
    setDataUrl(null);
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${pdfKey.replace(/:/g,'_')}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{icon} {label}</h3>
        <div className="flex gap-2 flex-wrap items-center">
          {ghSaving && <span className="text-xs text-blue-600 animate-pulse">{T('⏳ 正在保存到 GitHub…','⏳ Saving to GitHub…')}</span>}
          {dataUrl && <Btn onClick={handleDownload}>{T('⬇️ 下载 PDF','⬇️ Download PDF')}</Btn>}
          <input ref={ref} type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
          <Btn variant="primary" onClick={() => ref.current?.click()} disabled={busy || ghSaving}>
            {busy ? T('⏳ 读取中…','⏳ Reading…') : T('⬆️ 上传 PDF','⬆️ Upload PDF')}
          </Btn>
          {dataUrl && <Btn variant="danger" onClick={handleDelete}>🗑</Btn>}
        </div>
      </div>
      {err && <div className="text-xs text-red-700 mb-2 p-2 bg-red-50 border border-red-200 rounded">{err}</div>}
      {dataUrl ? (
        blobUrl ? (
          <iframe
            src={blobUrl}
            className="w-full rounded-md border border-gray-200"
            style={{ height:'620px' }}
            title={label}
          />
        ) : (
          <div className="border border-gray-200 rounded-md p-4 text-center text-xs text-gray-500">{T('正在渲染 PDF…','Rendering PDF…')}</div>
        )
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center">
          <p className="text-sm text-gray-500 mb-1">{T('还没有上传 PDF','No PDF uploaded yet')}</p>
          <p className="text-xs text-gray-400">{T('在此上传 PDF 文件','Upload a PDF file here')}</p>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400">
        {T('PDF 保存在 GitHub 的 ','PDF saved to GitHub at ')}<code className="bg-gray-100 px-1 rounded">data/files/</code>{T(' 并在本地缓存以加快加载。',' and cached locally for fast loading.')}
      </p>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// JOB DETAIL
// ════════════════════════════════════════════════════════════════

function JobDetail({ region, job, resumeDb, formatting, glossary, library, jobs, setJobs, onBack }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({...job});
  const [saving, setSaving]   = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => { setForm({...job}); }, [job.id]);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const updateJob = async patch => {
    const updated = jobs.map(j=>j.id===job.id?{...j,...patch}:j); setJobs(updated); await saveJson(`${region}:jobs`, updated);
  };

  const handleSaveAll = async () => {
    setSaving(true); await updateJob(form); setSaving(false); setEditing(false);
  };

  const handleSaveNotes = async () => {
    await updateJob({ notes: form.notes });
    setNotesSaved(true); setTimeout(()=>setNotesSaved(false),1500);
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">{T('← 返回追踪','← Back to tracker')}</button>

      {/* Header card */}
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{form.role||T('（无职位名）','(no title)')}</h2>
            <div className="text-sm text-gray-600">{form.company||T('（无公司）','(no company)')}{form.location?` · ${form.location}`:''}</div>
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
              <span>{T('添加于 ','Added ')}{fmtDate(form.dateAdded)}</span>
              {form.salaryRange && <span>💰 {form.salaryRange}</span>}
              {form.applicationDeadline && <span>📅 {T('截止：','Deadline: ')}{fmtDate(form.applicationDeadline)}</span>}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <StatusSelect value={form.status} onChange={v=>{set('status',v); updateJob({status:v});}} />
            <Btn onClick={()=>setEditing(e=>!e)}>{editing?T('取消编辑','Cancel editing'):T('✏️ 编辑详情','✏️ Edit details')}</Btn>
          </div>
        </div>

        {editing && (
          <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[['company',T('公司','Company')],['role',T('职位','Role')],['location',T('地点','Location')],['salaryRange',T('薪资范围','Salary Range')],['noc',T('NOC 编码','NOC')],['weeklyHours',T('周工时','Weekly hrs')],['empType',T('雇佣类型','Emp type')],['applyMethod',T('投递方式','Apply via')],['startDate',T('入职日期','Start')],['endDate',T('离职日期','End')],['priority',T('梯队','Tier')]].map(([k,lbl])=>(
                <div key={k}>
                  <label className="text-xs text-gray-600 mb-1 block">{lbl}</label>
                  <input value={form[k]||''} onChange={e=>set(k,e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-600 mb-1 block">{T('截止日期','Deadline')}</label>
                <input type="date" value={form.applicationDeadline||''} onChange={e=>set('applicationDeadline',e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">{T('职位描述','Job Description')}</label>
              <textarea value={form.jdText||''} onChange={e=>set('jdText',e.target.value)}
                className="w-full h-32 p-3 text-sm font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
            </div>
            <div className="flex justify-end">
              <Btn variant="primary" onClick={handleSaveAll} disabled={saving}>
                {saving?T('保存中…','Saving…'):T('💾 保存更改','💾 Save changes')}
              </Btn>
            </div>
          </div>
        )}
      </Card>

      {/* AI prompts */}
      <AiPromptSection resumeDb={resumeDb} job={form} formatting={formatting} glossary={glossary} tailoredResume={form.tailoredResume||''} library={library} region={region} />

      {/* How-to tip */}
      <Card className="p-3 bg-blue-50 border-blue-200">
        <p className="text-xs text-blue-900 leading-relaxed">
          <strong>{T('如何从 Claude 获取 PDF：','How to get the PDF from Claude:')}</strong>{' '}
          {T('在 Claude.ai 中启用 ','Enable the ')}<strong>{T('Analysis 工具','Analysis tool')}</strong>{T(' → 复制提示词 → 粘贴 → Claude 通过 Python (reportlab) 生成 PDF → 下载 → 在下方上传。',' in Claude.ai → copy prompt → paste → Claude generates a PDF via Python (reportlab) → download → upload below.')}
          {' '}<strong>{T('分开还是合并：','Separate vs combined:')}</strong>{T(' 大多数在线门户（LinkedIn、Workday、Greenhouse）有独立的上传栏 — 分别上传简历和求职信。',' most online portals (LinkedIn, Workday, Greenhouse) have separate fields — upload resume and cover letter individually.')}
          {T("如果通过邮件申请或职位要求单个文件，让 Claude 把它们合并成 2 页 PDF（第 1 页简历，第 2 页求职信）— 这已经写在求职信提示词的说明里了。","If applying by email or the posting asks for one file, tell Claude to combine them into a 2-page PDF (resume page 1, cover letter page 2) — it's already in the cover letter prompt instructions.")}
        </p>
      </Card>

      {/* PDF upload fields */}
      <PdfUploadField icon="📝" label={T('定制简历','Tailored resume')} pdfKey={`${region}:${job.id}:resume`} />
      <PdfUploadField icon="✉️" label={T('求职信（或简历+求职信合并 PDF）','Cover letter (or combined resume+cover PDF)')} pdfKey={`${region}:${job.id}:cover`} />

      <Card className="p-4">
        <SectionHdr icon="🗒" title={T('我的备注','My notes')}
          action={<Btn variant="primary" onClick={handleSaveNotes}>{notesSaved?T('✅ 已保存','✅ Saved'):T('💾 保存','💾 Save')}</Btn>}
        />
        <textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}
          placeholder={T('招聘者姓名、他们问了什么、跟进、被拒原因、总体感受…','Recruiter names, what they asked, follow-ups, why rejected, general vibes…')}
          className="w-full h-32 p-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
      </Card>

      {form.jdText && (
        <details className="bg-white border border-gray-200 rounded-lg">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">{T('原始职位描述','Original job description')}</summary>
          <div className="px-4 pb-4 text-xs text-gray-700 whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">{form.jdText}</div>
        </details>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// WATCHDOG TAB  (LinkedIn email scanner — requires Anthropic API key)
// ════════════════════════════════════════════════════════════════

function WatchdogTab({ region, jobs, setJobs, resumeDb }) {
  const [step, setStep]           = useState('setup');
  const [profile, setProfile]     = useState('');
  const [pastedText, setPastedText] = useState('');
  const [found, setFound]         = useState([]);
  const [selected, setSelected]   = useState(new Set());
  const [msg, setMsg]             = useState('');
  const [adding, setAdding]       = useState(false);
  const [added, setAdded]         = useState([]);

  const DEFAULT_PROFILE = 'Edit this profile to describe yourself in 2-3 sentences. Include: degree, key skills, relevant experience, target roles, and languages. This is used to score and match jobs — the more specific, the better the results.';

  useEffect(() => {
    if (!ghConfigured()) { setProfile(DEFAULT_PROFILE); return; }
    loadText('watchdogProfile').then(t => setProfile(t || DEFAULT_PROFILE));
  }, []);
  const saveProfile = (val) => { setProfile(val); saveText('watchdogProfile', val); };

  const anthropicKey = () => lsGet('anthropicKey');

  async function callClaude(messages, useWebSearch = false) {
    const key = anthropicKey();
    if (!key) throw new Error(T('没有 Anthropic API 密钥 — 请在 ⚙️ 设置中添加。','No Anthropic API key — add it in ⚙️ Settings.'));
    const body = {
      model:'claude-haiku-4-5-20251001',
      max_tokens:8192,
      system: 'You are a job search API. Return ONLY a JSON array. No narration, no explanation, no preamble. Start your response with [ and end with ].',
      messages,
    };
    if (useWebSearch) body.tools = [{ type:'web_search_20250305', name:'web_search', max_uses: 5 }];
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key': key,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true',
      },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      setMsg(T('触发限流 — 等待 30 秒后重试…','Rate limited — waiting 30s and retrying…'));
      await new Promise(r => setTimeout(r, 30000));
      const retry = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-api-key': key, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify(body),
      });
      if (!retry.ok) { const e = await retry.json().catch(()=>({})); throw new Error(`API ${retry.status}: ${e.error?.message||T('触发限流 — 请等待一分钟后再试。','Rate limit — wait a minute and try again.')}`); }
      const data = await retry.json();
      return (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    }
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`API ${res.status}: ${e.error?.message||'error'}`); }
    const data = await res.json();
    return (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
  }

  function parseArr(text) {
    if (!text) return [];
    // Try to find a JSON array — look for [{ to }] pattern
    const m = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    // Fallback: try any [ to ] match
    const m2 = text.match(/\[[\s\S]*\]/);
    if (m2) { try { return JSON.parse(m2[0]); } catch {} }
    return [];
  }

  async function scan() {
    if (!pastedText.trim()) return;
    setStep('scanning'); setFound([]); setSelected(new Set());
    setMsg(T('正在读取粘贴的文本并搜索完整职位详情…','Reading pasted text and searching for full job details…'));
    try {
      // Truncate inputs to stay under rate limits
      const trimmedText = pastedText.slice(0, 8000);
      const trimmedProfile = profile.slice(0, 500);

      // Single API call: extract jobs + web search company career pages + score
      const resultText = await callClaude([{ role:'user', content:
        `Extract ALL job listings from the email text below. Then search the web for full descriptions.

RULES:
- Extract EVERY job listing in the email — do not skip any
- Use the EXACT job title and company name from the company's career page — these are the official titles used in applications
- Search the company's career page (Workday/Greenhouse/Lever) for the full JD, not LinkedIn

MY PROFILE (for scoring 1-10): ${trimmedProfile}

For each job return: company (from career page), role (exact title from career page), location, description (from career page search), url (career page link), salary (or ""), score (1-10), reason.

JSON only: [{"company":"...","role":"...","location":"...","description":"...","url":"...","salary":"","score":7,"reason":"..."}]

EMAIL TEXT:
${trimmedText}` }], true);

      const rawJobs = parseArr(resultText);
      if (!rawJobs.length) {
        setMsg(T('未能提取到任何职位。请尝试复制更多邮件内容。','Could not extract any job listings. Try copying more of the email.'));
        setStep('review'); return;
      }

      const merged = rawJobs.map((j,i) => ({
        ...j, score: j.score||5, reason: j.reason||'', _id:`j${i}_${Date.now()}`
      })).sort((a,b) => b.score - a.score);

      setFound(merged);
      setSelected(new Set(merged.filter(j=>j.score>=7).map(j=>j._id)));
      setMsg(T(`找到 ${merged.length} 个职位 — 已预选 ${merged.filter(j=>j.score>=7).length} 个高匹配（≥7）。`,`${merged.length} jobs found — ${merged.filter(j=>j.score>=7).length} high-fit (≥7) pre-selected.`));
      setStep('review');
    } catch(e) { setMsg(T(`错误：${e.message}`,`Error: ${e.message}`)); setStep('review'); }
  }

  const REGION_LABELS = { canada:'Canada', hongkong:'Hong Kong', china:'Mainland China' };

  async function manualSearch() {
    if (!profile || profile.startsWith('Edit this profile')) {
      setMsg(T('⚠ 请先填写你的资料概述 — Claude 需要它来确定要搜索哪些职位。','⚠ Please write your profile summary first — Claude needs it to know what jobs to search for.'));
      return;
    }
    setStep('scanning'); setFound([]); setSelected(new Set());
    const loc = REGION_LABELS[region] || 'Canada';
    setMsg(T(`正在搜索 ${loc} 的职位…`,`Searching for jobs in ${loc}…`));
    try {
      const trimmedProfile = profile.slice(0, 500);
      const resultText = await callClaude([{ role:'user', content:
        `Find real job postings for this person. You have 5 web searches. ONLY return jobs located in ${loc} — skip any US, UK, or other country results.

Person: ${trimmedProfile}
Location: MUST be in ${loc} only. ${loc === 'Canada' ? 'PRIORITY: the city named in the profile first, then Toronto and Vancouver. Other Canadian cities only if very strong fit.' : loc === 'Hong Kong' ? 'Cities: Hong Kong, Central, Kowloon' : 'Cities: Shanghai, Beijing, Shenzhen, Guangzhou, Nanjing'}.

STRATEGY:

Phase 1 (search 1): Search "${loc} companies hiring 2025" plus the role type from the profile, to find which ${loc}-based companies are actively posting.

Phase 2 (searches 2-5): For each company found, search "[company name] careers [role] ${loc}" to find their career page. Company career pages (Workday, Greenhouse, Lever) have real job details.

CRITICAL: Every job you return MUST have a ${loc} location. Do NOT include US jobs, remote-US jobs, or jobs from any other country.

Return JSON only:
[{"company":"...","role":"...","location":"Toronto, ON","description":"...","url":"https://...","salary":"","score":7,"reason":"..."}]` }], true);

      const rawJobs = parseArr(resultText);
      if (!rawJobs.length) {
        const len = (resultText||'').length;
        const tail = (resultText || '(empty)').slice(-500);
        setMsg(T(`无法从响应中解析 JSON（${len} 字符）。响应结尾："…${tail}"`,`Could not parse JSON from response (${len} chars). End of response: "…${tail}"`));
        setStep('review'); return;
      }

      const merged = rawJobs.map((j,i) => ({
        ...j, score:j.score||5, reason:j.reason||'', _id:`j${i}_${Date.now()}`
      })).sort((a,b) => b.score - a.score);

      setFound(merged);
      setSelected(new Set(merged.filter(j=>j.score>=7).map(j=>j._id)));
      setMsg(T(`在 ${loc} 找到 ${merged.length} 个职位 — 已预选 ${merged.filter(j=>j.score>=7).length} 个高匹配（≥7）。`,`${merged.length} jobs found in ${loc} — ${merged.filter(j=>j.score>=7).length} high-fit (≥7) pre-selected.`));
      setStep('review');
    } catch(e) { setMsg(T(`错误：${e.message}`,`Error: ${e.message}`)); setStep('review'); }
  }

  // Fuzzy match for duplicate detection — handles "RBC" vs "Royal Bank of Canada", "Analyst" vs "Financial Analyst I"
  const norm = s => (s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
  const fuzzy = (a, b) => { const na=norm(a), nb=norm(b); if (!na||!nb) return false; return na===nb || (na.length>3 && nb.length>3 && (na.includes(nb) || nb.includes(na))); };

  async function addToTracker() {
    setAdding(true);
    const toAdd = found.filter(j => selected.has(j._id));
    const newJobs = [];
    let skipped = 0;
    for (const j of toAdd) {
      if (jobs.some(e => fuzzy(e.company, j.company) && fuzzy(e.role, j.role))) { skipped++; continue; }
      newJobs.push({ id:newId(), dateAdded:new Date().toISOString(), company:j.company||'', role:j.role||'', location:j.location||'', salaryRange:j.salary||'', applicationDeadline:'', status:'interested', jdText:j.description||'', notes:[j.url?`Apply: ${j.url}`:'', j.salary?`Salary: ${j.salary}`:''].filter(Boolean).join('\n') });
    }
    if (!newJobs.length) { setMsg(T(`所选的 ${skipped} 个职位都已在你的追踪中（按公司+职位模糊匹配）。`,`All ${skipped} selected job${skipped!==1?'s':''} already in your tracker (fuzzy-matched by company + role).`)); setAdding(false); return; }
    const updated = [...jobs, ...newJobs];
    setJobs(updated);
    await saveJson(`${region}:jobs`, updated);
    setAdded(newJobs);
    setMsg(T(`已添加 ${newJobs.length} 个职位。${skipped ? ` 跳过 ${skipped} 个（已在追踪中）。` : ''}`,`${newJobs.length} job${newJobs.length!==1?'s':''} added.${skipped ? ` ${skipped} skipped (already in tracker).` : ''}`));
    setStep('done');
    setAdding(false);
  }

  const hasKey = !!anthropicKey();
  const scoreColor = s => s>=8 ? 'bg-green-100 text-green-800' : s>=6 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  const toggle = id => { const s = new Set(selected); s.has(id)?s.delete(id):s.add(id); setSelected(s); };
  const [editingId, setEditingId] = useState(null);
  const updateJob = (id, field, value) => setFound(f => f.map(j => j._id===id ? {...j, [field]:value} : j));

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <SectionHdr icon="📧" title={T('LinkedIn 职位提醒扫描器','LinkedIn job alert scanner')} />
        <p className="text-xs text-gray-500 mb-3">
          {T('粘贴一封 LinkedIn 职位提醒邮件 → Claude 在每家公司的招聘页搜索完整 JD → 对照你的资料评分 → 批量加入追踪，描述已就绪可用于简历定制。',"Paste a LinkedIn job alert email → Claude searches each company's career page for the full JD → scores against your profile → batch-add to tracker with descriptions ready for resume tailoring.")}
        </p>

        {!hasKey && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 mb-3">
            ⚠ {T('未设置 Anthropic API 密钥。在 ','No Anthropic API key set. Add one in ')}<strong>⚙️ {T('设置','Settings')}</strong>{T(' 中添加以使用此功能。',' to use this feature.')}
          </div>
        )}

        {step === 'setup' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1 font-medium">{T('你的资料（用于匹配与评分）','Your profile (used for matching & scoring)')}</label>
              <textarea value={profile} onChange={e=>setProfile(e.target.value)} onBlur={e=>saveText('watchdogProfile', e.target.value)} rows={3}
                className="w-full text-xs border border-gray-200 rounded-md p-2 resize-none text-gray-700 focus:outline-none focus:border-gray-400"
                placeholder={T('用 2-3 句话描述你自己以便职位匹配…','Describe yourself in 2-3 sentences for job matching…')} />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-400">{T('点击其他位置时会保存到 GitHub。','Saved to GitHub when you click away.')}</p>
                <button onClick={()=>saveProfile(DEFAULT_PROFILE)} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">{T('重置为默认','Reset to default')}</button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1 font-medium">
                {T('粘贴 LinkedIn 职位提醒邮件','Paste LinkedIn job alert email')}
              </label>
              <textarea value={pastedText} onChange={e=>setPastedText(e.target.value)} rows={8}
                className="w-full text-xs border border-gray-200 rounded-md p-2 resize-y text-gray-700 focus:outline-none focus:border-gray-400"
                placeholder={T("打开一封 LinkedIn 职位提醒邮件 → Ctrl+A → Ctrl+C → 粘贴到这里。\n邮件里有职位名称和公司名 — 这就是 Claude 搜索完整职位所需的全部。","Open a LinkedIn job alert email → Ctrl+A → Ctrl+C → paste here.\nThe email has job titles and company names — that's all Claude needs to search for the full listings.")} />
            </div>
            <Btn variant="primary" onClick={scan} disabled={!profile.trim()||!pastedText.trim()||!hasKey}>
              {T('🔍 搜索并评分职位','🔍 Search & score jobs')}
            </Btn>

            {/* Divider */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-xs text-gray-400">{T('或','or')}</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Manual search */}
            <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
              <p className="text-xs text-gray-600 mb-2">
                <strong>{T('🌐 发现新职位','🌐 Discover new jobs')}</strong>{T(' — Claude 在网络上搜索 ',' — Claude searches the web for fresh postings in ')}<strong>{REGION_LABELS[region]||region}</strong>{T(' 中符合你资料的最新职位。无需邮件。',' matching your profile. No email needed.')}
              </p>
              <Btn onClick={manualSearch} disabled={!profile.trim()||!hasKey}>
                {T('🌐 搜索新职位（近 24 小时）','🌐 Search new jobs (last 24h)')}
              </Btn>
            </div>
          </div>
        )}

        {step === 'scanning' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-7 h-7 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
            <p className="text-sm text-gray-500 text-center max-w-sm">{msg}</p>
            <p className="text-xs text-gray-400 text-center">{T('这可能需要 20–40 秒（为每个职位进行网络搜索）','This may take 20–40 seconds (web search for each job)')}</p>
          </div>
        )}

        {step === 'review' && (
          <div>
            <div className="text-xs text-gray-500 bg-gray-50 rounded-md p-2 mb-3">{msg}</div>
            {found.length > 0 && (
              <>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600">{T('已选 ','')}{selected.size} / {found.length}{T(' 项',' selected')}</span>
                  <div className="flex gap-3">
                    <button onClick={()=>setSelected(new Set(found.map(j=>j._id)))} className="text-xs text-blue-600 hover:underline">{T('全选','Select all')}</button>
                    <button onClick={()=>setSelected(new Set())} className="text-xs text-gray-500 hover:underline">{T('清除','Clear')}</button>
                    <button onClick={()=>setStep('setup')} className="text-xs text-gray-500 hover:underline">{T('← 返回','← Back')}</button>
                  </div>
                </div>
                <div className="space-y-2 mb-3">
                  {found.map(j => {
                    const isSel = selected.has(j._id);
                    const isEdit = editingId === j._id;
                    const isDup = jobs.some(e => fuzzy(e.company, j.company) && fuzzy(e.role, j.role));
                    return (
                    <div key={j._id} className={`rounded-md border transition-colors ${isDup?'border-orange-200 bg-orange-50/50':isSel?'border-blue-200 bg-blue-50':'border-gray-200 bg-white'}`}>
                      <div className="flex gap-2 p-3 cursor-pointer" onClick={()=>{ if(!isEdit) toggle(j._id); }}>
                        <input type="checkbox" checked={isSel} onChange={()=>{ if(!isEdit) toggle(j._id); }} aria-label={T('选择这条职位','Select this job')} className="mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2 mb-0.5">
                            <p className="text-sm font-medium text-gray-900">{j.role} <span className="font-normal text-gray-500">· {j.company}</span></p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${scoreColor(j.score)}`}>{j.score}/10</span>
                              {isDup && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{T('已在追踪','In tracker')}</span>}
                              <button onClick={e=>{e.stopPropagation(); setEditingId(isEdit?null:j._id);}}
                                className={`text-xs px-1.5 py-0.5 rounded border ${isEdit?'bg-gray-200 border-gray-300':'border-gray-200 hover:bg-gray-100'}`}
                                title={T('编辑','Edit')}>✏️</button>
                            </div>
                          </div>
                          {!isEdit && j.location && <p className="text-xs text-gray-400 mb-0.5">{j.location}</p>}
                          {!isEdit && j.salary && <p className="text-xs text-gray-500 mb-0.5">💰 {j.salary}</p>}
                          {!isEdit && <p className="text-xs text-gray-500 mb-1">{j.reason}</p>}
                          {!isEdit && j.description && <p className="text-xs text-gray-400 italic mb-1">{j.description.slice(0,300)}{j.description.length>300?'…':''}</p>}
                          {!isEdit && (j.url) && (
                            <a href={j.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                              className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1">{T('↗ 查看并申请','↗ View & apply')}</a>
                          )}
                        </div>
                      </div>
                      {isEdit && (
                        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-gray-100 ml-6" onClick={e=>e.stopPropagation()}>
                          <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs text-gray-500 mb-0.5 block">{T('公司','Company')}</label>
                              <input value={j.company||''} onChange={e=>updateJob(j._id,'company',e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-gray-400" /></div>
                            <div><label className="text-xs text-gray-500 mb-0.5 block">{T('职位','Role')}</label>
                              <input value={j.role||''} onChange={e=>updateJob(j._id,'role',e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-gray-400" /></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-xs text-gray-500 mb-0.5 block">{T('地点','Location')}</label>
                              <input value={j.location||''} onChange={e=>updateJob(j._id,'location',e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-gray-400" /></div>
                            <div><label className="text-xs text-gray-500 mb-0.5 block">{T('薪资','Salary')}</label>
                              <input value={j.salary||''} onChange={e=>updateJob(j._id,'salary',e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-gray-400" /></div>
                          </div>
                          <div><label className="text-xs text-gray-500 mb-0.5 block">{T('申请链接','Apply URL')}</label>
                            <input value={j.url||''} onChange={e=>updateJob(j._id,'url',e.target.value)} className="w-full text-xs border border-gray-200 rounded px-2 py-1 font-mono focus:outline-none focus:border-gray-400" /></div>
                          <div><label className="text-xs text-gray-500 mb-0.5 block">{T('职位描述','Job description')}</label>
                            <textarea value={j.description||''} onChange={e=>updateJob(j._id,'description',e.target.value)} rows={6}
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1 resize-y focus:outline-none focus:border-gray-400" /></div>
                          <div className="flex justify-end">
                            <button onClick={()=>setEditingId(null)} className="text-xs px-3 py-1 rounded bg-gray-900 text-white hover:bg-gray-700">{T('完成','Done')}</button>
                          </div>
                        </div>
                      )}
                    </div>);
                  })}
                </div>
                <Btn variant="primary" onClick={addToTracker} disabled={!selected.size||adding}>
                  {adding?T('⏳ 添加中…','⏳ Adding…'):T(`➕ 添加 ${selected.size} 个职位到追踪`,`➕ Add ${selected.size} job${selected.size!==1?'s':''} to tracker`)}
                </Btn>
              </>
            )}
          </div>
        )}

        {step === 'done' && (
          <div>
            <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md p-2 mb-3">✅ {msg}</div>
            <div className="space-y-1.5 mb-3">
              {added.map(j => (
                <div key={j.id} className="text-xs p-2 bg-gray-50 rounded-md border border-gray-200">
                  <span className="font-medium text-gray-900">{j.role}</span>
                  <span className="text-gray-500"> · {j.company}</span>
                  {j.location && <span className="text-gray-400"> · {j.location}</span>}
                  {j.notes && j.notes.split('\n').map((n,i)=><p key={i} className="text-gray-400 mt-0.5">{n}</p>)}
                </div>
              ))}
            </div>
            <Btn onClick={()=>{setStep('setup');setFound([]);setAdded([]);setMsg('');setSelected(new Set());}}>{T('📧 扫描更多职位','📧 Scan more jobs')}</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// INSIGHTS TAB
// ════════════════════════════════════════════════════════════════

// Where applications stand, counted once each at their current status. Applications = everything past Interested.
// 2026-09-23: Working now counts as an interview that ended in a job — before, Working was in the total but flowed
// nowhere (5 applications flowed out as 1 + 1 + 2 = 4), and the response and offer rates left it out.
function pipelineCounts(jobs) {
  const c = {}; jobs.forEach(j => { c[j.status] = (c[j.status] || 0) + 1; });
  const known = new Set(STATUSES.map(s => s.id));
  const other = jobs.filter(j => !known.has(j.status)).length;   // a stored status this version does not know
  const interested = c.interested || 0;
  const apps = jobs.length - interested;
  const noAnswer = c.applied || 0, rejected = c.rejected || 0;
  const offers = c.offered || 0, working = c.working || 0, inProgress = c.interviewing || 0, noOffer = c.interview_rejected || 0;
  const interviews = offers + working + inProgress + noOffer;
  return { interested, apps, noAnswer, rejected, interviews, other, offers, working, inProgress, noOffer };
}

function PipelineChart({ p, titleId, eqId }) {
  const wrapRef = useRef(null);
  const [W, setW] = useState(0);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    setW(Math.floor(el.clientWidth));
    // the drawing is laid out at the container's own width, one unit per pixel, so text never scales down with it
    const ro = new ResizeObserver(entries => setW(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const w = W || 600;
  // three widths: wide (the source's label left of it), middle, and narrow — a phone, where three columns of labels do
  // not fit side by side, so the source's label moves to a line above the drawing and the left margin goes
  const wide = w >= 640, narrow = w < 480;
  const H = wide ? 260 : narrow ? 250 : 220, nw = 12, gap = 6, minH = 6;
  const top0 = narrow ? 28 : 0;
  const L = wide ? 96 : narrow ? 8 : 80, R = wide ? 112 : 88;
  const x0 = L, x2 = w - R - nw, x1 = Math.round((x0 + x2) / 2);
  const plotH = H - top0;
  const unit = p.apps ? Math.min(40, (plotH - 16) / p.apps) : 0;
  const hOf = n => n > 0 ? Math.max(n * unit, minH) : 0;
  const stack = (nodes, center) => {
    const list = nodes.filter(n => n.n > 0).map(n => ({ ...n, h: hOf(n.n) }));
    const total = list.reduce((a, n) => a + n.h, 0) + gap * Math.max(0, list.length - 1);
    let y = Math.max(top0, Math.min(H - total, center - total / 2));
    list.forEach(n => { n.y = y; y += n.h + gap; });
    return list;
  };
  const srcH = hOf(p.apps), srcY = top0 + (plotH - srcH) / 2;
  const col1 = stack([
    { id:'noanswer',   n:p.noAnswer,   kind:'unk', label:T('未回复','No answer') },
    { id:'rejected',   n:p.rejected,   kind:'end', label:T('被拒','Rejected') },
    { id:'interviews', n:p.interviews, kind:'fwd', label:T('面试','Interviews') },
    { id:'other',      n:p.other,      kind:'unk', label:T('其他状态','Other status') },
  ], top0 + plotH / 2);
  const iv = col1.find(n => n.id === 'interviews');
  const col2 = iv ? stack([
    { id:'offers',     n:p.offers,     kind:'fwd', label:T('Offer','Offers') },
    { id:'working',    n:p.working,    kind:'fwd', label:T('在职','Working') },
    { id:'inprogress', n:p.inProgress, kind:'unk', label:T('进行中','In progress') },
    { id:'nooffer',    n:p.noOffer,    kind:'end', label:T('无 Offer','No offer') },
  ], iv.y + iv.h / 2) : [];
  const band = (xa, ya, ha, xb, yb, hb) => {
    const mx = (xa + xb) / 2;
    return `M${xa},${ya} C${mx},${ya} ${mx},${yb} ${xb},${yb} L${xb},${yb + hb} C${mx},${yb + hb} ${mx},${ya + ha} ${xa},${ya + ha}Z`;
  };
  // a link leaves its source as a slice of exactly n units, so the slices of one node add up to the node
  const links = (src, sy, targets, xa, xb) => { let y = sy; return targets.map(t => { const hs = t.n * (src ? unit : 0); const d = band(xa, y, hs, xb, t.y, t.h); y += hs; return { d, kind: t.kind === 'fwd' ? 'link-fwd' : 'link-end', id: t.id }; }); };
  const l1 = links(true, srcY, col1, x0 + nw, x1);
  const l2 = iv ? links(true, iv.y, col2, x1 + nw, x2) : [];
  const label = (x, y, n, word, anchor) => (
    <>
      <text className="n" x={x} y={y} textAnchor={anchor}>{n}</text>
      <text className="w" x={x} y={y + 16} textAnchor={anchor}>{word}</text>
    </>
  );
  const nodeRect = (x, n) => (
    <>
      <rect x={x} y={n.y} width={nw} height={n.h} rx="2" className={n.kind} />
      {n.kind === 'unk' && <rect x={x + .5} y={n.y + .5} width={nw - 1} height={Math.max(0, n.h - 1)} rx="2" className="unk-edge" />}
    </>
  );
  // a label sits by the top of its node and always inside the drawing (the lowest node's word used to be cut off)
  const top = n => Math.max(top0 + 14, Math.min(H - 20, n.y + Math.min(n.h / 2, 12) + 3));
  return (
    <div className="sankey" ref={wrapRef}>
      {W > 0 && (
        <svg viewBox={`0 0 ${w} ${H}`} width={w} height={H} role="img" aria-labelledby={`${titleId} ${eqId}`}>
          <defs>
            <pattern id="docket-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(135)">
              <rect width="7" height="7" fill="var(--paper)" />
              <rect width="3" height="7" className="hatch-bar" />
            </pattern>
          </defs>
          {l1.map(l => <path key={'a' + l.id} d={l.d} className={l.kind} />)}
          {l2.map(l => <path key={'b' + l.id} d={l.d} className={l.kind} />)}
          <rect x={x0} y={srcY} width={nw} height={srcH} rx="2" className="src" />
          {narrow
            ? <text x={x0} y={18}><tspan className="n">{p.apps}</tspan><tspan className="w" dx="6">{T('申请','applications')}</tspan></text>
            : label(x0 - 8, srcY + srcH / 2 - 2, p.apps, T('申请','Applications'), 'end')}
          {col1.map(n => <React.Fragment key={n.id}>{nodeRect(x1, n)}{label(x1 + nw + 8, top(n), n.n, n.label, 'start')}</React.Fragment>)}
          {col2.map(n => <React.Fragment key={n.id}>{nodeRect(x2, n)}{label(x2 + nw + 8, top(n), n.n, n.label, 'start')}</React.Fragment>)}
        </svg>
      )}
    </div>
  );
}

function InsightsTab({ jobs, regionName, onWorking, onAdd }) {
  const [view, setView] = useState('chart');
  const stats = useMemo(() => {
    const total  = jobs.length;
    const applied = jobs.filter(j => j.status !== 'interested').length;
    // Working counts as a response and as an offer: a job you work in answered you and hired you (see pipelineCounts)
    const responded = jobs.filter(j => ['interviewing','offered','working','interview_rejected'].includes(j.status)).length;
    const offered   = jobs.filter(j => ['offered','working'].includes(j.status)).length;
    const responseRate = applied ? Math.round(responded/applied*100) : 0;
    const offerRate    = applied ? Math.round(offered/applied*100) : 0;
    const now  = Date.now();
    const last7  = jobs.filter(j=>now-new Date(j.dateAdded).getTime()<7*86400000).length;
    const last30 = jobs.filter(j=>now-new Date(j.dateAdded).getTime()<30*86400000).length;
    const coMap = {}; jobs.forEach(j=>{if(j.company) coMap[j.company]=(coMap[j.company]||0)+1;});
    const topCos = Object.entries(coMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const upcoming = jobs.filter(j=>j.applicationDeadline && new Date(j.applicationDeadline)>new Date() && j.status==='interested')
      .sort((a,b)=>new Date(a.applicationDeadline)-new Date(b.applicationDeadline)).slice(0,5);
    return { responseRate, offerRate, last7, last30, topCos, total, applied, upcoming };
  }, [jobs]);

  // ── the signature panel: the CEC hours ledger. Every working job's counted hours add up to the total counted ──
  const c = cecHours(jobs);
  const workingJobs = jobs.filter(j => j.status === 'working');
  const bad = workingJobs.filter(j => j.noc && !teerOk(j.noc));
  const noType = workingJobs.filter(j => !(j.empType||'').trim());
  const shown = c.per.slice(0, 3);
  const rest = c.per.slice(3);
  const segs = shown.map(x => ({ ...x, label: [x.role || T('（无职位名）','(no title)'), x.company || T('（无公司）','(no company)')].join(' · ') + (x.noc ? ` · NOC ${x.noc} (TEER ${teerOf(x.noc)})` : '') }));
  if (rest.length) segs.push({ id:'rest', company:T('其他岗位','Other jobs'), label:T(`其他 ${rest.length} 个岗位`, `${rest.length} other jobs`), hours: rest.reduce((a, x) => a + x.hours, 0) });
  const segColours = ['var(--point)', 'var(--on-band-2)', 'var(--on-band-3)', 'var(--on-band-3)'];
  const counted = Math.round(c.total);
  const perSum = segs.reduce((a, x) => a + Math.round(x.hours), 0);
  const off = perSum - counted;   // the equation's check is computed, not typed: rounding may leave at most 1 h
  const plural = (n, one, many) => n === 1 ? one : many;
  const lede = c.weeklyRate > 0
    ? (c.remain <= 0
        ? T('1,560 小时已经数满。每周所有岗位合计超过 30 小时的部分不计入。','All 1,560 hours are counted. Hours above 30 a week, across all jobs combined, do not count.')
        : T(`按每周 ${fmtNum(c.weeklyRate)} 小时，${fmtDate(c.eta)} 数满 1,560 小时。每周所有岗位合计超过 30 小时的部分不计入。`,
            `At ${fmtNum(c.weeklyRate)} hours a week you reach 1,560 on ${fmtDate(c.eta)}. Hours above 30 a week, across all jobs combined, do not count.`))
    : T('把在职岗位的状态设为「在职·计工时」，填上入职日期和每周工时，这里才开始计数。','Set a job to Working (CEC hours) with a start date and weekly hours to start counting.');

  const p = pipelineCounts(jobs);
  const eq1 = p.noAnswer + p.rejected + p.interviews + p.other;
  const eq2 = p.offers + p.working + p.inProgress + p.noOffer;
  const mark = (a, b) => a === b ? <span className="ok">✓</span> : <span className="bad">{T(`✗ 差 ${Math.abs(a - b)}`, `✗ off by ${Math.abs(a - b)}`)}</span>;
  const share = n => p.apps ? Math.round(n / p.apps * 100) + '%' : '—';

  return (
    <>
      <section className="plate" aria-labelledby="ins-h">
        <div className="plate-in">
          <div className="plate-head">
            <p className="eyebrow">{T('数据','Insights')} · {regionName}</p>
            <button type="button" className="btn" onClick={onWorking}>
              {workingJobs.length ? T(`在职岗位（${workingJobs.length}）`, `Working jobs (${workingJobs.length})`) : T('把一个岗位标为在职','Mark a job as Working')}
            </button>
          </div>
          <div>
            <h1 id="ins-h" className="display" tabIndex={-1}>{T(`CEC 工时 ${fmtNum(c.total)} / ${fmtNum(CEC_TARGET)}`, `${fmtNum(c.total)} of ${fmtNum(CEC_TARGET)} CEC hours`)}</h1>
            <p className="lede">{lede}</p>
            <div className="rule" aria-hidden="true"></div>
          </div>
          {segs.length > 0 && (
            <>
              <div className="sum-bar" aria-hidden="true">
                {segs.map((x, i) => <span key={x.id} style={{ width: Math.min(100, x.hours / CEC_TARGET * 100) + '%', background: segColours[i] }}></span>)}
              </div>
              <ul className="sum-legend">
                {segs.map((x, i) => <li key={x.id}><i style={{ background: segColours[i] }}></i><span>{x.label}</span> <b>{fmtNum(x.hours)} h</b></li>)}
                <li><i className="track"></i><span>{T('还差','still to count')}</span> <b>{fmtNum(c.remain)} h</b></li>
              </ul>
              <p className="sum-eq">
                {segs.map(x => `${x.company || x.label} ${fmtNum(x.hours)} h`).join(' + ')} = {fmtNum(counted)} h {T('已计入','counted')}{' '}
                {Math.abs(off) <= 1 ? <span className="ok">✓</span> : <span className="bad">{T(`✗ 差 ${Math.abs(off)} h`, `✗ off by ${Math.abs(off)} h`)}</span>}
                {' · '}{fmtNum(c.capped)} h {T('超出每周上限、不计入','above the weekly cap not counted')}
              </p>
            </>
          )}
          {(bad.length > 0 || noType.length > 0) && (
            <ul className="plate-notes">
              {bad.length > 0 && <li>{T(`${bad.length} 个在职岗位的 NOC 不在 TEER 1–3，它的工时不计入`, `${bad.length} working ${plural(bad.length,'job has','jobs have')} a NOC outside TEER 1–3 — ${plural(bad.length,'its','their')} hours are not counted`)}</li>}
              {noType.length > 0 && <li>{T(`${noType.length} 个在职岗位没填雇佣类型——承包人的工时不计入`, `${noType.length} working ${plural(noType.length,'job has','jobs have')} no employment type — contractor hours don’t count`)}</li>}
            </ul>
          )}
          <p className="caption">{T('计入的是状态为「在职·计工时」、填了入职日期和每周工时的岗位，从入职日算到离职日（没有离职日就算到今天）；NOC 不在 TEER 1–3 的岗位不计入。',
            'Counts jobs marked Working that have a start date and weekly hours, from the start date to the end date (or today); a job whose NOC is outside TEER 1–3 is left out.')}</p>
        </div>
      </section>

      {!jobs.length ? (
        <div className="empty">
          <h2>{T('还没有投递','No applications yet')}</h2>
          <p>{T('加几条职位之后，这里会画出它们走到了哪一步。','Once you add some jobs, this page draws where each of them stands.')}</p>
          <Btn onClick={onAdd}>{T('添加职位','Add job')}</Btn>
        </div>
      ) : (
        <>
          <section className="chart" aria-labelledby="pipe-h">
            <div className="ch-head">
              <h2 id="pipe-h">{T('流程','Pipeline')}</h2>
              <div className="seg" role="group" aria-label={T('显示方式','Show as')}>
                <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>{T('图','Chart')}</button>
                <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>{T('表','Table')}</button>
              </div>
              <p>{T('每条投递只按它现在的状态算一次。','Each application counted once, at its current status.')}</p>
            </div>
            {p.interested > 0 && <p className="chart-note">{T(`另有 ${p.interested} 条感兴趣、还没投`, `+${p.interested} interested, not applied yet`)}</p>}
            {view === 'chart' ? (
              p.apps > 0 ? <PipelineChart p={p} titleId="pipe-h" eqId="pipe-eq" /> : <p className="hint">{T('还没有投出去的申请。','No applications sent yet.')}</p>
            ) : (
              <div className="tablewrap">
                <table className="data">
                  <thead><tr><th scope="col">{T('阶段','Stage')}</th><th scope="col" className="num">{T('申请数','Applications')}</th><th scope="col" className="num">{T('占比','Share')}</th></tr></thead>
                  <tbody>
                    <tr><td>{T('申请','Applications')}</td><td className="num">{p.apps}</td><td className="num">{share(p.apps)}</td></tr>
                    <tr><td className="sub">{T('未回复','No answer')}</td><td className="num">{p.noAnswer}</td><td className="num">{share(p.noAnswer)}</td></tr>
                    <tr><td className="sub">{T('被拒','Rejected')}</td><td className="num">{p.rejected}</td><td className="num">{share(p.rejected)}</td></tr>
                    <tr><td className="sub">{T('面试','Interviews')}</td><td className="num">{p.interviews}</td><td className="num">{share(p.interviews)}</td></tr>
                    <tr><td className="sub sub2">{T('Offer','Offers')}</td><td className="num">{p.offers}</td><td className="num">{share(p.offers)}</td></tr>
                    <tr><td className="sub sub2">{T('在职','Working')}</td><td className="num">{p.working}</td><td className="num">{share(p.working)}</td></tr>
                    <tr><td className="sub sub2">{T('进行中','In progress')}</td><td className="num">{p.inProgress}</td><td className="num">{share(p.inProgress)}</td></tr>
                    <tr><td className="sub sub2">{T('无 Offer','No offer')}</td><td className="num">{p.noOffer}</td><td className="num">{share(p.noOffer)}</td></tr>
                    {p.other > 0 && <tr><td className="sub">{T('其他状态','Other status')}</td><td className="num">{p.other}</td><td className="num">{share(p.other)}</td></tr>}
                    <tr><td>{T('感兴趣（还没投）','Interested (not applied)')}</td><td className="num">{p.interested}</td><td className="num">—</td></tr>
                  </tbody>
                </table>
              </div>
            )}
            <p className="chart-eq" id="pipe-eq">
              {T(`${p.apps} 条申请 = ${p.noAnswer} 未回复 + ${p.rejected} 被拒 + ${p.interviews} 面试`, `${p.apps} applications = ${p.noAnswer} no answer + ${p.rejected} rejected + ${p.interviews} interviews`)}
              {p.other > 0 ? T(` + ${p.other} 其他状态`, ` + ${p.other} other status`) : ''} {mark(eq1, p.apps)}
              {' · '}
              {T(`${p.interviews} 面试 = ${p.offers} Offer + ${p.working} 在职 + ${p.inProgress} 进行中 + ${p.noOffer} 无 Offer`, `${p.interviews} interviews = ${p.offers} offers + ${p.working} working + ${p.inProgress} in progress + ${p.noOffer} no offer`)} {mark(eq2, p.interviews)}
            </p>
          </section>

          <div className="stats">
            <div className="stat"><span className="lbl">{T('追踪总数','Tracked')}</span><span className="big">{stats.total}</span></div>
            <div className="stat"><span className="lbl">{T('近 7 天新增','Added, last 7 days')}</span><span className="big">{stats.last7}</span></div>
            <div className="stat"><span className="lbl">{T('近 30 天新增','Added, last 30 days')}</span><span className="big">{stats.last30}</span></div>
            <div className="stat"><span className="lbl">{T('回应率','Response rate')}</span><span className="big">{stats.responseRate}%</span><span className="amt">{T(`基于 ${stats.applied} 条已投`, `of ${stats.applied} applied`)}</span></div>
            <div className="stat"><span className="lbl">{T('Offer 率','Offer rate')}</span><span className="big">{stats.offerRate}%</span><span className="amt">{T(`基于 ${stats.applied} 条已投`, `of ${stats.applied} applied`)}</span></div>
          </div>

          <div className="grid-2">
            {stats.upcoming.length > 0 && (
              <section className="card" aria-labelledby="ins-due">
                <div className="card-head"><h2 id="ins-due">{T('即将截止','Upcoming deadlines')}</h2></div>
                <ul className="rows">
                  {stats.upcoming.map(j => <li key={j.id}><span>{j.role}{T('，',' · ')}{j.company}</span><span className="num">{fmtDate(j.applicationDeadline)}</span></li>)}
                </ul>
              </section>
            )}
            {stats.topCos.length > 0 && (
              <section className="card" aria-labelledby="ins-cos">
                <div className="card-head"><h2 id="ins-cos">{T('投递最多的公司','Top companies')}</h2></div>
                <ul className="rows">
                  {stats.topCos.map(([co, n]) => <li key={co}><span>{co}</span><span className="num">{n}</span></li>)}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </>
  );
}


// ════════════════════════════════════════════════════════════════
// DIAGNOSIS TAB — career diagnosis (a personal take on the six-step funnel, 2026-08-18)
// Order: stage → strengths → target profile → reality check → resume narrative → decisions
// ════════════════════════════════════════════════════════════════

const DIAG_DEFAULT = () => ({
  stage: '', stageNote: '',
  strengths: [],
  target: { industry: '', role: '', constraints: '', note: '' },
  alignment: [],
  resume: { checks: {}, note: '' },
  decisions: [],
  updatedAt: null,
});

const RESUME_CHECKS = [
  { id: 'r1', zh: '讲的是行为模式与轨迹，不是关键词堆砌', en: 'Tells behavioral patterns & trajectory, not keyword stuffing' },
  { id: 'r2', zh: '每段经历都回答「我怎么做的、带来什么变化」', en: 'Each entry answers "what I did and what changed"' },
  { id: 'r3', zh: '与下面第③步的目标画像对齐', en: 'Aligned with the target profile in step 3' },
  { id: 'r4', zh: '读起来像自己说话，只是更清晰', en: 'Sounds like you, only sharper' },
  { id: 'r5', zh: '整页有一条叙事线，不是条目拼盘', en: 'The page reads as one narrative, not a list of fragments' },
];

function DiagSection({ num, title, hint, children }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-bold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">{num}</span>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      {hint && <p className="text-xs text-gray-500 mb-3">{hint}</p>}
      {children}
    </div>
  );
}

function DiagList({ items, onAdd, onRemove, onToggle, placeholder, checkable }) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (!t) return; onAdd(t); setDraft(''); };
  return (
    <div>
      {(items || []).map(it => (
        <div key={it.id} className="flex items-start gap-2 py-1 group">
          {checkable && (
            <input type="checkbox" checked={!!it.done} onChange={() => onToggle(it.id)}
              className="mt-1 h-4 w-4 text-blue-600 rounded" />
          )}
          <span className={'flex-1 text-sm ' + (it.done ? 'line-through text-gray-400' : 'text-gray-800')}>{it.text}</span>
          <button onClick={() => onRemove(it.id)}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder={placeholder}
          className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
        <button onClick={add} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700">{T('添加','Add')}</button>
      </div>
    </div>
  );
}

function DiagnosisTab({ diagnosis, setDiagnosis }) {
  const d = diagnosis || DIAG_DEFAULT();
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const patch = (p) => setDiagnosis({ ...d, ...p });
  const patchTarget = (p) => patch({ target: { ...d.target, ...p } });
  const patchResume = (p) => patch({ resume: { ...d.resume, ...p } });

  const listOps = (key, checkable) => ({
    onAdd:    t  => patch({ [key]: [...(d[key]||[]), { id: newId(), text: t, ...(checkable ? { done:false } : {}) }] }),
    onRemove: id => patch({ [key]: (d[key]||[]).filter(x => x.id !== id) }),
    onToggle: id => patch({ [key]: (d[key]||[]).map(x => x.id === id ? { ...x, done: !x.done } : x) }),
  });

  const save = async () => {
    setSaving(true);
    const next = { ...d, updatedAt: new Date().toISOString() };
    setDiagnosis(next);
    await saveJson('diagnosis', next);
    setSaving(false); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800);
  };

  const stageBtn = (val, zh, en, desc) => (
    <button onClick={() => patch({ stage: d.stage === val ? '' : val })}
      className={'flex-1 rounded-lg border p-3 text-left transition ' +
        (d.stage === val ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-300 bg-white hover:border-gray-400')}>
      <div className="font-medium text-sm text-gray-900">{T(zh, en)}</div>
      <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
    </button>
  );

  const inp = (props) => (
    <input {...props} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{T('求职诊断','Career Diagnosis')}</h2>
          <p className="text-xs text-gray-500">
            {T('先想清楚，再投递——六步走完再回「添加职位」。','Think first, then apply — finish the six steps before Add Job.')}
            {d.updatedAt && <span className="ml-2">{T('上次保存：','Last saved: ')}{new Date(d.updatedAt).toLocaleString()}</span>}
          </p>
        </div>
        <button onClick={save} disabled={saving}
          className={'px-4 py-2 rounded-lg text-sm font-medium text-white ' + (savedFlash ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700') + (saving ? ' opacity-60' : '')}>
          {saving ? T('保存中…','Saving…') : savedFlash ? T('已保存 ✓','Saved ✓') : T('保存','Save')}
        </button>
      </div>

      <DiagSection num="①" title={T('阶段定位','Where you are')}
        hint={T('两种状态要的动作完全不同：定方向阶段狂投是弯路，攻坚阶段反复自省是拖延。','The two stages need different actions: mass-applying while lost is a detour; endless self-reflection while executing is procrastination.')}>
        <div className="flex gap-3">
          {stageBtn('explore', '探索方向', 'Exploring direction', T('还不确定要做什么/去哪个行业','Not yet sure what role or industry'))}
          {stageBtn('execute', '攻坚投递', 'Executing search', T('目标明确，卡在拿面试/过面试','Target clear; stuck on getting or passing interviews'))}
        </div>
        <textarea value={d.stageNote} onChange={e => patch({ stageNote: e.target.value })}
          placeholder={T('现在最卡的一件事是什么？','What is the single biggest blocker right now?')}
          className="w-full mt-3 border border-gray-300 rounded px-2 py-1.5 text-sm h-16 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
      </DiagSection>

      <DiagSection num="②" title={T('优势清单','Strengths')}
        hint={T('写「我反复被证明擅长的事」，不是「我会的技能名词」。每条最好带一个真实事例。','List what you are repeatedly proven good at — not skill nouns. Each item ideally carries one real example.')}>
        <DiagList items={d.strengths} {...listOps('strengths')} placeholder={T('例：把混乱信息整理成能执行的清单（例子：××项目）','e.g. Turning messy info into executable checklists (example: ...)')} />
      </DiagSection>

      <DiagSection num="③" title={T('目标画像','Target profile')}
        hint={T('从②推出来，不是从招聘网站上抄下来。','Derived from step 2 — not copied from job boards.')}>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="text-xs text-gray-600">{T('目标行业','Industry')}</label>
            {inp({ value: d.target.industry, onChange: e => patchTarget({ industry: e.target.value }), placeholder: T('哪个行业需要②里的东西','Which industry needs step 2') })}
          </div>
          <div>
            <label className="text-xs text-gray-600">{T('目标岗位','Role')}</label>
            {inp({ value: d.target.role, onChange: e => patchTarget({ role: e.target.value }), placeholder: T('岗位名（可以不止一个）','Role title(s)') })}
          </div>
        </div>
        <label className="text-xs text-gray-600">{T('硬约束','Hard constraints')}</label>
        {inp({ value: d.target.constraints, onChange: e => patchTarget({ constraints: e.target.value }), placeholder: T('地点/签证/最低薪资/时间窗……','Location / visa / salary floor / timing...') })}
      </DiagSection>

      <DiagSection num="④" title={T('岗位对齐','Reality check')}
        hint={T('拿 3–5 个真实 JD 对照③：他们反复要求、而我没证据的能力，逐条记在这里补。','Check 3–5 real JDs against step 3. What they repeatedly ask for and you cannot yet evidence — list here to fix.')}>
        <DiagList items={d.alignment} {...listOps('alignment', true)} checkable
          placeholder={T('例：JD 都要 SQL，我只有课程练习 → 做一个真数据集项目','e.g. JDs want SQL; I only have coursework → build one real-data project')} />
      </DiagSection>

      <DiagSection num="⑤" title={T('简历叙事自查','Resume story check')}
        hint={T('多数 AI 简历工具只是往 CV 里塞关键词；这五条检查的是叙事。改完简历回来逐条勾。','Most AI resume tools stuff keywords. These five check the narrative. Re-check after each resume revision.')}>
        {RESUME_CHECKS.map(c => (
          <label key={c.id} className="flex items-start gap-2 py-1 cursor-pointer">
            <input type="checkbox" checked={!!d.resume.checks[c.id]}
              onChange={() => patchResume({ checks: { ...d.resume.checks, [c.id]: !d.resume.checks[c.id] } })}
              className="mt-1 h-4 w-4 text-blue-600 rounded" />
            <span className="text-sm text-gray-800">{T(c.zh, c.en)}</span>
          </label>
        ))}
        <textarea value={d.resume.note} onChange={e => patchResume({ note: e.target.value })}
          placeholder={T('没过的那几条，差在哪？','For unchecked items — what exactly is missing?')}
          className="w-full mt-2 border border-gray-300 rounded px-2 py-1.5 text-sm h-16 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
      </DiagSection>

      <DiagSection num="⑥" title={T('关键决策','High-stakes decisions')}
        hint={T('记下会改变方向的大决定（接不接 offer、转不转赛道、搬不搬家），写清「什么条件下选哪边」。','Log direction-changing decisions (offers, pivots, relocation) with the condition that decides each.')}>
        <DiagList items={d.decisions} {...listOps('decisions')} placeholder={T('例：若 X 月前拿不到 Y，则转 Z','e.g. If no Y by month X, switch to Z')} />
      </DiagSection>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// REGION APP
// ════════════════════════════════════════════════════════════════

function RegionApp({ region, tab, go, openJobId, setOpenJobId, trackerStatus, onCount, resumeDb, sections, updateSections, formatting, setFormatting, glossary, setGlossary, library, setLibrary, diagnosis, setDiagnosis }) {
  const regionMeta = REGIONS.find(r=>r.id===region);
  const regionLabel = rName(regionMeta);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const j = (DEMO && !ghConfigured()) ? sampleJobs(region) : await loadJson(`${region}:jobs`);
      if (!cancelled) { setJobs(j); setLoading(false); }
    })();
    return () => { cancelled=true; };
  }, [region]);
  useEffect(() => { onCount(loading ? null : jobs.length); }, [loading, jobs.length]);

  const tabMeta = TABS.find(t => t.id === tab) || TABS[0];
  const shared = T('所有地区共用','Shared by all regions');
  const eyebrow = tabMeta.scope === 'region' ? regionLabel : shared;
  if (loading) return (
    <>
      <PageHead eyebrow={eyebrow} title={T(tabMeta.zh, tabMeta.label)} />
      <div className="card loading" aria-busy="true">
        <span className="sr-only">{T(`正在加载${regionLabel}的投递…`, `Loading ${regionLabel} applications…`)}</span>
        <span className="skel" style={{width:'40%'}}></span><span className="skel" style={{width:'85%'}}></span><span className="skel" style={{width:'70%'}}></span>
      </div>
    </>
  );

  const openJob = tab === 'tracker' ? jobs.find(j=>j.id===openJobId) : null;
  // the views not redrawn yet keep their old insides under the family heading (round 1 redraws the shell, Tracker and Insights)
  const legacy = node => <><PageHead eyebrow={eyebrow} title={T(tabMeta.zh, tabMeta.label)} /><div className="legacy">{node}</div></>;

  return (
    <>
      {tab==='addjob'  && legacy(<AddJobTab resumeDb={resumeDb} formatting={formatting} glossary={glossary} library={library} jobs={jobs} setJobs={setJobs} region={region} onSaved={id=>go('tracker', { openJobId:id })} />)}
      {tab==='tracker' && !openJob && <TrackerTab region={region} jobs={jobs} setJobs={setJobs} resumeDb={resumeDb} formatting={formatting} initialStatus={trackerStatus} onAdd={()=>go('addjob')} onOpen={id=>setOpenJobId(id)} />}
      {tab==='tracker' && openJob  && <><PageHead eyebrow={regionLabel} title={openJob.role || T('（无职位名）','(no title)')} /><div className="legacy"><JobDetail region={region} job={openJob} resumeDb={resumeDb} formatting={formatting} glossary={glossary} library={library} jobs={jobs} setJobs={setJobs} onBack={()=>setOpenJobId(null)} /></div></>}
      {tab==='profile' && legacy(<ProfileTab sections={sections} updateSections={updateSections} formatting={formatting} setFormatting={setFormatting} glossary={glossary} setGlossary={setGlossary} region={region} resumeDb={resumeDb} />)}
      {tab==='diagnosis' && legacy(<DiagnosisTab diagnosis={diagnosis} setDiagnosis={setDiagnosis} />)}
      {tab==='library' && legacy(<LibraryTab library={library} setLibrary={setLibrary} updateSections={updateSections} />)}
      {tab==='insights'&& <InsightsTab jobs={jobs} regionName={regionLabel} onWorking={()=>go('tracker', { status: jobs.some(j => j.status === 'working') ? 'working' : null })} onAdd={()=>go('addjob')} />}
      {tab==='watchdog'&& legacy(<WatchdogTab region={region} jobs={jobs} setJobs={setJobs} resumeDb={resumeDb} />)}
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN APP — the family shell: top bar (band), navigation (sage), the view, the honest footer (band)
// ════════════════════════════════════════════════════════════════

const HALF_CIRCLE = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>;
const GEAR = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M10.34 5.10L10.58 2.51L13.42 2.51L13.66 5.10A7.1 7.1 0 0 1 15.71 5.95L17.71 4.28L19.72 6.29L18.05 8.29A7.1 7.1 0 0 1 18.90 10.34L21.49 10.58L21.49 13.42L18.90 13.66A7.1 7.1 0 0 1 18.05 15.71L19.72 17.71L17.71 19.72L15.71 18.05A7.1 7.1 0 0 1 13.66 18.90L13.42 21.49L10.58 21.49L10.34 18.90A7.1 7.1 0 0 1 8.29 18.05L6.29 19.72L4.28 17.71L5.95 15.71A7.1 7.1 0 0 1 5.10 13.66L2.51 13.42L2.51 10.58L5.10 10.34A7.1 7.1 0 0 1 5.95 8.29L4.28 6.29L6.29 4.28L8.29 5.95A7.1 7.1 0 0 1 10.34 5.10Z"/><circle cx="12" cy="12" r="3"/></svg>;

function App() {
  useLangToggle();
  const [region, setRegionState] = useState('canada');
  const [tab, setTab]               = useState(tabFromUrl);
  const [openJobId, setOpenJobId]   = useState(null);
  const [trackerStatus, setTrackerStatus] = useState(null);
  const [jobCount, setJobCount]     = useState(null);
  const [sections, setSections]     = useState([]);
  const [resumeDb, setResumeDb]     = useState('');
  const [formatting, setFormatting] = useState('');
  const [glossary, setGlossary]     = useState('');
  const [library, setLibrary]       = useState([]);
  const [diagnosis, setDiagnosis]   = useState(null);
  const [loaded, setLoaded]         = useState(false);
  const [ghOk, setGhOk]             = useState(false);
  const [saveErr, setSaveErr]       = useState('');
  const themeRef = useRef(null), gearRef = useRef(null);
  const latest = useRef({});

  useEffect(() => {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('root').style.display = '';
  }, []);

  useEffect(() => {
    const ok = ghConfigured(); setGhOk(ok);
    if (!ok) { setLoaded(true); return; }   // no dialog on arrival: the connect card on every view opens Settings
    (async () => {
      const [rawSecs, oldDb, fmt, gls, lib, diag] = await Promise.all([
        loadJson('resumeSections'),
        loadText('resumeDb'),
        loadText('formatting'),
        loadText('glossary'),
        loadJson('library'),
        loadJson('diagnosis'),
      ]);
      setDiagnosis(diag && !Array.isArray(diag) ? diag : null);
      let secs = rawSecs;
      if ((!secs || secs.length === 0) && oldDb.trim()) {
        secs = [{ id: newId(), name: 'My Profile', content: oldDb, source: 'manual', addedAt: new Date().toISOString() }];
      }
      setSections(secs);
      setResumeDb(combineSections(secs));
      setFormatting(fmt);
      setGlossary(gls);
      setLibrary(lib);
      setLoaded(true);
    })();
  }, []);

  // a failed save stays on screen until dismissed: the change is on this page only and is lost on reload
  useEffect(() => {
    const h = e => setSaveErr(e.detail?.message || 'Save to GitHub failed');
    window.addEventListener('jobapp:saveerror', h);
    return () => window.removeEventListener('jobapp:saveerror', h);
  }, []);

  // views are addresses (?tab=…): the browser's back and forward move between them
  useEffect(() => {
    const h = () => { setTab(tabFromUrl()); setOpenJobId(null); setTrackerStatus(null); };
    window.addEventListener('popstate', h);
    return () => window.removeEventListener('popstate', h);
  }, []);

  const updateSections = async (newSecs, persist = true) => {
    setSections(newSecs);
    const combined = combineSections(newSecs);
    setResumeDb(combined);
    if (persist) {
      await Promise.all([
        saveJson('resumeSections', newSecs),
        saveText('resumeDb', combined),
      ]);
    }
  };

  const handleGhChange = async ok => {
    setGhOk(ok);
    if (ok) {
      const [rawSecs, oldDb, fmt, gls, lib] = await Promise.all([
        loadJson('resumeSections'), loadText('resumeDb'), loadText('formatting'), loadText('glossary'), loadJson('library'),
      ]).catch(() => [[], '', '', '', library]);
      let secs = rawSecs;
      if ((!secs || secs.length === 0) && oldDb.trim()) {
        secs = [{ id: newId(), name: 'My Profile', content: oldDb, source: 'manual', addedAt: new Date().toISOString() }];
      }
      setSections(secs); setResumeDb(combineSections(secs)); setFormatting(fmt); setGlossary(gls); setLibrary(lib);
    }
  };
  latest.current = { ghOk, handleGhChange };

  // Settings is the family dialog (appearance.js); the two connection sections are React, rendered into it on open
  // and unmounted on close. `focus` names the field to land on (the connect card goes straight to Repository).
  const settingsOpts = focus => {
    let root = null;
    return {
      strings: Appearance.STRINGS[lang],
      focus,
      sections: [() => {
        const box = document.createElement('div');
        root = ReactDOM.createRoot(box);
        ReactDOM.flushSync(() => root.render(<SettingsSections ghOk={latest.current.ghOk} onGhChange={ok => latest.current.handleGhChange(ok)} />));
        return box;
      }],
      onClose: () => { const r = root; root = null; if (r) setTimeout(() => r.unmount(), 0); },
    };
  };
  const openSettings = (opener, focus) => Appearance.openSettings(opener || gearRef.current, settingsOpts(focus));
  useEffect(() => {
    if (themeRef.current) Appearance.bindToggle(themeRef.current);
    if (gearRef.current) Appearance.bindSettings(gearRef.current, () => settingsOpts());
  }, []);

  const go = (t, opts = {}) => {
    if (t !== tab) { try { history.pushState(null, '', tabHref(t)); } catch (e) {} }
    setTab(t); setOpenJobId(opts.openJobId || null); setTrackerStatus(opts.status || null);
  };
  // changing region keeps the view you are on (it used to jump back to Add job)
  const setRegion = r => { setRegionState(r); setOpenJobId(null); setJobCount(null); };

  const repo = ghCfg().repo;
  const pill = ghOk ? { short: T('你的仓库','Your repo'), long: ` · ${repo}`, warn: false }
    : DEMO ? { short: T('演示','Demo'), long: T(' · 示例数据，不会保存',' · sample data, nothing is saved'), warn: true }
    : { short: T('未保存','Not saved'), long: T(' · 没有连接仓库',' · no repo connected'), warn: true };
  const skip = e => { e.preventDefault(); const h = document.querySelector('#main h1'); if (h) h.focus(); };
  const navLink = t => (
    <a key={t.id} href={tabHref(t.id)} aria-current={tab === t.id ? 'page' : undefined} onClick={e => { e.preventDefault(); go(t.id); }}>
      <span className="ico"><Icon name={t.icon} size={16} /></span><span>{T(t.zh, t.label)}</span>
      {t.id === 'tracker' && jobCount != null && <span className="cnt">{jobCount}</span>}
    </a>
  );

  return (
    <>
      <a className="skip" href="#main" onClick={skip}>{T('跳到内容','Skip to content')}</a>
      <header className="topbar">
        <a className="brand" href={tabHref('tracker')} aria-label={T('Docket 首页','Docket home')} onClick={e => { e.preventDefault(); go('tracker'); }}>
          <DocketMark /><b>Docket</b><span>{T('求职投递，每个地区一条管线——数据存在你自己的私有仓库','Job applications, one pipeline per region — kept in a private repo you own.')}</span>
        </a>
        <span className={`pill${pill.warn ? ' warn' : ''}`} title={pill.short + pill.long}>{pill.short}<span className="long">{pill.long}</span></span>
        <button type="button" className="btn btn-ghost lang-btn" onClick={toggleLang} title={T('切换语言','Switch language')} lang={lang === 'en' ? 'zh' : 'en'}>{T('EN','中文')}</button>
        <button type="button" className="btn btn-ghost btn-icon" id="theme" ref={themeRef} aria-label={T('深色模式','Dark mode')} aria-pressed="false" title={T('深色模式','Dark mode')}>{HALF_CIRCLE}</button>
        <button type="button" className="btn btn-ghost btn-icon" id="nl-settings-button" ref={gearRef} aria-haspopup="dialog" aria-label={T('设置','Settings')} title={T('设置','Settings')}>{GEAR}</button>
        <a className="btn btn-ghost gh" href="https://github.com/NickkkLian/Job-Tracker" rel="noopener">GitHub</a>
      </header>

      <div className="shell">
        <nav className="nav" aria-label={T('页面','Sections')}>
          <div className="nav-in">
          <div className="nav-region">
            <label htmlFor="region" className="eyebrow">{T('地区','Region')}</label>
            <select id="region" value={region} onChange={e => setRegion(e.target.value)}>
              {REGIONS.map(r => <option key={r.id} value={r.id}>{rName(r)}</option>)}
            </select>
          </div>
          <div className="nav-links">
            {TABS.filter(t => t.scope === 'region').map(navLink)}
            <p className="group eyebrow">{T('所有地区共用','Shared by all regions')}</p>
            {TABS.filter(t => t.scope === 'shared').map(navLink)}
          </div>
          </div>
        </nav>

        <main id="main" className="main">
          <div className="main-in">
            {!ghOk && !DEMO && (
              <section className="card connect" aria-labelledby="connect-h">
                <h2 id="connect-h">{T('连接你的私有数据仓库','Connect your private data repo')}</h2>
                <p>{T('Docket 把你的投递存在你自己的 GitHub 私有仓库里。连接之前，在这里添加的东西都不会保存。','Docket keeps your applications in a private GitHub repo you own. Until you connect one, nothing you add here is saved.')}</p>
                <div className="acts">
                  <Btn variant="primary" onClick={e => openSettings(e.currentTarget, '#set-repo')}>{T('连接…','Connect…')}</Btn>
                  <a href="?demo=1&tab=tracker">{T('先看演示','Try the demo')}</a>
                </div>
              </section>
            )}
            {loaded && (
              <RegionApp
                key={region}
                region={region}
                tab={tab}
                go={go}
                openJobId={openJobId}
                setOpenJobId={setOpenJobId}
                trackerStatus={trackerStatus}
                onCount={setJobCount}
                resumeDb={resumeDb}
                sections={sections}
                diagnosis={diagnosis}
                setDiagnosis={setDiagnosis}
                updateSections={updateSections}
                formatting={formatting}
                setFormatting={setFormatting}
                glossary={glossary}
                setGlossary={setGlossary}
                library={library}
                setLibrary={setLibrary}
              />
            )}
          </div>
        </main>
      </div>

      <footer className="honest">
        <div className="honest-in">
          <dl>
            <dt>{!ghOk && DEMO ? T('关于这个演示','About this demo') : T('关于这个页面','About this page')}</dt>
            <dd>{ghOk ? T(`你的投递，从 ${repo} 读取、写回 ${repo}。`, `Your applications, read from and written to ${repo}.`)
              : DEMO ? <>{T('演示用的示例投递，公司全是虚构的；在这里改的东西都不会保存。','Sample applications made up for this demo — every company is fictional, and nothing you change here is saved.')}{' '}
                  <button type="button" className="btn btn-link" onClick={e => openSettings(e.currentTarget, '#set-repo')}>{T('连接仓库…','Connect a repo…')}</button></>
              : T('连接私有仓库之前，什么都不会保存。','Nothing is saved until you connect a private repo.')}</dd>
          </dl>
          <dl>
            <dt>{T('这里没有验证的','Not verified here')}</dt>
            <dd>{T('职位描述读取器是为英文招聘启事调的启发式规则：它帮你填字段，由你来核对。工时账按「数据」页上写的规则计算，不是 IRCC 的计算。',
              'The job-description reader is a heuristic tuned for English postings: it fills fields in, you check them. The hours ledger follows the rules written on the Insights page; it is not an IRCC calculation.')}</dd>
          </dl>
          <dl>
            <dt>{T('源码','Source')}</dt>
            <dd><a href="https://github.com/NickkkLian/Job-Tracker" rel="noopener">github.com/NickkkLian/Job-Tracker</a> · MIT · {T('Nick Lian 制作','built by Nick Lian')}</dd>
            <dd>{T('GitHub 令牌和可选的 Anthropic 密钥只存在这个浏览器里，只发给各自的 API。','The GitHub token and the optional Anthropic key stay in this browser and go only to their own APIs.')}</dd>
          </dl>
        </div>
      </footer>

      {saveErr && (
        <div className="toasts">
          <div className="toast" role="alert">
            <p>{T('没能保存到 GitHub','Couldn’t save to GitHub')} — {saveErr}. {T('这次改动只在这个页面上，刷新就没了。','Your change is on this page only and is lost on reload.')}</p>
            <Btn className="btn-sm" onClick={e => openSettings(e.currentTarget)}>{T('打开设置','Open settings')}</Btn>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={T('关闭','Dismiss')} data-tip={T('关闭','Dismiss')} onClick={() => setSaveErr('')}><Icon name="x" /></button>
          </div>
        </div>
      )}
    </>
  );
}

// Mount
initTips();
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
