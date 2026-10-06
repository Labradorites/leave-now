// Where the API lives. Empty = same server (node server.js).
// On GitHub Pages this points at the Cloudflare Worker.
window.API_BASE = location.hostname.endsWith('github.io') ? 'https://leave-now.leave-now.workers.dev' : '';
