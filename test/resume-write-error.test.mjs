import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(process.env.APP_SOURCE||new URL('../src/app.jsx',import.meta.url),'utf8');
const body=src.slice(src.indexOf('async function startBatch()'),src.indexOf('  const TAG ='));
for(const lang of ['en','zh'])test(`resume write throttling keeps its wait and private diagnostics in ${lang}`,async()=>{
 const logs=[],diagnostics=[],delays=[],retained=[];const jobs=[{id:'synthetic',company:'Synthetic company',role:'Synthetic role'}];
 const c={T:(zh,en)=>lang==='en'?en:zh,HubSettingsRuntime:{track:f=>f()},eligible:jobs,jobs,selected:new Set(['synthetic']),region:'test',resumeDb:'',formatting:'',lsGet:()=> 'fake',setRunning:()=>{},setProgress:()=>{},addLog:s=>logs.push(s),ghConfigured:()=>true,ghFindDataUrl:async()=>null,savePdfLocal:(key,value)=>retained.push([key,value]),pdfGhPath:k=>k,promptBatchTailor:()=>'',TAILOR_SCHEMA:{},fetch:async()=>({ok:true,json:async()=>({})}),anthropicText:()=> '{}',renderResumePDF:()=>({output:()=> 'synthetic-pdf'}),ghCreateDataUrl:async()=>{throw Error('HTTP 429 RAW_WRITE_DIAGNOSTIC');},setTimeout:(f,ms)=>{delays.push(ms);f();},console:{warn:e=>diagnostics.push(String(e?.message||e)),error:e=>diagnostics.push(String(e?.message||e))}};
 vm.runInNewContext(body+';this.start=startBatch',c);await c.start();
 assert.deepEqual(delays,[30000],'a refused write must retain the existing rate-limit wait');
 assert.equal(retained.length,1,'the generated resume must remain in this browser');
 assert.equal(retained[0][1],'synthetic-pdf');
 assert(diagnostics.some(x=>x.includes('RAW_WRITE_DIAGNOSTIC')),'the original write diagnostic must remain in the console');
 assert(!logs.join('\n').includes('RAW_WRITE_DIAGNOSTIC'),'provider detail must not enter the user log');
});
