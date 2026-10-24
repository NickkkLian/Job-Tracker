/* ApplyLedger keeps its React state, per-file merge queues, raw AI slot and three visual palettes. */
(() => {
 const C=HubSettingsContract,R=HubSettingsRuntime,H=SuiteSettingsHelpers,kit=H.kitPreferences('Job-Tracker');let backup,sourceNotice;
 function pause(value){jobSourcePaused=value;const main=document.getElementById('main');if(main){sourceNotice||=H.connectionNotice([main]);sourceNotice(value);}}
 const adapter=window.settingsAdapter={
  ...kit,app:'Job-Tracker',demo:DEMO,isolatedCredentials:true,connectionSlot:'jobapp:connection',
  routing:'Fixed data/ paths and repository default branch. App PDFs and reviewed kit dependencies are included in the private backup.',
  language:()=>lang,setLanguage(value){if(value===lang)return;lang=value;document.documentElement.lang=value;_langSubs.slice().forEach(fn=>fn());},
  connection:()=>({...jobConnection}),
  unsaved:()=>[...jobDrafts.values()].some(Boolean)||jobFailedPaths.size>0||!!document.querySelector('dialog[open]:not(.suite-panel):not(.suite-confirm):not(.suite-merge-dialog)'),
  adopt(next){if(R.sameConnection(jobConnection,next))return;jobConnection={...next};adapter.invalidate();pause(true);},
  invalidate(){for(const map of [shaCache,baseCache,saveQueues])for(const k of Object.keys(map))delete map[k];backup=null;jobFailedPaths.clear();},
  async reload(){
   if(DEMO)return;if(!C.complete(jobConnection))throw new C.SettingsError('required');
   if(!window.jobSettingsBridge)throw new C.SettingsError('pending');
   pause(true);jobSourcePaused=false;
   try{
    jobSettingsBridge.reload();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const until=Date.now()+30000;while(jobSettingsBridge.status().loading||R.pending>1){if(Date.now()>until)throw new C.SettingsError('storage');await new Promise(resolve=>setTimeout(resolve,20));}
    if(jobSettingsBridge.status().error)throw new C.SettingsError('storage');pause(false);
   }catch(error){pause(true);throw error;}
  },
  effectiveModel:()=> 'claude-sonnet-5-5',refreshAI(){window.jobSettingsBridge?.refresh();},
  backupHelp:{en:'Private backup of all saved Job Tracker data files: regional jobs, profile/text and formatting, glossary, alerts profile, resumes, diagnosis, application kits and progress, plus PDF and legacy HTML dependencies. Original browser recovery caches and unsaved work are excluded. Restore validates the whole manifest and target revisions, writes attachments first, then lists any completed/remaining files on failure. No application is submitted or sent.',zh:'所有已保存求职追踪文件的私有备份：各地区职位、资料文本与格式、词汇表、提醒资料、简历、诊断、投递资料包与进度，以及 PDF 和旧 HTML 依赖。不含原浏览器恢复缓存与未保存工作。恢复会检查完整清单与目标版本，先写附件；失败时列出已完成和待完成文件。不会提交或发送任何申请。'},
  async backup(){return (await getBackup()).backup();},async stage(value){return (await getBackup()).stage(value);},
  async restore(value){const alreadyPaused=jobSourcePaused;pause(true);try{return await (await getBackup()).restore(value);}catch(error){if(error.completed?.length||error.code==='reload'){adapter.invalidate();pause(true);}else pause(alreadyPaused);throw error;}},
  connectionControls(container,context){
   let button=container.querySelector('#suite-job-test'),status=container.querySelector('p');if(!button){button=document.createElement('button');button.id='suite-job-test';status=document.createElement('p');status.id='suite-job-test-status';status.setAttribute('role','status');container.append(button,status);}
   button.textContent=T('测试填写的连接（只读）','Test draft connection (read only)');button.disabled=DEMO;
   button.onclick=async()=>{try{const c=context.draft();if(!C.complete(c))throw new C.SettingsError('required');await R.track(()=>testGhConnection(c.token,c.owner+'/'+c.repo));status.textContent=T('连接测试成功；没有保存凭据或数据。','Connection test passed; no credentials or data were saved.');}catch{status.textContent=T('测试失败；没有保存。','Test failed; nothing was saved.');}};
  },
  appControls(container,settings){
   H.controls(container,T('各地区、提醒资料、诊断与简历格式仍在原页面。重置偏好不会删除文件或本机 PDF 恢复缓存。','Regions, alert profile, diagnosis and resume formatting remain with their pages. Reset preferences keeps data files and local PDF recovery.'),[{text:T('重新加载已保存文件','Reload saved files'),action:async()=>{if(R.pending)return;if(!await settings.confirm('Discard this page’s unsaved edits and reload the saved private files? Local PDF recovery remains.','放弃此页面尚未保存的编辑，并重新加载已保存私有文件？本机 PDF 恢复仍保留。','Reload','重新加载'))return;jobDrafts.clear();adapter.invalidate();try{await R.track(()=>adapter.reload());}catch{}settings.refresh();}}]);kit.shortcuts(container);
  },
  install(){},
 };
 async function getBackup(){if(!backup)backup=await createJobBackup(adapter);return backup;}
})();
