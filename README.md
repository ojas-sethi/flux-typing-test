# klacks

A minimalist typing test that gets out of your way. Built with React + Vite, backed by Firebase.

## Features

- **Test modes** — picked from a one-line spec ("words / 30 seconds"):
  - **words**: 1,375 common English words, weighted by how often they occur in real text
  - **sentences**: 150 original sentences of everyday prose
  - **quotes**: one real quote per test (99 quotes, 57 authors, all public domain), credited to its author and source, filterable by length
  - timed (15/30/60/120s) or word-count (10/25/50/100) for words and sentences
- **Punctuation & numbers** — optional toggles to mix capitalization, punctuation, and digits into words mode
- **Live ruler** — a tick ruler tracks progress; each finished second (or word) grows into a bar showing how fast you typed it
- **Live feedback** — smooth caret, per-letter coloring, live WPM, caps lock warning
- **Typing sounds** — subtle synthesized mechanical "klack" on each keystroke with an error thud (toggleable, no audio assets)
- **Results** — WPM, accuracy, raw, consistency, character breakdown, a per-second rhythm chart with error marks and hover details, copy-to-clipboard
- **Personal bests** — tracked per test configuration, with a callout when you beat one
- **Profile** — one filter (all / words / sentences / quotes / races) drives headline stats, a full history chart, a personal-best matrix and a test log
- **Social** — add friends, view their stats, and race head-to-head in real time with shareable room codes
- **Dark & light themes**, settings persisted across sessions

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `tab` + `enter` | restart test |
| `esc` | restart test |
| `ctrl/cmd` + `backspace` | clear current word |
| `backspace` (at word start) | go back to previous word |

## Development

```bash
npm install
npm run dev     # start dev server
npm run build   # production build
npm run lint    # eslint
```

Firebase config lives in `.env` (see `.env.example`).
