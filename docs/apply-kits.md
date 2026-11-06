# Private Apply kits

Open `?tab=apply` or `#apply/<id>`. A hash opens the matching full-page kit and moves
focus to its heading. Add `?step=<step-id>` after the hash to focus a particular handoff.
The default Now view shows open handoffs and approaching dates. Other views clear
the hash. The kit list groups by derived state, then sorts each group by deadline,
with undated applications last. Dates and countdowns are calendar dates; each kit labels
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
  "jobRef": {"region": "canada", "id": "example-job"},
  "handoff": {
    "updatedAt": "2026-10-28T19:00:00.000Z",
    "steps": [{"id": "submit", "kind": "submit", "text": {"en": "Review and submit", "zh": "核对后提交"}}]
  },
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
    "handoffDone": {"submit": "2026-10-28T22:00:00.000Z"},
    "outcome": "declined",
    "outcomeDate": "2026-11-02",
    "outcomeNote": "The fictional employer has filled the role."
  }
]
```

**Mark sent** is idempotent and records the user's local date. Older progress fields
are preserved during merges. `jobRef` is optional. With a matching reference, Mark
sent records progress and changes that regional job to `applied` through one Git
commit and a non-forced branch update. A moved branch causes a fresh three-way merge.
An interview, offer or declined outcome changes the linked row to `interviewing`,
`offered` or `rejected` in the same operation. A missing linked row blocks the save
and explains the problem. Kits without a reference continue to save progress alone.
Unknown fields and unrelated progress records survive conflict merges. Blank
personal answers have disabled copy buttons until an actual answer is saved.

`handoff` is optional and written by the kit's author. Each step has a stable ID,
English and Chinese text, a kind (`robot-check`, `code`, `upload`, `sign-in`, `consent`,
`submit` or `other`), and an optional HTTPS URL. Completed steps use ISO timestamps
in `handoffDone`. With no handoff, Your part uses the existing `steps` checklist.
User-written steps live in `manualSteps` in progress. Copy marks stay in page memory.
Done and Mark sent have a six-second Undo. Not today hides a handoff until the next
local midnight in this browser.

Sent applications with no outcome move to No reply after 21 days. Ready to send is
derived from a planned date in the next seven days or a deadline in the next fourteen
days. These are display states, leaving the seven stored job statuses intact.

Each application can record one current outcome: `declined`, `interview`, `offer`
or `withdrawn`. The Apply kits list and open application show its translated
label, date and short note. Use **Record outcome** / **Edit outcome** in the steps panel
of the application, choose a result and date, add an optional note (up to 500
characters), then **Save outcome**. The date defaults to today in the user's local
calendar. Outcomes can also be recorded when an older record has no applied date.

Declined and withdrawn appear in Closed. **Clear outcome** removes all three
outcome fields. Application dates, preparation, personal answers and unrelated fields
remain available.
No migration is needed: records without these fields, or with just an outcome,
remain valid. Failed saves retain the draft and show the previously saved result.
The existing field-preserving transforms and three-way merge keep outcomes when
an older page saves another field, including after first encountering an outcome
written by another page. The public demo includes three fictional complete kits and
creates a sample tailored PDF from its fictional profile when Download is pressed.

Moving a linked job in Applications also updates its kit progress in the same commit.
Moving to Saved clears the current send/outcome facts; moving to Sent records today
only when no send date exists. Talking, Offer and Closed record the outcome date
without inventing an earlier send date. Working keeps an ISO `markedWorkingAt` fact
in progress, preserves an existing offer date/note, and keeps the stored job status
`working`. Editing that offer without changing its outcome preserves the Working
fact. A changed job status also records `statusChangedAt` on the regional row;
older rows without event dates are not included in dated reply totals.

Optional answer `group` labels can name form sections. Without them the page makes
groups of eight answers in their existing order. Short answers share two desktop
columns; long values use a full-width row and clamp to two lines until Show all.
The sidebar jumps to these groups. A Your part bar stays below the header after
the original step scrolls away. The page has no nested scrolling region. Copy
marks belong to the exact copied value: saving a different answer clears its mark
and removes it from the copied count. Marks survive navigation within the current
document and clear on reload. No follow-up date is written or displayed; old stored
`followUpDate` values are preserved as unknown legacy fields during merges.

The kit initially shows the current handoff, the resume download, cover Copy and
answer previews. Preview text opens the full cover letter. Why this file explains
the resume choice. Preparation and the longer instructions open on demand. Other
steps holds the remaining handoff checklist. Application options holds the posting,
Copy link, manual-step editor and linked job details. On phones a long answer uses
one preview line below its label. Show all always reveals the complete value.
Now keeps the task preview and identity to two lines. Its Activity disclosure
contains waiting, weekly activity, saved-row checks and keyboard help.
