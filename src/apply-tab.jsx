// Read-only kits + a separate progress file use the same strict reads, serial saves,
// three-way conflicts and mounted-file replacement as the rest of ApplyLedger.
function kitLabel(value) { if (typeof value === 'string') return value; const preferred=value?.[lang], fallback=value?.[lang === 'zh' ? 'en' : 'zh']; return typeof preferred === 'string' ? preferred : typeof fallback === 'string' ? fallback : ''; }

const kitCopySessions=new Map();
function kitAnswerText(answer,record) {return typeof record.answers?.[answer.id]==='string'?record.answers[answer.id]:answer.text||'';}
function KitCopy({id,label,value,onCopied,paper=false,initialCopied=false}) {
  const [state,setState]=useState(''),[ever,setEver]=useState(initialCopied),[expanded,setExpanded]=useState(false);
  const timer=useRef(null);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  useEffect(()=>{setEver(initialCopied);if(!initialCopied){setState('');clearTimeout(timer.current);}},[initialCopied]);
  const copy=async()=>HubSettingsRuntime.track(async()=>{
    try{await navigator.clipboard.writeText(value);setState('copied');setEver(true);onCopied?.(id,value);clearTimeout(timer.current);timer.current=setTimeout(()=>setState(''),1600);}
    catch{setState('failed');setExpanded(true);}
  });
  return <div className={`kit-copy${paper?' send-paper':''}`}>
    <div className="kit-copy-head"><label htmlFor={id}>{label}</label><button type="button" className="btn" data-copy={id} disabled={!value} onClick={copy}>{ever&&<Icon name="check" size={14} className="copy-tick"/>} {state==='copied'?T('已复制','Copied'):T('复制','Copy')}</button></div>
    {paper?<details className="cover-preview" open={state==='failed'||undefined}><summary>{T('预览全文','Preview text')}</summary><div id={id} className="send-text expanded" tabIndex={0}>{value}</div></details>:<div id={id} className={`send-text${expanded?' expanded':''}`} tabIndex={0}>{value||T('需要你填写','Your answer needed')}</div>}
    {(!paper&&(value?.length>64||value?.includes('\n')))&&<button className="show-all" onClick={()=>setExpanded(v=>!v)}>{expanded?T('收起','Show less'):T('查看全部','Show all')}</button>}
    {state==='failed'&&<p className="field-err" role="alert">{T('复制失败，请选中文字手动复制。','Copy failed. Select the text and copy it manually.')}</p>}
  </div>;
}

function KitAnswer({kit,answer,record,busy,update,onCopied,copied}) {
  const saved=kitAnswerText(answer,record);
  const [draft,setDraft]=useState(saved);
  useSettingsDraft(draft!==saved);
  useEffect(()=>setDraft(saved),[saved]);
  const id=`answer-${kit.id}-${answer.id}`;
  return <div className={`kit-answer ${saved.length<=64&&!saved.includes('\n')?'short-answer':'long-answer'}${copied?' is-copied':''}`} id={`row-${id}`} tabIndex={-1} data-answer={answer.id} data-copied={copied?'true':undefined}>
    <KitCopy id={id} label={kitLabel(answer.label)} value={saved} onCopied={onCopied} initialCopied={copied}/>
    {answer.editable&&<div className="kit-personal"><label className="sr-only" htmlFor={`${id}-edit`}>{kitLabel(answer.label)}</label><input id={`${id}-edit`} value={draft} placeholder={kitLabel(answer.prompt)} onChange={e=>setDraft(e.target.value)} disabled={busy}/><button className="btn" disabled={busy||!draft.trim()||draft===saved} onClick={()=>update(kit.id,r=>({...r,answers:{...r.answers,[answer.id]:draft}}))}>{T('保存答案','Save answer')}</button></div>}
    {answer.note&&<p className="hint">{kitLabel(answer.note)}</p>}
  </div>;
}

function kitOutcomeLabel(value) {
  return ({declined:T('未录用','Declined'),interview:T('面试','Interview'),offer:T('录用','Offer'),withdrawn:T('已撤回','Withdrawn')})[value] || '';
}

function KitOutcome({ kit, record, busy, update }) {
  const saved=record.outcome || '', savedDate=record.outcomeDate || '', savedNote=record.outcomeNote || '';
  const [outcome,setOutcome]=useState(saved), [date,setDate]=useState(savedDate || localISO(new Date())), [note,setNote]=useState(savedNote);
  const dirty=outcome!==saved || (!!outcome && (date!==savedDate || note!==savedNote));
  useSettingsDraft(dirty);
  useEffect(() => {setOutcome(saved);setDate(savedDate || localISO(new Date()));setNote(savedNote);}, [saved,savedDate,savedNote]);
  return <div className="kit-result">
    <div className="kit-result-line"><b>{T('申请结果','Application outcome')}</b><span>{saved ? kitOutcomeLabel(saved) : T('尚无结果','No outcome yet')}{savedDate && ` · ${savedDate}`}</span></div>
    {saved && savedNote && <p className="kit-result-note">{savedNote}</p>}
    <details className="kit-outcome-editor"><summary>{saved ? T('更改结果','Edit outcome') : T('记录结果','Record outcome')}</summary>
      <form className="kit-outcome-form" onSubmit={e => {e.preventDefault();if(outcome) update(kit.id,r => ApplyKits.setOutcome(r,outcome,date,note));}}>
        <label htmlFor={`outcome-${kit.id}`}>{T('结果','Outcome')}<select id={`outcome-${kit.id}`} value={outcome} required disabled={busy} onChange={e=>setOutcome(e.target.value)}><option value="" disabled>{T('选择结果','Choose outcome')}</option>{ApplyKits.outcomes.map(value => <option key={value} value={value}>{kitOutcomeLabel(value)}</option>)}</select></label>
        <label htmlFor={`outcome-date-${kit.id}`}>{T('日期','Date')}<input id={`outcome-date-${kit.id}`} type="date" required value={date} disabled={busy} onChange={e=>setDate(e.target.value)}/></label>
        <label className="kit-outcome-note" htmlFor={`outcome-note-${kit.id}`}>{T('简短备注（可选）','Short note (optional)')}<textarea id={`outcome-note-${kit.id}`} rows={2} maxLength={500} value={note} disabled={busy} onChange={e=>setNote(e.target.value)}/></label>
        <div className="acts"><button type="submit" className="btn btn-primary" data-save-outcome={kit.id} disabled={busy || !outcome || !date || !dirty}>{busy ? T('保存中…','Saving…') : T('保存结果','Save outcome')}</button>{saved && <button type="button" className="btn" data-clear-outcome={kit.id} disabled={busy} onClick={()=>update(kit.id,r=>ApplyKits.setOutcome(r,''))}>{T('清除结果','Clear outcome')}</button>}</div>
      </form>
    </details>
  </div>;
}

function KitPage({kit,record,desk,go}) {
  const [salary,setSalary]=useState(false),[downloadError,setDownloadError]=useState(''),[downloading,setDownloading]=useState(false),[copied,setCopied]=useState(()=>new Map(kitCopySessions.get(kit.id)||[])),[manual,setManual]=useState(''),[undo,setUndo]=useState(null);
  const markCopied=(id,value)=>setCopied(old=>{const next=new Map(old);next.set(id,value);kitCopySessions.set(kit.id,[...next]);return next;});
  const answerWasCopied=answer=>copied.get(`answer-${kit.id}-${answer.id}`)===kitAnswerText(answer,record);
  const page=useRef(null),gn=useRef(false);
  const [barActive,setBarActive]=useState(false),[barLeft,setBarLeft]=useState(0);
  useEffect(()=>{
    const panel=page.current.querySelector('.your-part');
    const measure=()=>setBarLeft(page.current.getBoundingClientRect().left);
    const observer=new IntersectionObserver(entries=>{setBarActive(!entries[0].isIntersecting&&entries[0].boundingClientRect.top<0);measure();},{rootMargin:`-${document.querySelector('#root header.topbar').getBoundingClientRect().height}px 0px 0px 0px`});
    observer.observe(panel);window.addEventListener('resize',measure);measure();return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
  },[]);
  const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('step');
  const steps=Ledger.steps(kit,record),open=Ledger.openSteps(kit,record),requestedStep=steps.find(s=>s.id===requested)||(requested==null?null:steps[Number(requested)]),current=requestedStep&&!record.handoffDone?.[requestedStep.id]?requestedStep:open[0];
  const state=Ledger.state(kit,record);
  const copiedCount=kit.answers.filter(answerWasCopied).length;
  const answerGroups=[];
  kit.answers.forEach((answer,index)=>{
    const key=kitLabel(answer.group)||String(Math.floor(index/8));
    let group=answerGroups.at(-1);
    if(!group||group.key!==key){group={key,label:kitLabel(answer.group)||(index+1===kit.answers.length?T(`第 ${index+1} 项`,`Answer ${index+1}`):T(`第 ${index+1}–${Math.min(kit.answers.length,index+8)} 项`,`Answers ${index+1}–${Math.min(kit.answers.length,index+8)}`)),answers:[]};answerGroups.push(group);}
    group.answers.push(answer);
  });

  useEffect(()=>{const node=requested?page.current?.querySelector(`[data-step="${CSS.escape(current?.id||'')}"] input`):page.current?.querySelector('h1');node?.focus({preventScroll:true});},[kit.id,requested,current?.id]);
  useEffect(()=>{if(!undo)return;const t=setTimeout(()=>setUndo(null),6000);return()=>clearTimeout(t);},[undo]);
  const update=(id,transform)=>desk.update(id,transform);
  const tick=async(step,checked=true)=>{
    const ok=await update(kit.id,r=>({...r,handoffDone:{...r.handoffDone,[step.id]:checked?new Date().toISOString():null}}));
    if(ok&&checked)setUndo({kind:'step',step:step.id});
  };
  const mark=async()=>{const ok=await update(kit.id,r=>ApplyKits.applied(r));if(ok)setUndo({kind:'sent'});};
  const download=async()=>HubSettingsRuntime.track(async()=>{
    setDownloading(true);setDownloadError('');
    try {
      let blob;
      if(DEMO)blob=sampleTailoredResume(kit).output('blob');
      else {
        const data=await ghFindDataUrl(kit.resume.path,'application/pdf');
        if(!data)throw new Error(T('简历文件不存在，请补上这份 PDF。','The resume file is missing. Upload this PDF to the kit.'));
        const bin=atob(data.split(',')[1]||'');if(!bin.startsWith('%PDF-'))throw new Error(T('下载内容不是 PDF。','The downloaded file is not a PDF.'));
        blob=new Blob([Uint8Array.from(bin,c=>c.charCodeAt(0))],{type:'application/pdf'});
      }
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=kit.resume.path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(e){setDownloadError(e.message);}finally{setDownloading(false);}
  });
  const resume=<div className="resume-row" data-entry="row"><Icon name="file"/><span><b>{kit.resume.path.split('/').pop()}</b></span><button className="btn" data-download={kit.id} disabled={downloading} onClick={download}>{downloading?T('下载中…','Downloading…'):T('下载','Download')}</button><details className="resume-reason"><summary aria-label={T('选择原因','Why this file')}><Icon name="info" size={16}/></summary><p>{kitLabel(kit.resume.reason)}</p></details></div>;
  const action=(step,compact=false)=>{
    if(step?.kind==='upload')return compact?<button className="btn btn-primary" disabled={downloading} onClick={download}>{T('下载简历','Download resume')}</button>:resume;
    return <a className="btn btn-primary" href={ApplyKits.url(step?.url)||(step?.kind==='code'?`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(kit.company)}`:kit.postingUrl)} target="_blank" rel="noreferrer">{step?.kind==='code'?T('打开邮箱查找验证码','Find the code in email'):T('打开申请表单','Open the form')}<Icon name="open" size={14}/></a>;
  };
  const stepRow=step=><li key={step.id} data-step={step.id} className={current?.id===step.id?'current-step':''}><label><input type="checkbox" checked={!!record.handoffDone?.[step.id]} disabled={desk.busy} onChange={e=>tick(step,e.target.checked)}/><span><b><mark>{kitLabel(step.text)}</mark></b></span></label>{current?.id===step.id&&!record.handoffDone?.[step.id]&&<div className="step-material">{action(step)}</div>}</li>;
  const shortcuts=e=>{
    if(!Appearance.shortcutsOn()||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(e.key==='n'&&gn.current){e.preventDefault();gn.current=false;go('now');return;}
    gn.current=e.key==='g';
    const answers=[...page.current.querySelectorAll('.kit-answer')],index=answers.indexOf(document.activeElement.closest('.kit-answer'));
    if(['j','k'].includes(e.key)){e.preventDefault();answers[(index+(e.key==='j'?1:-1)+answers.length)%answers.length]?.focus();}
    if(e.key==='c'&&index>=0){e.preventDefault();answers[index].querySelector('[data-copy]')?.click();}
    if(e.key==='?'){e.preventDefault();const d=page.current.querySelector('.keyboard-help');d.open=!d.open;}
  };
  return <article className="kit-page" data-kit={kit.id} ref={page} onKeyDown={shortcuts}>
    <div className="kit-desk"><header className="kit-header"><button className="back-button" onClick={()=>go('apply')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>{T('投递材料包','Apply kits')}</button><div className="kit-title-line"><h1 tabIndex={-1}>{kit.role}</h1><details className="kit-overflow"><summary aria-label={T('申请选项','Application options')}><Icon name="dots"/></summary><div><details className="manual-step"><summary>{T('添加步骤','Add step')}</summary><form onSubmit={e=>{e.preventDefault();if(manual.trim())update(kit.id,r=>({...r,manualSteps:[...(r.manualSteps||[]),{id:newId(),text:manual.trim()}]})).then(ok=>{if(ok)setManual('');});}}><label htmlFor="manual-step-text">{T('下一步','Next step')}</label><input id="manual-step-text" value={manual} onChange={e=>setManual(e.target.value)}/><button className="btn" disabled={desk.busy||!manual.trim()}>{T('添加步骤','Add step')}</button></form></details><a className="btn" href={kit.postingUrl} target="_blank" rel="noreferrer">{T('打开职位','Open posting')}<Icon name="open" size={14}/></a><button className="btn" onClick={()=>navigator.clipboard.writeText(location.href).catch(()=>setDownloadError(T('复制失败，请手动复制地址。','Copy failed. Copy the address manually.')))}>{T('复制链接','Copy link')}</button>{kit.jobRef&&<button className="btn" onClick={()=>{window.dispatchEvent(new CustomEvent('jobapp:openlinked',{detail:kit.jobRef}));}}>{T('职位详情和 AI 提示词','Job details and AI prompts')}</button>}</div></details></div><p className="kit-byline">{kit.company}{kit.location&&` · ${kit.location}`}{kit.optional&&` · ${T('可选','Optional')}`}<span>{kit.deadline?T(`${ledgerDate(kit.deadline)} 截止`,`Closes ${ledgerDate(kit.deadline)}`):T('截止日未注明','Deadline not listed')}</span></p></header>
    <section className={`your-part${record.appliedAt||state==='closed'?' is-settled':''}`} aria-labelledby="your-part-title"><h2 id="your-part-title" className="slip-flag">{T('你要做的','Your part')}</h2>
      {record.appliedAt?<p className="sent-line">{T(`${ledgerDate(record.appliedDate||record.appliedAt)} 已投递 · ${Ledger.age(record.appliedAt)} 天`, `Sent ${ledgerDate(record.appliedDate||record.appliedAt)} · ${Ledger.age(record.appliedAt)} days`)}{!record.outcome&&T('，暂无回复',', no reply yet')} {record.outcome&&(state==='working'?stateName(state):kitOutcomeLabel(record.outcome))}</p>:state==='closed'?<p>{T('这份申请已结束','This application is closed')}</p>:<>
      <ol className="your-steps">{current&&stepRow(current)}</ol>{steps.length>1&&<details className="other-handoff"><summary>{T('其他步骤','Other steps')}</summary><ol className="your-steps">{steps.filter(step=>step.id!==current?.id).map(stepRow)}</ol></details>}
      {!open.length&&<div className="mark-sent"><button className="btn btn-primary" data-applied={kit.id} disabled={desk.busy} onClick={mark}>{T('标记已投递','Mark sent')}</button><span>{T('记录今天的日期','Records today’s date')}</span></div>}

      </>}
      <DeskError desk={desk}/>
    </section></div>
    <div className={`kit-working-bar${barActive?' is-active':''}`} style={{left:barLeft}}><div><span className="working-bar-label">{T('你要做的','Your part')}</span><b>{record.appliedAt?stateName(state):current?kitLabel(current.text):T('材料已备好，可以投递','Ready to send')}</b></div>
      {!record.appliedAt&&state!=='closed'&&(current?<>{action(current,true)}<button className="btn" disabled={desk.busy} onClick={()=>tick(current)}>{T('完成这一步','Done')}</button></>:<button className="btn btn-primary" disabled={desk.busy} onClick={mark}>{T('标记已投递','Mark sent')}</button>)}
      <span className="working-copy-count" role="status">{T(`已复制 ${kit.answers.length} 项中的 ${copiedCount} 项`,`${copiedCount} of ${kit.answers.length} copied`)}</span>
    </div>
    <details className="phone-steps"><summary>{T('按顺序操作','Steps in order')}</summary><ol>{kit.steps.map((step,i)=><li key={i}>{kitLabel(step)}</li>)}</ol></details>
    <div className="kit-columns"><section className="materials-list"><div className="section-line"><h2>{T('材料','Materials')}</h2><span role="status">{T(`已复制 ${kit.answers.length} 项中的 ${copiedCount} 项`,`${copiedCount} of ${kit.answers.length} copied`)}</span></div>
      {resume}{downloadError&&<p className="field-err" role="alert">{downloadError}</p>}
      <KitCopy id={`cover-${kit.id}`} label={T('求职信（英文）','Cover letter (English)')} value={kit.coverLetter||''} paper onCopied={markCopied}/>
      <div className="answer-heading"><h3>{T('表格答案','Form answers')}</h3>{kit.formNote&&<details className="form-note"><summary>{T('填写说明','Form notes')}</summary><p>{kitLabel(kit.formNote)}</p></details>}</div>
      <div className="answers-list">{answerGroups.map((group,index)=><section className="answer-group" key={group.key} aria-labelledby={`answer-group-${index}`}><h4 id={`answer-group-${index}`}>{group.label}</h4>{group.answers.map(answer=><KitAnswer key={answer.id} kit={kit} answer={answer} record={record} busy={desk.busy} update={update} copied={answerWasCopied(answer)} onCopied={markCopied}/>)}</section>)}</div>
      {kit.salary&&<div className="kit-salary"><label><input type="checkbox" checked={salary} onChange={e=>setSalary(e.target.checked)}/>{T('表格确实要求期望薪资','The form asks for expected salary')}</label>{salary&&<><KitCopy id={`salary-${kit.id}`} label={T('期望薪资','Expected salary')} value={kit.salary.text}/><p className="hint">{kitLabel(kit.salary.note)} <a href={kit.salary.source} target="_blank" rel="noreferrer">{T('薪资来源','Salary source')}</a></p></>}</div>}
    </section><aside className="steps-aside"><nav className="answer-jumps" aria-label={T('跳到表格答案','Jump to form answers')}><h2>{T('表格答案','Form answers')}</h2>{answerGroups.map(group=><button className="answer-jump" key={group.key} onClick={()=>{const node=document.getElementById(`row-answer-${kit.id}-${group.answers[0].id}`);node?.scrollIntoView({block:'start'});node?.focus({preventScroll:true});}}>{group.label}{group.answers.filter(answerWasCopied).length>0&&<span>{T(`已复制 ${group.answers.filter(answerWasCopied).length} 项`,`${group.answers.filter(answerWasCopied).length} copied`)}</span>}</button>)}</nav>

      {!record.appliedAt&&<details className="kit-preparation"><summary>{T('投递前准备','Preparation')}</summary>{kit.actions.map(a=><label key={a.id} className="preparation-action"><input type="checkbox" data-action={a.id} checked={!!record.completed?.[a.id]} disabled={desk.busy} onChange={e=>{const checked=e.target.checked;update(kit.id,r=>({...r,completed:{...r.completed,[a.id]:checked?new Date().toISOString():null}}));}}/><span><small>{a.date} · {a.minutes} {T('分钟','min')}</small><b>{kitLabel(a.title)}</b><span>{kitLabel(a.outcome)}</span></span></label>)}<p className="hint">{T('计划投递 ','Planned send date ')}{kit.applyDate||'—'}</p></details>}
      <details className="steps-in-order"><summary>{T('按顺序操作','Steps in order')}</summary><ol>{kit.steps.map((s,i)=><li key={i}>{kitLabel(s)}</li>)}</ol></details>
      {[['fit',T('为什么适合','Why this role')],['reviewNote',T('核对过什么','What was checked')],['sideDoor',T('投递入口','Way in')]].map(([key,label])=><details key={key}><summary>{label}</summary><p>{kitLabel(kit[key])}</p></details>)}
      <details><summary>{T('材料依据','Sources')}</summary><ul>{(kit.sources||[]).map((s,i)=><li key={i}>{kitLabel(s.label)}{ApplyKits.url(s.url)&&<a href={s.url} target="_blank" rel="noreferrer"> {T('查看来源','View source')}</a>}</li>)}</ul></details>
      <KitOutcome kit={kit} record={record} busy={desk.busy} update={update}/>
    </aside></div><ShortcutsHelp kind="kit"/>
    {!record.appliedAt&&state!=='closed'&&<div className="kit-bottom-action">{open.length?<button className="btn btn-primary" disabled={desk.busy} onClick={()=>tick(open[0])}>{T(`完成第 ${steps.findIndex(s=>s.id===open[0].id)+1} 步`,`Done: step ${steps.findIndex(s=>s.id===open[0].id)+1}`)}</button>:<button className="btn btn-primary" disabled={desk.busy} onClick={mark}>{T('标记已投递','Mark sent')}</button>}</div>}
    {undo&&<div className="desk-undo" role="status">{undo.kind==='sent'?T('已记录投递','Application recorded'):T('步骤已完成','Step finished')}<button className="btn" onClick={()=>{update(kit.id,r=>{if(undo.kind==='step')return {...r,handoffDone:{...r.handoffDone,[undo.step]:null}};const next={...r};delete next.appliedAt;delete next.appliedDate;return next;});setUndo(null);}}>{T('撤销','Undo')}</button></div>}
  </article>;
}

function ApplyTab({openSettings,desk,go}) {
  const selected=ApplyKits.hashId(location.hash),kit=desk.kits.find(k=>k.id===selected);
  if(desk.loading)return <DeskSkeleton/>;
  if(kit)return <KitPage key={kit.id} kit={kit} record={desk.progress.find(r=>r.id===kit.id)||{id:kit.id}} desk={desk} go={go}/>;
  const groups=['yours','ready','saved','sent','talking','offer','quiet','working','closed'];
  const records=new Map(desk.progress.map(r=>[r.id,r]));
  return <div className="apply-list-view"><PageHead title={T('投递材料包','Apply kits')} /><DeskError desk={desk} openSettings={openSettings}/>
    {selected&&!kit&&<p className="field-err" role="alert">{T('这个链接没有对应的申请。','This link has no matching application.')}</p>}
    {!desk.kits.length&&!desk.error&&<section className="card"><h2>{T('还没有申请材料包','No application kits yet')}</h2><p>{T('审核后的材料包上传到你的私有仓库后，就能在这里使用。','Upload reviewed kits to your private repository to use them here.')}</p></section>}
    <div className="kit-groups">{groups.map(state=>{const kits=desk.kits.filter(k=>Ledger.state(k,records.get(k.id))===state);return !!kits.length&&<section className={`kit-group kit-span-${Math.min(3,kits.length)}`} key={state} data-kit-group={state}><div className="section-line"><GroupStamp group={state}/><h2>{stateName(state)}</h2><span>{kits.length}</span></div><ul>{kits.map(k=>{const record=records.get(k.id)||{},copies=new Map(kitCopySessions.get(k.id)||[]),copiedCount=k.answers.filter(a=>copies.get(`answer-${k.id}-${a.id}`)===kitAnswerText(a,record)).length;return <li className="kit-list-row" key={k.id} data-entry="row"><a href={kitHref(k)}><b>{k.role}</b><span>{k.company}{record.outcome?` · ${kitOutcomeLabel(record.outcome)} ${record.outcomeDate?ledgerDate(record.outcomeDate):''}`:k.deadline?` · ${ledgerDate(k.deadline)}`:''}{copiedCount>0&&` · ${T(`已复制 ${copiedCount} 项`,`${copiedCount} copied`)}`}</span>{state==='yours'&&Ledger.openSteps(k,record)[0]&&<span className="kit-step"><mark>{kitLabel(Ledger.openSteps(k,record)[0].text)}</mark></span>}<span className="kit-holds">{T(`${k.answers.length} 项表格答案`,`${k.answers.length} form answers`)}{k.coverLetter?T(' · 求职信',' · cover letter'):''}{T(' · 简历',' · resume')}</span></a></li>;})}</ul></section>;})}</div>
  </div>;
}
