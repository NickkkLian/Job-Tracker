// Extended shared-harness scenarios. Uses the same offline Chrome and fake GitHub
// as Job-Tracker.mjs; contains fictional data only. See test/README.md.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
const harness=process.env.HARNESS_ROOT;
if(!harness){console.error('Set HARNESS_ROOT to the shared app-harness folder (it holds cdp.mjs and page.mjs).');process.exit(2);}
const {launch}=await import(pathToFileURL(path.join(harness,'cdp.mjs')));
const {testPage}=await import(pathToFileURL(path.join(harness,'page.mjs')));
const {settingsClick}=await import(pathToFileURL(path.join(harness,'tests/settings-pointer.mjs')));
const app=path.resolve(process.argv[2] || '.');
const KITS='data/apply-kits.json', PROGRESS='data/apply-kit-progress.json';
const bi=(en,zh)=>({en,zh});
const kit=(id,deadline) => ({id,company:'Fictional '+id,role:'Automation apprentice '+id,deadline,deadlineKind:bi('Employer close','雇主截止日期'),postingUrl:'https://example.com/'+id,applyDate:'2026-10-21',resume:{path:`data/apply-kits/${id}/resume.pdf`,reason:bi('Chosen test PDF','测试 PDF')},fit:bi('A practice case can demonstrate a gap; no professional experience is implied.','练习可展示思路，不代表职业经验。'),reviewNote:bi('Draft for review','待审核草稿'),sideDoor:bi('No verified referral','无已核实内推'),coverLetter:'Dear Fictional team,\n\nExact punctuation: “hello” & <not markup>.\nNick',answers:[{id:'auth',label:bi('Work authorization','工作授权'),text:'I hold a PGWP, an open work permit.'},{id:'start',label:bi('Start date','入职日期'),text:'',editable:true,prompt:bi('Your actual date','实际日期')}],actions:[{id:'practice',date:'2026-10-20',minutes:30,title:bi('Practice before applying','投递前练习'),outcome:bi('Synthetic only','仅合成数据')}],steps:[bi('Review, then submit yourself.','检查后自行提交。')],formNote:bi('Prepared answers; extra questions unverified.','预备答案，额外问题未核实。'),salary:{text:'CAD 40,000–50,000 from the fictional posting.',source:'https://example.com/salary',note:bi('Only if asked','仅被问到时')},sources:[]});
const fixtures=[kit('later','2026-10-30'),kit('first','2026-10-22'),{...kit('optional',''),optional:true}];
const PDF='%PDF-1.4\n% fictional selected attachment\n%%EOF\n';
const storage={'pha-config':{owner:'o',repo:'jobdata',token:'test-token'},'jobapp:connection':{owner:'o',repo:'jobdata',token:'test-token'}};
const API='https://api.github.com/repos/o/jobdata/contents/';
function setup({kits=fixtures,records=[],failReads=false,failSave=false,clipboardFails=false,legacy=false}={}) {
 const {url,dir}=testPage(app,{seed:{[KITS]:kits,[PROGRESS]:records,'data/canada_jobs.json':[]},storage,failReads});
 let html=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace('<head>','<head><meta name="settings-host" content="same-origin-v1"><meta name="settings-manager" content="/?app=Job-Tracker#keys-and-connections">');
 if(legacy){
  // Keep the harness injection, replacing only the app's generated page.
  const marker='<meta charset="utf-8">', old=fs.readFileSync(process.env.LEGACY_PAGE,'utf8');
  assert.ok(old.includes(marker));
  html=html.slice(0,html.indexOf(marker))+old.slice(old.indexOf(marker));
 }
 const script=`<script>window.__copies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{${clipboardFails?'throw new Error("denied");':'__copies.push(t);'}}},configurable:true});var originalFetch=fetch;window.fetch=async function(u,o){if(String(u).includes('/contents/data/apply-kits/')&&String(u).endsWith('.pdf')===false&&String(u).includes('.pdf?'))return new Response(JSON.stringify({content:btoa(${JSON.stringify(PDF)}),sha:'pdf-v1'}));${failSave?`if(o?.method==='PUT'&&String(u).includes('${PROGRESS}'))return new Response(JSON.stringify({message:'test write failure'}),{status:500});`:''}return originalFetch(u,o);};</script>`;
 fs.writeFileSync(path.join(dir,'index.html'),html.replace('<meta charset="utf-8">',script+'<meta charset="utf-8">'));
 return {url,dir};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(p){await p.until("document.querySelector('[data-kit]')",10000);}
async function remote(p){return p.eval(`fetch(${JSON.stringify(API+PROGRESS)}).then(r=>r.json()).then(j=>JSON.parse(decodeURIComponent(escape(atob(j.content)))))`);}
async function outside(p,records){await p.eval(`fetch(${JSON.stringify(API+PROGRESS)}).then(r=>r.json()).then(j=>fetch(${JSON.stringify(API+PROGRESS)},{method:'PUT',body:JSON.stringify({sha:j.sha,content:btoa(unescape(encodeURIComponent(${JSON.stringify(JSON.stringify(records))})))})}))`);}
async function reopen(p,url){await p.eval(`location.href=${JSON.stringify(url+'?tab=apply#apply/first')}`);await ready(p);await p.until("document.querySelector('[data-kit=first]').open");}
let pass=0,fail=0;
async function scenario(name,fn,opts={}){
 if(process.env.ONLY_SCENARIOS && !process.env.ONLY_SCENARIOS.split(',').some(id=>name.startsWith(id+'_')))return;
 const b=await launch();let p;try{const page=setup(opts);p=await b.open(page.url+'?tab=apply#apply/first');await fn(p,page,b);const errors=p.errors.filter(x=>!/Failed to load resource|favicon/.test(x));assert.deepEqual(errors,[]);console.log('PASS '+name);pass++;}catch(e){console.log('FAIL '+name+': '+e.stack);if(p)console.log('PAGE:',await p.eval('document.body.innerText.slice(0,1500)'),p.errors);fail++;}finally{await b.close();}
}
await scenario('S28_apply_renders_sorted_kits_and_deep_link',async p=>{
 await ready(p);assert.deepEqual(await p.eval("[...document.querySelectorAll('[data-kit]')].map(e=>e.dataset.kit)"),['first','later','optional']);
 assert.equal(await p.eval("document.querySelector('[data-kit=first]').open"),true);
 await p.eval("location.hash='#apply/later'");await p.until("document.querySelector('[data-kit=later]').open");
 await p.eval("location.hash='#apply/missing'");await p.until("document.querySelector('main').textContent.includes('no matching application')");
 await p.click('#root .brand');await p.until("document.querySelector('h1').textContent.includes('Tracker')");
 assert.equal(await p.eval('location.hash'),'');
});
await scenario('S29_copy_exact_cover_answers_and_salary_only_when_asked',async p=>{
 await ready(p);await p.click('[data-copy=cover-first]');await p.until('__copies.length===1');assert.equal((await p.eval('__copies'))[0],fixtures[1].coverLetter);
 await p.click('[data-copy=answer-first-auth]');await p.until('__copies.length===2');assert.equal((await p.eval('__copies'))[1],fixtures[1].answers[0].text);
 assert.equal(await p.eval("document.querySelector('[data-copy=answer-first-start]').disabled"),true);
 assert.equal(await p.eval("!!document.querySelector('[data-copy=salary-first]')"),false);
 await p.click('[data-kit=first] .kit-salary input');await p.click('[data-copy=salary-first]');assert.equal((await p.eval('__copies'))[2],fixtures[1].salary.text);
});
await scenario('S30_download_serves_selected_PDF_bytes',async p=>{
 await ready(p);await p.click('[data-download=first]');let bytes;
 for(let i=0;i<60&&!bytes;i++){await sleep(100);for(const d of fs.readdirSync(os.tmpdir()).filter(d=>d.startsWith('hub-cdp-'))){const f=path.join(os.tmpdir(),d,'downloads','resume.pdf');if(fs.existsSync(f))bytes=fs.readFileSync(f);}}
 assert.ok(bytes,'actual browser download exists');assert.equal(bytes.toString(),PDF);
});
await scenario('S31_mark_applied_and_personal_answers_survive_reload',async(p,{url})=>{
 await ready(p);await p.eval("document.querySelector('#answer-first-start-edit').value='2027-01-04';document.querySelector('#answer-first-start-edit').dispatchEvent(new Event('input',{bubbles:true}))");
 // Native typing triggers React's controlled input, avoiding its value tracker.
 await p.eval("(()=>{const e=document.querySelector('#answer-first-start-edit');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2027-01-05');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await p.click('[data-kit=first] .kit-personal button');await p.until("document.querySelector('#answer-first-start').value==='2027-01-05'");
 await p.click('[data-kit=first] [data-action=practice]');await p.until("!document.querySelector('[data-applied=first]').disabled");
 await p.click('[data-applied=first]');await p.until("document.querySelector('[data-applied=first]').textContent.includes('recorded')");
 const saved=await remote(p),r=saved.find(x=>x.id==='first');assert.ok(r.appliedAt);assert.equal(r.answers.start,'2027-01-05');assert.ok(r.completed.practice);
 const diff=(Date.parse(r.followUpDate+'T12:00:00Z')-Date.parse(r.appliedDate+'T12:00:00Z'))/864e5;assert.equal(diff,7);
 // Fake GitHub is in page memory: seed the next document with the persisted remote file.
 await p.eval(`localStorage.setItem('apply-test-reloaded',${JSON.stringify(JSON.stringify(saved))})`);
 const next=setup({records:saved});await reopen(p,next.url);
 assert.equal(await p.eval("document.querySelector('[data-applied=first]').disabled"),true);assert.equal(await p.eval("document.querySelector('#answer-first-start').value"),'2027-01-05');
});
await scenario('S32_stale_save_merges_other_records_and_preserves_kit_data',async p=>{
 await ready(p);await outside(p,[{id:'elsewhere',answers:{x:'retained'},unknown:'keep'}]);await p.click('[data-applied=first]');
 await p.until("document.querySelector('[data-applied=first]').textContent.includes('recorded')");let rows=await remote(p);assert.equal(rows.find(r=>r.id==='elsewhere').unknown,'keep');
 await p.click('[data-kit=first] [data-action=practice]');await p.until("document.querySelector('[data-kit=first] [data-action=practice]').checked");await sleep(100);rows=await remote(p);assert.equal(rows.find(r=>r.id==='elsewhere').answers.x,'retained');
 assert.equal(await p.eval(`__gh.log.filter(x=>x.method==='PUT'&&x.path===${JSON.stringify(KITS)}).length`),0);
});
await scenario('S33_failed_save_does_not_claim_applied',async p=>{
 await ready(p);await p.click('[data-applied=first]');await p.until("document.querySelector('[role=alert]')?.textContent.includes('Save failed')");assert.equal(await p.eval("document.querySelector('[data-applied=first]').disabled"),false);assert.equal((await remote(p)).length,0);
},{failSave:true});
await scenario('S34_read_failure_disables_all_mutations',async p=>{
 await p.until("document.querySelector('main').textContent.includes('Couldn’t read application kits')",10000);assert.equal(await p.eval("document.querySelectorAll('[data-applied]').length"),0);assert.equal(await p.eval("__gh.log.filter(x=>x.method==='PUT').length"),0);
},{failReads:true});
await scenario('S35_copy_failure_exposes_manual_copy',async p=>{
 await ready(p);await p.click('[data-copy=cover-first]');await p.until("document.querySelector('[data-kit=first]').textContent.includes('Copy failed')");assert.equal(await p.eval("document.querySelector('#cover-first').value"),fixtures[1].coverLetter);
},{clipboardFails:true});
await scenario('S36_invalid_kit_rejected',async p=>{
 await p.until("document.querySelector('main').textContent.includes('Couldn’t read application kits')");assert.equal(await p.eval("document.querySelectorAll('[data-kit]').length"),0);
},{kits:[{...kit('broken','2026-10-22'),postingUrl:'javascript:alert(1)'}]});
await scenario('S37_phone_bilingual_theme_and_no_overflow',async p=>{
 await ready(p);await p.size(375,812);assert.equal(await p.eval('innerWidth'),375);
 await p.click('.phone-menu>summary');assert.ok(await p.eval("document.querySelector('.phone-menu-items [aria-current=page]').checkVisibility()"));await p.key('Escape');
 assert.ok(await p.eval('document.documentElement.scrollWidth<=innerWidth'));
 assert.equal(await p.eval("document.querySelectorAll('.topbar .lang-btn,.topbar #theme').length"),0);
 await p.click('#suite-language-toggle');await p.click('#suite-theme-toggle');await p.until("localStorage.getItem('pha-lang')==='zh'");
 await p.until("document.querySelector('h1').textContent==='去投递'");assert.ok(await p.eval('document.documentElement.scrollWidth<=innerWidth'));
});
const appliedRecord={id:'first',appliedAt:'2026-10-20T12:00:00Z',appliedDate:'2026-10-20',followUpDate:'2026-10-27',answers:{start:'Saved answer'},unknown:'keep'};
async function field(p,selector,value){await p.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);}
await scenario('S38_existing_result_in_list_and_page_without_closed_followup',async p=>{
 await ready(p);
 for(const selector of ['[data-kit=first] > summary','[data-kit=first] .kit-record']){
  const text=await p.eval(`document.querySelector(${JSON.stringify(selector)}).textContent`);
  assert.ok(text.includes('Declined'));assert.ok(text.includes('2026-10-28'));assert.ok(text.includes('Fictional response <thanks>'));
  assert.ok(!text.includes('Follow up:'));
 }
 assert.equal(await p.eval("document.querySelectorAll('[data-kit=first] script').length"),0);
 const out=process.env.EVIDENCE_DIR;
 if(out){
  fs.mkdirSync(out,{recursive:true});
  for(const [name,w,h] of [['desktop',1280,900],['phone',375,812]]){
   await p.size(w,h);await p.eval("document.querySelector('[data-kit=first]').scrollIntoView({block:'start'})");
   assert.ok(await p.eval('document.documentElement.scrollWidth<=innerWidth'));
   await p.shot(path.join(out,`outcome-${name}.png`));
  }
  await p.click('[data-kit=first] .kit-outcome-editor > summary');await p.shot(path.join(out,'outcome-phone-editor.png'));
  await p.click('[data-kit=first] > summary');await p.eval('scrollTo(0,0)');await p.shot(path.join(out,'outcome-phone-list.png'));
  await p.size(1280,900);await p.eval('scrollTo(0,0)');await p.shot(path.join(out,'outcome-desktop-list.png'));
  await p.click('#suite-language-toggle');await p.click('#suite-theme-toggle');await p.until("localStorage.getItem('pha-lang')==='zh'");
  await p.until("document.querySelector('[data-kit=first] > summary').textContent.includes('未录用')");
  await p.size(375,812);assert.ok(await p.eval('document.documentElement.scrollWidth<=innerWidth'));await p.shot(path.join(out,'outcome-phone-zh-dark.png'));
 }
},{records:[{...appliedRecord,outcome:'declined',outcomeDate:'2026-10-28',outcomeNote:'Fictional response <thanks>'}]});
await scenario('S39_set_all_results_reload_and_clear_preserves_progress',async(p,{url})=>{
 await ready(p);await p.click('[data-kit=first] .kit-outcome-editor > summary');
 for(const value of ['declined','interview','offer','withdrawn']){
  await field(p,'#outcome-first',value);await field(p,'#outcome-date-first','2026-10-28');await field(p,'#outcome-note-first','Synthetic '+value);
  await p.click('[data-save-outcome=first]');await p.until(`document.querySelector('[data-kit=first] > summary').textContent.includes('Synthetic ${value}')`);
  const r=(await remote(p)).find(r=>r.id==='first');assert.equal(r.outcome,value);assert.equal(r.outcomeDate,'2026-10-28');assert.equal(r.answers.start,'Saved answer');assert.equal(r.unknown,'keep');
  assert.equal(await p.eval("document.querySelector('[data-kit=first] .kit-record').textContent.includes('Follow up:')"),!['declined','withdrawn'].includes(value));
 }
 const saved=await remote(p),next=setup({records:saved});await reopen(p,next.url);
 assert.ok(await p.eval("document.querySelector('[data-kit=first] > summary').textContent.includes('Withdrawn')"));
 await p.click('[data-kit=first] .kit-outcome-editor > summary');await p.click('[data-clear-outcome=first]');
 await p.until("document.querySelector('[data-kit=first] .kit-record').textContent.includes('Follow up:')");
 const r=(await remote(p)).find(r=>r.id==='first');assert.equal(r.outcome,undefined);assert.equal(r.outcomeDate,undefined);assert.equal(r.outcomeNote,undefined);assert.equal(r.appliedDate,'2026-10-20');assert.equal(r.answers.start,'Saved answer');
},{records:[appliedRecord]});
await scenario('S40_failed_result_save_keeps_saved_result_and_draft',async p=>{
 await ready(p);await p.click('[data-kit=first] .kit-outcome-editor > summary');await field(p,'#outcome-first','offer');await p.click('[data-save-outcome=first]');
 await p.until("document.querySelector('[role=alert]')?.textContent.includes('Save failed')");
 assert.ok(!(await p.eval("document.querySelector('[data-kit=first] > summary').textContent")).includes('Offer'));
 assert.equal(await p.eval("document.querySelector('#outcome-first').value"),'offer');assert.equal((await remote(p))[0].outcome,undefined);
},{records:[appliedRecord],failSave:true});
if(process.env.LEGACY_PAGE) await scenario('S41_old_page_stale_saves_preserve_new_outcome_on_same_record',async p=>{
 await ready(p);const result={...appliedRecord,outcome:'declined',outcomeDate:'2026-10-28',outcomeNote:'Fictional update'};
 await outside(p,[result,{id:'elsewhere',unknown:'keep'}]);await p.click('[data-kit=first] [data-action=practice]');
 await p.until("!document.querySelector('[data-kit=first] [data-action=practice]').disabled");
 assert.equal((await remote(p)).find(r=>r.id==='first').outcome,'declined');
 await field(p,'#answer-first-start-edit','Updated synthetic answer');await p.click('[data-kit=first] .kit-personal button');await p.until("document.querySelector('#answer-first-start').value==='Updated synthetic answer'");
 const rows=await remote(p),r=rows.find(r=>r.id==='first');assert.equal(r.outcome,'declined');assert.equal(r.outcomeDate,result.outcomeDate);assert.equal(r.outcomeNote,result.outcomeNote);assert.equal(rows.find(r=>r.id==='elsewhere').unknown,'keep');
},{records:[appliedRecord],legacy:true});
console.log(`\nJob-Tracker Apply extension: ${pass} passed; ${fail} failed.`);process.exitCode=fail?1:0;
