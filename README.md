# klacks

A minimalist typing test that gets out of your way. Built with React + Vite, backed by Firebase.

## Features

- **Test modes** — random common words or full sentences, timed (15/30/60/120s) or word-count (10/25/50/100) tests
- **Punctuation & numbers** — optional toggles to mix capitalization, punctuation, and digits into words mode
- **Live feedback** — smooth caret, per-letter coloring, live WPM while you type, caps lock warning
- **Typing sounds** — subtle synthesized mechanical "klack" on each keystroke with an error thud (toggleable, no audio assets)
- **Rich results** — WPM, raw WPM, accuracy, consistency, per-second WPM + raw chart, character breakdown
- **Personal bests** — tracked per test configuration, with a celebration when you beat one
- **Accounts & profiles** — Google sign-in, usernames, bios, test history, stats and progression charts
- **Social** — add friends and race head-to-head in real time
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
