# Apply-kit checks

Run the app's offline unit checks with `node --test test/*.test.mjs`.

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
