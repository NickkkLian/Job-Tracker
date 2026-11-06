// Display states are derived. Legacy stored statuses and unknown fields retain their meaning.
const Ledger = (() => {
  const QUIET_AFTER_DAYS = 21, READY_WINDOW_DAYS = 7, DEADLINE_WINDOW_DAYS = 14;
  const age = (value, now = new Date()) => value && Number.isFinite(Date.parse(value)) ? Math.max(0, Math.floor((now - new Date(value)) / 864e5)) : null;
  function inPeriod(value, period, now = new Date()) {
    if (!value || !Number.isFinite(Date.parse(value))) return false;
    const start = new Date(now.getFullYear(), now.getMonth(), period === 'month' ? 1 : now.getDate());
    if (period === 'week') start.setDate(start.getDate() - (start.getDay()+6)%7);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(...value.split('-').map((part,i)=>Number(part)-(i===1?1:0))) : new Date(value);
    return date >= start && date <= now;
  }
  const steps = (kit, record = {}) => [
    ...(kit.handoff?.steps || kit.steps.map((text, i) => ({id:`legacy-${i}`, text, kind:'other'}))),
    ...(record.manualSteps || []).map(s => ({...s, kind:'other'})),
  ];
  const openSteps = (kit, record = {}) => steps(kit, record).filter(s => !record.handoffDone?.[s.id]);
  function state(kit, record = {}, job, now = new Date()) {
    const outcome = record.outcome;
    if (['declined','withdrawn'].includes(outcome)) return 'closed';
    if (outcome === 'interview') return 'talking';
    if (record.markedWorkingAt || job?.status === 'working') return 'working';
    if (outcome === 'offer') return 'offer';
    if (record.appliedAt) return age(record.appliedAt, now) >= QUIET_AFTER_DAYS ? 'quiet' : 'sent';
    if (job && job.status !== 'interested') {
      if (job.status === 'applied') return age(job.appliedAt, now) >= QUIET_AFTER_DAYS ? 'quiet' : 'sent';
      return ({interviewing:'talking',offered:'offer',working:'working',rejected:'closed',interview_rejected:'closed'})[job.status] || 'closed';
    }
    if (kit?.handoff && openSteps(kit, record).length || record.manualSteps?.some(s => !record.handoffDone?.[s.id])) return 'yours';
    const today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    const planned = kit && ApplyKits.days(kit.applyDate, today);
    const deadline = ApplyKits.days(kit?.deadline || job?.applicationDeadline, today);
    if (kit && planned != null && planned >= 0 && planned <= READY_WINDOW_DAYS || deadline != null && deadline >= 0 && deadline <= DEADLINE_WINDOW_DAYS) return 'ready';
    return 'saved';
  }
  function entries(jobs, kits, progress, region, now = new Date()) {
    const records = new Map(progress.map(r => [r.id,r]));
    const linked = new Set(kits.filter(k => k.jobRef?.region === region).map(k => String(k.jobRef.id)));
    return [
      ...kits.map(kit => {
        const record = records.get(kit.id) || {id:kit.id};
        const job = kit.jobRef?.region === region ? jobs.find(j => String(j.id) === String(kit.jobRef.id)) : null;
        return {id:`kit-${kit.id}`,kit,record,job,company:kit.company,role:kit.role,region:kit.jobRef?.region || region,state:state(kit,record,job,now),sentAt:record.appliedAt};
      }),
      ...jobs.filter(j => !linked.has(String(j.id))).map(job => ({id:`job-${job.id}`,job,company:job.company,role:job.role,region,state:state(null,{},job,now),sentAt:job.appliedAt || null})),
    ];
  }
  function linkedStatus(record, previous = {}) {
    if (record.outcome === 'interview') return 'interviewing';
    if (record.outcome === 'declined') return 'rejected';
    if (record.markedWorkingAt && record.outcome !== 'withdrawn') return 'working';
    if (record.outcome === 'offer') return 'offered';
    if (record.appliedAt) return 'applied';
    if (previous.appliedAt && !record.appliedAt) return 'interested';
    if (previous.outcome && !record.outcome) return 'interested';
    return null;
  }
  function jobStatusPatch(job,status,now = new Date()) {
    const patch = {status};
    if (job.status !== status) patch.statusChangedAt = now.toISOString();
    if (status === 'interested') patch.appliedAt = null;
    if (status === 'applied' && job.status !== 'applied' && !job.appliedAt) patch.appliedAt = now.toISOString();
    return patch;
  }
  function progressForStatus(record, status, now = new Date()) {
    let next = {...record};
    delete next.markedWorkingAt;
    if (status === 'interested') {
      delete next.appliedAt; delete next.appliedDate;
      return ApplyKits.setOutcome(next, '');
    }
    if (status === 'applied') next = ApplyKits.applied(next, now);
    const outcome = {interviewing:'interview',offered:'offer',working:'offer',rejected:'declined',interview_rejected:'declined'}[status] || '';
    const today = ApplyKits.applied({id:record.id},now).appliedDate;
    const sameOutcome = outcome && outcome === record.outcome;
    next = ApplyKits.setOutcome(next, outcome, sameOutcome ? record.outcomeDate || today : today, sameOutcome ? record.outcomeNote || '' : '');
    if (status === 'working') next.markedWorkingAt = now.toISOString();
    return next;
  }
  const isReply = row => row.record?.outcome ? ['declined','interview','offer'].includes(row.record.outcome) : ['talking','offer','working'].includes(row.state);
  return {QUIET_AFTER_DAYS,READY_WINDOW_DAYS,DEADLINE_WINDOW_DAYS,age,inPeriod,steps,openSteps,state,entries,linkedStatus,jobStatusPatch,progressForStatus,isReply};
})();

// Publish both files through one non-forced Git ref update. A competing writer triggers a fresh merge.
async function saveLinkedFiles({files, request, read, merge, ask, attempts = 4}) {
  const repo = await request('');
  const branch = encodeURIComponent(repo.default_branch);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const ref = await request(`/git/ref/heads/${branch}`);
    const head = ref.object.sha;
    const commit = await request(`/git/commits/${head}`);
    const conflicts = [];
    const remote = await Promise.all(files.map(f => read(f.path, head)));
    let values = files.map((f,i) => merge(f.base,remote[i],f.value,{conflicts},[f.path]));
    if (conflicts.length) {
      const pick = await ask(conflicts);
      if (!['mine','theirs'].includes(pick)) throw new Error('Save cancelled');
      values = files.map((f,i) => merge(f.base,remote[i],f.value,{pick},[f.path]));
    }
    const tree = await request('/git/trees','POST',{base_tree:commit.tree.sha,tree:files.map((f,i) => ({path:f.path,mode:'100644',type:'blob',content:JSON.stringify(values[i])}))});
    const next = await request('/git/commits','POST',{message:'jobapp: record linked application progress',tree:tree.sha,parents:[head]});
    try {
      await request(`/git/refs/heads/${branch}`,'PATCH',{sha:next.sha,force:false});
      return values;
    } catch (e) {
      if (![409,422].includes(e.status) || attempt === attempts-1) throw e;
    }
  }
}
