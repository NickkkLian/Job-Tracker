import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../src/app.jsx',import.meta.url),'utf8');
const body=src.slice(src.indexOf('async function startBatch()'),src.indexOf('  const TAG ='));
for(const lang of ['en','zh'])test(`batch mixed results explain each job in ${lang}`,async()=>{
 const logs=[],states={};const jobs=['saved','existing','failed'].map(id=>({id,company:id,role:'Role'}));
 const c={T:(zh,en)=>lang==='en'?en:zh,HubSettingsRuntime:{track:f=>f()},eligible:jobs,jobs,selected:new Set(jobs.map(j=>j.id)),region:'test',resumeDb:'',formatting:'',lsGet:()=> 'fake',setRunning:()=>{},setProgress:f=>{if(typeof f==='function')Object.assign(states,f(states));else Object.assign(states,f);},addLog:s=>logs.push(s),ghConfigured:()=>true,ghFindDataUrl:async p=>p.includes('existing')?'existing':null,loadPdfLocal:()=>null,savePdfLocal:()=>{},pdfGhPath:k=>k,promptBatchTailor:()=>'',TAILOR_SCHEMA:{},fetch:async()=>({ok:true,json:async()=>({})}),anthropicText:()=> '{}',renderResumePDF:()=>({output:()=> 'pdf'}),ghCreateDataUrl:async p=>{if(p.includes('failed'))throw Error('Test write failed');},setTimeout:f=>f()};
 vm.runInNewContext(body+';this.start=startBatch',c);await c.start();
 assert.deepEqual({...states},{saved:'done',existing:'skip',failed:'error'});
 assert.match(logs.join('\n'),lang==='en'?/Job 1 of 3/:/第 1 个职位，共 3 个/);
 assert.match(logs.at(-1),lang==='en'?/any failures are explained above/:/失败原因见上方记录/);
 assert.doesNotMatch(logs.at(-1),/Tailored resumes saved|定制简历已保存/);
});
