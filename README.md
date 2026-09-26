# ApplyLedger

![ApplyLedger](.github/header.png)

A job-application tracker for people applying in several countries at once. Every region (Canada, US, UK,
Hong Kong, Mainland China, …) keeps its own pipeline and its own tailored documents; your profile, resume library
and glossary are shared. The app is one HTML file — React 18, compiled ahead of time, with every library served from
this repository — and keeps everything in a **private GitHub repo you own**.

**Live demo:** https://nickkklian.github.io/Job-Tracker/?demo=1&tab=tracker (or `&tab=insights`; add `&region=usa`
to open another region) — sample data, nothing is saved. English by default, 中文 in the top bar.

![Tracker](docs/screenshot-tracker.png)

## What's in it

The navigation has two groups: the views that belong to the region you are in, and the ones every region shares.

| View | What it does |
|---|---|
| **Add job** | Paste a job description or upload one (`.txt/.md/.docx/.pdf`). An upload fills the empty fields — company, role, location, salary, deadline — from the text, heuristically; for pasted text, *Fill fields from the description* does the same. You check them before saving. Tier (T1–T4) and status are on the same form, and in Canada so are the five fields the hours ledger reads |
| **Tracker** | Applications grouped by tier, with a search box and status filters that show their counts; the status is a control you change in place. Opening a job gives prompt generators for a tailored resume, cover letter, interview prep, networking plan and job-description analysis — copied into Claude.ai, no API key needed — the same kind of prompt for translating a resume into Simplified or Traditional Chinese, and PDF slots that sync to the repo |
| **Insights** | Where every application stands: a pipeline chart (or the same numbers as a table) whose parts add up to the whole, response and offer rates, upcoming deadlines and the companies you applied to most. In Canada it opens with the **CEC hours ledger** (below) |
| **Alerts** | Optional, needs an Anthropic key: paste a LinkedIn job-alert email; Claude looks up each posting on the company's careers page and scores it against your profile, and the ones you tick go into the tracker. *Discover new jobs* has Claude run up to five web searches for postings from the last 24 hours that fit your profile and score them the same way. It searches the region picked at the top: each of the twelve regions names its own place and main cities in the search (Remote / Global asks for fully remote roles open to any country) |
| **My profile** | A sectioned profile (upload files, or start from a skeleton and per-role skills blocks), a translation glossary, and formatting rules that go into every resume prompt |
| **Diagnosis** | A six-step check before applying: stage → strengths → target profile → reality check against real postings → resume narrative → high-stakes decisions |
| **Resumes** | A library of resume versions: preview, rename, download, delete, or use one as your profile |

![Insights](docs/screenshot-insights.png)

### Canada: the CEC hours ledger

The Canadian Experience Class counts skilled work hours toward 1,560, and IRCC's 30-hours-a-week cap applies
**across all jobs combined**, not per job. The ledger therefore slices time by week, sums every working job's hours
for that week, caps the total at 30 and gives the capped hours back to each job in proportion — so two 25-hour jobs
count as 30, not 50. It leaves out jobs whose NOC code isn't TEER 1–3 (a job with no NOC code yet is treated as
TEER 2), warns about working jobs with no employment type recorded, since contractor hours don't count, and shows
the date you reach 1,560 at the current weekly rate.

### Batch tailoring (optional, needs an Anthropic key)

For every "Interested" job with a JD, one API call returns the tailored resume as **structured
JSON** (sections → entries → bullets); a small jsPDF renderer lays it out as a one-page Letter PDF
with the same column geometry the Claude.ai prompts specify. Results are pushed to the repo and
cached locally. A job whose resume is already in the repo is skipped before any API call, so a run in
another browser never replaces it; to tailor that job again, delete its resume first.

## How it's built

| Concern | Approach |
|---|---|
| Runtime | One `index.html`, built from `src/` by `build.mjs`: the JSX is compiled ahead of time with esbuild (pinned) and inlined. React 18, ReactDOM, mammoth, jsPDF and pdf.js (loaded the first time a `.pdf` is read) are served from `vendor/` (sources and hashes in `vendor/SOURCE.md`; CI fails if a file there does not match its hash); the styles are plain CSS (`app.css`) on the family's design tokens (`design-tokens.css`), with light/dark and three palettes from `appearance.js`. CI rebuilds the page and fails if it differs from the committed one. It also fails on every way of loading a script from another host that `check-scripts.mjs` lists at its top, among them a `<script>` whose `src` is not a path in this repository (in any case, quoting, spacing or line breaks, with character references, or written inside a string in the code), a `<base href>`, a `<link>` that preloads a script, an import map, `import()`, `importScripts`, workers or a `src` set in code unless the address is a plain path, code that runs text as code (`eval`, `Function`), and any address ending in `.js` or `.mjs`. It reads `index.html` and the page's own scripts outside `vendor/`, after a self-test that catches one sample of each form and passes the real page. Ways a static check cannot see, such as code text held in a variable and given to `setTimeout`, or names built while the page runs, are stopped by the browser instead: the page's Content-Security-Policy (written by `build.mjs`) lets scripts come only from this site and from the page's own inline scripts by their sha256, with no `'unsafe-eval'`, so text run as code and scripts from other hosts are refused while the page runs. `check-scripts.mjs` fails CI if that policy is missing, moved after a script, or loosened in any way |
| Storage | GitHub Contents API against a private repo. Each write sends the file's last known SHA; if the file changed since (another tab or device saved first, GitHub answers 409), it reads the file again and merges: what changed on one side only is kept from both, and when both sides changed the same value it asks which to keep. A page that never read a file does not write over it |
| Files | PDFs are stored as raw base64 under `data/files/` and cached in localStorage for instant preview; on a new device they're pulled from the repo on first open |
| JD parsing | Regex heuristics over the first 80 cleaned lines (noise such as contact lines, EEO boilerplate and URLs is stripped first); the raw JD is always stored unmodified |
| Prompts | Long, explicit reportlab instructions (column widths, table styles, one-page enforcement, a banned-word list for junior résumés) so Claude.ai's Analysis tool produces a consistent PDF every time |
| Secrets | GitHub token and Anthropic key live only in this browser's localStorage |
| Language | English by default, 中文 via the top bar; stored ids and prompt templates are never translated |

## Running it

Open `index.html` from any static server — every script the page uses is in this repository, including pdf.js
for reading `.pdf` job descriptions. To serve it locally:

```bash
python3 -m http.server 8732        # then http://localhost:8732/?demo=1&tab=tracker
```

To change it, edit `src/app.jsx` (the app) or `src/index.template.html` (the page around it), install the one
build dependency with `npm install` (esbuild 0.27.7), then:

```bash
node build.mjs            # writes index.html
node build.mjs --check    # what CI runs: index.html must be exactly what src/ builds to, and vendor/ match its hashes
node check-scripts.mjs    # CI too: no script from another host, and the page's script policy intact (--self-test: each form and each loosened policy is caught)
node check-models.mjs     # CI too: the page asks for Claude Opus 5.5 or Sonnet 5 only, with max_tokens >= 16000, and reads replies by block type (--self-test: each rule is caught)
```

A link can open a region: `?region=usa` (the ids are the `REGIONS` list in `src/app.jsx`); the region picker still
changes it.

To use it for real, create a private repo, generate a classic token with the `repo` scope, and
enter both in Settings (the gear in the top bar). The optional features (Batch Tailor, Alerts) take an Anthropic
API key in the same dialog.

## Limitations

- Calling the Anthropic API from the browser requires the `anthropic-dangerous-direct-browser-access`
  header. The key is stored only in this browser and sent only to Anthropic's API, which suits one person's own copy
  but not a shared deployment.
- The JD extractor is heuristic and tuned for English postings; it fills, you check.

## License

MIT.
