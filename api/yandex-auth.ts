// Vercel Serverless Function: proxies Yandex's OAuth Device Flow (RFC 8628).
//
// Yandex Music has no public developer program — every third-party client shares the
// official Android app's client_id/client_secret (long-published in the open-source
// yandex-music-api project, not a secret we're newly exposing). We still keep them
// server-side here rather than in the browser bundle, both because that's the more
// robust place to hold credentials generally, and so future rotation only needs an
// env var change, not a redeploy of client code.
const OAUTH_BASE = 'https://oauth.yandex.ru';
const DEFAULT_CLIENT_ID = '23cabbbdc6cd418abb4b39c32c41195d';
const DEFAULT_CLIENT_SECRET = '53bc75238f0c4d08a118e51fe9203300';

function randomDeviceId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

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

    const clientId = process.env.YANDEX_CLIENT_ID || DEFAULT_CLIENT_ID;
    const clientSecret = process.env.YANDEX_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;

    let targetUrl: string;
    let targetBody: URLSearchParams;

    if (body.action === 'device_code') {
      targetUrl = `${OAUTH_BASE}/device/code`;
      targetBody = new URLSearchParams({
        client_id: clientId,
        device_id: randomDeviceId(),
        device_name: 'TransferMusic',
      });
    } else if (body.action === 'poll') {
      if (!body.deviceCode) {
        return Response.json({ error: 'missing_device_code' }, { status: 400 });
      }
      targetUrl = `${OAUTH_BASE}/token`;
      targetBody = new URLSearchParams({
        grant_type: 'device_code',
        code: body.deviceCode,
        client_id: clientId,
        client_secret: clientSecret,
      });
    } else if (body.action === 'refresh') {
      if (!body.refreshToken) {
        return Response.json({ error: 'missing_refresh_token' }, { status: 400 });
      }
      targetUrl = `${OAUTH_BASE}/token`;
      targetBody = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: body.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });
    } else {
      return Response.json({ error: 'unknown_action' }, { status: 400 });
    }

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: targetBody,
    });

    const data = await upstream.json().catch(() => ({}));
    return Response.json(data, { status: upstream.status });
  },
};
