import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const harness=process.env.HARNESS_ROOT;if(!harness)throw Error('Set HARNESS_ROOT to the existing app-harness');
const {launch}=await import(pathToFileURL(path.join(harness,'cdp.mjs')));
const {testPage}=await import(pathToFileURL(path.join(harness,'page.mjs')));
import {makeJobs} from './pipeline.fixture.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),phase=process.argv[2]||'green',out=path.resolve('evidence',phase);
fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[]};
const check=(name,actual,expected=true)=>report.checks.push({name,actual,expected,pass:JSON.stringify(actual)===JSON.stringify(expected)});
const storage={'jobapp:connection':{owner:'o',repo:'jobdata',token:'test-token'},'pha-config':{owner:'o',repo:'jobdata',token:'test-token'},'pha-lang':'en','pha-theme':'light'};
function fixture(busy){const f=testPage(root,{seed:{'data/canada_jobs.json':makeJobs(busy),'data/china_jobs.json':makeJobs(busy),'data/resumeSections.json':[],'data/library.json':[]},storage});fs.writeFileSync(path.join(f.dir,'index.html'),fs.readFileSync(path.join(f.dir,'index.html'),'utf8').replace('<head>','<head><meta name="settings-host" content="same-origin-v1"><meta name="settings-manager" content="/?app=Job-Tracker#keys-and-connections"><script>{const k="pipeline-fixture:"+location.pathname;if(!sessionStorage.getItem(k)){localStorage.clear();sessionStorage.setItem(k,"1");}}</script>'));return f;}
const b=await launch();
try {
 const f=fixture(true),p=await b.open(f.url+'?tab=tracker',{width:1440,height:900});
 await p.until("document.querySelectorAll('.job-open').length>0",15000);
 check('only populated stages get columns',await p.eval("[...document.querySelectorAll('.pipeline-stage')].map(e=>e.dataset.stage)"),['want','sent','talk','won','shut']);
 check('tier 1 open, tiers 2–4 closed',await p.eval("[...document.querySelectorAll('.pipeline-tier')].map(e=>e.open)"),[true,false,false,false]);
 const menu=await p.eval("!!document.querySelector('.job-move>summary')");check('Move to is keyboard reachable',menu);
 if(menu){
  const id=await p.eval("document.querySelector('.job').dataset.job");
  await p.eval("document.querySelector('.job-move>summary').focus()");await p.key('Enter','\r');await p.key('ArrowDown');
  await p.until("document.activeElement.matches('[data-move-status]')");
  await p.key('Enter','\r');await p.until("document.activeElement.matches('.job-open')");
  check('keyboard move keeps card focus',await p.eval('document.activeElement.closest(".job").dataset.job'),id);
  check('keyboard move changes stored status',await p.eval("__gh.json('data/canada_jobs.json').find(j=>j.id==="+JSON.stringify(id)+").status"),'applied');
  check('move is announced',await p.eval("!!document.querySelector('#pipeline-announcement').textContent.trim()"));
  await p.eval("document.querySelector('[data-tier=T2]>summary').click()");await p.until("document.querySelector('[data-tier=T2]').open && JSON.parse(localStorage.getItem('jobapp:tier-folds:canada')).T2===true");await p.reload();await p.until("!!document.querySelector('[data-tier=T2]')",15000);
  check('tier fold survives reload',await p.eval("document.querySelector('[data-tier=T2]').open"));
  await p.eval("const s=document.getElementById('region');s.value='china';s.dispatchEvent(new Event('change',{bubbles:true}))");await p.until("document.querySelector('.pipeline')?.dataset.region==='china'",15000);
  check('other region has its own folds',await p.eval("document.querySelector('[data-tier=T2]').open"),false);
 } else {for(const name of ['keyboard move keeps card focus','keyboard move changes stored status','move is announced','tier fold survives reload','other region has its own folds'])check(name,false);}
 await p.size(390,844);
 await p.until("document.querySelector('.pipeline-stage')?.dataset.stage==='talk'");
 check('phone in-progress order',await p.eval("[...document.querySelectorAll('.pipeline-stage')].map(e=>e.dataset.stage)"),['talk','won','sent','want','shut']);
 for(const w of [320,390]){await p.size(w,844);check('header one row '+w,await p.eval("(()=>{const es=[...document.querySelectorAll('.topbar [data-settings-slot]>button,.topbar .phone-menu>summary')];return es.length===4&&Math.max(...es.map(e=>e.getBoundingClientRect().y))-Math.min(...es.map(e=>e.getBoundingClientRect().y))<=1&&document.querySelector('.topbar').getBoundingClientRect().height<=60})()"));check('no horizontal overflow '+w,await p.eval('document.documentElement.scrollWidth<=innerWidth'));}
 await p.close();
 const f2=fixture(false),p2=await b.open(f2.url+'?tab=tracker',{width:1440,height:900});await p2.until("document.querySelectorAll('.job-open').length>0",15000);
 check('real mix has only 3 columns',await p2.eval("[...document.querySelectorAll('.pipeline-stage')].map(e=>e.dataset.stage)"),['want','sent','shut']);
 check('To apply spans two tracks',await p2.eval("document.querySelector('[data-stage=want]')?.classList.contains('wide')"));
 check('no delete on cards',await p2.eval("document.querySelectorAll('.job [data-tip=\"Delete application\"]').length"),0);
 check('rail follows search',await p2.eval("(async()=>{const e=document.getElementById('trk-search');e.focus();return true})()"));
 await p2.type('Brightfern');
 check('filtered rail total',await p2.eval("[...document.querySelectorAll('.stage-rail .stage-n')].reduce((a,e)=>a+Number(e.textContent),0)"),makeJobs(false).filter(j=>`${j.company} ${j.role} ${j.location}`.toLowerCase().includes('brightfern')).length);
 await p2.click('.suite-gear');await p2.until("document.querySelector('.suite-panel').open");
 check('repo info and GitHub moved to Settings',await p2.eval("document.querySelector('.job-repo-info')?.textContent==='Your repo · o/jobdata · GitHub' && document.querySelector('.job-repo-info a')?.getAttribute('href')==='https://github.com/NickkkLian/Job-Tracker'"));
 report.errors.push(...p.errors,...p2.errors);await p2.close();
}catch(e){report.errors.push(e.stack||String(e));}finally{await b.close();}
fs.writeFileSync(path.join(out,'regression.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));process.exitCode=report.checks.some(c=>!c.pass)||report.errors.length?1:0;
