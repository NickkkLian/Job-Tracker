// Read-only kits + a separate progress file use the same strict reads, serial saves,
// three-way conflicts and mounted-file replacement as the rest of ApplyLedger.
function kitLabel(value) { if (typeof value === 'string') return value; const preferred=value?.[lang], fallback=value?.[lang === 'zh' ? 'en' : 'zh']; return typeof preferred === 'string' ? preferred : typeof fallback === 'string' ? fallback : ''; }

function KitCopy({ id, label, value }) {
  const [state, setState] = useState('');
  const copy = async () => {return HubSettingsRuntime.track(async()=>{/* settings workflow */
    try { await navigator.clipboard.writeText(value); setState('copied'); }
    catch { setState('failed'); }
  });};
  return <div className="kit-copy">
    <div className="kit-copy-head"><label htmlFor={id}>{label}</label><button type="button" className="btn" data-copy={id} disabled={!value} onClick={copy}>{state === 'copied' ? T('已复制','Copied') : T('复制','Copy')}</button></div>
    <textarea id={id} value={value || ''} readOnly rows={value?.length > 450 ? 9 : 2} onFocus={e => e.target.select()} />
    <span className={state === 'failed' ? 'field-err' : 'hint'} role="status">{state === 'failed' ? T('复制失败，请选中文字手动复制。','Copy failed. Select the text and copy it manually.') : state === 'copied' ? T('已原样复制。','Copied exactly.') : ''}</span>
  </div>;
}

function KitAnswer({ kit, answer, record, busy, update }) {
  const saved = typeof record.answers?.[answer.id] === 'string' ? record.answers[answer.id] : answer.text || '';
  const [draft, setDraft] = useState(saved);
  useSettingsDraft(draft!==saved);
  useEffect(() => setDraft(saved), [saved]);
  const id = `answer-${kit.id}-${answer.id}`;
  return <div className="kit-answer">
    {answer.editable && <div className="kit-personal">
      <label htmlFor={`${id}-edit`}>{kitLabel(answer.label)} · {T('填写真实信息后保存','Enter your actual answer, then save')}</label>
      <input id={`${id}-edit`} value={draft} placeholder={kitLabel(answer.prompt)} onChange={e => setDraft(e.target.value)} disabled={busy} />
      <button className="btn" type="button" disabled={busy || !draft.trim() || draft === saved} onClick={() => update(kit.id, r => ({...r, answers:{...r.answers, [answer.id]:draft}}))}>{T('保存答案','Save answer')}</button>
    </div>}
    <KitCopy id={id} label={kitLabel(answer.label)} value={saved} />
    {answer.note && <p className="hint">{kitLabel(answer.note)}</p>}
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

function ApplyKitCard({ kit, record, busy, update, focused }) {
  const ref = useRef(null);
  const [salary, setSalary] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    if (focused && ref.current) { ref.current.open = true; ref.current.scrollIntoView({block:'start'}); ref.current.querySelector('summary')?.focus(); }
  }, [focused]);
  const count = ApplyKits.days(kit.deadline, localISO(new Date()));
  const countdown = count == null ? T('未注明截止日期','No published deadline') : count < 0 ? T(`已过 ${-count} 天`, `${-count} days past`) : count === 0 ? T('今天到期','Due today') : T(`还有 ${count} 天`, `${count} days left`);
  const download = async () => {return HubSettingsRuntime.track(async()=>{/* settings workflow */
    setDownloading(true); setDownloadError('');
    try {
      const data = await ghFindDataUrl(kit.resume.path, 'application/pdf');
      if (!data) throw new Error(T('简历文件不存在，请联系资料维护者。','The resume file is missing. Ask the kit maintainer to upload it.'));
      const bin = atob(data.split(',')[1] || '');
      if (!bin.startsWith('%PDF-')) throw new Error(T('下载内容不是 PDF。','The downloaded file is not a PDF.'));
      const blob = new Blob([Uint8Array.from(bin, c => c.charCodeAt(0))], {type:'application/pdf'});
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = kit.resume.path.split('/').pop(); a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { setDownloadError(e.message); }
    finally { setDownloading(false); }
  });};
  return <details className={`card apply-kit${focused ? ' kit-focused' : ''}`} ref={ref} data-kit={kit.id}>
    <summary>
      <span className="kit-summary"><span className="eyebrow">{kit.company}{kit.optional ? ` · ${T('可选','Optional')}` : ''}</span><h2>{kit.role}</h2><span className="kit-status"><span className={`tag ${record.outcome === 'offer' ? 'tag-success' : record.outcome === 'interview' ? 'tag-warning' : record.outcome ? 'tag-neutral' : record.appliedAt ? 'tag-info' : 'tag-neutral'}`}>{kitOutcomeLabel(record.outcome) || (record.appliedAt ? T('已投递','Applied') : T('待投递','To apply'))}</span>{record.outcome && record.outcomeDate && <span className="kit-date">{record.outcomeDate}</span>}</span>{record.outcome && record.outcomeNote && <span className="kit-result-note">{record.outcomeNote}</span>}<span className="kit-date">{kit.deadline || '—'} · {countdown} · {kitLabel(kit.deadlineKind)}</span></span>
    </summary>
    <div className="kit-body">
      <div className="kit-record">
        <button type="button" className="btn btn-primary" data-applied={kit.id} disabled={busy || !!record.appliedAt || ['declined','withdrawn'].includes(record.outcome)} onClick={() => update(kit.id, r => ApplyKits.applied(r))}>{busy ? T('保存中…','Saving…') : record.appliedAt ? T('已记录投递','Application recorded') : T('标记已投递','Mark applied')}</button>
        <p>{record.appliedAt ? <>{T('投递日期：','Applied: ')}{record.appliedDate || record.appliedAt.slice(0,10)}{ApplyKits.followUp(record) && <> · {T('跟进日期：','Follow up: ')}{ApplyKits.followUp(record)}</>}</> : !['declined','withdrawn'].includes(record.outcome) && T('实际发送后点击。将记录当天日期，并在一周后跟进。','Click after sending. Records the date and a follow-up date one week later.')}</p>
        <KitOutcome kit={kit} record={record} busy={busy} update={update}/>
      </div>
      <div className="acts"><a className="btn" href={kit.postingUrl} target="_blank" rel="noreferrer">{T('打开职位','Open posting')} <Icon name="open" size={14}/></a><a href={`#apply/${encodeURIComponent(kit.id)}`}>{T('此申请的链接','Link to this application')}</a></div>
      <p className="kit-notice">{kitLabel(kit.reviewNote)}</p>
      <h3>{T('是否合适','Fit and gaps')}</h3><p>{kitLabel(kit.fit)}</p>
      <p className="hint">{T('联系入口：','Way in: ')}{kitLabel(kit.sideDoor)}</p>
      <section aria-label={T('投递前','Before you apply')}>
        <h3>{T('投递前','Before you apply')}</h3>
        <p className="hint">{T('这些日期已经写进你的日历。只有实际完成后才勾选。','These dates are on your calendar. Check an action only after completing it.')}</p>
        {kit.actions.length ? <ul className="kit-actions">{kit.actions.map(a => <li key={a.id}>
          <label><input type="checkbox" data-action={a.id} checked={!!record.completed?.[a.id]} disabled={busy} onChange={e => {const checked=e.target.checked; update(kit.id, r => ({...r, completed:{...r.completed, [a.id]:checked ? new Date().toISOString() : null}}));}}/><span><b>{a.date} · {a.minutes} {T('分钟','min')}</b><br/>{kitLabel(a.title)}</span></label><p>{kitLabel(a.outcome)}</p>
        </li>)}</ul> : <p>{T('没有已确认、可在截止前补上的技能缺口。','No confirmed skill gap that can be closed before the deadline.')}</p>}
        <p><b>{T('计划投递：','Planned application: ')}</b>{kit.applyDate || '—'} · {T('完成准备后，再按下方步骤投递。','Complete preparation, then follow the steps below.')}</p>
      </section>
      <section aria-label={T('发送材料','Send')}>
        <h3>{T('发送材料','Send')}</h3>
        <button type="button" className="btn btn-primary" data-download={kit.id} disabled={downloading} onClick={download}>{downloading ? T('下载中…','Downloading…') : T('下载所选简历','Download selected resume')}</button>
        <p className="hint">{kit.resume.path.split('/').pop()} · {kitLabel(kit.resume.reason)}</p>
        {downloadError && <p className="field-err" role="alert">{downloadError}</p>}
        <KitCopy id={`cover-${kit.id}`} label={T('求职信 / 邮件正文（英文）','Cover letter / email body (English)')} value={kit.coverLetter || ''}/>
        <h3>{T('表格答案','Form answers')}</h3>
        <p className="hint">{kitLabel(kit.formNote)}</p>
        {kit.answers.map(a => <KitAnswer key={a.id} kit={kit} answer={a} record={record} busy={busy} update={update}/>)}
        {kit.salary && <div className="kit-salary"><label><input type="checkbox" checked={salary} onChange={e => setSalary(e.target.checked)}/>{T('表格确实要求期望薪资','The form asks for expected salary')}</label>{salary && <><KitCopy id={`salary-${kit.id}`} label={T('薪资（仅被问到时）','Salary (only if asked)')} value={kit.salary.text || ''}/><p className="hint">{kitLabel(kit.salary.note)} {ApplyKits.url(kit.salary.source) && <a href={kit.salary.source} target="_blank" rel="noreferrer">{T('薪资来源','Salary source')}</a>}</p></>}</div>}
      </section>
      <section><h3>{T('按顺序操作','Steps in order')}</h3><ol className="how">{kit.steps.map((s,i) => <li key={i}>{kitLabel(s)}</li>)}</ol></section>
      <details className="kit-sources"><summary>{T('材料依据','Sources for this kit')}</summary><ul>{(kit.sources || []).map((s,i) => <li key={i}>{kitLabel(s.label)}{ApplyKits.url(s.url) && <> · <a href={s.url} target="_blank" rel="noreferrer">{T('来源','Source')}</a></>}</li>)}</ul></details>
    </div>
  </details>;
}

function ApplyTab({ openSettings }) {
  const [kits, setKits] = useState([]), [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(null), [saveError, setSaveError] = useState('');
  const [attempt, setAttempt] = useState(0), [busy, setBusy] = useState(false), [selected, setSelected] = useState(() => ApplyKits.hashId(location.hash));
  const now = useRef(progress); now.current = progress;
  useEffect(() => holdFile('applyProgress', () => now.current, setProgress), []);
  useEffect(() => {const h=() => setSelected(ApplyKits.hashId(location.hash)); window.addEventListener('hashchange',h); window.addEventListener('popstate',h); return () => {window.removeEventListener('hashchange',h); window.removeEventListener('popstate',h);};}, []);
  useEffect(() => {
    let cancelled=false; setLoading(true); setError(null);
    if (!ghConfigured()) {setKits([]); setProgress([]); setLoading(false); return;}
    Promise.all([ghRead(ApplyKits.path), loadJsonStrict('applyProgress')]).then(([text, records]) => {
      const data=ApplyKits.validate(text ? JSON.parse(text) : []); ApplyKits.validateProgress(records);
      if (!cancelled) {setKits(ApplyKits.sort(data)); setProgress(records); setLoading(false);}
    }).catch(e => {if(!cancelled){setError(e); setLoading(false);}});
    return () => {cancelled=true;};
  }, [attempt]);
  const update = async (id, transform) => {return HubSettingsRuntime.track(async()=>{/* settings workflow */
    if (busy || error || loading || !ghConfigured()) return;
    setBusy(true); setSaveError('');
    const rows=now.current, record=rows.find(r => r.id === id) || {id};
    const changed=transform(record), next=rows.some(r => r.id === id) ? rows.map(r => r.id === id ? changed : r) : [...rows, changed];
    try {const r=await ghWrite(ApplyKits.progressPath, next); setProgress(ApplyKits.validateProgress(r.data));}
    catch(e){console.warn(e);setSaveError('failed');}
    finally {setBusy(false);}
  });};
  return <>
    <PageHead eyebrow={T('所有地区共用','Shared by all regions')} title={T('去投递','Apply')} sub={T('材料、准备和下一步，都在同一处。','Your materials, preparation and next step, together.')} />
    {loading ? <div className="card" aria-busy="true">{T('正在读取申请材料…','Loading application kits…')}</div> : error ? <ErrorCard title={T('没能读取申请材料，未保存任何更改','Couldn’t read application kits; no changes saved')} error={error} onRetry={() => setAttempt(x => x+1)} openSettings={openSettings}/> : !kits.length ? <section className="card"><h2>{T('还没有申请材料包','No application kits yet')}</h2><p>{T('由资料维护者审核材料包后上传到你的私有仓库，即可在这里使用。','Your kit maintainer can review and upload application kits to your private repository to make them available here.')}</p></section> : <>
      <p className="hint">{T(`${kits.length} 份申请 · 按截止日期排序 · 投递记录保存到你的仓库`,`${kits.length} applications · nearest deadline first · progress saved to your repo`)}</p>
      {selected && !kits.some(k => k.id === selected) && <p className="field-err" role="alert">{T('这个链接没有对应的申请，请从下面选择。','This link has no matching application. Choose one below.')}</p>}
      {saveError && <p className="field-err kit-save-error" role="alert">{T('保存失败；刚才的操作未记录，请重试。','Save failed; the last action was not recorded. Please retry.')}</p>}
      <div className="kit-list">{kits.map(kit => <ApplyKitCard key={kit.id} kit={kit} record={progress.find(r => r.id === kit.id) || {id:kit.id}} busy={busy} update={update} focused={selected === kit.id}/>)}</div>
    </>}
  </>;
}
