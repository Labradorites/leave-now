// Cloudflare Worker: the API half of Leave Now when the page is hosted on GitHub Pages.
// Deploy: npx wrangler deploy   Key: npx wrangler secret put DATAMALL_KEY

import { handleApi } from './api.mjs';

const ALLOWED = ['https://labradorites.github.io', 'http://localhost:3000'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin');
    const cors = {
      'access-control-allow-origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
      vary: 'origin',
    };
    let status = 404, body = { error: 'Not found' };
    try {
      const out = await handleApi(new URL(request.url), env.DATAMALL_KEY);
      if (out) ({ status, body } = out);
    } catch (err) {
      status = 502; body = { error: err.message };
    }
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } });
  },
};
