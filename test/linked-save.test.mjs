import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
function fixture(){
 const html=fs.readFileSync(new URL('../src/index.template.html',import.meta.url),'utf8');
 const source=fs.readFileSync(new URL('../src/ledger.jsx',import.meta.url),'utf8');
 const retries=[];let jobs=[{id:'j',status:'interested',notes:'Original'}],resolveSave;
 const c=vm.createContext({Date,Map,Set,Promise,JSON,URL,URLSearchParams,console,
  baseCache:{'jobs.json':structuredClone(jobs)},fileHolders:{'jobs.json':{get:()=>jobs,set:value=>{jobs=value;}}},saveQueues:{},jobLatestWrites:new Map(),jobFailedPaths:new Set(),shaCache:{},
  jobSaveStatus:{pending:(path,retry)=>{retries.push(retry);return 1;},start:()=>1,succeed:()=>{},fail:()=>{}},ghCfg:()=>({repo:'sample/fixture',token:'fake'}),ghHdrs:()=>({}),fetch:()=>{throw Error('Unexpected network');},T:(zh,en)=>en,
  saveLinkedFiles:()=>new Promise(resolve=>{resolveSave=resolve;})});
 vm.runInContext(html.slice(html.indexOf('const SafeMerge ='),html.indexOf('/*__APP_JS__*/')),c);
 vm.runInContext(source.slice(source.indexOf('function ghWriteLinked('),source.indexOf('function DeskError(')),c);
 return {c,retries,get jobs(){return jobs;},set jobs(v){jobs=v;},resolve:v=>resolveSave(v)};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('linked acknowledgement updates the mounted status and preserves newer local notes',async()=>{
 const f=fixture();
 const save=f.c.ghWriteLinked([{path:'jobs.json',value:[{id:'j',status:'applied',notes:'Original'}]}]);
 await tick();f.jobs=[{id:'j',status:'interested',notes:'Typed during save'}];
 f.resolve([[{id:'j',status:'applied',notes:'Original',external:'Retained'}]]);await save;
 assert.equal(f.jobs[0].status,'applied');assert.equal(f.jobs[0].notes,'Typed during save');assert.equal(f.jobs[0].external,'Retained');
 assert.equal(f.c.baseCache['jobs.json'][0].status,'applied');
});
test('a queued note save inherits the acknowledged linked status',async()=>{
 const f=fixture();const save=f.c.ghWriteLinked([{path:'jobs.json',value:[{id:'j',status:'applied',notes:'Original'}]}]);await tick();
 f.c.saveQueues['jobs.json'].waiting={value:[{id:'j',status:'interested',notes:'Queued note'}],opts:{}};
 f.resolve([[{id:'j',status:'applied',notes:'Original'}]]);await save;
 assert.equal(f.c.saveQueues['jobs.json'].waiting.value[0].status,'applied');assert.equal(f.c.saveQueues['jobs.json'].waiting.value[0].notes,'Queued note');
});
