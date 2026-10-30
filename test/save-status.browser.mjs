// Production queues and HTTP fixture only. No real credentials, repositories, AI or paid calls.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const harness=process.env.HARNESS_ROOT;if(!harness)throw Error('Set HARNESS_ROOT');
const {launch}=await import(pathToFileURL(path.join(harness,'cdp.mjs'))),{testPage}=await import(pathToFileURL(path.join(harness,'page.mjs')));
const phase=process.argv[2]||'green',root=path.resolve(process.env.APP_ROOT||new URL('../',import.meta.url).pathname),out=path.resolve(process.env.EVIDENCE_DIR||'evidence/save-status');fs.mkdirSync(out,{recursive:true});
const {measure,widths}=await import(pathToFileURL(path.join(harness,'width-sweep/measure.mjs')));
const {policy}=await import(pathToFileURL(path.join(harness,'width-sweep/fixtures.mjs')));
const report={phase,root,checks:[],errors:[]};
const storage={'pha-config':{owner:'o',repo:'fictional',token:'test-token'},'jobapp:connection':{owner:'o',repo:'fictional',token:'test-token'},'pha-lang':'en','pha-theme':'light','nl-scheme':'light',__gh_allow_delete:'1'};
function fixture(){const f=testPage(root,{seed:{'data/canada_jobs.json':[{id:'synthetic',company:'Example Studio',role:'Analyst',status:'interested',priority:'T1'}],'data/resumeSections.json':[],'data/library.json':[]},raw:{'data/formatting.txt':'Initial','data/glossary.txt':'Initial'},storage});
 const p=path.join(f.dir,'index.html');let html=fs.readFileSync(p,'utf8').replace('<head>','<head><meta name="settings-host" content="same-origin-v1"><meta name="settings-manager" content="/?app=Job-Tracker#keys-and-connections">');
 const marker='<meta charset="utf-8">',shim=`<script>{const nativeFetch=window.fetch;window.__held=false;window.fetch=async function(u,o){if(window.__holdPath&&String(u).includes('/contents/'+window.__holdPath)&&['PUT','DELETE'].includes(o?.method)){window.__held=true;await new Promise(r=>window.__release=r);window.__held=false;}return nativeFetch(u,o);};}</script>`;
 fs.writeFileSync(p,html.replace(marker,shim+marker));return f;
}
const status="document.querySelector('#job-save-status')",text=status+"?.textContent",state=status+"?.dataset.saveState";
const b=await launch();
async function scenario(name,fn){let p;try{const f=fixture();p=await b.open(f.url+'?tab=tracker',{width:1440,height:900});await p.until("document.querySelector('.job-open')&&window.SuiteSettings&&HubSettingsRuntime.pending===0",15000);await fn(p);assert.deepEqual(p.errors,[]);report.checks.push({name,pass:true});console.log('PASS '+name);}catch(e){report.checks.push({name,pass:false,error:e.stack});console.log('FAIL '+name+': '+e.message);}finally{await p?.close();}}
const write=(p,value='Saved value')=>p.eval(`window.__task=ghWrite('data/formatting.txt',${JSON.stringify(value)}).catch(e=>{window.__taskError=e.message});'started'`);
const hold=p=>p.eval("__holdPath='data/formatting.txt'");
const release=p=>p.eval("__holdPath=null;__release();'released'");
async function expectStatus(p,expected){assert.equal(await p.eval(state),expected,'persistent header '+expected);}
try{
 await scenario('saving then repository acknowledgement shows Saved HH:MM',async p=>{
  await hold(p);await write(p);await p.until('__held');await expectStatus(p,'saving');assert.match(await p.eval(text),/Saving/);
  await release(p);await p.eval('__task');await expectStatus(p,'saved');assert.match(await p.eval(text),/Saved \d{2}:\d{2}/);
  assert.ok(await p.eval("__gh.log.some(r=>r.method==='PUT'&&r.path==='data/formatting.txt'&&[200,201].includes(r.status))"));
  assert.equal(await p.eval(status+".querySelector('[role=status]').getAttribute('aria-atomic')"),'true');
 });
 await scenario('failed write has plain reason, last saved time, keyboard Retry and multiple-file aggregation',async p=>{
  await write(p);await p.eval('__task');const before=await p.eval(text);
  await p.eval("__gh.fail=(method,p)=>method==='PUT'&&p==='data/formatting.txt'?500:0");await write(p,'Newest retry value');await p.eval('__task');await expectStatus(p,'error');
  assert.match(await p.eval(text),/Not saved: service unavailable/);assert.ok((await p.eval(text)).includes(before));
  await p.eval("ghWrite('data/glossary.txt','Other success')");await expectStatus(p,'error');
  const box=await p.eval(status+".querySelector('button').getBoundingClientRect().toJSON()");assert.ok(box.width>=44&&box.height>=44);
  await p.eval("__gh.fail=null;document.querySelector('#job-save-status button').focus()");await p.key('Enter','\r');await p.until(state+"==='saved'");
  assert.equal(await p.eval("fetch('https://api.github.com/repos/o/fictional/contents/data/formatting.txt').then(r=>r.json()).then(j=>atob(j.content))"),'Newest retry value');
  assert.equal(await p.eval("document.activeElement===document.querySelector('#job-save-status button')||document.activeElement===document.body"),true);
 });
 await scenario('offline explicitly identifies page-only work and reconnect preserves failed edits',async p=>{
  await p.cdp('Network.enable');await p.cdp('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await p.until('navigator.onLine===false');
  await expectStatus(p,'offline');assert.match(await p.eval(text),/Offline.*changes only in this page/);
  await p.eval("__gh.fail=(m)=>m==='PUT'?'offline':0");await write(p);await p.eval('__task');
  await p.cdp('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await p.until('navigator.onLine===true');await expectStatus(p,'error');assert.match(await p.eval(text),/connection lost/);
 });
 await scenario('edit during a save remains pending until its own repository acknowledgement',async p=>{
  await hold(p);await write(p,'First');await p.until('__held');await expectStatus(p,'saving');
  await p.eval("window.__second=ghWrite('data/formatting.txt','Second');window.__third=ghWrite('data/formatting.txt','Latest');'queued'");
  await p.eval("const releaseFirst=__release;__held=false;releaseFirst();'released first'");await p.eval('__task');await p.until('__held');await expectStatus(p,'saving');
  await release(p);await p.eval('Promise.all([__second,__third])');await expectStatus(p,'saved');
  assert.equal(await p.eval("__gh.puts('data/formatting.txt').filter(r=>[200,201].includes(r.status)).length"),2);
  assert.equal(await p.eval("fetch('https://api.github.com/repos/o/fictional/contents/data/formatting.txt').then(r=>r.json()).then(j=>atob(j.content))"),'Latest');
 });
 await scenario('native edit, attachment create/update/delete and staged restore all feed the header',async p=>{
  await p.click('.job-move>summary');await p.click('[data-move-status=applied]');await p.until("__gh.json('data/canada_jobs.json')[0].status==='applied'");await expectStatus(p,'saved');
  await p.eval("__gh.fail=(m,p)=>m==='PUT'&&p.endsWith('.pdf')?403:0;ghCreateDataUrl('data/files/synthetic.pdf','data:application/pdf;base64,JVBERi0xLjQK').catch(()=>{})");await p.until(state+"==='error'");assert.match(await p.eval(text),/check connection access/);
  await p.eval('__gh.fail=null');await p.click('#job-save-status button');await p.until(state+"==='saved'");
  await p.eval("ghWriteDataUrl('data/files/synthetic.pdf','data:application/pdf;base64,JVBERi0xLjQKJQ==')");await expectStatus(p,'saved');
  await p.eval("__gh.fail=(m)=>m==='DELETE'?500:0;ghDeleteFile('data/files/synthetic.pdf').catch(()=>{})");await p.until(state+"==='error'");await p.eval('__gh.fail=null');await p.click('#job-save-status button');await p.until("!__gh.has('data/files/synthetic.pdf')");await expectStatus(p,'saved');
  await p.eval("(async()=>{window.__package=await settingsAdapter.backup();window.__staged=await settingsAdapter.stage(__package);window.__restore=settingsAdapter.restore(__staged);return 'restoring';})()");await p.eval('__restore');await expectStatus(p,'saved');
 });
 if(phase!=='red')await scenario('all header states fit 320–2560; screenshots in English/Chinese light/dark',async p=>{
  const geometries=[];await write(p);await p.eval('__task');
  for(const language of ['en','zh'])for(const theme of ['light','dark']){
   if(await p.eval("lang")!==language)await p.click('#suite-language-toggle');
   if(await p.eval("document.getElementById('suite-theme-toggle').dataset.scheme")!==theme)await p.click('#suite-theme-toggle');
   await p.until('lang==='+JSON.stringify(language));await p.until("document.getElementById('suite-theme-toggle').dataset.scheme==="+JSON.stringify(theme));
   for(const width of [390,1440]){await p.size(width,900);await p.shot(path.join(out,`header-${language}-${theme}-${width}.png`));}
  }
  for(const mode of ['ready','saving','saved','error','offline','local']){
   // Fresh source status for layout only; transition scenarios above use real writes exclusively.
   await p.eval(`jobSaveStatus.reset();jobSaveStatus.connection({online:${mode!=='offline'},connected:${mode!=='local'}});`);
   if(['saving','saved','error'].includes(mode)){
    await hold(p);await write(p);await p.until('__held');if(mode==='error')await p.eval("__gh.fail=()=>500");
    if(mode!=='saving'){await release(p);await p.eval('__task');}
   }
   for(const language of ['en','zh']){
    if(await p.eval('lang')!==language)await p.click('#suite-language-toggle');
    for(const width of widths){await p.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await p.eval('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const result=await p.eval('('+measure.toString()+')('+JSON.stringify('#root header.topbar')+','+JSON.stringify(policy('Job-Tracker'))+')');
     geometries.push({mode,language,width,failures:result.failures,allowances:result.allowances});
    }
   }
   if(mode==='saving'){await release(p);await p.eval('__task');}await p.eval('__gh.fail=null');
  }
  fs.writeFileSync(path.join(out,'all-state-widths.json'),JSON.stringify(geometries,null,2));const failures=geometries.filter(r=>r.failures.length);assert.equal(failures.length,0,JSON.stringify(failures.slice(0,4))); 
 });
}finally{await b.close();fs.writeFileSync(path.join(out,phase+'.json'),JSON.stringify(report,null,2));}
const failed=report.checks.filter(c=>!c.pass).length;
if(phase==='red'){assert.equal(report.checks.length,5);assert.equal(failed,5,'all five requirements must fail on baseline');console.log('EXPECTED RED: all 5 baseline scenarios fail');}
else process.exitCode=failed?1:0;
