// Apply kits are private, reviewed data, never bundled into the public page.
const ApplyKits = (() => {
  const path = 'data/apply-kits.json';
  const progressPath = 'data/apply-kit-progress.json';
  const outcomes = ['declined', 'interview', 'offer', 'withdrawn'];
  const text = v => typeof v === 'string' ? v : '';
  const day = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0,10) === v;
  const label = v => v == null || typeof v === 'string' || (typeof v === 'object' && !Array.isArray(v) && ['en','zh'].every(l => v[l] == null || typeof v[l] === 'string'));
  function url(v) {
    try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  }
  function file(v) { return /^data\/apply-kits\/[a-z0-9_-]+\/[a-zA-Z0-9_.-]+\.pdf$/.test(v || '') ? v : ''; }
  function validate(rows) {
    if (!Array.isArray(rows)) throw new Error('Apply kits must be an array');
    const ids = new Set();
    rows.forEach(k => {
      if (!k || !/^[a-z0-9_-]+$/.test(k.id || '') || ids.has(k.id) || !text(k.role) || !text(k.company)
          || !url(k.postingUrl) || !file(k.resume?.path) || (k.deadline && !day(k.deadline))
          || !Array.isArray(k.answers) || !Array.isArray(k.actions) || !Array.isArray(k.steps)) throw new Error('Invalid application kit');
      ids.add(k.id);
      if (![k.deadlineKind,k.fit,k.reviewNote,k.sideDoor,k.formNote,k.resume.reason].every(label)
        || (k.coverLetter != null && typeof k.coverLetter !== 'string') || !k.steps.every(label)
        || (k.sources != null && (!Array.isArray(k.sources) || k.sources.some(s => !s || !label(s.label))))
        || (k.salary != null && (typeof k.salary.text !== 'string' || !label(k.salary.note) || !url(k.salary.source)))) throw new Error('Invalid kit content');
      for (const list of [k.answers, k.actions]) {
        const seen = new Set();
        list.forEach(x => { if (!x || !/^[a-z0-9_-]+$/.test(x.id || '') || seen.has(x.id)) throw new Error('Invalid kit item'); seen.add(x.id); });
      }
      k.answers.forEach(a => { if (!label(a.label) || !label(a.note) || !label(a.prompt) || (a.text != null && typeof a.text !== 'string')) throw new Error('Invalid form answer'); });
      k.actions.forEach(a => { if (!day(a.date) || !Number.isFinite(a.minutes) || a.minutes <= 0 || !label(a.title) || !label(a.outcome)) throw new Error('Invalid action'); });
      if (k.applyDate && (!day(k.applyDate) || k.actions.some(a => a.date > k.applyDate) || (k.deadline && k.applyDate > k.deadline))) throw new Error('Application must follow preparation and precede the deadline');
    });
    return rows;
  }
  function validateProgress(rows) {
    if (!Array.isArray(rows) || rows.some((r, i) => !r || typeof r.id !== 'string' || rows.findIndex(x => x?.id === r.id) !== i
      || (r.answers != null && (typeof r.answers !== 'object' || Array.isArray(r.answers)))
      || (r.completed != null && (typeof r.completed !== 'object' || Array.isArray(r.completed)))
      || (r.appliedAt != null && (typeof r.appliedAt !== 'string' || !Number.isFinite(Date.parse(r.appliedAt))))
      || (r.appliedDate != null && !day(r.appliedDate)) || (r.followUpDate != null && !day(r.followUpDate))
      || (r.outcome != null && r.outcome !== '' && !outcomes.includes(r.outcome))
      || (r.outcomeDate != null && r.outcomeDate !== '' && !day(r.outcomeDate))
      || (r.outcomeNote != null && typeof r.outcomeNote !== 'string'))) throw new Error('Invalid application progress');
    return rows;
  }
  function sort(rows) { return [...rows].sort((a,b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || a.company.localeCompare(b.company)); }
  function days(deadline, today) { return day(deadline) ? Math.round((Date.parse(deadline + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 864e5) : null; }
  function applied(record, now = new Date()) {
    if (record.appliedAt) return record;
    const follow = new Date(now); follow.setDate(follow.getDate() + 7);
    const iso = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    return { ...record, appliedAt: now.toISOString(), appliedDate: iso(now), followUpDate: iso(follow) };
  }
  function hashId(hash) { try { return /^#apply\//.test(hash) ? decodeURIComponent(hash.slice(7)) : ''; } catch { return ''; } }
  function setOutcome(record, outcome, date, note = '') {
    const next = {...record};
    if (!outcome) {
      delete next.outcome; delete next.outcomeDate; delete next.outcomeNote;
    } else {
      if (!outcomes.includes(outcome) || !day(date) || typeof note !== 'string') throw new Error('Invalid application outcome');
      Object.assign(next, {outcome, outcomeDate:date, outcomeNote:note.trim()});
    }
    return next;
  }
  function followUp(record) { return record.appliedAt && !['declined','withdrawn'].includes(record.outcome) && day(record.followUpDate) ? record.followUpDate : ''; }
  return { path, progressPath, outcomes, validate, validateProgress, sort, days, applied, setOutcome, followUp, hashId, url, file };
})();
