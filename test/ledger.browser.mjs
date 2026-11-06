import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
const harness=process.env.HARNESS_ROOT;
const {launch}=await import(pathToFileURL(path.join(harness,'cdp.mjs')));
const {testPage}=await import(pathToFileURL(path.join(harness,'page.mjs')));
const root=fileURLToPath(new URL('../',import.meta.url));
let passed=0,failed=0;
const browser=await launch();
async function scenario(name,fn,options={}){let p;try{
 const f=testPage(root,{seed:options.seed||{},storage:{'pha-lang':'en','nl-scheme':'light',...options.storage}});
 const html=path.join(f.dir,'index.html');fs.writeFileSync(html,fs.readFileSync(html,'utf8').replace('<head>','<head><meta name="settings-host" content="same-origin-v1"><meta name="settings-manager" content="/?app=Job-Tracker#keys-and-connections"><script>localStorage.clear()</script>'));
 if(options.inject)fs.writeFileSync(html,fs.readFileSync(html,'utf8').replace('<meta charset="utf-8">',`<script>${options.inject}</script><meta charset="utf-8">`));
 p=await browser.open(f.url+(options.query||'?demo=1'),{width:1230,height:690});await p.until(options.ready||"document.querySelector('[data-handoff-open]')&&window.SuiteSettings",15000);
 await fn(p);assert.deepEqual(p.errors,[]);console.log('PASS '+name);passed++;
 }catch(e){console.log('FAIL '+name+': '+e.stack);failed++;}finally{await p?.close();}}
try{
 await scenario('Now opens by default and the handoff link focuses its exact step',async p=>{
  assert.match(await p.eval("document.querySelector('h1').textContent"),/1 thing needs you/);
  assert.ok(await p.eval("(()=>{const panel=document.querySelector('.waiting-desktop'),strip=panel.querySelector('.age-strip-button').getBoundingClientRect();return panel.checkVisibility()&&strip.bottom<innerHeight})()"));
  await p.size(390,844);
  assert.equal(await p.eval("document.querySelector('.waiting-desktop').checkVisibility()"),false);
  assert.equal(await p.eval("document.querySelector('.waiting-mobile').checkVisibility()"),false);
  await p.click('[data-handoff-open]');await p.until("document.querySelector('.kit-page')");
  assert.equal(await p.eval("document.activeElement.closest('[data-step]').dataset.step"),'robot-submit');
  await p.size(390,844);assert.ok(await p.eval("document.querySelector('.current-step .btn').getBoundingClientRect().bottom<innerHeight"));
  assert.ok(await p.eval('document.documentElement.scrollWidth<=innerWidth'));
 });
 await scenario('J K Enter and C use real controls and copied count remains after the tick animation',async p=>{
  await p.key('j','j');assert.ok(await p.eval("document.activeElement.matches('[data-handoff-open]')"));
  await p.key('k','k');await p.key('Enter','\r');await p.until("document.querySelector('.kit-page')");
  await p.eval("window.__copies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>__copies.push(t)},configurable:true});document.querySelector('.kit-answer').focus()");
  await p.key('c','c');await p.until('__copies.length===1');
  assert.match(await p.eval("document.querySelector('.materials-list .section-line').textContent"),/1 of 11 copied/);
  await p.eval('new Promise(r=>setTimeout(r,1700))');assert.ok(await p.eval("!!document.querySelector('.kit-answer [data-copy] svg path')"));
 });
 await scenario('D finishes the handoff, Undo restores it, H hides it until tomorrow',async p=>{
  await p.key('j','j');await p.key('d','d');await p.until("document.querySelectorAll('[data-handoff]').length===0");
  await p.click('.desk-undo .btn');await p.until("document.querySelectorAll('[data-handoff]').length===1");
  await p.eval("document.querySelector('[data-handoff-open]').focus()");await p.key('h','h');await p.until("document.querySelectorAll('[data-handoff]').length===0");
  assert.ok(await p.eval("JSON.parse(localStorage.getItem('jobapp:snoozed'))['demo-handoff']>Date.now()"));
 });
 await scenario('region menu contains twelve regions, counts and keyboard movement',async p=>{
  await p.click('.region-menu>summary');assert.equal(await p.eval("document.querySelectorAll('.region-menu [role=menuitem]').length"),12);
  await p.key('Home');assert.ok(await p.eval("document.activeElement.textContent.includes('Canada')"));
  await p.key('End');assert.ok(await p.eval("document.activeElement.textContent.includes('Remote')"));
  await p.key('Escape');assert.ok(await p.eval("document.activeElement.matches('.region-menu>summary')"));
 });
 await scenario('No reply is folded, all seven statuses remain available and sheet Escape returns focus',async p=>{
  await p.click('.desktop-nav a[href*=tracker]');await p.until("document.querySelector('.application-list')");
  assert.equal(await p.eval("document.querySelector('[data-stage=quiet] .application-group').open"),false);
  assert.equal(await p.eval("new Set([document.querySelector('.job').dataset.status,...[...document.querySelector('.job').querySelectorAll('[data-move-status]')].map(n=>n.dataset.moveStatus)]).size"),7);
  const id=await p.eval("document.querySelector('.job-open').closest('[data-job]').dataset.job");
  await p.click('.job-open');await p.until("document.querySelector('.job-detail-sheet dialog').open");await p.key('Escape');
  await p.until("!document.querySelector('.job-detail-sheet')");assert.equal(await p.eval("document.activeElement.closest('[data-job]')?.dataset.job"),id);
 });
 await scenario('saved-row check carries the added-date caveat and demo never writes',async p=>{
  await p.click('.activity-panel>summary');await p.click('.saved-health .btn');await p.until("document.querySelector('#ghost-in')");
  assert.match(await p.eval("document.querySelector('main').textContent"),/Added date used in place/);
  assert.match(await p.eval("document.querySelector('#ghost-in').value"),/date-source: added/);
  assert.equal(await p.eval("__gh.log.filter(r=>['PUT','PATCH','POST','DELETE'].includes(r.method)).length"),0);
 });
 await scenario('own-data link leaves demo and opens enabled connection controls',async p=>{
  await p.click('.honest button');await p.until("document.querySelector('.about-view')");
  await p.click('.about-view>a.btn-primary');await p.until("location.search.includes('connect=1')&&window.SuiteSettings&&document.querySelector('.suite-panel').open");
  assert.equal(await p.eval('DEMO'),false);
  assert.ok(await p.eval("[...document.querySelectorAll('#suite-section-connection input:not([type=hidden])')].some(e=>!e.disabled)"));
 });
 const linkedKit={id:'linked',company:'Example Studio',role:'Analyst',postingUrl:'https://example.com/job',resume:{path:'data/apply-kits/linked/resume.pdf'},jobRef:{region:'canada',id:'linked-job'},answers:[],steps:[],actions:[]};
 const atomicFixture={query:'?tab=apply#apply/linked',ready:"document.querySelector('[data-applied]')&&fileHolders['data/canada_jobs.json']?.get().length===1&&window.SuiteSettings",storage:{'pha-config':{owner:'o',repo:'fixture',token:'fictional-only'},'jobapp:connection':{owner:'o',repo:'fixture',token:'fictional-only'}},seed:{'data/canada_jobs.json':[{id:'linked-job',company:'Example Studio',role:'Analyst',status:'interested',priority:'T1',notes:'Original'}],'data/apply-kits.json':[linkedKit],'data/apply-kit-progress.json':[],'data/resumeSections.json':[],'data/library.json':[]},inject:`{
 const nativeFetch=fetch;let tree=[],head=1;window.__atomic=[];
 window.fetch=async function(u,o={}){const url=new URL(String(u));const suffix=url.pathname.replace('/repos/o/fixture','');const method=o.method||'GET';const body=o.body?JSON.parse(o.body):null;
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
  if(!url.pathname.startsWith('/repos/o/fixture'))return nativeFetch(u,o);
  if(suffix===''||suffix==='/')return json({default_branch:'main'});
  if(suffix==='/git/ref/heads/main')return json({object:{sha:'head-'+head}});
  if(suffix.startsWith('/git/commits/head-'))return json({tree:{sha:'base-tree'}});
  if(suffix==='/git/trees'&&method==='POST'){tree=body.tree;return json({sha:'tree'});}
  if(suffix==='/git/commits'&&method==='POST')return json({sha:'next-head'});
  if(suffix==='/git/refs/heads/main'&&method==='PATCH'){__atomic.push({body,tree:structuredClone(tree)});if(window.__atomicFail)return json({message:'Synthetic failure'},500);for(const file of tree)__gh.outside(file.path,rows=>rows.splice(0,rows.length,...JSON.parse(file.content)));head++;return json({object:{sha:'next-head'}});}
  return nativeFetch(u,o);
 };
}`};
 await scenario('linked Mark sent publishes both files and keeps the mounted row coherent',async p=>{
  await p.click('[data-applied]');await p.until("document.querySelector('.sent-line')");
  assert.equal(await p.eval("__gh.json('data/canada_jobs.json')[0].status"),'applied');
  assert.equal(await p.eval("fileHolders['data/canada_jobs.json'].get()[0].status"),'applied');
  assert.equal(await p.eval('__atomic[0].tree.length'),2);assert.equal(await p.eval('__atomic[0].body.force'),false);
  await p.click('.desktop-nav a[href*=tracker]');await p.until("document.querySelector('.job-move')");
  await p.click('.job-move>summary');await p.click('[data-move-status=working]');await p.until("document.querySelector('[data-stage=working]')");
  assert.ok(await p.eval("!!__gh.json('data/apply-kit-progress.json')[0].markedWorkingAt"));
  await p.eval("location.hash='#apply/linked'");await p.until("document.querySelector('.sent-line')?.textContent.includes('Working')");
 },atomicFixture);
 await scenario('failed linked commit leaves both files unchanged and Retry records both',async p=>{
  await p.eval('__atomicFail=true');await p.click('[data-applied]');await p.until("document.querySelector('.kit-save-error')");
  assert.equal(await p.eval("__gh.json('data/canada_jobs.json')[0].status"),'interested');
  assert.equal(await p.eval("__gh.json('data/apply-kit-progress.json').length"),0);
  await p.eval('__atomicFail=false');await p.click('.kit-save-error .btn');await p.until("document.querySelector('.sent-line')");
  assert.equal(await p.eval("__gh.json('data/canada_jobs.json')[0].status"),'applied');
 },atomicFixture);
 await scenario('missing linked job reports failure in both the kit and header before writing',async p=>{
  await p.eval("fileHolders['data/canada_jobs.json'].set([])");await p.click('[data-applied]');await p.until("document.querySelector('.kit-save-error')");
  assert.match(await p.eval("document.querySelector('.kit-save-error').textContent"),/linked job is missing/);
  assert.equal(await p.eval("document.querySelector('#job-save-status').dataset.saveState"),'error');
  assert.equal(await p.eval('__atomic.length'),0);
 },atomicFixture);
}finally{await browser.close();}
console.log(`Ledger browser: ${passed} passed; ${failed} failed.`);process.exitCode=failed?1:0;
