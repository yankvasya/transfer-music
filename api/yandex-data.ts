// Vercel Serverless Function: generic authenticated pass-through to the Yandex Music
// Data API (api.music.yandex.net). This API sends no CORS headers at all (verified
// directly against the live API), so the browser can never call it cross-origin —
// this proxy exists purely to make the call same-origin from the app's own domain.
//
// The frontend supplies the target path via ?path=, its own "Authorization: OAuth
// <token>" header (forwarded through as-is — this proxy never sees/handles the
// client_id or client_secret, only the end user's already-issued token), and any
// form-encoded body for POST requests (this API expects
// application/x-www-form-urlencoded, not JSON).
const DATA_API_BASE = 'https://api.music.yandex.net';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    if (!path || !path.startsWith('/')) {
      return Response.json({ error: 'missing_or_invalid_path' }, { status: 400 });
    }

    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return Response.json({ error: 'missing_authorization' }, { status: 401 });
    }

    const headers: Record<string, string> = {
      Authorization: authorization,
      // Identifies as the official Android app — the Data API appears to expect this.
      'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621',
    };

    const contentType = request.headers.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;

    const upstream = await fetch(`${DATA_API_BASE}${path}`, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  },
};
