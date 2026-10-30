import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const component=fs.readFileSync(new URL('../assets/settings-standard/save-status.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/app.jsx',import.meta.url),'utf8');
function fixture(){
 const context={window:{},Date,Map,Set,Promise,console,jobFailedPaths:new Set(),shaCache:{},baseCache:{'data/a.json':[]},fileHolders:{},saveQueues:{},jobLatestWrites:new Map(),jobCachedFiles:new Map(),jobBinaryValues:new Map(),jobConnection:{},T:(zh,en)=>en,
  HubSettingsRuntime:{track:fn=>fn()},ghCfg:()=>({token:'fake',repo:'o/fictional'}),isJsonPath:()=>true,ghFetchFile:()=>{},ghPut:()=>{},ReactDOM:{flushSync:fn=>fn()}};
 vm.createContext(context);vm.runInContext(component,context);context.jobSaveStatus=context.window.SuiteSaveStatus.create();context.jobSaveStatus.connection({online:true,connected:true});
 const calls=[];context.SafeMerge={snapshot:v=>JSON.parse(JSON.stringify(v)),rebase:(sent,saved,now)=>now,save:args=>new Promise((resolve,reject)=>calls.push({args,resolve,reject}))};
 vm.runInContext(app.slice(app.indexOf('function ghWrite(path,'),app.indexOf('// Tests the given token')),context);
 return {c:context,calls,status:context.jobSaveStatus};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('production queue coalesces newer edits but old acknowledgement cannot claim Saved',async()=>{
 const {c,calls,status}=fixture(),a=c.ghWrite('data/a.json',[{id:'a',v:1}]);await tick();
 const b=c.ghWrite('data/a.json',[{id:'a',v:2}]),d=c.ghWrite('data/a.json',[{id:'a',v:3}]);
 calls[0].resolve({sha:'a',data:[{id:'a',v:1}],wrote:true});await a;await tick();
 assert.equal(status.snapshot().state,'saving');assert.equal(calls[1].args.data[0].v,3);
 calls[1].resolve({sha:'b',data:[{id:'a',v:3}],wrote:true});await Promise.all([b,d]);assert.equal(status.snapshot().state,'saved');
});
test('production retry saves the newest whole file and preserves another file failure',async()=>{
 const {c,calls,status}=fixture();c.fileHolders['data/a.json']={get:()=>[{id:'a',v:0}]};
 const a=c.ghWrite('data/a.json',[{id:'a',v:1}]);await tick();calls[0].reject(Error('HTTP 500'));await assert.rejects(a);
 const b=c.ghWrite('data/b.json',[]);await tick();calls[1].resolve({data:[],wrote:true});await b;assert.equal(status.snapshot().state,'error');
 const retry=status.retry();await tick();assert.equal(calls.length,3);assert.equal(calls[2].args.data[0].v,1);
 calls[2].resolve({data:[{id:'a',v:1}],wrote:true});await retry;assert.equal(status.snapshot().state,'saved');
});
test('merge resolved by read does not invent a repository save time',async()=>{
 const {c,calls,status}=fixture(),a=c.ghWrite('data/a.json',[]);await tick();calls[0].resolve({data:[],wrote:false});await a;
 assert.equal(status.snapshot().lastSavedAt,null);assert.equal(status.snapshot().state,'ready');
});
test('completed repository restore keeps saved status while its reload error reaches Settings',async()=>{
 const {c,status}=fixture();vm.runInContext(app.slice(app.indexOf('async function jobSaveOperation('),app.indexOf('let jobRegionLoading=')),c);
 const error=Object.assign(new Error('Could not reload'),{code:'reload'});
 await assert.rejects(c.jobSaveOperation('backup-restore',()=>{},async()=>{throw error;}),{code:'reload'});
 assert.equal(status.snapshot().state,'saved');assert.equal(c.jobFailedPaths.size,0);
});
test('an older cached PDF cannot certify that newer unsaved bytes are retained',async()=>{
 const {c,status}=fixture();vm.runInContext(app.slice(app.indexOf('async function jobSaveOperation('),app.indexOf('let jobRegionLoading=')),c);
 c.jobCachedFiles.set('pdf','old bytes');status.connection({online:false,connected:true});
 await assert.rejects(c.jobSaveOperation('pdf',()=>{},async()=>{throw Error('Failed to fetch');},'new bytes'));
 assert.equal(status.snapshot().durable,false);
 c.jobCachedFiles.set('pdf','new bytes');
 await assert.rejects(c.jobSaveOperation('pdf',()=>{},async()=>{throw Error('Failed to fetch');},'new bytes'));
 assert.equal(status.snapshot().durable,true);
});
