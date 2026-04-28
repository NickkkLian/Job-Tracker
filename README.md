# 💼 Job Application Command Center

A personal job search tracker for **Canada**, **Hong Kong**, and **Mainland China** — with AI-assisted resume tailoring, cover letter drafting, interview prep, and networking strategy via Claude.ai.

**No API key. No build step. No backend. One HTML file.**

---

## Features

**Job Tracker**
- Add applications manually — company, role, location, salary, deadline, notes
- Track status across the full pipeline: Applied → Interviewing → Offered / Rejected
- Filter and search across all applications
- Upcoming deadline reminders in the Insights dashboard
- Three fully isolated regions — Canada, Hong Kong, Mainland China — data never crosses between them

**AI Help via Claude.ai**
- Five ready-to-use prompts generated from your resume + job description:
  - 📝 Tailor Resume
  - ✉️ Cover Letter
  - 🎯 Interview Prep
  - 👥 Networking Strategy
  - 🔍 Analyze This Job
- The app builds a structured prompt with your background and the JD already embedded — you copy it, paste into Claude.ai, and paste the result back to save it
- Works with the free or Pro Claude.ai plan — no API key, no extra cost

**Resume Management**
- Master profile — paste or upload your full background (used to build AI prompts)
- Resume library — store, preview, rename, and download multiple resume versions
- Upload support: `.txt`, `.md`, `.docx`, `.pdf`
- Download tailored resumes and cover letters as `.md` or `.txt`

**Insights Dashboard**
- Pipeline counts by status
- Response rate and offer rate
- Activity over the last 7 and 30 days
- Top companies and upcoming deadlines

---

## How it works

| What | Where |
|------|-------|
| The app itself | A single `index.html` — hosted on GitHub Pages |
| Your data (resume, jobs, library) | Your own **private** GitHub repo, via the GitHub API |
| GitHub token | Your browser's `localStorage` only — never committed anywhere |

The app never sends your data to any third-party server. Your GitHub token is used only to read and write files in your own private repo.

---

## Setup

> Takes about 10 minutes. No terminal or coding required.

### 1. Fork or download

- **Fork** this repo to your GitHub account, or
- Download `index.html` and create a new public repo to host it

### 2. Create a private repo for your data

Go to [github.com/new](https://github.com/new) and create a **private** repo — name it anything, e.g. `jobapp-data`. Leave it empty.

### 3. Enable GitHub Pages on this repo

- Repo → **Settings → Pages**
- Source: **Deploy from a branch** → branch: `main` · folder: `/ (root)`
- Click **Save**

Your app will be live at `https://your-username.github.io/your-repo-name` within about a minute.

### 4. Create a GitHub Personal Access Token

- Go to [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
- Give it a name (e.g. "Job Tracker")
- Tick the **repo** scope
- Click **Generate token** — copy it immediately (you only see it once)

### 5. Configure the app

- Open your GitHub Pages URL
- A settings dialog opens automatically on first visit
- Enter your **GitHub token** and **private data repo** (format: `your-username/jobapp-data`)
- Click **Test connection**, then **Save**

Done. Your data now saves to your private repo on every change.

---

## How the AI features work

The app does not call any AI API directly. Instead, it builds a prompt from your profile and the job description, then opens Claude.ai for you.

```
Click "Tailor Resume"
  → App generates a prompt (your background + JD + instructions)
  → Copy the prompt
  → Paste into Claude.ai and send
  → Copy Claude's response
  → Paste it into the "Tailored Resume" field in the app
  → Save — stored in your private GitHub repo
```

Uses your existing [Claude.ai](https://claude.ai) account — no additional API charges.

---

## Your data in GitHub

After first use, your private data repo will contain:

```
data/
  resumeDb.txt          ← your master profile
  library.json          ← your resume library
  canada_jobs.json      ← Canada applications
  hongkong_jobs.json    ← Hong Kong applications
  china_jobs.json       ← Mainland China applications
```

Each save creates a commit, so you have a full history of your data.

---

## Tech stack

- [React 18](https://react.dev) + [Babel Standalone](https://babeljs.io/docs/babel-standalone) — JSX runs in the browser, no build step needed
- [Tailwind CSS](https://tailwindcss.com) Play CDN
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js) — `.docx` parsing
- [PDF.js](https://mozilla.github.io/pdf.js/) — `.pdf` parsing (lazy-loaded)
- [GitHub Contents API](https://docs.github.com/en/rest/repos/contents) — data storage

No framework CLI, no bundler, no `npm install`.

---

## Updating

When a new version of `index.html` is available, replace the file in your repo and commit — GitHub Pages updates automatically. Your data in the private repo is unaffected.

---

## License

MIT — fork it, modify it, make it your own.
