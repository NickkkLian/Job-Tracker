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
- Seven ready-to-use prompts generated from your resume + job description:
  - 📝 Tailor Resume — tailors your profile to the specific role and JD
  - ✉️ Cover Letter — writes a targeted 300-word cover letter
  - 🎯 Interview Prep — 8 likely questions, what they test, areas to study
  - 👥 Networking Strategy — specific LinkedIn targets and outreach approach
  - 🔍 Analyze This Job — day-to-day reality, red flags, salary estimate, competition
  - 🇨🇳 Translate to Simplified Chinese — translates and reformats into Mainland China 简历 structure
  - 🇭🇰 Translate to Traditional Chinese — translates and reformats into Hong Kong CV structure
- Translation prompts open a source picker — choose from the saved tailored resume, any resume in your library, or paste your own text
- Works with the free or Pro Claude.ai plan — no API key, no extra cost

**Print View (PDF export)**
- Once a tailored resume is saved, a 🖨️ Print view button appears next to Copy and Download
- Choose from three visual styles: 🇨🇳 Mainland China 简历, 🇭🇰 Hong Kong CV, 📄 English (clean)
- Opens a fully styled A4 HTML page in a new tab — press Ctrl+P (⌘P) and save as PDF
- Chinese styles use Noto Sans SC / TC fonts loaded from Google Fonts
- No install required — runs entirely in your browser

**Resume Management**
- My Profile — upload multiple files as separate named sections (resume versions, skills docs, anything you want Claude to reference); all sections are combined when building AI prompts
- Resume library — store, preview, rename, and download your polished finished resumes separately from the profile
- Formatting requirements — describe your preferred resume layout once; automatically injected into every Tailor Resume prompt so Claude always follows your structure
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
  → App combines all your profile sections into one reference document
  → Adds your formatting requirements (if set)
  → Embeds the job description
  → Copy the prompt → paste into Claude.ai → send
  → Copy Claude's response → paste it into the Tailored Resume field → Save

Click "→ 简体中文" or "→ 繁體中文"
  → Source picker opens — choose from:
       · Saved tailored resume for this job
       · Any resume in your library
       · Paste your own text
  → Generate prompt → copy → open Claude.ai → paste → send
  → Paste translation back into the Tailored Resume field → Save

Click "🖨️ Print view" (appears once a tailored resume is saved)
  → Choose a visual style:
       · 🇨🇳 Mainland China 简历  (dark navy accents, Noto Sans SC)
       · 🇭🇰 Hong Kong CV        (clean uppercase headers, Noto Sans TC)
       · 📄 English clean        (minimal Inter font)
  → Styled A4 HTML opens in a new tab
  → Press Ctrl+P (⌘P) → Destination: Save as PDF → set Margins to None
```

Uses your existing [Claude.ai](https://claude.ai) account — no additional API charges.

**Tip:** Set your formatting requirements in **My Profile → 🎨 Resume formatting requirements** once. Every Tailor Resume prompt will include your rules automatically — section order, bullet style, page length, date format, language, etc.

---

## Your data in GitHub

After first use, your private data repo will contain:

```
data/
  resumeSections.json   ← your profile sections (uploaded files)
  resumeDb.txt          ← combined profile text (auto-generated)
  formatting.txt        ← your resume formatting requirements
  library.json          ← your resume library
  canada_jobs.json      ← Canada applications
  hongkong_jobs.json    ← Hong Kong applications
  china_jobs.json       ← Mainland China applications
```

Each save creates a commit, so you have a full history of your data. `resumeDb.txt` is auto-generated from your sections on every save — you don't need to edit it directly.

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
