// Vercel Serverless Function: exchanges a Deezer OAuth authorization code for an access
// token. Unlike Spotify/YouTube, Deezer has no PKCE option — its token exchange needs an
// app_secret that must never reach the browser. Unlike Yandex, Deezer has no
// widely-published shared credential either, so each user brings their own app_id +
// app_secret (registered at developers.deezer.com/myapps, same trust model as this app's
// existing "paste your own Client ID" flow, just extended to a secret too). Both values
// are supplied per-request by the client and forwarded here without being stored
// server-side.
const TOKEN_ENDPOINT = 'https://connect.deezer.com/oauth/access_token.php';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 });
    }

    const { appId, appSecret, code, redirectUri } = body;
    if (!appId || !appSecret || !code) {
      return Response.json({ error: 'missing_params' }, { status: 400 });
    }

    const params = new URLSearchParams({ app_id: appId, secret: appSecret, code, output: 'json' });
    if (redirectUri) params.set('redirect_uri', redirectUri);

    const upstream = await fetch(`${TOKEN_ENDPOINT}?${params.toString()}`);
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
  },
};
