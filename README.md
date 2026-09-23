# Job Application Command Center

A single-file job-search tracker for people applying across several countries at once. Every
region (Canada, US, UK, Hong Kong, Mainland China, …) keeps its own pipeline and its own tailored
documents; profile, resume library and glossary are shared. The app is one HTML file — React 18,
compiled ahead of time, with every library served from this repository — and stores everything in
a **private GitHub repo you own**.

**Live demo:** https://nickkklian.github.io/Job-Tracker/?demo=1&tab=tracker (or `&tab=insights`) —
sample data, nothing is saved. English by default, 中文 toggle in the header.

![Tracker](docs/screenshot-tracker.png)

## What's in it

| Tab | What it does |
|---|---|
| **Add Job** | Paste or upload a job description (`.txt/.md/.docx/.pdf`); role, company, location, salary and deadline are extracted heuristically and pre-filled for review. Tier (T1–T4) is on the same form; in the Canada region so are NOC code, employment type, weekly hours and the start and end dates |
| **Tracker** | Filter by status and tier, search, open a job. Each job gets prompt generators for a tailored resume, cover letter, interview prep, networking plan and JD analysis — copied into Claude.ai, no API key required — plus PDF slots that sync to the repo |
| **My Profile** | Sectioned profile (upload files or insert a skeleton / per-role skills blocks), a translation glossary, and formatting rules that are injected into every resume prompt |
| **Diagnosis** | A six-step pre-application check: stage → strengths → target profile → reality check against real JDs → resume narrative → high-stakes decisions |
| **Resumes** | A library of resume versions with preview, rename, download and "use as profile" |
| **Insights** | A Sankey of the pipeline, response and offer rates, upcoming deadlines — and, in the Canada region, a **CEC hours ledger** (see below) |
| **Alerts** | Optional, needs an Anthropic key: paste a LinkedIn job-alert email, Claude looks up each posting on the company's career page, scores it against your profile, and the ones you tick go straight into the tracker |

![Insights](docs/screenshot-insights.png)

### The CEC hours ledger (Canada only)

Canadian Experience Class counts skilled work hours toward 1,560, and IRCC's 30-hours-per-week cap
applies **across all jobs combined**, not per job. The ledger therefore slices time by week, sums
every active job's hours for that week, caps the total at 30, and attributes the capped hours back
proportionally — so two 25-hour jobs count as 30, not 50. It leaves out jobs whose NOC code isn't
TEER 1–3 (a job with no NOC code yet is treated as TEER 2), warns about working jobs with no employment
type recorded, since contractor hours don't count, and shows an ETA to the target at the current
weekly rate. The ledger, its fields and the "(CEC hours)" in the status name appear only in the Canada region.

### Batch tailoring (optional, needs an Anthropic key)

For every "Interested" job with a JD, one API call returns the tailored resume as **structured
JSON** (sections → entries → bullets); a small jsPDF renderer lays it out as a one-page Letter PDF
with the same column geometry the Claude.ai prompts specify. Results are cached locally and pushed
to the repo.

## How it's built

| Concern | Approach |
|---|---|
| Runtime | One `index.html`, built from `src/` by `build.mjs`: the JSX is compiled ahead of time with esbuild (pinned) and inlined. React 18, ReactDOM, mammoth, jsPDF, pdf.js (loaded the first time a `.pdf` is read) and Tailwind's Play CDN script are served from `vendor/` (sources and hashes in `vendor/SOURCE.md`). CI rebuilds the page and fails if it differs from the committed one. It also looks for scripts from another host in two forms: a `<script … src="https://…">` tag (or `http://`, `//`) written on one line with a lowercase, double-quoted `src`, and an http(s) address ending in `.js` or `.mjs`; a script loaded any other way would get past it |
| Storage | GitHub Contents API against a private repo. Each write sends the file's last known SHA; if another device saved first (GitHub answers 409), it reads the new SHA and writes once more, so the last device to save wins |
| Files | PDFs are stored as raw base64 under `data/files/` and cached in localStorage for instant preview; on a new device they're pulled from the repo on first open |
| JD parsing | Regex heuristics over the first 80 cleaned lines (noise such as contact lines, EEO boilerplate and URLs is stripped first); the raw JD is always stored unmodified |
| Prompts | Long, explicit reportlab instructions (column widths, table styles, one-page enforcement, a banned-word list for junior résumés) so Claude.ai's Analysis tool produces a consistent PDF every time |
| Secrets | GitHub token and Anthropic key live only in this browser's localStorage |
| Language | English by default, 中文 via the toggle; stored ids and prompt templates are never translated |

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
node build.mjs --check    # what CI runs: index.html must be exactly what src/ builds to
```

To use it for real, create a private repo, generate a classic token with the `repo` scope, and
enter both in ⚙️ Settings. The optional features (Batch Tailor, Alerts) take an Anthropic API key in
the same panel.

## Limitations

- Tailwind still runs as its Play CDN script (now served from `vendor/`), which builds the stylesheet in
  the browser on every load; a stylesheet built ahead of time would be lighter.
- Calling the Anthropic API from the browser requires the `anthropic-dangerous-direct-browser-access`
  header. The key is stored only in this browser and sent only to Anthropic's API, which suits one person's own copy
  but not a shared deployment.
- The JD extractor is heuristic and tuned for English postings; it pre-fills, you verify.

## License

MIT.
