// The public demo (?demo=1) shows no CEC hours feature: no "Working (CEC hours)" status, no hours ledger, no Insights
// headline about CEC hours, no hours fields. Real accounts in the Canada region keep all of it.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../src/app.jsx',import.meta.url),'utf8');
const ledger=fs.readFileSync(new URL('../src/ledger.jsx',import.meta.url),'utf8');
const between=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,`snippet ${a}`);return s.slice(i,j);};

// The real definitions: DEMO, the region gate, the status list, the status names (tracker and ledger)
const code=[
  between(app,'const DEMO =','\n')+'\n',
  between(app,'let regionNow','// Display name for a region'),
  between(app,'const STATUSES =','// Display only'),
  between(app,'const stName =','\n')+'\n',
  between(ledger,'function stateName(state)','function kitHref'),
  'this.labels={working:stName(STATUSES.find(s=>s.id==="working")),all:STATUSES.map(stName),ledger:stateName("working")};this.cec=cecShown();',
].join('');
const run=(search,region)=>{const c={location:{search},T:(zh,en)=>en};vm.runInNewContext(code.replace("let regionNow = 'canada';",`let regionNow = '${region}';`),c);return c;};

test('demo in Canada: plain Working, no CEC in any status name',()=>{
  const c=run('?demo=1','canada');
  assert.equal(c.cec,false);
  assert.equal(c.labels.working,'Working');
  assert.equal(c.labels.ledger,'Working');
  assert.ok(!c.labels.all.some(l=>/CEC/.test(l)),c.labels.all.join(', '));
});

test('real account in Canada keeps "Working (CEC hours)"',()=>{
  const c=run('','canada');
  assert.equal(c.cec,true);
  assert.equal(c.labels.working,'Working (CEC hours)');
  assert.equal(c.labels.ledger,'Working (CEC hours)');
});

test('real account outside Canada: plain Working',()=>{
  const c=run('?tab=tracker','us');
  assert.equal(c.cec,false);
  assert.equal(c.labels.working,'Working');
});

// Every visible CEC text sits behind the demo-aware gate (cecShown() or !DEMO), never behind the region check alone
for(const [name,src,needle] of [
  ['Insights headline',app,'CEC hours`)}</h2>'],
  ['Insights empty-ledger line',app,"'CEC hours: no working jobs recorded yet'"],
  ['job form hours fields',app,"'For the CEC hours ledger'"],
  ['job page hours fields',app,"['NOC', form.noc"],
  ['How it works section',ledger,"'CEC hours use a combined weekly cap'"],
])test(`${name} is hidden in the demo`,()=>{
  const at=src.indexOf(needle);assert.ok(at>0,needle);
  const before=src.slice(0,at);
  const gate=Math.max(before.lastIndexOf('cecShown()'),before.lastIndexOf('!DEMO&&'));
  assert.ok(gate>before.lastIndexOf('inCanada()'),`${name}: nearest gate is the region check, not the demo-aware one`);
  assert.ok(at-gate<4000,`${name}: no demo-aware gate near it`);
});

// The made-up demo person carries no work-permit / PGWP wording in any sample text the demo can show
// (profile sections, apply-desk answers). Immigration status stays off every public surface.
test('demo sample text has no work permit or PGWP wording',()=>{
  const demoLedger=fs.readFileSync(new URL('../src/ledger-demo.js',import.meta.url),'utf8');
  const profile=between(app,'function sampleProfile()','const library');
  for(const [name,text] of [['sample profile',profile],['apply-desk answers',demoLedger]])
    assert.ok(!/work permit|PGWP/i.test(text),`${name} mentions a work permit or PGWP`);
});
