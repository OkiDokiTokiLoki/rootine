# 🌱 Rootine — Grow Journal

A single-page web app for logging and analysing plant grow cycles. Built as a vanilla-JS progressive web app: no frameworks, no backend. Everything lives in `localStorage`, works offline, and no fetch to any third party.

👉 **[Live demo](https://okidokitokiloki.github.io/rootine/)**

---

## Features

- **Multiple grow cycles**: Run several grows side by side, each marked by their own stage.
- **Plants**: Per-cycle list with configurable plant type, repotted date (auto-updated when a Repot action is logged), and a ⭐ Favourite flag.
- **Nutrients**: Per-cycle list including starting dilution (ml/l). Colour-coded automatically.
- **Entries**: Timestamped log entries carrying:
    - Per-plant nutrient per-feed quantity **and** concentration dilutions
    - Per-plant water amount
    - Actions: **LST**, **Defoliate**, **Repot**, **Light adjusted** (lux amount / distance between plant and light / on-off schedule) [each action indicated by its own badge]
    - Free-form observations and per-plant notes
- **Stats**: Feed/water/day/observation counts, individual plant cards with cumulative totals, conditional harvest yields, and observation feed.
- **Plant detail**: Per-plant recap e.g. totals, active dilution, last fed / watered / LST'd / defoliated timestamps, 7-day + cycle-long counts, plant-specific notes.
- **Light schedule**: Header shows scheduled on/off window, with current state (on/off) shown in real time.
- **JSON backup / restore**: Full import-export of all data with option to merge or purge existing data.
- **Offline-ready**: Service worker pre-caches `index.html` so the app loads with no network.
- **Migration-safe**: localStorage data is upgraded in place across schema versions.

---

## Tech stack

- **Vite**: dev server + production build
- **Vanilla JS / ES modules**: no framework, no JSX, no runtime library
- **localStorage**: sole persistence layer
- **Service Worker**: public/sw.js, registered with a runtime-patched cache name derived from the precached file contents (auto-invalidates on deploy)

---

## Browser support

Modern evergreen browsers (Chrome, Firefox, Safari, Edge). Uses:

- ES modules
- `localStorage`
- Service workers (with runtime-patched cache name)
