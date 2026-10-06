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
const apiReady = import('./api.mjs'); // shared with the Cloudflare Worker

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    const out = await (await apiReady).handleApi(url, KEY);
    if (out) return send(res, out.status, out.body);
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
