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
const app=path.resolve(process.argv[2] || '.');
const KITS='data/apply-kits.json', PROGRESS='data/apply-kit-progress.json';
const bi=(en,zh)=>({en,zh});
const kit=(id,deadline) => ({id,company:'Fictional '+id,role:'Automation apprentice '+id,deadline,deadlineKind:bi('Employer close','雇主截止日期'),postingUrl:'https://example.com/'+id,applyDate:'2026-10-21',resume:{path:`data/apply-kits/${id}/resume.pdf`,reason:bi('Chosen test PDF','测试 PDF')},fit:bi('A practice case can demonstrate a gap; no professional experience is implied.','练习可展示思路，不代表职业经验。'),reviewNote:bi('Draft for review','待审核草稿'),sideDoor:bi('No verified referral','无已核实内推'),coverLetter:'Dear Fictional team,\n\nExact punctuation: “hello” & <not markup>.\nNick',answers:[{id:'auth',label:bi('Work authorization','工作授权'),text:'I hold a PGWP, an open work permit.'},{id:'start',label:bi('Start date','入职日期'),text:'',editable:true,prompt:bi('Your actual date','实际日期')}],actions:[{id:'practice',date:'2026-10-20',minutes:30,title:bi('Practice before applying','投递前练习'),outcome:bi('Synthetic only','仅合成数据')}],steps:[bi('Review, then submit yourself.','检查后自行提交。')],formNote:bi('Prepared answers; extra questions unverified.','预备答案，额外问题未核实。'),salary:{text:'CAD 40,000–50,000 from the fictional posting.',source:'https://example.com/salary',note:bi('Only if asked','仅被问到时')},sources:[]});
const fixtures=[kit('later','2026-10-30'),kit('first','2026-10-22'),{...kit('optional',''),optional:true}];
const PDF='%PDF-1.4\n% fictional selected attachment\n%%EOF\n';
const storage={'pha-config':{owner:'o',repo:'jobdata',token:'test-token'}};
const API='https://api.github.com/repos/o/jobdata/contents/';
function setup({kits=fixtures,records=[],failReads=false,failSave=false,clipboardFails=false}={}) {
 const {url,dir}=testPage(app,{seed:{[KITS]:kits,[PROGRESS]:records,'data/canada_jobs.json':[]},storage,failReads});
 let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
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
 const b=await launch();try{const page=setup(opts);const p=await b.open(page.url+'?tab=apply#apply/first');await fn(p,page,b);const errors=p.errors.filter(x=>!/Failed to load resource|favicon/.test(x));assert.deepEqual(errors,[]);console.log('PASS '+name);pass++;}catch(e){console.log('FAIL '+name+': '+e.stack);fail++;}finally{await b.close();}
}
await scenario('S28_apply_renders_sorted_kits_and_deep_link',async p=>{
 await ready(p);assert.deepEqual(await p.eval("[...document.querySelectorAll('[data-kit]')].map(e=>e.dataset.kit)"),['first','later','optional']);
 assert.equal(await p.eval("document.querySelector('[data-kit=first]').open"),true);
 await p.eval("location.hash='#apply/later'");await p.until("document.querySelector('[data-kit=later]').open");
 await p.eval("location.hash='#apply/missing'");await p.until("document.querySelector('main').textContent.includes('no matching application')");
 await p.click('a[href="?tab=tracker"]');await p.until("document.querySelector('h1').textContent.includes('Tracker')");
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
 const {dir}=setup({records:saved});const next='file://'+path.join(dir,'index.html');await reopen(p,next);
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
 await p.until("(()=>{const n=document.querySelector('.nav-links').getBoundingClientRect(),a=document.querySelector('.nav [aria-current=page]').getBoundingClientRect();return a.left>=n.left&&a.right<=n.right})()");
 assert.ok(await p.eval('document.documentElement.scrollWidth<=innerWidth'));
 await p.click('.lang-btn');await p.until("document.querySelector('h1').textContent==='去投递'");assert.ok(await p.eval('document.documentElement.scrollWidth<=innerWidth'));
 await p.click('#theme');await sleep(150);assert.ok(await p.eval('document.documentElement.scrollWidth<=innerWidth'));
});
console.log(`\nJob-Tracker Apply extension: ${pass} passed; ${fail} failed.`);process.exitCode=fail?1:0;
