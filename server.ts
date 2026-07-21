// Self-hosted stand-in for the Vercel serverless runtime: the four handlers in api/ all
// use the Web Fetch API shape (`export default { fetch(request: Request) }`) because
// that's what Vercel's own runtime calls directly. On a plain Node server there's no
// Vercel runtime to do that translation, so this file does it instead — convert each
// incoming Node request into a Web Request, hand it to the same unmodified handler, and
// convert the Web Response back into a Node response. The handlers themselves don't
// know or care which runtime is calling them.
import 'dotenv/config';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import deezerAuth from './api/deezer-auth.ts';
import deezerData from './api/deezer-data.ts';
import yandexAuth from './api/yandex-auth.ts';
import yandexData from './api/yandex-data.ts';

const PORT = Number(process.env.PORT) || 3001;

const routes: Record<string, { fetch(request: Request): Promise<Response> }> = {
  '/api/deezer-auth': deezerAuth,
  '/api/deezer-data': deezerData,
  '/api/yandex-auth': yandexAuth,
  '/api/yandex-data': yandexData,
};

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const url = `http://${req.headers.host ?? `localhost:${PORT}`}${req.url ?? '/'}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';
  let body: Buffer | undefined;
  if (hasBody) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    if (chunks.length > 0) body = Buffer.concat(chunks);
  }

  return new Request(url, { method, headers, body });
}

async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  const body = response.body ? Buffer.from(await response.arrayBuffer()) : null;
  res.end(body);
}

const server = createServer((req, res) => {
  const pathname = (req.url ?? '').split('?')[0];
  const handler = routes[pathname];

  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
    return;
  }

  toWebRequest(req)
    .then((request) => handler.fetch(request))
    .then((response) => sendWebResponse(res, response))
    .catch((err) => {
      console.error('Request handling error:', err);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error' }));
    });
});

server.listen(PORT, () => {
  console.log(`TransferMusic API proxy listening on port ${PORT}`);
});
