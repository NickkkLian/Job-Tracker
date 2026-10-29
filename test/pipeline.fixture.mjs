// Invented volume fixture derived from the approved mockup. No private data.
export function makeJobs(busy = false) {
let seed = 20261028;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const ROLES = ['Data Analyst','BI Developer','Ops Analyst','Pricing Analyst','Product Analyst','Junior Data Scientist','Analytics Engineer',
 'LLM Evaluation Analyst','Data Quality Specialist','Research Assistant (AI)','Business Intelligence Analyst','Junior Machine Learning Engineer',
 'Applied AI Operations Specialist','Data & Reporting Analyst, Finance','Customer Insights Analyst (Contract)','AI Workflow Automation Associate',
 'Revenue Operations Data Analyst','Quantitative Research Intern','Product Operations Associate','Junior Financial Data Analyst',
 'Marketing Analytics Coordinator','AI Product Intern (Winter 2027)','Junior Data Engineer','Data Annotation Lead','Risk Analytics Co-op',
 'Associate Product Manager, AI Tools','Prompt Engineer, Internal Platforms','Analyst, Credit Risk Modelling',
 'Junior Data Analyst, Strategy & Planning (12-month term)','Associate, Data Engineering and Analytics Platforms',
 'Machine Learning Operations Intern, Applied Research Team','Business Systems Analyst, Enterprise Reporting',
 'Research Assistant, Natural Language Processing Lab','Data Analyst','AI Solutions Analyst','Operations Research Analyst','Growth Analyst',
 'Technical Program Coordinator, AI Adoption','Junior Quant Developer','Market Research Analyst'];
const COS = ['Northwind Analytics','Larchmere Health','Copperline Freight','Halcyon Robotics','Pinegate Credit Union','Tidewater Insurance Group',
 'Saltmarsh AI','Quillfeather Labs','Brightfern','Kestrel Mobility','Orca Bay Energy','Fernhill Software','Ashgrove Capital','Lumen & Hart',
 'Marrowstone Bio','Westmere Retail Group','Cobalt Harbour','Juniper Ridge Logistics','Stillwater Data','Mosscliff','Redcedar Systems',
 'Granite Peak Credit','Harbourline Media','Northshore Transit Authority','Silverbirch Pharma','Vellum AI','Tamarack Labs','Bluefin Payments',
 'Driftwood Games','Oakhaven Insurance','Lower Fraser Valley Regional Health Services','Coastline Municipal Utilities Commission'];
const LOCS = ['Surrey','Surrey','Toronto, ON','Toronto, ON','多伦多','Vancouver','Vancouver, BC','Vancouver, British Columbia, Canada','Burnaby',
 'Metro Vancouver','Richmond, BC','Remote','','','Toronto, ON / Hybrid','Vancouver, BC (hybrid, 3 days in office)'];
const day = (m, a, b) => `2026-${String(m).padStart(2,'0')}-${String(a + Math.floor(rnd() * (b - a + 1))).padStart(2,'0')}`;
const months = [].concat(Array(31).fill(5), Array(52).fill(8), Array(27).fill(9));
const jobs = months.map((m, i) => ({ id:'j' + i, role:pick(ROLES), company:pick(COS), location:pick(LOCS),
  dateAdded: m === 5 ? day(5, 7, 31) : m === 8 ? day(8, 1, 31) : day(9, 1, 16), status:'interested', priority:'T3' }));
// the long tail of real names: one role of 104 and one of 101 characters, one company of 100
jobs[17].role = 'Junior Data Analyst, Customer Insights & Reporting (12-month contract, hybrid, Metro Vancouver offices)';
jobs[63].role = 'Graduate Analyst Program 2027: Data, Automation and Decision Science rotations across three business lines';
jobs[63].role = jobs[63].role.slice(0, 101);
jobs[17].role = jobs[17].role.padEnd(104, 'X');
jobs[41].company = 'Pacific Northwest Institute for Applied Data Science and Public Policy Research, Office of Analytics';
jobs[41].company = jobs[41].company.padEnd(100, 'X');
// real tier and status mix: interested T1 30 / T2 20 / T3 27 / T4 24; applied T3 4, T1 2, T4 1; rejected T3 2
const plan = [].concat(Array(30).fill(['interested','T1']), Array(20).fill(['interested','T2']), Array(27).fill(['interested','T3']),
  Array(24).fill(['interested','T4']), Array(4).fill(['applied','T3']), Array(2).fill(['applied','T1']), [['applied','T4']], Array(2).fill(['rejected','T3']));
const order = jobs.map((_, i) => i).sort(() => rnd() - .5);
order.forEach((ji, k) => { jobs[ji].status = plan[k][0]; jobs[ji].priority = plan[k][1]; });
const t1 = jobs.filter(j => j.priority === 'T1' && j.status === 'interested');
t1[3].applicationDeadline = '2026-11-18';
t1.slice(0, 5).forEach(j => j.ready = true);
if (busy) { // a mid-search week, same 110 entries
  const intr = jobs.filter(j => j.status === 'interested');
  intr.slice(0, 11).forEach(j => j.status = 'applied');
  intr.slice(11, 15).forEach(j => j.status = 'interviewing');
  intr[15].status = 'offered'; intr[16].status = 'working';
  intr.slice(17, 21).forEach(j => j.status = 'rejected');
  intr.slice(21, 23).forEach(j => j.status = 'interview_rejected');
}

jobs.forEach(j => {j.jdText = 'Invented local test posting'; if(j.status==='working') Object.assign(j,{startDate:'2026-06-01',weeklyHours:'20',noc:'21223',empType:'T4 employee'});});
return jobs;
}
