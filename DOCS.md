# ApplyLedger: build and save details

Moved from the README so its first pages show what the app does. Nothing here was rewritten.

## Runtime

One `index.html`, built from `src/` by `build.mjs`: the JSX is compiled ahead of time with esbuild (pinned) and inlined. React 18, ReactDOM, mammoth, jsPDF and pdf.js (loaded the first time a `.pdf` is read) are served from `vendor/` (sources and hashes in `vendor/SOURCE.md`; CI fails if a file there does not match its hash); the styles are plain CSS (`app.css`) on the family's design tokens (`design-tokens.css`), with light/dark and three palettes from `appearance.js`. CI rebuilds the page and fails if it differs from the committed one. It also fails on every way of loading a script from another host that `check-scripts.mjs` lists at its top, among them a `<script>` whose `src` is not a path in this repository (in any case, quoting, spacing or line breaks, with character references, or written inside a string in the code), a `<base href>`, a `<link>` that preloads a script, an import map, `import()`, `importScripts`, workers or a `src` set in code unless the address is a plain path, code that runs text as code (`eval`, `Function`), and any address ending in `.js` or `.mjs`. It reads `index.html` and the page's own scripts outside `vendor/`, after a self-test that catches one sample of each form and passes the real page. Ways a static check cannot see, such as code text held in a variable and given to `setTimeout`, or names built while the page runs, are stopped by the browser instead: the page's Content-Security-Policy (written by `build.mjs`) lets scripts come only from this site and from the page's own inline scripts by their sha256, with no `'unsafe-eval'`, so text run as code and scripts from other hosts are refused while the page runs. `check-scripts.mjs` fails CI if that policy is missing, moved after a script, or loosened in any way

## CI checks

```bash
node check-scripts.mjs    # CI too: no script from another host, and the page's script policy intact (--self-test: each form and each loosened policy is caught)
node check-models.mjs     # CI too: the page asks for Claude Opus 5.5, Sonnet 5.5 or Haiku 5.5 only, with max_tokens >= 16000, and reads replies by block type (--self-test: each rule is caught)
node ghost-mutants.mjs    # CI too: breaks each rule in a copy, one at a time; a test must fail for every break
```

## Header save status

The header keeps save state visible across pages. “Saved HH:MM” appears after a repository write succeeds.
Failures show a plain reason and Retry, while keeping the last successful time. Multiple files are combined so
one saved file cannot conceal another pending or failed save. Offline text distinguishes matching PDF recovery
bytes kept in this browser from edits held only in the current page. Form drafts still need their Save action.
