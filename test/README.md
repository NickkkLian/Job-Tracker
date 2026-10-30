# Apply-kit checks

Run the app's offline unit checks with `node --test test/*.test.mjs`.

`save-status.test.mjs` exercises the production per-file queue: newer queued edits, retry payloads when the
displayed file is older, no-write merges, restore reload errors and PDF recovery byte matching.
`save-status.browser.mjs green` uses the shared harness with only fictional HTTP fixtures; `red` requires
`APP_ROOT` pointing to a pre-status checkout. It checks header transitions, Retry, offline retention, writes made
while another save is in flight, attachment/restore paths and geometry in all six states. Set `EVIDENCE_DIR` for
JSON and header screenshots. Browser runs need an explicitly approved round and must respect the run cap.

The browser extension uses the shared app-harness `cdp.mjs` and `page.mjs`. Set
`HARNESS_ROOT` to that folder (the one holding `cdp.mjs` and `page.mjs`).
Create a local temporary directory, then run from this checkout:

```sh
HARNESS_HTTP=1 SETTINGS_FIXTURE=1 HARNESS_OFFLINE=1 TMPDIR=/absolute/path/to/job/tmp node test/apply-kits.browser.mjs .
HARNESS_HTTP=1 SETTINGS_FIXTURE=1 HARNESS_OFFLINE=1 TMPDIR=/absolute/path/to/job/tmp node "$HARNESS_ROOT/tests/Job-Tracker.mjs" .
```

Scenarios S28–S37 extend the shared suite using the same fake GitHub and CDP mobile
emulation. They cover sorting, deep links, exact copying, real browser download bytes,
persisted personal answers and application/follow-up dates, stale-save merging,
failed reads/writes, invalid kits, clipboard failure, Chinese, dark mode and 375px
layout. All fixtures are fictional. No real repository is contacted.

S38–S40 cover stored outcomes in collapsed and open cards, all four results,
closed follow-up suppression, reload, clearing, preservation of other progress and
failed saves. Set `EVIDENCE_DIR` to an absolute local folder to capture desktop and
375px phone screenshots. Set `LEGACY_PAGE` to an archived pre-change `index.html`
to include S41, which opens that actual older page and saves twice after an
external outcome update on the same record. For a branch based on main:

```sh
git show origin/main:index.html > /absolute/path/to/job/legacy-index.html
HARNESS_HTTP=1 SETTINGS_FIXTURE=1 HARNESS_OFFLINE=1 TMPDIR=/absolute/path/to/job/tmp \
LEGACY_PAGE=/absolute/path/to/job/legacy-index.html \
EVIDENCE_DIR=/absolute/path/to/job/evidence \
node test/apply-kits.browser.mjs .
```

The shared suite stays outside this checkout; the extension is kept here so it can
be reviewed and run without modifying another workspace.

The approved pipeline redesign has two additional browser checks. From the parent
workspace, with the same offline browser and local HTTP environment, run:

```sh
HARNESS_ROOT=/absolute/path/to/app-harness node Job-Tracker/test/pipeline.browser.mjs green
HARNESS_ROOT=/absolute/path/to/app-harness node Job-Tracker/test/pipeline-gaps.browser.mjs green
```

The first checks keyboard Move to, saved status, focus and announcement, populated
columns, per-region tier folding, phone order, filters and the one-row header.
The second measures text/SVG gaps at 1440 and 390 with the invented 110-job real
and busy mixes. `red` uses `BASELINE_ROOT` (default `.tmp/baseline`) for the gap
check. Results go to the parent workspace's `evidence/red` or `evidence/green`.
The shared measurement helper includes visible descendants of `display: contents`.
