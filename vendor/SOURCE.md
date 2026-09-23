# vendor/ — the libraries this page loads, served from this repository

The page used to load these from other hosts at run time; if a host went down or changed a file, the page broke. They are
copied here unchanged. The first five come from a private mirror that fetched them on 2026-07-25 from the URLs below; each
file's sha256 was checked against that mirror's manifest when it was copied in. The two pdf.js files were fetched from
cdnjs on 2026-09-23; each one's SHA-512 matched the SRI hash cdnjs lists for it
(`https://api.cdnjs.com/libraries/pdf.js/3.11.174?fields=sri`).

| file | from | sha256 | licence |
|---|---|---|---|
| `react-18.3.1.production.min.js` | https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js | `d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd` | MIT |
| `react-dom-18.3.1.production.min.js` | https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js | `35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d` | MIT |
| `mammoth-1.8.0.browser.min.js` | https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js | `deb07bf230d1cb3e190bc5adc6743f35c6531b6571d1e5469b24f452a7f0f4ab` | BSD-2-Clause |
| `jspdf-2.5.1.umd.min.js` | https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js | `98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875` | MIT |
| `tailwind-cdn-3.x.js` | https://cdn.tailwindcss.com (the Tailwind 3 Play CDN script: it builds the page's CSS in the browser) | `176e894661aa9cdc9a5cba6c720044cbbf7b8bd80d1c9a142a7c24b1b6c50d15` | MIT |
| `pdf-3.11.174.min.js` | https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js | `5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946` | Apache-2.0 |
| `pdf.worker-3.11.174.min.js` | https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js | `feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b` | Apache-2.0 |

Babel is no longer loaded at all: src/app.jsx is compiled ahead of time by build.mjs.

pdf.js is not loaded with the page: `loadPdfJs` in src/app.jsx adds it the first time a `.pdf` job description is read,
and points its worker at the second file.
