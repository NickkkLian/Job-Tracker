# Private Apply kits

Open `?tab=apply` or `#apply/<id>`. A hash selects the Apply view, opens the matching
card and moves focus to it. Other views clear the hash. The cards sort by date with
undated applications last. Dates and countdowns are calendar dates; each kit labels
an employer closing date versus a personal target. Preparation dates are proposals,
not claims that the user's calendar has been updated.

The app reads these files from its existing configured private data repository:

| Private path | Purpose |
| --- | --- |
| `data/apply-kits.json` | Reviewed kit array, read only in this view |
| `data/apply-kits/<id>/<filename>.pdf` | Reviewed selected attachment |
| `data/apply-kit-progress.json` | User progress array, created on the first action if missing |

No personal kit or resume belongs in this public app checkout. A missing kits file
shows an empty state; a failed/malformed read shows an error and prevents progress
writes. Reads use the existing GitHub Contents/Blobs transport. Progress writes use
the existing serial save queues, three-way conflicts and mounted file holder. Failed
writes show an error and do not claim success. The kits file is never rewritten.

A kit uses this structure (English examples; UI metadata has English and Chinese):

```json
{
  "id": "example-role",
  "company": "Example employer",
  "role": "Example role",
  "deadline": "2026-10-30",
  "deadlineKind": {"en": "Employer close", "zh": "雇主截止日期"},
  "applyDate": "2026-10-28",
  "postingUrl": "https://example.com/job",
  "resume": {
    "path": "data/apply-kits/example-role/resume.pdf",
    "reason": {"en": "Relevant version", "zh": "相关版本"}
  },
  "coverLetter": "Exact English send text",
  "answers": [{"id": "start", "label": {"en": "Start date", "zh": "入职日期"}, "text": "", "editable": true}],
  "actions": [{"id": "practice", "date": "2026-10-27", "minutes": 60, "title": {"en": "Practice", "zh": "练习"}, "outcome": {"en": "Evidence to keep", "zh": "保存证据"}}],
  "steps": [{"en": "Review, then submit yourself", "zh": "审核后自行提交"}],
  "fit": {"en": "Evidence and remaining gaps", "zh": "依据与剩余缺口"},
  "reviewNote": {"en": "Verification status", "zh": "核实状态"},
  "sideDoor": {"en": "Verified contact, or none", "zh": "已核实联系人或无"},
  "formNote": {"en": "Known answers and limits", "zh": "已知答案与限制"},
  "sources": [{"label": {"en": "Posting source", "zh": "岗位来源"}, "url": "https://example.com/job"}]
}
```

`optional: true` labels an optional application. A missing/empty `deadline` means
no published close. Optional `salary: {text, source, note}` appears only after the
user confirms the form asks for salary. Salary source must be an HTTPS employer URL.

Progress keeps kit content separate:

```json
[
  {
    "id": "example-role",
    "answers": {"start": "Actual answer entered by the user"},
    "completed": {"practice": "2026-10-27T19:00:00.000Z"},
    "appliedAt": "2026-10-28T22:00:00.000Z",
    "appliedDate": "2026-10-28",
    "followUpDate": "2026-11-04",
    "outcome": "declined",
    "outcomeDate": "2026-11-02",
    "outcomeNote": "The fictional employer has filled the role."
  }
]
```

Mark applied is idempotent and records the user's local date plus seven calendar
days, including across daylight-saving changes. It records a kit application; the
existing regional tracker rows are not changed. The follow-up is a recorded date,
not an automatic reminder or message. The app never submits applications, sends
email, adds calendar entries or changes the task list. Unknown fields and unrelated
progress records survive conflict merges. Blank personal answers have disabled
copy buttons until an actual answer is saved.

Each application can record one current outcome: `declined`, `interview`, `offer`
or `withdrawn`. The collapsed Apply list and open application show its translated
label, date and short note. Use **Record outcome** / **Edit outcome** near the top
of the application, choose a result and date, add an optional note (up to 500
characters), then **Save outcome**. The date defaults to today in the user's local
calendar. Outcomes can also be recorded when an older record has no applied date.

Declined and withdrawn are closed: their follow-up reminder is hidden without
deleting its stored date. Interview and offer keep it visible. **Clear outcome**
removes all three outcome fields and restores an existing follow-up date. It does
not remove application dates, preparation, personal answers or unrelated fields.
No migration is needed: records without these fields, or with just an outcome,
remain valid. Failed saves retain the draft and show the previously saved result.
The existing field-preserving transforms and three-way merge keep outcomes when
an older page saves another field, including after first encountering an outcome
written by another page. Regional Tracker statuses remain separate from Apply kits.
