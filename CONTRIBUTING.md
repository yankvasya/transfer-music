# Contributing to TransferMusic

Thanks for your interest in contributing! This guide covers how to set up the project locally, run the checks, and add a new service.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your own app credentials, see below
npm run dev
```

### Credentials

Every service runs on one shared app instead of a per-visitor Client ID — see `.env.example` for the full list. Short version:

- **Spotify / YouTube**: register your own app (Spotify Developer Dashboard / Google Cloud Console) and set `VITE_SPOTIFY_CLIENT_ID`, `VITE_SPOTIFY_REDIRECT_URI`, `VITE_YOUTUBE_CLIENT_ID`, `VITE_YOUTUBE_REDIRECT_URI` in `.env`.
- **Yandex Music**: uses a shared OAuth app — the proxy functions in `api/` need `YANDEX_CLIENT_ID` / `YANDEX_CLIENT_SECRET` set as server-side env vars (in your Vercel project settings, not `.env`).
- **Deezer**: register an app at `developers.deezer.com/myapps`. The App ID is public (`VITE_DEEZER_APP_ID`); the Secret Key must be server-side only (`DEEZER_APP_SECRET`, set in Vercel, never in `.env`/committed anywhere).

### Scripts

```bash
npm run dev       # start the dev server
npm run build     # typecheck + production build
npm run lint       # oxlint
npm test           # run the full Vitest suite
npm run preview   # serve the production build locally
```

## Architecture in brief

Every service implements the same two interfaces — `DestinationConnector` (`createPlaylist` / `searchTrack` / `addTracks`) and `SourceConnector` (`listPlaylists` / `getPlaylistName` / `getPlaylistTrackLines`) — so `ImporterProgress`, `ExportView`, and the bridge queue are all generic components driven by whichever connector gets passed in, not four sets of near-duplicate screens. Matching confidence is scored in a single dependency-free utility (`src/utils/matching.ts`): above `0.85` auto-accepts, between `0.5` and `0.85` goes to manual review, below that is a miss.

## Adding a new service

1. Implement the `DestinationConnector` / `SourceConnector` interfaces in `src/connectors/` (see the existing ones for reference).
2. Add the auth flow (OAuth PKCE, Device Flow, etc.) in `src/hooks/` and `api/` if a CORS/auth proxy is needed.
3. Register the service in `src/serviceMeta.ts` and `src/connectors/index.ts`.
4. Add tests alongside your connector and components.
5. Run `npm run lint` and `npm test` to make sure everything passes.

## Self-hosting

The `api/` handlers use the Web Fetch API shape Vercel's runtime expects (`export default { fetch(request) }`) — `server.ts` is a small always-on Node process that runs those same, unmodified handlers outside of Vercel, translating between Node's `http` module and the Web `Request`/`Response` objects they expect.

- `npm run build` produces the static frontend in `dist/`.
- `npm run start:api` runs the API proxy on `process.env.PORT` (default `3001`), loading credentials from a `.env` file via `dotenv` — see `.env.example` for what's required. For a persistent process, something like `pm2 start "npx tsx server.ts" --name transfermusic-api` works too.
- Point a reverse proxy (e.g. Caddy) at both: serve `dist/` as static files, and forward `/api/*` to `http://localhost:3001`.
