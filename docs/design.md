# ApplyLedger's look: the signing desk

Read this before adding or restyling any part of the interface. A new part should look as if it was always there.

## The idea

An assistant prepares each application and the person does the one step only they can do (tick a robot check, enter a
code, press Submit). So the interface is a desk where prepared paper waits for a signature.

- **The desk** is a deep ink band. It is the header on every page, and it grows only where a step is waiting for you:
  under the Now heading and at the top of a kit. Nothing else is dark.
- **A slip** is a bright sheet lying on the desk. It carries the one step that is yours, a tab that says so in words
  ("Your turn", "Your part"), the days left when there is a deadline, and the button that opens the kit at that step.
- **Marker yellow means "this is yours", and nothing else.** The tab, the marked step, the "Your turn" folder tab and
  stamp, the clasp of the mark. Never use it for decoration, for the current page, for a status or for a warning.
- **The ledger** is everything below the desk: paper sheets on a pale blotter, each group opened by a ring stamp
  (bookmark, envelope, speech, check, clock, cross) and a hairline.
- **The still life** beside the Now heading is drawn in the page (`DeskArt` in `src/ledger.jsx`), not an image file. It
  shows what the heading says: a paper with its flag when something waits, a closed folder when the desk is clear.

## Where things are

| File | Holds |
|---|---|
| `desk.css` | Every token (light, dark, the two other palettes) and every redrawn view. Start here. |
| `ledger.css` | Layout kept from before for the parts not redrawn (kit answers, detail sheet, phone header details). |
| `app.css`, `design-tokens.css` | The shared base. They read the tokens that `desk.css` sets; do not edit them for looks. |
| `assets/fonts/` | Noto Serif SC (interface), Hanken Grotesk (see below). Sources and licences in `SOURCES.md`. |

## Rules

1. **Two voices.** Noto Serif SC is the interface. Hanken Grotesk is used only for words that leave in the person's
   name or were pasted in as data: cover letter, form answers, text areas. That is how a person tells "the app is
   talking" from "this exact text goes to the employer".
2. **Sizes** (rem, so the 1230 px composition scales as one object up to 1920 px): 2.75 the Now heading and the month
   figures · 2 page headings and large numerals · 1.375 the kit's Materials heading · 1.125 section headings, folder
   titles and the step on a slip · 0.9375 body, row titles and navigation · 0.8125 secondary lines and buttons · 0.75
   fine print only. Nothing smaller. On narrower screens the two headings step down (2.375 from 900 to 1229 px; 1.875
   and 1.75 on phones).
3. **A tile's second line adds something its group heading does not** (a date, the next step, a place), or it shows
   only the company. It never repeats the group's name.
4. **Entries are packed.** A row or tile is a strong line and at most one short second line; nothing is pinned to the
   far edge with empty space before it. Application tiles sit four to a row (three from 900 to 1229 px, one on a
   phone). On a wide screen with a mouse the move button appears when the tile is pointed at or focused; on a wide
   touch screen it sits right after the words; under 900 px it is left out, and the status is changed in the sheet a
   tile opens.
5. **Depth comes from paper on a surface**, not from boxes inside boxes: one sheet level (`--sheet-shadow`), one floating
   level for menus and dialogs (`--float-shadow`), and the slip's own shadow on the desk.
6. **Colour carries meaning only.** Ink for structure and primary actions, blue for links, "talking" and what moves
   forward in the chart, green for an offer or work, red for errors and deleting, pale amber for a caution. Silence
   ("Sent", "No reply", "Closed") gets no colour. The status control follows the same tones.
7. **Motion**: `transform` and `opacity` only, 120 to 200 ms, and it never blocks input. A finished step slides off the
   desk; under reduced motion it only fades.
8. **Words**: plain, in the person's terms, both languages written for their reader. No taglines, no explanations of
   the interface on the interface.
9. **English curly quotes.** Noto Serif SC draws ’ “ ” a full square wide. On English pages those marks come from a
   Latin serif on the device (`Desk Latin Marks` in `desk.css`). Keep that rule when changing the font stack.

10. **One column grid per page.** Tiles in every group start on the same four columns; a sub-heading may be indented,
    its tiles are not. On a kit, answers take one of three widths: a third, a half or the whole line.
11. **A sheet is one sheet.** The application sheet has no boxes inside it: sections are parted by hairlines, labels are
    sentence case in the small size, long instructions wait behind an info button, and folds use the app's plus and
    minus.
12. **The chart scales with the page.** Every length in the pipeline chart is multiplied by the page's scale, and each
    node's label is one line (two for the middle column on a phone), so no two labels touch.

## Checks before a change ships

- `node build.mjs --check`, `npm test`, and the browser suites in `test/` (see `test/README.md`).
- Look at 390, 1230 and 1440 px, light and dark, English and Chinese.
- `test/pipeline.measure.mjs` measures empty space inside every `[data-entry]`; a new row or tile should carry
  `data-entry` and keep the gap between two pieces of content on one line small.
- Text contrast at least 4.5:1 and control outlines at least 3:1 against their surface, in both themes.
