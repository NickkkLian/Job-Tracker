# 💼 Job Application Command Center

Personal job search tracker for **Canada**, **Hong Kong**, and **Mainland China** — with AI-assisted resume tailoring, cover letter drafting, interview prep, and networking strategy via Claude.ai.

**No API key. No build step. No backend. One HTML file.**

---

## Features

**Job Tracker**
- Add applications manually — company, role, location, salary, deadline, notes
- Track status: Applied → Interviewing → Offered / Rejected
- Filter and search across all applications
- Upcoming deadline reminders in the Insights dashboard
- Three fully isolated regions — Canada, Hong Kong, Mainland China — data never crosses

**AI Help via Claude.ai**
- Five pre-built prompts generated from your resume + job description:
  - 📝 Tailor Resume
  - ✉️ Cover Letter
  - 🎯 Interview Prep
  - 👥 Networking Strategy
  - 🔍 Analyze This Job
- Copy the prompt → paste into Claude.ai → paste the result back to save it with the application
- Uses your existing Claude.ai subscription — no API key, no extra cost

**Resume Management**
- Master profile — paste or upload your full background (used to generate AI prompts)
- Resume library — store, preview, rename, download multiple resume versions
- Upload support: `.txt`, `.md`, `.docx`, `.pdf`
- Download tailored resumes and cover letters as `.md` or `.txt`

**Insights Dashboard**
- Pipeline counts by status
- Response rate and offer rate
- Applications in the last 7 and 30 days
- Top companies and upcoming deadlines

**Data Storage**
- All app data (resume, jobs, library) is saved to your own **private GitHub repo** via the GitHub API
- GitHub token stays in your browser — never committed to any repo
- Every save creates a readable commit in your data repo

---

## How to deploy

> Total time: about 10 minutes. No terminal required.

### 1. Create two GitHub repos

| Repo | Visibility | Purpose |
|------|-----------|---------|
| `NickkkLian/jobapp` | **Public** | Hosts the app via GitHub Pages |
| `NickkkLian/jobapp-data` | **Private** | Stores your resume and job data |

### 2. Upload the app file

- Go to your **public** repo (`NickkkLian/jobapp`)
- Click **Add file → Upload files**
- Upload `index.html` — rename it to `index.html` if it isn't already
- Commit to `main`

### 3. Enable GitHub Pages

- In the repo → **Settings → Pages**
- Source: **Deploy from a branch**
- Branch: `main` · Folder: `/ (root)`
- Click **Save**

Your app is live at `https://NickkkLian.github.io/jobapp` within about a minute.

### 4. Configure the app

- Open your GitHub Pages URL — a settings dialog appears automatically
- Create a GitHub Personal Access Token at [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
  - Tick the **repo** scope (needed to read and write your private data repo)
  - Copy the token — you only see it once
- Enter the token and your data repo name (`NickkkLian/jobapp-data`) in the dialog
- Click **Test connection** to verify, then **Save**

The app writes your data as JSON files into the private repo on every save. You can view (and edit) them directly on GitHub anytime.

---

## How the AI features work

The app does not call any AI API. Instead, it builds a structured prompt that includes your background and the job description, and opens Claude.ai for you.

```
You click "Tailor Resume"
  → App generates a prompt (your profile + JD + instructions)
  → Modal shows the prompt with a Copy button
  → You copy it and open Claude.ai
  → Paste and send — Claude responds
  → Copy the result back into the app's "Tailored Resume" field
  → Click Save — stored in your private GitHub repo
```

This means AI features work with the [Claude.ai free or Pro plan](https://claude.ai) — no additional API account or charges.

---

## Data & privacy

| What | Where |
|------|-------|
| Resume, jobs, library | Your private GitHub repo (`NickkkLian/jobapp-data`) |
| GitHub token | Your browser's `localStorage` only |
| Prompt content | Sent to Claude.ai when you paste and send — subject to Anthropic's [privacy policy](https://www.anthropic.com/privacy) |

Nothing is sent to any third-party server by the app itself. The GitHub token is never committed to any repo.

---

## File structure in your data repo

After first use, your private data repo will contain:

```
data/
  resumeDb.txt          ← your master profile
  library.json          ← your resume library
  canada_jobs.json      ← Canada applications
  hongkong_jobs.json    ← Hong Kong applications
  china_jobs.json       ← Mainland China applications
```

---

## Tech

- [React 18](https://react.dev) + [Babel Standalone](https://babeljs.io/docs/babel-standalone) (JSX in browser, no build step)
- [Tailwind CSS](https://tailwindcss.com) Play CDN
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js) for `.docx` parsing
- [PDF.js](https://mozilla.github.io/pdf.js/) for `.pdf` parsing (lazy-loaded)
- [GitHub Contents API](https://docs.github.com/en/rest/repos/contents) for storage
- No framework, no bundler, no dependencies to install

---

## Updating

When a new version of `index.html` is available, upload it to your public repo and commit — GitHub Pages updates automatically. Your data in the private repo is unaffected.
