# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Cloudflare Worker (`worker.js`) that accepts URL parameters describing visited locations and returns a full HTML page with an interactive Leaflet.js travel map. Deployed at `https://travelmap.psiegel.org/`.

The worker is stateless — all data comes from query parameters. It is called by the MediaWiki client-side parser in the `PS-Trips Templates` repo.

## Commands

```bash
npm run dev      # local dev server at http://localhost:8787
npm run deploy   # deploy (see note below)
npm install      # install dependencies
```

> **Epic constraint**: Wrangler CLI is blocked at Epic. `npm run deploy` won't work from inside Epic's network. Instead, commit and push to GitHub — deployment is automated via GitHub Actions.
>
> Secrets (`ADMIN_PASSWORD`, `SENTRY_DSN`) must be set via the Cloudflare Dashboard, not `wrangler secret`.

## Testing Locally

```bash
# Basic map
curl "http://localhost:8787/?work=NY,CA,TX&personal=OH,HI&workTrips=NY:40,CA:9"

# Test Sentry (requires ADMIN_PASSWORD env var set)
curl "https://travelmap.psiegel.org/debug-sentry?key=your-admin-password"
```

## Architecture

### Entry Point

`export default Sentry.withSentry(...)` wraps the `fetch(request, env, ctx)` handler. All logic flows from there.

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `validateCodes()` | ~line 95 | Filters location codes against VALID_* sets |
| `sanitizeTitle()` | ~line 94 | Strips HTML/dangerous chars from `title` param |
| `parseTripCounts()` | ~line 105 | Parses `NY:40,CA:9` format |
| `fetchGeoDataWithCache()` | ~line 1015 | KV-cached GeoJSON fetch with retry |
| `fetchWithRetry()` | ~line 926 | 3-attempt fetch with exponential backoff + 10s timeout |
| `shouldShowLocation()` | ~line 856 | Determines layer visibility for active filter |

### Validation Sets

- `VALID_STATES` — 51 US states + DC (2-letter codes)
- `VALID_PROVINCES` — 13 Canadian provinces/territories (2-letter codes)
- `VALID_COUNTRIES` — 60+ countries (3-letter ISO codes, includes HTI, VIR)

### URL Parameters

**Current trips:** `work`, `personal`, `prov`, `provPers`, `workCountries`, `persCountries`, `workTrips`, `persTrips`

**Future trips:** `workFuture`, `personalFuture`, `provFuture`, `persCountriesFuture`, `workTripsFuture`, `persTripsFuture`

**Display:** `title`, `view` (persisted filter: `all`/`work`/`personal`/`past`/`future`), `print` (consumed on load, triggers auto-print)

### GeoJSON Caching (KV)

`fetchGeoDataWithCache()` checks `GEO_CACHE` KV namespace before fetching from GitHub. Cache keys: `geo_countries_50m`, `geo_states_provinces_50m`. TTL: 24 hours. Provides 200–300x speedup on cache hits (~10ms vs ~2–3s).

### Map Features

- Color coding: orange (work), pink (personal), purple (both), faded/dashed (future)
- Hover tooltips with full location name and trip count
- View filter buttons (All / Work Only / Personal Only / Past Only / Future Only) — state persisted in `&view=` URL param via `history.replaceState`
- Statistics dashboard (collapsible, auto-expands for print)
- Share buttons: Copy URL, Print (`&print=1` param approach for iframe-safe printing)
- Legend dimming based on active filter
- Smooth filter transitions via CSS `transition: fill-opacity 0.3s`

### Admin Endpoints

- `GET /debug-sentry?key=ADMIN_PASSWORD` — triggers a test Sentry error
  - `503` if `ADMIN_PASSWORD` not configured
  - `401` if key missing/wrong
  - `500` on success (error sent to Sentry)

### Sentry Integration

Configured via `SENTRY_DSN` env var. 10% performance sampling. Custom tags: `map.has_data`, `map.states_count`, `map.has_work`, `map.has_personal`, `map.has_future`, `map.has_trip_counts`. Sensitive headers scrubbed before sending.

## Environment Variables

Set via Cloudflare Dashboard (Workers & Pages → travel-map-api → Settings → Variables):

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Error monitoring |
| `ADMIN_PASSWORD` | Debug endpoint auth |
| `ENVIRONMENT` | Set to `production` in wrangler.toml |

## KV Namespace

`GEO_CACHE` binding defined in `wrangler.toml`. IDs already configured — do not recreate.
