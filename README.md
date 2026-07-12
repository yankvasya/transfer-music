# 🔀 TransferMusic

Move playlists between **Spotify, YouTube, Yandex Music, and Deezer** — paste a plain-text tracklist and turn it into a playlist, export any playlist back to text, or bridge two services directly with bulk migration.

**Live demo:** [transfer-music-beta.vercel.app](https://transfer-music-beta.vercel.app)

[![CI](https://github.com/yankvasya/transfer-music/actions/workflows/ci.yml/badge.svg)](https://github.com/yankvasya/transfer-music/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<!-- Add a screenshot or short GIF of the picker + an import in progress here. -->

## What it does

- **Import**: paste `Artist - Title` lines and create a real playlist on Spotify, YouTube, Yandex Music, or Deezer.
- **Export**: turn any of your playlists on those services into a plain-text tracklist (copy or download).
- **Direct bridge**: move one or more playlists straight from one service to another — no manual copy-paste tracklist step, with search, select-all, and filtering for large libraries.
- **Bulk migration**: queue up several playlists at once; the queue pauses (rather than silently skipping ahead) if a connector-wide rate limit or quota is hit.
- **Smart track matching**: every match is scored (normalized string similarity across title + artist, ignoring things like "(Live)"/"(Remaster)" suffixes). High-confidence matches are added automatically; uncertain ones land in a "Needs Review" queue where you pick the right candidate or reject them all.
- **Resumable imports**: progress is checkpointed as it runs — a rate limit, a quota cap, a closed tab, or even a crash mid-import all leave an accurate, resumable entry in History instead of losing work.
- **Duplicate detection**: two tracklist lines that resolve to the same actual track only get added once.
- **Import history**: every run is saved locally (with resume/retry for anything incomplete), independent of any backend.

## Why these four services

Each one needed a different auth flow, which is most of why this project exists as a learning exercise:

| Service | Auth | Notes |
|---|---|---|
| Spotify | OAuth PKCE, your own Client ID | Direct browser calls |
| YouTube | OAuth PKCE, your own Client ID | Data API v3; import capped at ~100 searches/day on the free tier, handled via a circuit breaker |
| Yandex Music | OAuth Device Flow, shared credential | No CORS support server-side — proxied through a small Vercel function |
| Deezer | OAuth (no PKCE), your own App ID + Secret | Also proxied — missing `Access-Control-Allow-Origin` blocks direct calls |

A couple of services were investigated and deliberately **not** added: VK Music (no OAuth path for audio scope — the only working method needs the user's raw account password, with real ban risk), and Apple Music / SoundCloud (both require a paid developer subscription just to register an app).

## Tech stack

- **React 19 + TypeScript + Vite**, `react-router-dom` (query-param routing, not path segments — adding a service is a new `?type=` value, not new routes)
- **Vercel serverless functions** (Web Fetch API handlers) for the two services that need a CORS/auth proxy
- **Vitest + React Testing Library** — 76 tests across 11 files, covering the core import loop (rate limiting, quota handling, resumability, duplicate detection, manual review), the bulk migration queue, and history persistence
- **GitHub Actions CI** — typecheck, build, lint, and the full test suite on every PR
- No backend database — playlists and history live in the actual music services and the browser's `localStorage`, respectively

### Architecture in brief

Every service implements the same two interfaces — `DestinationConnector` (`createPlaylist` / `searchTrack` / `addTracks`) and `SourceConnector` (`listPlaylists` / `getPlaylistName` / `getPlaylistTrackLines`) — so `ImporterProgress`, `ExportView`, and the bridge queue are all generic components driven by whichever connector gets passed in, not four sets of near-duplicate screens. Matching confidence is scored in a single dependency-free utility (`src/utils/matching.ts`): above `0.85` auto-accepts, between `0.5` and `0.85` goes to manual review, below that is a miss.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your own OAuth credentials, see below
npm run dev
```

### Credentials

- **Spotify / YouTube**: register your own app (Spotify Developer Dashboard / Google Cloud Console) and set `VITE_SPOTIFY_CLIENT_ID`, `VITE_SPOTIFY_REDIRECT_URI`, `VITE_YOUTUBE_CLIENT_ID`, `VITE_YOUTUBE_REDIRECT_URI` in `.env`.
- **Yandex Music**: uses a shared OAuth app — no per-user setup needed locally, but the proxy functions in `api/` need `YANDEX_CLIENT_ID` / `YANDEX_CLIENT_SECRET` set as server-side env vars if you're deploying your own instance.
- **Deezer**: no env vars — you enter your own App ID and Secret Key directly in the app's login screen.

### Scripts

```bash
npm run dev       # start the dev server
npm run build     # typecheck + production build
npm run lint       # oxlint
npm test           # run the full Vitest suite
npm run preview   # serve the production build locally
```

## Deploying

Built for Vercel: `vercel.json` rewrites everything except `/api/*` to `index.html` (client-side routing via `BrowserRouter`), and the two proxy endpoints ship as Vercel serverless functions automatically.

## License

[MIT](LICENSE)
