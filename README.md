# Job Application Command Center

A single-file job tracker and AI-powered application toolkit. Track applications across three regions, generate tailored resumes and cover letters via Claude.ai, and scan LinkedIn alerts for new opportunities — all from one static HTML page hosted on GitHub Pages.

## Live App

**https://NickkkLian.github.io/Job-Tracker**

No backend, no build step, no server. Just one `index.html` on GitHub Pages.

## Quick Start

### 1. Create a private data repo

Go to GitHub → New repository → name it `jobapp-data` → set to **Private** → Create.

This repo stores all your data (jobs, profile, resumes, PDFs) as JSON and text files.

### 2. Generate a GitHub token

Go to [github.com/settings/tokens/new](https://github.com/settings/tokens/new) → check **repo** scope → Generate → copy the token immediately.

### 3. Configure the app

Open the app → click ⚙️ Settings → paste your token and repo name (`username/jobapp-data`) → Save → Test connection.

### 4. (Optional) Set up LinkedIn Alerts

To use the 📧 Alerts tab, you also need an Anthropic API key. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → Create → paste it in ⚙️ Settings. Costs ~$0.002 per scan.

## Features

### 📋 Three Regions

Track applications separately for Canada 🇨🇦, Hong Kong 🇭🇰, and Mainland China 🇨🇳. Each region has its own job list, insights, and alerts. Profile, resume library, formatting rules, and glossary are shared across all regions.

### ➕ Add Job

- Upload a JD file (PDF, DOCX, TXT, MD) and the parser auto-fills role, company, location, salary, and deadline
- Noise filtering strips boilerplate (EEO statements, contact info, copyright lines) before extraction
- Or fill fields manually

### 📋 Tracker

- Filter by status, search by keyword
- Status pipeline: **Interested → Applied → Interviewing → Offered / Rejected**
- Open any job to view details, edit fields, save notes, upload tailored resume/cover letter PDFs, and generate AI prompts

### 📝 My Profile (3 cards)

**Multi-section profile manager** — Upload your background as separate named sections (education, experience, projects, skills, etc.) from `.txt`, `.md`, `.docx`, or `.pdf` files. Sections are combined into a single profile used by all AI prompts.

**Translation glossary** — `English → Chinese` term mappings injected into the translate prompts for consistent terminology.

**Resume formatting requirements** — Additional layout rules (e.g., "sections in this order", "use British English") injected into the Tailor Resume prompt.

### 📚 Resume Library

Store and preview multiple resume versions as Markdown. Download as `.md` or `.txt`. Use any library resume as a translation source.

### 📊 Insights

- **Cumulative pipeline funnel chart** — a job at "Interviewing" also counts in "Applied" (moving forward never decreases previous stage counts)
- Color-coded horizontal bars: purple (Interested), blue (Applied), yellow (Interviewing), green (Offered), red (Rejected)
- Response rate and offer rate based on applied jobs (excludes Interested)
- Activity metrics (last 7/30 days), top companies, upcoming deadlines

### 📧 Alerts (LinkedIn Watchdog)

Two modes for discovering jobs:

**Email scan** — Paste a LinkedIn job alert email (titles + company names). Claude Haiku uses web search to find each job on the company's own career page (Workday, Greenhouse, Lever, etc.), extracts the full JD, scores it against your profile, and lets you batch-add matches to the tracker.

**Manual search** — Click "Search new jobs (last 24h)" and Claude searches the web for fresh postings in your current region matching your profile. No email input needed.

Both modes show results as interactive cards with fit scores (1-10), descriptions, salary info, and clickable "View & apply" links. Each card is editable (✏️) — fix company names, paste in a better JD, or add the real apply URL before adding to the tracker.

Requires an **Anthropic API key** (add in ⚙️ Settings). Costs ~$0.002 per scan using Haiku.

## AI Prompts (Copy-Paste to Claude.ai)

The app generates ready-to-paste prompts — no API key needed for these. Copy the prompt, paste into [claude.ai](https://claude.ai/new), and Claude does the work.

| Prompt | Output | Method |
|--------|--------|--------|
| Tailor Resume | One-page PDF | Claude Analysis Tool (reportlab) |
| Cover Letter | PDF (standalone or combined with resume) | Claude Analysis Tool (reportlab) |
| Interview Prep | Markdown (read in Claude.ai) | Direct response |
| Networking | Markdown | Direct response |
| Job Analysis | Markdown | Direct response |
| Translate Resume | Markdown (Simplified or Traditional Chinese) | Direct response |

### Tailor Resume

Generates a one-page PDF resume directly via Claude's Analysis Tool (Python + reportlab). Features include:

- Region-aware contact line (Canada excludes the +86 phone number)
- Structural layout fixes: SPAN-based section headers, colWidths=[78, None], RIGHTPADDING=8pt
- Anti-pattern guards: no HRFlowable, no getSampleStyleSheet, no tighten functions
- Binary-search spacing to fill the page when content is sparse, trim content first when too long
- Adjacent courses and skills included for transferable capability
- Courses listed by relevance, never by grade (grades never shown)
- Output file: `Firstname_Lastname_Resume.pdf`

**Tone calibration**: Recent graduate. Banned buzzwords (leveraged, spearheaded, drove, transformed, etc.). Allowed verbs (built, wrote, analyzed, tested, supported, etc.). No inflated claims — "Built" not "led", "Supported" not "drove". Internships are 3 months — no long-term strategic impact claims.

### Cover Letter

Also generates PDF via Analysis Tool. Key features:

- 3–4 paragraphs, 300–380 words
- Para 1 must reference something specific about the company (strategy, philosophy, track record)
- Para 2 picks achievements that match the specific role type (discretionary vs. quant, finance vs. engineering)
- Para 3 acknowledges early-career status and redirects to strengths — "Don't apologize; reframe"
- No dashes (— or –) in body text
- Skips the profile block if resume was already generated in the same Claude.ai conversation (saves tokens)
- Optional combined 2-page PDF (resume + cover letter) for email applications
- Output file: `Firstname_Lastname_Cover_Letter.pdf`

### Interview Prep

Starts with a 4-angle strengths summary:
1. Geographic / regional fit
2. Language abilities
3. Interdisciplinary skills
4. Practical / hands-on abilities

Each angle includes honest gap flagging. Followed by 8 likely questions, what they test, 3 study areas, red flags, and location-specific tips.

### Translate Resume

Supports Simplified Chinese (Mainland 简历 format) and Traditional Chinese (Hong Kong CV format). Injects the personal translation glossary for consistent terminology.

## Architecture

```
NickkkLian.github.io/Job-Tracker/
  index.html              ← the entire app (single file, ~130KB)

NickkkLian/jobapp-data/   (private repo)
  data/
    resumeDb.txt              ← combined profile text
    resumeSections.json       ← profile sections (multi-file)
    formatting.txt            ← resume formatting rules
    glossary.txt              ← Chinese translation glossary
    watchdogProfile.txt       ← alerts tab scoring profile
    library.json              ← resume library
    canada_jobs.json          ← job data per region
    hongkong_jobs.json
    china_jobs.json
    files/
      canada_<jobId>_resume.pdf    ← tailored resume PDFs
      canada_<jobId>_cover.pdf     ← cover letter PDFs
      ...
```

### Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + Babel Standalone (JSX in browser, no build step) |
| Styling | Tailwind CSS via CDN |
| File parsing | Mammoth.js (DOCX), PDF.js (PDF text extraction) |
| Storage | GitHub Contents API (private repo, 409 SHA-conflict retry) |
| AI (Alerts only) | Anthropic API (Claude Haiku) with web search |
| Local cache | localStorage for PDF preview blobs and credentials |

### Storage Model

All data persists in your private GitHub repo via the Contents API. The app handles SHA conflicts with automatic retry. PDF files (tailored resumes, cover letters) are stored as base64 in `data/files/` and cached in localStorage for fast preview (blob URL conversion for cross-browser iframe rendering).

### Status Model

```
Interested → Applied → Interviewing → Offered
                                    ↘ Rejected
```

Default status for new jobs: **Interested**. Insights pipeline counts are cumulative. Response/offer rates exclude Interested jobs from the denominator.

## Security

- GitHub token and Anthropic API key stay in `localStorage` — never transmitted except to their respective APIs
- All job data is in your **private** GitHub repo
- No backend, no database, no analytics, no tracking
- The app is a static HTML file with no dependencies beyond CDN scripts
- Anthropic API calls include `anthropic-dangerous-direct-browser-access: true` (required for browser-to-API calls; API key is visible in browser devtools — acceptable for a personal tool)
- PDF previews use blob URLs (`URL.createObjectURL`) for cross-browser compatibility, with proper cleanup on unmount
