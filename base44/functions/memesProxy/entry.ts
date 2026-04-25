const MEMES_API = 'https://dash.tradinganalyticspro.com/memes-api';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const path = body.path || '/signals';
    const method = body.method || 'GET';
    const params = body.params || '';

    const url = `${MEMES_API}${path}${params ? '?' + params : ''}`;

    const fetchOpts: RequestInit = { method };
    if (method === 'POST' && body.body) {
      fetchOpts.body = JSON.stringify(body.body);
      fetchOpts.headers = { 'Content-Type': 'application/json' };
    }

    const res = await fetch(url, fetchOpts);
    const data = await res.json();

    return Response.json(data, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders });
  }
});
