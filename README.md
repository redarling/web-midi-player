MIDI Player
===========

A browser-based MIDI player with real-time piano roll visualization. Select from 11 built-in tunes and watch notes render live as they play through a Web Audio synthesizer.

## Getting Started

Requires Node.js 16+.

```sh
npm install
npm start
```

Opens http://localhost:3000 in your browser.

## Features

- Play, stop, rewind, and fast-forward through MIDI scores
- Real-time piano roll visualization (color-coded by pitch, scrolling 10s window)
- Toggle between live playback view and reference score view
- 11 built-in tunes: Tetris, Zelda, Super Mario Bros., Megaman 3, Duck Tales, MEGALOVANIA, and more
- Seeking via `skipToTimestamp` with O(log n) binary search and automatic restoration of sustaining notes

## Tech Stack

- React 18 + TypeScript
- Web Audio via [jzz-synth-tiny](https://github.com/niclasku/jzz-synth-tiny) (General MIDI synthesizer)
- CRACO (Create React App Configuration Override)

## Architecture

```
src/
  player/           MIDI playback engine (event timeline, chunked waiting, seek)
  synthesizer/      Web Audio synthesizer wrapper (channels, note playback, recorder)
  visualization/    Piano roll rendering (score, track, note, timer components)
  panes/            UI page components
```

Scores are stored as JSON in `public/tunes/`. A conversion script (`scripts/midiToJson.ts`) can convert standard `.mid` files to this simplified format.

## Limitations

- `delayAsync` is non-reentrant: only one delay can be active at a time
- Each synthesizer channel can only play one note at a time
- Browser timing has limited precision; `buildTimer()` (based on `performance.now()`) is used to avoid drift accumulation
- The JSON score format is a simplification of real MIDI (overlapping notes are split into separate tracks, max 16 channels)
- Concurrent `play()` calls are not supported
- Audio quality is limited by the lightweight Web Audio synth
