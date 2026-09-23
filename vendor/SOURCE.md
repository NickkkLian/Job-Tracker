# vendor/ — the libraries this page loads, served from this repository

The page used to load these from other hosts at run time; if a host went down or changed a file, the page broke. They are
copied here unchanged. The copies come from a private mirror that fetched them on 2026-07-25 from the URLs below; each
file's sha256 was checked against that mirror's manifest when it was copied in.

| file | from | sha256 | licence |
|---|---|---|---|
| `react-18.3.1.production.min.js` | https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js | `d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd` | MIT |
| `react-dom-18.3.1.production.min.js` | https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js | `35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d` | MIT |
| `mammoth-1.8.0.browser.min.js` | https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js | `deb07bf230d1cb3e190bc5adc6743f35c6531b6571d1e5469b24f452a7f0f4ab` | BSD-2-Clause |
| `jspdf-2.5.1.umd.min.js` | https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js | `98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875` | MIT |
| `tailwind-cdn-3.x.js` | https://cdn.tailwindcss.com (the Tailwind 3 Play CDN script: it builds the page's CSS in the browser) | `176e894661aa9cdc9a5cba6c720044cbbf7b8bd80d1c9a142a7c24b1b6c50d15` | MIT |

Babel is no longer loaded at all: src/app.jsx is compiled ahead of time by build.mjs.
