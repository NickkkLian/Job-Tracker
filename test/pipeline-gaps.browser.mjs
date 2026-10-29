import fs from 'node:fs';import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const harness=process.env.HARNESS_ROOT;if(!harness)throw Error('Set HARNESS_ROOT to the existing app-harness');
const {launch}=await import(pathToFileURL(path.join(harness,'cdp.mjs')));const {testPage}=await import(pathToFileURL(path.join(harness,'page.mjs')));import {makeJobs} from './pipeline.fixture.mjs';import {measure} from './pipeline.measure.mjs';
const phase=process.argv[2]||'green',root=(phase==='red'?path.resolve(process.env.BASELINE_ROOT||'.tmp/baseline'):fileURLToPath(new URL('../',import.meta.url))),out=path.resolve('evidence',phase);fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[]},b=await launch();
try{for(const busy of [false,true]){
 const f=testPage(root,{seed:{'data/canada_jobs.json':makeJobs(busy),'data/resumeSections.json':[],'data/library.json':[]},storage:{'jobapp:connection':{owner:'o',repo:'jobdata',token:'test-token'},'pha-config':{owner:'o',repo:'jobdata',token:'test-token'}}});
 const file=path.join(f.dir,'index.html');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('<head>','<head><meta name="settings-host" content="same-origin-v1"><meta name="settings-manager" content="/?app=Job-Tracker#keys-and-connections"><script>localStorage.clear();</script>'));
 const p=await b.open(f.url+'?tab=tracker',{width:1440,height:900});await p.until("document.querySelectorAll('.job-open').length>0",15000);
 for(const width of [1440,390]){await p.size(width,900);await p.eval('new Promise(r=>setTimeout(r,75))');const m=await p.eval(measure);const entry=m.entries.card;report.checks.push({busy,width,maxGap:entry.maxGap,maxTrail:entry.maxTrail,count:entry.count,pass:entry.maxGap<=32});await p.shot(path.join(out,`gap-${busy?'busy':'real'}-${width}.png`));}
 report.errors.push(...p.errors);await p.close();
}}catch(e){report.errors.push(e.stack||String(e));}finally{await b.close();}
fs.writeFileSync(path.join(out,'gaps.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=report.checks.some(c=>!c.pass)||report.errors.length?1:0;
