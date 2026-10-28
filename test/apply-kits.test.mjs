import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const ctx=vm.createContext({URL,Date});
vm.runInContext(readFileSync(new URL('../src/apply-kits.js',import.meta.url),'utf8')+';globalThis.k=ApplyKits;',ctx);
const k=ctx.k;
const kit=(id='a',deadline='2026-10-22') => ({id,deadline,role:'Test role',company:'Made-up employer',postingUrl:'https://example.com/job',resume:{path:`data/apply-kits/${id}/resume.pdf`},answers:[],actions:[],steps:[]});
test('kits sort by nearest deadline, with undated optional last',()=>{
 assert.equal(k.sort([kit('c',''),kit('b','2026-10-30'),kit('a')]).map(x=>x.id).join(','),'a,b,c');
 assert.equal(k.days('2026-10-22','2026-10-20'),2);
 assert.equal(k.days('2026-10-20','2026-10-22'),-2);
 assert.equal(k.days('','2026-10-20'),null);
});
test('unsafe links, paths, duplicates and invalid schedules are rejected',()=>{
 assert.equal(k.url('javascript:alert(1)'),'');assert.equal(k.url('https://user:pass@example.com'),'');
 assert.equal(k.file('data/apply-kits/a/../../secret.pdf'),'');assert.equal(k.file('data/files/other.pdf'),'');
 assert.throws(()=>k.validate([kit(),kit()]));assert.throws(()=>k.validate([{...kit(),postingUrl:'javascript:alert(1)'}]));
 assert.throws(()=>k.validate([{...kit(),applyDate:'2026-10-23'}]));
 assert.throws(()=>k.validate([{...kit(),applyDate:'2026-10-21',actions:[{id:'x',date:'2026-10-22'}]}]));
 assert.equal(k.validate([kit()]).length,1);
 assert.throws(()=>k.validate([{...kit(),deadline:'2026-02-31'}]));
 assert.throws(()=>k.validate([{...kit(),fit:{en:{bad:'object'}}}]));
});
test('applied is idempotent, retains fields, follows local calendar seven days later',()=>{
 const r=k.applied({id:'a',unknown:'retain',answers:{start:'actual'}},new Date(2026,9,31,18));
 assert.equal(r.appliedDate,'2026-10-31');assert.equal(r.followUpDate,'2026-11-07');assert.equal(r.unknown,'retain');
 assert.equal(r.answers.start,'actual');assert.equal(k.applied(r,new Date(2026,10,5)),r);
});
test('progress rejects malformed records and retains unrelated content',()=>{
 assert.throws(()=>k.validateProgress({}));assert.throws(()=>k.validateProgress([{id:'a'},{id:'a'}]));
 assert.throws(()=>k.validateProgress([{id:'a',answers:[]} ]));
 assert.throws(()=>k.validateProgress([{id:'a',appliedAt:{}}]));
 assert.equal(k.validateProgress([{id:'a',unknown:'kept'}])[0].unknown,'kept');
});
test('deep links decode safely',()=>{
 assert.equal(k.hashId('#apply/ubc'),'ubc');assert.equal(k.hashId('#apply/%ZZ'),'');assert.equal(k.hashId('#other'),'');
});
test('outcomes set, change and clear without losing application progress',()=>{
 const original={id:'a',appliedAt:'2026-10-20T12:00:00Z',appliedDate:'2026-10-20',followUpDate:'2026-10-27',answers:{start:'Saved answer'},completed:{practice:true},extra:'keep'};
 for(const value of ['declined','interview','offer','withdrawn']) {
  const saved=k.setOutcome(original,value,'2026-10-28','  A fictional update.  ');
  assert.equal(saved.outcome,value);assert.equal(saved.outcomeDate,'2026-10-28');assert.equal(saved.outcomeNote,'A fictional update.');
  assert.equal(saved.answers,original.answers);assert.equal(saved.completed,original.completed);assert.equal(saved.extra,'keep');
  assert.equal(k.followUp(saved),['declined','withdrawn'].includes(value)?'':'2026-10-27');
  const cleared=k.setOutcome(saved,'');
  assert.equal(JSON.stringify(cleared),JSON.stringify(original));assert.equal(k.followUp(cleared),'2026-10-27');
 }
 assert.equal(original.outcome,undefined);assert.equal(k.followUp({id:'a'}),'');
 assert.throws(()=>k.setOutcome(original,'unknown','2026-10-28',''));
 assert.throws(()=>k.setOutcome(original,'offer','2026-02-30',''));
});
test('outcome validation accepts legacy and outcome-only records, rejects malformed fields',()=>{
 for(const r of [{id:'a'},{id:'a',outcome:'declined'},{id:'a',outcome:'interview',outcomeDate:'2026-10-28',outcomeNote:'Synthetic note',extra:true},{id:'a',outcome:null,outcomeDate:null,outcomeNote:null}]) assert.equal(k.validateProgress([r])[0],r);
 for(const r of [{outcome:'unknown'},{outcomeDate:'2026-02-30'},{outcomeNote:{}},{outcome:[]}]) assert.throws(()=>k.validateProgress([{id:'a',...r}]));
});
