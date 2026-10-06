# Leave Now

One-screen commute advisor: tells you **when to leave** and **which bus to catch**, picking a less crowded (and ideally double-deck) bus within your max extra wait, with live vs estimated timings and rain.

## Run
1. Get a free API key from LTA DataMall (Request for API Access).
2. Copy `.env.example` to `.env` and paste your key.
3. `node server.js` then open http://localhost:3000

Without a key it runs on demo bus data (weather is always live).

Defaults: stop 14241, services 145 and 176, 8 min walk, 15 min max extra wait. Change them under "My commute settings".

Alarms and the daily reminder work while the tab is open.
