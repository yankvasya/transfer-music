// Vercel Serverless Function: generic authenticated pass-through to the Deezer Web API
// (api.deezer.com). This API sends most CORS headers but consistently omits
// Access-Control-Allow-Origin (verified directly via curl against several origins), so
// the browser blocks it despite looking CORS-enabled at a glance — this proxy exists
// purely to make the call same-origin from the app's own domain.
//
// Deezer authenticates data calls via an `access_token` query param rather than an
// Authorization header. The frontend still sends a normal "Authorization: Bearer <token>"
// header to this proxy (consistent with every other connector in this app) — translating
// that into Deezer's expected query param is this proxy's job.
const DATA_API_BASE = 'https://api.deezer.com';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    if (!path || !path.startsWith('/')) {
      return Response.json({ error: 'missing_or_invalid_path' }, { status: 400 });
    }

    const authorization = request.headers.get('authorization');
    const accessToken = authorization?.replace(/^Bearer\s+/i, '');

    const target = new URL(`${DATA_API_BASE}${path}`);
    if (accessToken) target.searchParams.set('access_token', accessToken);

    const upstream = await fetch(target.toString(), {
      method: request.method,
      headers:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  },
};
