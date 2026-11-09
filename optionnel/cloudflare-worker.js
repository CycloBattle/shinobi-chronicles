// Proxy Cloudflare Worker (optionnel) : colle ce code dans ton Worker.
// Variables à définir : GEMINI_API_KEY (Secret) et ALLOWED_ORIGIN (ex : https://TON-PSEUDO.github.io)
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const autorises = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim());
    const cors = {
      'Access-Control-Allow-Origin': autorises.includes(origin) ? origin : autorises[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST' || !autorises.includes(origin))
      return new Response('Forbidden', { status: 403, headers: cors });

    let payload;
    try { payload = await req.json(); } catch { return new Response('Bad request', { status: 400, headers: cors }); }
    const model = /^gemini-[\w.-]+$/.test(payload.model || '') ? payload.model : 'gemini-2.5-flash';

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify(payload.body)
    });
    return new Response(await r.text(), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
};
