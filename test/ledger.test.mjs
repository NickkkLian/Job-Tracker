import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const context=vm.createContext({Date,URL,URLSearchParams,Set,Map});
vm.runInContext(readFileSync(new URL('../src/apply-kits.js',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../src/ledger.js',import.meta.url),'utf8')+';globalThis.api={Ledger,ApplyKits,saveLinkedFiles};',context);
const {Ledger:L,ApplyKits:K,saveLinkedFiles}=context.api;
const now=new Date('2026-11-05T12:00:00Z');
const kit={id:'a',company:'Sample company',role:'Analyst',postingUrl:'https://example.com/job',resume:{path:'data/apply-kits/a/resume.pdf'},steps:['Legacy instruction'],answers:[],actions:[]};
test('new optional fields validate and preserve unknown content',()=>{
 const value={...kit,extra:'keep',jobRef:{region:'canada',id:'job'},handoff:{updatedAt:now.toISOString(),steps:[{id:'submit',kind:'submit',text:{en:'Submit',zh:'提交'},url:'https://example.com/form'}]}};
 assert.equal(K.validate([value])[0],value);
 assert.throws(()=>K.validate([{...value,jobRef:{region:'../canada',id:'job'}}]));
 assert.throws(()=>K.validate([{...value,handoff:{steps:[{id:'a',kind:'submit',text:'x',url:'javascript:alert(1)'}]}}]));
 assert.throws(()=>K.validate([{...value,handoff:{steps:[value.handoff.steps[0],value.handoff.steps[0]]}}]));
 const record={id:'a',handoffDone:{submit:now.toISOString()},manualSteps:[{id:'personal',text:'Review'}],unknown:true};
 assert.equal(K.validateProgress([record])[0],record);
 assert.throws(()=>K.validateProgress([{id:'a',handoffDone:{submit:true}}]));
});
test('silence ages out at 21 days and replies immediately restore an active state',()=>{
 assert.equal(L.state(kit,{appliedAt:'2026-10-16T12:00:00Z'},null,now),'sent');
 assert.equal(L.state(kit,{appliedAt:'2026-10-15T12:00:00Z'},null,now),'quiet');
 assert.equal(L.state(kit,{appliedAt:'2026-10-01T12:00:00Z',outcome:'interview'},null,now),'talking');
 assert.equal(L.state(kit,{outcome:'withdrawn'},null,now),'closed');
});
test('ready windows include their boundary, exclude past dates and never add a stored status',()=>{
 assert.equal(L.state({...kit,applyDate:'2026-11-12'},{},null,now),'ready');
 assert.equal(L.state({...kit,applyDate:'2026-11-13'},{},null,now),'saved');
 assert.equal(L.state({...kit,applyDate:'2026-11-04'},{},null,now),'saved');
 assert.equal(L.state({...kit,deadline:'2026-11-19'},{},null,now),'ready');
 assert.equal(L.state({...kit,deadline:'2026-11-20'},{},null,now),'saved');
});
test('handoffs and manual steps use dated progress with the legacy checklist fallback',()=>{
 const value={...kit,handoff:{steps:[{id:'robot',text:'Check',kind:'robot-check'}]}};
 assert.equal(L.state(value,{},null,now),'yours');
 assert.equal(L.openSteps(value,{handoffDone:{robot:now.toISOString()}}).length,0);
 assert.equal(L.steps(kit)[0].text,'Legacy instruction');
 assert.equal(L.state(kit,{manualSteps:[{id:'mine',text:'Check'}]},null,now),'yours');
 assert.equal(K.hashId('#apply/a?step=robot'),'a');
});
test('linked rows are counted once while unlinked and other-region rows remain',()=>{
 const jobs=[{id:'one',status:'interested'},{id:'two',status:'applied',dateAdded:now.toISOString()}];
 const linked={...kit,jobRef:{region:'canada',id:'one'}};
 const rows=L.entries(jobs,[linked],[{id:'a',appliedAt:now.toISOString()}],'canada',now);
 assert.equal(rows.length,2);assert.equal(rows.filter(r=>r.state==='sent').length,2);
 assert.equal(L.entries(jobs,[linked],[],'usa',now).length,3);
 assert.equal(L.linkedStatus({outcome:'offer'}),'offered');
 assert.equal(L.linkedStatus({outcome:'interview'}),'interviewing');
 assert.equal(L.linkedStatus({outcome:'declined'}),'rejected');
 assert.equal(L.linkedStatus({},{appliedAt:now.toISOString()}),'interested');
});
test('tracker moves keep linked progress coherent for every stored status',()=>{
 const original={id:'a',appliedAt:'2026-10-20T12:00:00Z',appliedDate:'2026-10-20',outcome:'interview',answers:{start:'Keep'},handoffDone:{submit:now.toISOString()},extra:'keep'};
 const expected={interested:'saved',applied:'sent',interviewing:'talking',offered:'offer',working:'working',rejected:'closed',interview_rejected:'closed'};
 for(const [status,state] of Object.entries(expected)){
  const changed=L.progressForStatus(original,status,now);
  assert.equal(L.state(kit,changed,null,now),state);
  assert.equal(changed.extra,'keep');assert.equal(changed.answers.start,'Keep');
  assert.equal(changed.handoffDone.submit,now.toISOString());
  if(changed.outcome)assert.equal(changed.outcomeDate,'2026-11-05');
 }
 const working=L.progressForStatus(original,'working',now);
 assert.equal(L.linkedStatus(working),'working');
 assert.equal(L.state(kit,K.setOutcome(working,'interview','2026-11-05')), 'talking');
});
test('withdrawals are excluded from reply totals',()=>{
 assert.equal(L.isReply({record:{outcome:'withdrawn'},state:'closed'}),false);
 for(const outcome of ['declined','interview','offer'])assert.equal(L.isReply({record:{outcome},state:'closed'}),true);
});
test('working preserves an existing offer date and note, and outcomes do not invent send dates',()=>{
 const offer={id:'a',outcome:'offer',outcomeDate:'2026-10-25',outcomeNote:'Accepted on the phone'};
 const working=L.progressForStatus(offer,'working',now);
 assert.equal(working.outcomeDate,offer.outcomeDate);assert.equal(working.outcomeNote,offer.outcomeNote);assert.equal(working.appliedAt,undefined);
 const interview=L.progressForStatus({id:'a'},'interviewing',now);assert.equal(interview.appliedAt,undefined);assert.equal(interview.outcomeDate,'2026-11-05');
 assert.equal(L.state(null,{}, {status:'applied',dateAdded:'2026-01-01'},now),'sent');
});
test('calendar week and month counts exclude earlier periods and missing dates',()=>{
 assert.equal(L.inPeriod('2026-10-31T12:00:00Z','month',now),false);
 assert.equal(L.inPeriod('2026-11-03T12:00:00Z','month',now),true);
 assert.equal(L.inPeriod(undefined,'week',now),false);
});
test('explicit tracker Sent records a date while legacy undated Sent stays undated',()=>{
 assert.equal(L.jobStatusPatch({status:'interested'},'applied',now).appliedAt,now.toISOString());
 assert.equal(L.jobStatusPatch({status:'applied'},'applied',now).appliedAt,undefined);
 assert.equal(L.jobStatusPatch({status:'applied'},'interested',now).appliedAt,null);
 assert.equal(L.jobStatusPatch({status:'interested'},'interviewing',now).statusChangedAt,now.toISOString());
 assert.equal(L.jobStatusPatch({status:'applied'},'applied',now).statusChangedAt,undefined);
 assert.equal(L.linkedStatus({id:'a'},{id:'a',outcome:'declined'}),'interested');
});
test('atomic linked saving retries a moved head, reads one snapshot, never forces the branch',async()=>{
 const calls=[],reads=[];let heads=0,patches=0;
 const values=await saveLinkedFiles({files:[{path:'progress.json',base:[],value:[{id:'a'}]},{path:'jobs.json',base:[],value:[{id:'j'}]}],
  request:async(path,method='GET',body)=>{calls.push({path,method,body});if(path==='')return {default_branch:'main'};if(path==='/git/ref/heads/main')return {object:{sha:`head-${++heads}`}};if(path.startsWith('/git/commits/head'))return {tree:{sha:'base-tree'}};if(path==='/git/trees')return {sha:'tree'};if(path==='/git/commits')return {sha:'commit'};if(method==='PATCH'){assert.equal(body.force,false);if(!patches++){const e=Error('Moved');e.status=422;throw e;}return {};}throw Error(path);},
  read:async(path,head)=>{reads.push({path,head});return [{id:'external',keep:true}];},merge:(base,theirs,ours)=>[...theirs,...ours],ask:async()=>{throw Error('Unexpected conflict');}});
 assert.equal(heads,2);assert.equal(patches,2);assert.equal(values[0][0].id,'external');
 assert.deepEqual(reads.map(r=>r.head),['head-1','head-1','head-2','head-2']);
 assert.ok(calls.filter(c=>c.method==='PATCH').every(c=>c.body.force===false));
});
test('atomic save asks on same-field conflicts and cancels before publishing',async()=>{
 const methods=[];
 await assert.rejects(saveLinkedFiles({files:[{path:'jobs.json',base:[],value:[]}],request:async(path,method='GET')=>{methods.push(method);return path===''?{default_branch:'main'}:path.includes('/ref/')?{object:{sha:'h'}}:{tree:{sha:'t'}};},read:async()=>[],merge:(b,t,o,opt)=>{opt.conflicts?.push({path:['notes'],ours:'a',theirs:'b'});return o;},ask:async()=>null}),/cancelled/);
 assert.ok(methods.every(m=>m==='GET'));
});
