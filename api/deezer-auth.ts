// Vercel Serverless Function: exchanges a Deezer OAuth authorization code for an access
// token. Unlike Spotify/YouTube, Deezer has no PKCE option — its token exchange needs an
// app_secret that must never reach the browser. Uses this app's own shared Deezer app
// (App ID + Secret Key set as server-side env vars here) rather than a per-user
// credential, the same trust model as the Yandex proxy.
const TOKEN_ENDPOINT = 'https://connect.deezer.com/oauth/access_token.php';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    }

    const appId = process.env.DEEZER_APP_ID;
    const appSecret = process.env.DEEZER_APP_SECRET;
    if (!appId || !appSecret) {
      return Response.json(
        { error: 'server_not_configured', error_description: 'DEEZER_APP_ID/DEEZER_APP_SECRET are not set on the server.' },
        { status: 500 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 });
    }

    const { code, redirectUri } = body;
    if (!code) {
      return Response.json({ error: 'missing_params' }, { status: 400 });
    }

    const params = new URLSearchParams({ app_id: appId, secret: appSecret, code, output: 'json' });
    if (redirectUri) params.set('redirect_uri', redirectUri);

    const upstream = await fetch(`${TOKEN_ENDPOINT}?${params.toString()}`);
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
  },
};
