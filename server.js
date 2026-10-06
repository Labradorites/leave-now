// Leave Now: tiny proxy for LTA DataMall + data.gov.sg weather, and static file server.
// No dependencies. Run: node server.js  (needs Node 18+ for global fetch)

const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env (KEY=VALUE lines) if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = process.env.PORT || 3000;
const KEY = process.env.DATAMALL_KEY;
const DM = 'https://datamall2.mytransport.sg/ltaodataservice';

async function datamall(endpoint) {
  const res = await fetch(`${DM}/${endpoint}`, { headers: { AccountKey: KEY, accept: 'application/json' } });
  if (!res.ok) throw new Error(`DataMall ${res.status}`);
  return res.json();
}

// Bus stop list (for coordinates -> nearest weather area). Fetched once, cached.
let stopsCache = null;
async function getStop(code) {
  if (!stopsCache) {
    const all = [];
    for (let skip = 0; ; skip += 500) {
      const page = await datamall(`BusStops?$skip=${skip}`);
      all.push(...page.value);
      if (page.value.length < 500) break;
    }
    stopsCache = new Map(all.map(s => [s.BusStopCode, s]));
  }
  return stopsCache.get(code);
}

// Demo data so the UI works before an API key is set up
function demoArrivals(code) {
  const at = mins => new Date(Date.now() + mins * 60000).toISOString();
  const bus = (m, load, type, mon = 1) => ({ EstimatedArrival: at(m), Load: load, Type: type, Monitored: mon });
  return {
    BusStopCode: code,
    demo: true,
    Services: [
      { ServiceNo: '145', NextBus: bus(6, 'LSD', 'SD'), NextBus2: bus(14, 'SEA', 'DD'), NextBus3: bus(25, 'SDA', 'SD', 0) },
      { ServiceNo: '176', NextBus: bus(10, 'SDA', 'DD'), NextBus2: bus(19, 'SEA', 'SD', 0), NextBus3: bus(31, 'SEA', 'DD', 0) },
    ],
  };
}

async function weatherNear(lat, lng) {
  const res = await fetch('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast');
  if (!res.ok) throw new Error(`Weather ${res.status}`);
  const { data } = await res.json();
  const forecasts = data.items[0].forecasts;
  let area = forecasts[0].area;
  if (lat && lng) {
    let best = Infinity;
    for (const a of data.area_metadata) {
      const d = (a.label_location.latitude - lat) ** 2 + (a.label_location.longitude - lng) ** 2;
      if (d < best) { best = d; area = a.name; }
    }
  }
  const f = forecasts.find(x => x.area === area);
  return { area, forecast: f ? f.forecast : 'Unknown', validPeriod: data.items[0].valid_period?.text };
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/bus') {
      const code = (url.searchParams.get('stop') || '').replace(/\D/g, '');
      if (!code) return send(res, 400, { error: 'stop required' });
      if (!KEY) return send(res, 200, demoArrivals(code));
      return send(res, 200, await datamall(`v3/BusArrival?BusStopCode=${code}`));
    }
    if (url.pathname === '/api/weather') {
      const code = (url.searchParams.get('stop') || '').replace(/\D/g, '');
      let stop = null;
      if (KEY && code) { try { stop = await getStop(code); } catch { /* fall back to default area */ } }
      const w = await weatherNear(stop?.Latitude, stop?.Longitude);
      return send(res, 200, { ...w, stopName: stop ? `${stop.Description}, ${stop.RoadName}` : null });
    }
    // Static files
    const file = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
    if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file)) return send(res, 404, 'Not found', 'text/plain');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
    send(res, 200, fs.readFileSync(file), types[path.extname(file)] || 'application/octet-stream');
  } catch (err) {
    send(res, 502, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Leave Now running at http://localhost:${PORT}`);
  if (!KEY) console.log('No DATAMALL_KEY set: showing DEMO bus data. Add it to .env for live data.');
});
