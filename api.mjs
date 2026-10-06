// Shared API logic for the local server (server.js) and the Cloudflare Worker (worker.mjs).
// handleApi(url, key) -> { status, body } for /api/bus and /api/weather, or null for other paths.

const DM = 'https://datamall2.mytransport.sg/ltaodataservice';

async function datamall(endpoint, key) {
  const res = await fetch(`${DM}/${endpoint}`, { headers: { AccountKey: key, accept: 'application/json' } });
  if (!res.ok) throw new Error(`DataMall ${res.status}`);
  return res.json();
}

// Bus stop list (for coordinates -> nearest weather area). Fetched once per process/isolate, cached.
let stopsCache = null;
async function getStop(code, key) {
  if (!stopsCache) {
    const all = [];
    for (let skip = 0; ; skip += 500) {
      const page = await datamall(`BusStops?$skip=${skip}`, key);
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

export async function handleApi(url, key) {
  const code = (url.searchParams.get('stop') || '').replace(/\D/g, '');
  if (url.pathname === '/api/bus') {
    if (!code) return { status: 400, body: { error: 'stop required' } };
    if (!key) return { status: 200, body: demoArrivals(code) };
    return { status: 200, body: await datamall(`v3/BusArrival?BusStopCode=${code}`, key) };
  }
  if (url.pathname === '/api/weather') {
    let stop = null;
    if (key && code) { try { stop = await getStop(code, key); } catch { /* fall back to default area */ } }
    const w = await weatherNear(stop?.Latitude, stop?.Longitude);
    return { status: 200, body: { ...w, stopName: stop ? `${stop.Description}, ${stop.RoadName}` : null } };
  }
  return null;
}
