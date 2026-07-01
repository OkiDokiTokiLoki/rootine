# 🌱 Rootine — Grow Journal

A single-page web app for logging and analysing 'tomato' plant grow cycles. Built as a vanilla-JS progressive web app: no frameworks, no build step, no backend. Everything lives in `localStorage`, works offline, and no fetch to any third party.

👉 **[Live demo](https://okidokitokiloki.github.io/rootine/)**

---

## Features

- **Multiple grow cycles**: Run several grows side by side, marking them by various progressive timeline stages.
- **Plants**: Per-cycle list with configurable plant type, repotted date, and a ⭐ Favourite flag.
- **Nutrients**: Per-cycle list including starting dilution (ml/l). Colour-coded automatically.
- **Entries**: Timestamped log entries carrying:
    - Per-plant nutrient amounts (cups) **and** dilutions (ml/l)
    - Per-plant water amount
    - Actions: **LST**, **Defoliate**, **Repot**, **Light adjusted** (lux / cm / on-off schedule)
    - Free-form observations and per-plant notes
- **Stats**: Feed/water/day/observation counts, plant cards with cumulative totals, weekly summaries, conditional harvest yields, and observation feed.
- **Plant detail**: Per-plant recap e.g. totals, active dilution + history, last actioned, weekly + cycle-long counts, plant-specific notes.
- **Light schedule**: Header shows current on/off state in real-time, scheduled times, and total hours of light per cycle.
- **JSON backup / restore**: Full import-export of all data with option to merge or purge existing data.
- **Offline-ready**: Service worker pre-caches `index.html` so the app loads with no network.
- **Migration-safe**: localStorage data is upgraded in place across schema versions.

---

## Tech stack

- **Vanilla ES modules**: no bundler, no transpiler.
- **localStorage**: sole persistence layer.
- **Service Worker**: registered from a `Blob` URL (no extra file needed).

---

## Browser support

Modern evergreen browsers (Chrome, Firefox, Safari, Edge). Uses:

- ES modules
- `localStorage`
- Service workers (graceful no-op if unavailable)
- `color-scheme: dark` on datetime inputs
