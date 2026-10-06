# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Leave Now is a one-screen commute advisor. It tells the user when to leave and which bus to catch. It prefers a less crowded bus, ideally a double-decker, if one comes within the user's max extra wait. It also shows rain and whether each bus timing is live or estimated. It is a personal app: the default stop is 14241, the services are 145 and 176, the walk is 8 min, and the max extra wait is 15 min.

## Run

```
cp .env.example .env   # set DATAMALL_KEY (LTA DataMall account key)
node server.js         # http://localhost:3000 (PORT env overrides)
```

- The app has no dependencies, no build step, no package.json, and no tests or linter. It needs Node 18+ for the global `fetch`.
- Without `DATAMALL_KEY`, `/api/bus` returns made-up demo arrivals (`demoArrivals` in `api.mjs`). Weather data is always live.

## Architecture

The API logic lives in **`api.mjs`** (`handleApi(url, key)`) and runs in two places:
- **Local:** `server.js` runs it and also serves `public/`.
- **Hosted:** the page is on GitHub Pages (`.github/workflows/pages.yml` publishes `public/` on every push to main), and `worker.mjs` runs the API as a Cloudflare Worker (`wrangler.toml`, with the key stored as the Worker secret `DATAMALL_KEY`).
- `public/config.js` sets `window.API_BASE`, which points at the Worker when the page is served from github.io and is empty otherwise.
- The Worker's CORS allowlist is `ALLOWED` in `worker.mjs`.

**API (`api.mjs`)**
- It is needed because LTA DataMall blocks browser requests (CORS) and requires the `AccountKey` header.
- `GET /api/bus?stop=CODE` forwards to DataMall `v3/BusArrival`. The response passes through unchanged (`Services[].NextBus/NextBus2/NextBus3`, each with `EstimatedArrival`, `Load`, `Type`, `Monitored`).
- `GET /api/weather?stop=CODE` looks up the stop's coordinates with `getStop`. The first call pages through every DataMall `BusStops` record (`$skip` in steps of 500) and caches them in memory. It then picks the nearest area in the data.gov.sg v2 two-hour forecast.
- `server.js` loads `.env` itself, with no dotenv package.

**`public/index.html`** contains all the UI and logic in one inline script.
- Settings are saved in `localStorage` under `leaveNow`. They are merged over `DEFAULTS`.
- `busesFrom()` turns the API response into a flat list of buses for the selected services.
- `choose()` is the core decision:
  - A bus is catchable if `mins >= walk + BUFFER`. Candidates are catchable buses arriving no more than `maxWait` minutes after the first catchable bus.
  - Score = `LOAD_SCORE` (SEA 0, SDA 1, LSD 3), then −0.5 for double deck, +0.5 if not `Monitored` (estimate only), +0.08 per minute later. The lowest score wins.
  - Leave time = arrival − (walk + BUFFER).
- Timers: buses refresh every 30 s, weather every 10 min, and `tick()` runs every 1 s. `tick()` drives the countdown and the leave alarm (WebAudio beep plus the Notification API). `checkDaily()` fires the daily reminder.
- Alarms only work while the tab is open.

## Conventions

- Keep the app dependency-free: plain Node and plain browser JS, no frameworks or bundlers.
- `.env` is gitignored. Never commit the DataMall key.
- Git commits use author `nj` with an empty email: `git -c user.name=nj -c user.email= commit ...`.
- Remote: https://github.com/Labradorites/leave-now (`main`).
- Deferred ideas, not built yet: planning the night before for unfamiliar routes (would need OneMap routing), MRT crowd data, and push notifications that work with the page closed (would need a service worker).
