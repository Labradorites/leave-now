# Leave Now

One-screen commute advisor: tells you **when to leave** and **which bus to catch**, picking a less crowded (and ideally double-deck) bus within your max extra wait, with live vs estimated timings and rain.

## Run
1. Get a free API key from LTA DataMall (Request for API Access).
2. Copy `.env.example` to `.env` and paste your key.
3. `node server.js` then open http://localhost:3000

Without a key it runs on demo bus data (weather is always live).

Defaults: stop 14241, services 145 and 176, 8 min walk, 15 min max extra wait. Change them under "My commute settings".

Alarms and the daily reminder work while the tab is open.

## Hosted version (GitHub Pages + Cloudflare Worker)
GitHub Pages hosts the page at https://labradorites.github.io/leave-now/. Pages can only serve static files, so the bus and weather requests go through a free Cloudflare Worker that keeps the DataMall key secret.

1. `npx wrangler login`
2. `npx wrangler deploy`. Note the URL it prints: `https://leave-now.<subdomain>.workers.dev`.
3. `npx wrangler secret put DATAMALL_KEY`. Without it, the Worker serves demo bus data.
4. Put that Worker URL in `public/config.js` and push.
