function stateName(state) {
  return ({yours:T('轮到你','Your turn'),ready:T('待发送','Ready to send'),saved:T('已收藏','Saved'),sent:T('已投递','Sent'),quiet:T('未回复','No reply'),talking:T('沟通中','Talking'),offer:T('已获 Offer','Offer'),working:T(cecShown()?'在职·计工时':'在职',cecShown()?'Working (CEC hours)':'Working'),closed:T('已结束','Closed')})[state] || state;
}
function kitHref(kit, step) {
  return `#apply/${encodeURIComponent(kit.id)}${step == null ? '' : `?step=${encodeURIComponent(step)}`}`;
}
function useApplyDesk(connectionKey) {
  const [kits,setKits]=useState([]),[progress,setProgress]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(null);
  const [attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[saveError,setSaveError]=useState('');
  const latest=useRef(progress),retrySave=useRef(null);latest.current=progress;
  useEffect(()=>holdFile('applyProgress',()=>latest.current,setProgress),[]);
  useEffect(()=>{
    let cancelled=false;setLoading(true);setError(null);
    if(DEMO){const sample=sampleApplyDesk();setKits(sample.kits);setProgress(sample.progress);setLoading(false);return;}
    if(!ghConfigured()){setKits([]);setProgress([]);setLoading(false);return;}
    Promise.all([ghRead(ApplyKits.path),loadJsonStrict('applyProgress')]).then(([text,records])=>{
      const rows=ApplyKits.validate(text?JSON.parse(text):[]);ApplyKits.validateProgress(records);
      if(!cancelled){setKits(ApplyKits.sort(rows));setProgress(records);setLoading(false);}
    }).catch(e=>{if(!cancelled){setError(e);setLoading(false);}});
    return()=>{cancelled=true;};
  },[connectionKey,attempt]);
  const update=async(id,transform,options={})=>HubSettingsRuntime.track(async()=>{
    if(busy||error||loading||!DEMO&&!ghConfigured())return false;
    setBusy(true);setSaveError('');retrySave.current=()=>update(id,transform,options);
    const rows=latest.current,previous=rows.find(r=>r.id===id)||{id},record=transform(previous);
    const next=rows.some(r=>r.id===id)?rows.map(r=>r.id===id?record:r):[...rows,record];
    const kit=kits.find(k=>k.id===id),status=options.jobStatus||Ledger.linkedStatus(record,previous);
    const datePatch=record.appliedAt!==previous.appliedAt||status==='interested'?{appliedAt:record.appliedAt||null}:{};
    const sync=kit?.jobRef&&status&&(options.jobStatus||record.appliedAt!==previous.appliedAt||record.outcome!==previous.outcome);
    let attemptedWrite=false;
    try {
      if(DEMO){
        setProgress(ApplyKits.validateProgress(next));
        if(sync){const holder=fileHolders[keyToPath(`${kit.jobRef.region}:jobs`)];if(holder)holder.set(holder.get().map(j=>String(j.id)===String(kit.jobRef.id)?{...j,...options.jobPatch,...Ledger.jobStatusPatch(j,status),...datePatch}:j));}
      } else if(sync) {
        if(!REGION_BY[kit.jobRef.region])throw Object.assign(new Error('Unknown linked region'),{deskCode:'linked-region'});
        const jobPath=keyToPath(`${kit.jobRef.region}:jobs`);
        if(!(jobPath in baseCache))await ghRead(jobPath);
        const current=fileHolders[jobPath]?.get()||baseCache[jobPath];
        if(!Array.isArray(current)||!current.some(j=>String(j.id)===String(kit.jobRef.id)))throw Object.assign(new Error('Linked job missing'),{deskCode:'linked-job'});
        const jobs=current.map(j=>String(j.id)===String(kit.jobRef.id)?{...j,...options.jobPatch,...Ledger.jobStatusPatch(j,status),...datePatch}:j);
        const files=[{path:ApplyKits.progressPath,value:next},{path:jobPath,value:jobs}];
        attemptedWrite=true;
        const saved=await ghWriteLinked(files);
        ApplyKits.validateProgress(saved[0]);
      } else {
        attemptedWrite=true;const saved=await ghWrite(ApplyKits.progressPath,next);setProgress(ApplyKits.validateProgress(saved.data));
      }
      return true;
    } catch(e){if(!DEMO&&!attemptedWrite){const rev=jobSaveStatus.pending(ApplyKits.progressPath,()=>update(id,transform,options)),token=jobSaveStatus.start(ApplyKits.progressPath,rev);jobSaveStatus.fail(token,e);}console.warn('Application save failed',e);setSaveError(e.deskCode||'failed');return false;}
    finally{setBusy(false);}
  });
  return {kits,progress,loading,error,busy,saveError,update,retry:()=>setAttempt(n=>n+1),retrySave:()=>retrySave.current?.()};
}

function ghWriteLinked(changes,retryFiles=null) {
  const files=changes.map((f,i)=>({...f,base:SafeMerge.snapshot(retryFiles?.[i].base??baseCache[f.path]??[]),before:SafeMerge.snapshot(fileHolders[f.path]?.get()??baseCache[f.path]??[])}));
  const queues=files.map(f=>saveQueues[f.path]||(saveQueues[f.path]={chain:Promise.resolve(),waiting:null}));
  const blockers=queues.map(q=>q.chain);
  queues.forEach(q=>{q.waiting=null;});
  const revisions=files.map(f=>jobSaveStatus.pending(f.path,()=>ghWriteLinked(changes,files)));
  const task=Promise.all(blockers).then(async()=>{
    const tokens=files.map((f,i)=>jobSaveStatus.start(f.path,revisions[i]));
    const {repo,token}=ghCfg();
    const request=async(suffix,method='GET',body)=>{
      const r=await fetch(`https://api.github.com/repos/${repo}${suffix}`,{method,headers:ghHdrs(token),cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});
      if(!r.ok){const e=new Error(`GitHub ${r.status}`);e.status=r.status;throw e;}return r.json();
    };
    try {
      const values=await saveLinkedFiles({files,request,read:async(path,head)=>{
        try {const f=await request(`/contents/${path}?ref=${head}&t=${Date.now()}`);let content=f.content;if(!content&&f.sha&&f.size>0)content=(await request(`/git/blobs/${f.sha}`)).content;if(!content&&f.size>0)throw new Error('File content missing');return parseFile(path,frB64(content||''));}
        catch(e){if(e.status===404)return [];throw e;}
      },merge:SafeMerge.merge3,ask:conflicts=>SafeMerge.ask(conflicts,T)});
      files.forEach((f,i)=>{
        baseCache[f.path]=SafeMerge.snapshot(values[i]);delete shaCache[f.path];
        const holder=fileHolders[f.path],q=queues[i];
        if(q.waiting){q.waiting.value=SafeMerge.rebase(f.before,values[i],q.waiting.value);jobLatestWrites.set(f.path,{value:SafeMerge.snapshot(q.waiting.value),opts:q.waiting.opts});}
        if(holder)holder.set(SafeMerge.rebase(f.before,values[i],holder.get()));
        jobFailedPaths.delete(f.path);jobSaveStatus.succeed(tokens[i],new Date());
      });
      return values;
    }catch(e){files.forEach((f,i)=>{jobFailedPaths.add(f.path);jobSaveStatus.fail(tokens[i],e);});throw e;}
  });
  queues.forEach(q=>{q.chain=task.catch(()=>{});});
  return task;
}

function DeskError({desk,openSettings}) {
  return <>{desk.error&&<ErrorCard title={T('没能读取申请材料，未保存任何更改','Couldn’t read application kits; no changes saved')} error={desk.error} onRetry={desk.retry} openSettings={openSettings}/>}{desk.saveError&&<p className="field-err kit-save-error" role="alert">{T('未保存，刚才的更改没有记录。','Not saved. The last change was not recorded.')} {desk.saveError==='linked-job'?T('找不到关联职位，请核对材料包。','The linked job is missing. Check the kit’s job reference.'):desk.saveError==='linked-region'?T('材料包关联的地区不受支持。','The kit links to an unsupported region.'):''} <button className="btn" onClick={desk.retrySave}>{T('重试','Retry')}</button></p>}</>;
}
function DeskSkeleton() {
  return <div className="desk-skeleton" aria-busy="true"><span className="sr-only">{T('正在读取申请材料…','Loading application kits…')}</span>{[1,2,3].map(n=><span className="skel" key={n}/>)}</div>;
}
function useListMovement(selector,signature) {
  const before=useRef(new Map());
  React.useLayoutEffect(()=>{
    const next=new Map();
    document.querySelectorAll(selector).forEach(node=>{
      const key=node.dataset.handoff||node.dataset.job,rect=node.getBoundingClientRect(),previous=before.current.get(key);
      next.set(key,rect);
      if(previous&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
        const distance=previous.top-rect.top;
        if(Math.abs(distance)>1)node.animate([{transform:`translateY(${distance}px)`},{transform:'translateY(0)'}],{duration:200,easing:'cubic-bezier(.23,1,.32,1)'});
      }
    });
    before.current=next;
  },[signature]);
}
function ShortcutsHelp({kind}) {
  return <details className="keyboard-help"><summary>{T('快捷键','Keyboard shortcuts')} <kbd>?</kbd></summary><p>{kind==='kit'?T('J / K 切换答案，C 复制，空格勾选步骤，G 然后 N 返回现在。','J / K move between answers, C copies, Space checks a step, G then N opens Now.'):T('J / K 切换申请，Enter 打开，D 完成，H 明天再办。','J / K move between applications, Enter opens, D finishes, H hides until tomorrow.')}</p></details>;
}
function NowTab({jobs,region,desk,go,openSettings}) {
  const [snoozed,setSnoozed]=useState(()=>{try{return JSON.parse(localStorage.getItem('jobapp:snoozed')||'{}');}catch{return {};}});
  const [undo,setUndo]=useState(null),[leaving,setLeaving]=useState('');
  const rows=Ledger.entries(jobs,desk.kits,desk.progress,region);
  const preparedThisWeek=desk.kits.filter(k=>{return Ledger.inPeriod(k.preparedAt||k.handoff?.updatedAt,'week');}).length;
  const yours=rows.filter(r=>r.state==='yours'&&!(snoozed[r.kit.id]>Date.now()));
  useListMovement('[data-handoff]',yours.map(r=>r.id).join(','));
  const coming=rows.filter(r=>r.state==='ready');
  const talking=rows.filter(r=>['talking','offer'].includes(r.state));
  const sent=rows.filter(r=>r.sentAt||r.job?.status==='applied');
  const waiting=rows.filter(r=>['sent','quiet'].includes(r.state));
  const old=jobs.filter(j=>j.status==='interested'&&Ledger.age(j.dateAdded)>30);
  const open=row=>{if(row.kit)location.hash=kitHref(row.kit,Ledger.openSteps(row.kit,row.record)[0]?.id);else go('tracker',{openJobId:row.job.id});};
  const hide=row=>{const tomorrow=new Date();tomorrow.setHours(24,0,0,0);const next={...snoozed,[row.kit.id]:tomorrow.getTime()};setSnoozed(next);try{localStorage.setItem('jobapp:snoozed',JSON.stringify(next));}catch{}};
  const done=async row=>{
    if(leaving||desk.busy)return;
    const step=Ledger.openSteps(row.kit,row.record)[0];if(!step)return;
    setLeaving(row.id);
    await new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion:reduce)').matches?60:180));
    const ok=await desk.update(row.kit.id,r=>({...r,handoffDone:{...r.handoffDone,[step.id]:new Date().toISOString()}}));
    setLeaving('');if(ok)setUndo({id:row.kit.id,step:step.id});
  };
  useEffect(()=>{if(!undo)return;const timer=setTimeout(()=>setUndo(null),6000);return()=>clearTimeout(timer);},[undo]);
  const keys=e=>{
    if(!Appearance.shortcutsOn()||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    const buttons=[...e.currentTarget.querySelectorAll('[data-handoff-open]')],index=buttons.indexOf(document.activeElement);
    if(['j','k'].includes(e.key.toLowerCase())){e.preventDefault();buttons[(index+(e.key.toLowerCase()==='j'?1:-1)+buttons.length)%buttons.length]?.focus();}
    if(e.key==='d'&&index>=0){e.preventDefault();done(yours[index]);}
    if(e.key==='h'&&index>=0){e.preventDefault();hide(yours[index]);}
    if(e.key==='?'){e.preventDefault();const d=e.currentTarget.querySelector('.keyboard-help');if(d){e.currentTarget.querySelector('.activity-panel').open=true;d.open=!d.open;}}
  };
  useEffect(()=>{document.addEventListener('keydown',keys);return()=>document.removeEventListener('keydown',keys);});
  const today=localISO(new Date());
  const compact=row=>{
    const note=(row.record?.outcomeNote||row.job?.notes||stateName(row.state)).split(/\n|\s[—–]\s/)[0];
    const deadline=row.kit?.deadline||row.job?.applicationDeadline;
    const when=deadline?T('截止 ','Closes ')+ledgerDate(deadline):row.kit?.applyDate?T('计划 ','Planned ')+ledgerDate(row.kit.applyDate):T('截止日未注明','Deadline not listed');
    return <li key={row.id} className="compact-row" data-entry="row"><button className="row-link" onClick={()=>open(row)}><span className="row-main"><b>{row.role}</b><i>{row.company}</i></span><span className="row-sub">{row.state==='offer'?<><Icon name="check" size={12}/> {stateName('offer')}</>:row.state==='talking'?note:<>{when} · {row.kit?T('材料齐全','Kit ready'):T('尚无材料包','No kit yet')}</>}</span></button></li>;
  };
  const waitingSummary=<><h2>{T('已投递，等回复','Sent and waiting')} <span className="waiting-head-count">{waiting.length}</span></h2><AgeStrip rows={waiting} onOpen={()=>go('tracker',{status:'applied'})}/></>;
  const empty=!jobs.length&&!desk.kits.length&&!desk.loading;
  return <div className="now-view">
    <div className={`now-desk${yours.length?' has-slips':''}`}><div className="now-desk-main">
      <div className="now-heading"><h1 tabIndex={-1}>{empty?T('还没有申请','Nothing here yet'):yours.length?T(`有 ${yours.length} 件事等你处理`,`${yours.length} ${yours.length===1?'thing needs':'things need'} you`):T('现在没有要你处理的事','Nothing needs you right now')}</h1></div>
      {empty&&!desk.error&&<div className="empty-account"><Btn variant="primary" onClick={()=>go('addjob')}>{T('添加职位','Add job')}</Btn><a className="btn" href="?demo=1">{T('看看示例','Try the demo')}</a></div>}
      <section className="handoffs"><h2 className="sr-only">{T('轮到你','Your turn')}</h2><DeskError desk={desk} openSettings={openSettings}/>
      {desk.loading?<DeskSkeleton/>:yours.length?<ul className="slip-list">{yours.map(row=>{const step=Ledger.openSteps(row.kit,row.record)[0],left=row.kit.deadline?ApplyKits.days(row.kit.deadline,today):null;return <li key={row.id} className={`slip${leaving===row.id?' leaving':''}`} data-entry="row" data-handoff={row.kit.id}>
        <span className="slip-flag">{T('轮到你','Your turn')}</span>
        {left!=null&&left>=0&&<span className="slip-due"><b>{left}</b><span>{left===1?T('天后截止','day left'):T('天后截止','days left')}</span></span>}
        <div className="slip-text"><b className="slip-step"><mark title={kitLabel(step.text)}>{kitLabel(step.text)}</mark></b><span className="slip-meta" title={`${row.role} · ${row.company}`}>{row.role} · {row.company} · <span className="nowrap">{row.kit.deadline?<>{T('截止 ','Closes ')}{ledgerDate(row.kit.deadline)}</>:T('截止日未注明','Deadline not listed')}</span></span></div>
        <a className="btn btn-primary" data-handoff-open={row.kit.id} href={kitHref(row.kit,step.id)} aria-label={T(`打开这一步：${kitLabel(step.text)}`,`Open at this step: ${kitLabel(step.text)}`)}>{T('打开','Open')}<Icon name="chevron" size={14}/></a>
        <details className="row-actions"><summary aria-label={T('这份申请的更多操作','More actions for this application')}><Icon name="dots"/></summary><div>{row.kit.deadline&&<p>{T('截止 ','Closes ')}{ledgerDate(row.kit.deadline)}</p>}<button disabled={desk.busy} onClick={()=>done(row)}>{T('完成','Done')}</button><button onClick={()=>hide(row)}>{T('明天再办','Not today')}</button></div></details>
      </li>;})}</ul>:!desk.error&&!empty&&<p className="quiet-line">{T('没有待处理的步骤','No steps waiting on you')}</p>}</section>
    </div><DeskArt waiting={yours.length>0}/></div>
    <div className="now-ledger">{!!coming.length&&<section className="ledger-sheet"><div className="section-line"><h2>{T('近期投递','Coming up')}</h2></div><ul className="compact-list">{coming.map(compact)}</ul></section>}
      {!!talking.length&&<section className="ledger-sheet"><div className="section-line"><h2>{T('沟通中','Talking')}</h2></div><ul className="compact-list">{talking.map(compact)}</ul></section>}
      {(!!waiting.length||!!jobs.length)&&<aside className="ledger-sheet waiting-panel waiting-desktop">{waitingSummary}</aside>}
    </div>
    <details className="activity-panel"><summary>{T('投递动态','Activity')}<Icon name="down" size={14}/></summary><aside className="activity-content"><div className="waiting-panel waiting-mobile">{waitingSummary}</div>
      <div className="week-line"><h3>{T('本周','This week')}</h3><p>{T(`已投 ${sent.filter(r=>Ledger.inPeriod(r.sentAt,'week')).length} 份 · 备好 ${preparedThisWeek} 份材料`,`${sent.filter(r=>Ledger.inPeriod(r.sentAt,'week')).length} sent · ${preparedThisWeek} kits prepared`)}</p></div>
      <div className="saved-health"><h3>{T('收藏清单','Saved list')}</h3><p>{old.length?T(`${old.length} 条收藏超过 30 天`,`${old.length} saved over 30 days ago`):T('收藏都在 30 天以内','All saved within 30 days')}</p>{!!old.length&&<button className="btn" onClick={()=>{prefillGhost(old);go('ghost');}}>{T('检查收藏','Check saved rows')}<Icon name="chevron" size={14}/></button>}</div><ShortcutsHelp/>
    </aside></details>
    {undo&&<div className="desk-undo" role="status">{T('步骤已完成','Step finished')}<button className="btn" onClick={()=>{desk.update(undo.id,r=>({...r,handoffDone:{...r.handoffDone,[undo.step]:null}}));setUndo(null);}}>{T('撤销','Undo')}</button></div>}
  </div>;
}

// The desk still life beside the Now heading. It is drawn here (no image file) so it takes the desk colour of every
// palette and theme; it shows the state the heading states: a paper waiting with its flag, or a cleared desk.
function DeskArt({waiting}) {
  return <svg className="desk-art" viewBox="0 0 560 320" aria-hidden="true" focusable="false">
    <defs>
      <filter id="desk-shadow" x="-20%" y="-20%" width="150%" height="160%"><feDropShadow dx="7" dy="10" stdDeviation="7" floodColor="#03070d" floodOpacity=".5"/></filter>
      <filter id="desk-shadow-sm" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="3" dy="4" stdDeviation="2.5" floodColor="#03070d" floodOpacity=".45"/></filter>
      <linearGradient id="desk-tea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9a04a"/><stop offset="1" stopColor="#b97a26"/></linearGradient>
      <linearGradient id="desk-pen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f7d86"/><stop offset=".55" stopColor="#1f5c63"/><stop offset="1" stopColor="#174a50"/></linearGradient>
    </defs>
    {waiting?<>
      <g filter="url(#desk-shadow)" transform="rotate(-5 250 165)">
        <rect className="art-paper" x="150" y="28" width="204" height="268" rx="3"/>
        <g className="art-rule"><path d="M176 64h112M176 86h152M176 104h152M176 122h140M176 140h152M176 158h96"/><path d="M176 196h152M176 214h152M176 232h118"/></g>
        <path className="art-sign" d="M176 268h108"/>
        <path className="art-cross" d="m180 252 8 8m0-8-8 8"/>
        <g filter="url(#desk-shadow-sm)"><path className="art-flag" d="M300 250h78a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3h-78l-10-10z"/></g>
      </g>
      <g filter="url(#desk-shadow)" transform="rotate(38 448 190)">
        <rect x="372" y="182" width="150" height="16" rx="8" fill="url(#desk-pen)"/>
        <rect className="art-steel" x="402" y="181" width="7" height="18" rx="1.5"/>
        <path className="art-steel" d="M372 183.5 348 190l24 6.500z"/>
        <path d="M352 190h18" stroke="#1b2a3a" strokeWidth="1.2" fill="none"/>
      </g>
      <g filter="url(#desk-shadow)" transform="rotate(-24 452 262)"><rect x="412" y="254" width="78" height="17" rx="8.500" fill="url(#desk-pen)"/><rect className="art-steel" x="474" y="250" width="3.500" height="25" rx="1.750"/></g>
    </>:<>
      <g filter="url(#desk-shadow)" transform="rotate(-3 250 165)">
        <path className="art-folder-back" d="M146 40h74l12 14h126a4 4 0 0 1 4 4v230a4 4 0 0 1-4 4H146a4 4 0 0 1-4-4V44a4 4 0 0 1 4-4z"/>
        <rect className="art-paper" x="142" y="62" width="220" height="230" rx="4"/>
        <path className="art-rule" d="M170 100h92M170 118h56"/>
      </g>
      <g filter="url(#desk-shadow)" transform="rotate(-3 392 170)">
        <rect x="384" y="78" width="17" height="186" rx="8.500" fill="url(#desk-pen)"/>
        <rect className="art-steel" x="383" y="138" width="19" height="6" rx="1.500"/>
        <rect className="art-steel" x="399" y="86" width="3.500" height="44" rx="1.750"/>
      </g>
      <g filter="url(#desk-shadow)"><circle className="art-glass" cx="478" cy="232" r="26"/><circle className="art-water" cx="478" cy="232" r="19"/>
        <path className="art-leaf" d="M478 232c-4-22 4-40 20-52 4 20-2 40-20 52z"/><path className="art-leaf art-leaf-2" d="M478 232c-18-8-30-22-32-42 18 4 30 18 32 42z"/><path d="M478 232c2-18 8-34 20-52M478 232c-8-16-18-30-32-42" stroke="#2c5a44" strokeWidth="1.2" fill="none"/></g>
    </>}
    <g filter="url(#desk-shadow)"><circle className="art-saucer" cx="66" cy="84" r="48"/><rect className="art-cup" x="14" y="38" width="30" height="15" rx="7.500" transform="rotate(42 29 45)"/><circle className="art-cup" cx="66" cy="84" r="34"/><circle cx="66" cy="84" r="27.500" fill="url(#desk-tea)"/><path d="M47 77a21 21 0 0 1 23-13" stroke="#f2c97a" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".7"/></g>
    <g className="art-clip" filter="url(#desk-shadow-sm)"><path d="M70 196v34a9 9 0 0 0 18 0v-40a6 6 0 0 0-12 0v36" transform="rotate(-28 79 214)"/><path d="M108 236v30a8 8 0 0 0 16 0v-36a5.500 5.500 0 0 0-11 0v32" transform="rotate(34 116 252)"/></g>
  </svg>;
}

let ghostAddedDates=false,ghostMissingLinks=0;
function prefillGhost(jobs) {
  ghostAddedDates=true;
  ghostMissingLinks=0;
  ghostDraft=jobs.map(j=>{
    const link=j.postingUrl||j.url||(ApplyKits.url(j.applyMethod)?j.applyMethod:'')||String(j.jdText||'').match(/https:\/\/[^\s<>]+/)?.[0];
    if(!ApplyKits.url(link)){ghostMissingLinks++;return '';}
    return `${link} | company: ${j.company||''} | title: ${j.role||''} | posted: ${String(j.dateAdded||'').slice(0,10)} | date-source: added`;
  }).filter(Boolean).join('\n');
}

function HeaderMenu({label,children,className='',onOpen}) {
  const ref=useRef(null),search=useRef(''),lastKey=useRef(0);
  useEffect(()=>{const close=e=>{if(ref.current?.open&&!ref.current.contains(e.target))ref.current.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
  return <details ref={ref} className={`header-menu ${className}`} onToggle={e=>{if(e.currentTarget.open)onOpen?.();}} onKeyDown={e=>{
    const d=e.currentTarget,items=[...d.querySelectorAll('[role="menuitem"]')],index=items.indexOf(document.activeElement);
    if(e.key==='Escape'){e.preventDefault();d.open=false;d.querySelector('summary').focus();return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();d.open=true;items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
    if(e.key.length===1&&!e.ctrlKey&&!e.metaKey){search.current=Date.now()-lastKey.current<700?search.current+e.key:e.key;lastKey.current=Date.now();items.find(n=>n.textContent.trim().toLowerCase().startsWith(search.current.toLowerCase()))?.focus();}
  }}><summary>{label}<Icon name="down" size={14}/></summary><div className="header-menu-items" role="menu" onClick={e=>{if(e.target.closest('[role="menuitem"]')){ref.current.open=false;ref.current.querySelector('summary').focus();}}}>{children}</div></details>;
}
function AgeStrip({rows,onOpen}) {
  const seen=new Map(),quiet=rows.filter(r=>Ledger.age(r.sentAt)>=21),undated=rows.filter(r=>Ledger.age(r.sentAt)==null);
  const points=rows.filter(r=>Ledger.age(r.sentAt)!=null).map(row=>{
    const days=Ledger.age(row.sentAt),bucket=Math.min(21,days),index=seen.get(bucket)||0;seen.set(bucket,index+1);
    return {row,days,x:days>=21?286+(index%5)*12:8+days*12,line:days>=21?Math.floor(index/5):index};
  });
  const lines=Math.max(1,...points.map(p=>p.line+1)),height=Math.max(72,(lines+1)*12);
  return <button className="age-strip-button" onClick={onOpen} aria-label={T('查看已投递的申请','View sent applications')}><svg className="age-strip" viewBox={`0 0 350 ${height}`} role="img" aria-label={T(`按投递日期排列的 ${points.length} 份申请`,`${points.length} applications arranged by send date`)}><path d={`M8 ${height-1}H266M278 8V${height-1}H342`} fill="none" stroke="currentColor" opacity=".3"/>{points.map(({row,days,x,line})=><circle key={row.id} cx={x} cy={height-12-line*12} r="4" fill="currentColor"><title>{row.company} · {days} {T('天','days')}</title></circle>)}</svg><span className="age-labels"><span>{T('今天','Today')}</span><span>{T('21 天','21 days')}</span><span>{T('未回复','No reply')} {quiet.length}</span></span>{!!undated.length&&<span className="undated-sends"><span>{T(`${undated.length} 份没有记录投递日期`,`${undated.length} ${undated.length===1?'has':'have'} no recorded send date`)}</span></span>}</button>;
}

function AboutTab({go,openSettings}) {
  const code=path=>`https://github.com/NickkkLian/Job-Tracker/blob/main/${path}`;
  const labels=[T('职位提醒','Job alert'),T('筛选','Triage'),T('投递材料包','Apply kit'),T('轮到你','Your turn'),T('已投递','Sent'),T('回复或未回复','Reply or no reply')];
  return <div className="about-view"><PageHead title={T('了解原理','How it works')} sub={T('从一条职位提醒，到一份有记录的申请。','From a job alert to a recorded application.')}/><ol className="system-diagram" aria-label={labels.join(' → ')}>{labels.map((label,i)=><li key={label} className={i===3?'is-yours':''}><GroupStamp group={['want','quiet','ready','ready','sent','talk'][i]} size={36}/><span className={i===3?'your-mark':''}>{label}</span></li>)}</ol>
    <section><h2>{T('数据存在你自己的 GitHub 私有仓库','Your data stays in your own private GitHub repository')}</h2><p>{T('页首会显示正在保存、保存时间，或者未保存的原因和重试按钮。每份文件都有独立的保存队列。','The header shows saving, the saved time, or a plain reason and Retry. Each file has its own save queue.')} <a href={code('test/save-status.test.mjs')}>{T('查看保存测试','Read the save tests')}</a></p></section>
    <section><h2>{T('两处编辑，也能合并','Edits from two places can merge')}</h2><p>{T('保存会比较本页打开时、仓库里现在、本页修改后的三个版本。不同字段的更改都会保留。同一字段改成不同内容时，由你选择。','Saving compares the version you opened, the current repository version, and your edit. Changes to different fields are kept. Different edits to the same field ask you to choose.')} <a href={code('src/index.template.html')}>{T('查看合并代码','Read the merge code')}</a></p>{DEMO&&<button className="btn" onClick={()=>SafeMerge.ask([{path:['Sample application','notes'],ours:T('周四下午面试','Interview Thursday afternoon'),theirs:T('周五上午面试','Interview Friday morning')}],T)}>{T('试试冲突处理','Try it')}</button>}</section>
    <section><h2>{T('把时间留给还在招聘的职位','Check whether a posting is still hiring')}</h2><p>{T('幽灵岗检查使用四条规则，查看页面是否关闭、职位是否过旧、是否重复发布，以及是否是长期人才库。每条结论都附上原因。','Ghost check uses four rules for closed pages, old postings, repeated listings, and evergreen talent pools. Every result includes reasons.')} <a href={code('test/ghost-flags.test.mjs')}>{T('查看规则测试','Read the rule tests')}</a></p><button className="btn" onClick={()=>{ghostDraft=GhostFlags.SAMPLE;ghostAddedDates=false;go('ghost');}}>{T('检查 20 条示例','Check 20 samples')}</button></section>
    {!DEMO&&<section><h2>{T('CEC 工时按每周合计计算','CEC hours use a combined weekly cap')}</h2><p>{T('两份每周各 25 小时的工作，合计每周计入 30 小时。加拿大的数据页保留每份工作的贡献和未计入的工时。','Two jobs of 25 hours each count as 30 hours a week combined. Canada’s Insights keeps each job’s contribution and the hours above the cap.')} <a href={code('src/app.jsx')}>{T('查看 cecHours','Read cecHours')}</a></p></section>}
    {DEMO&&<a className="btn btn-primary" href="?tab=now&connect=1">{T('连接自己的数据','Try with your own data')}</a>}
  </div>;
}
