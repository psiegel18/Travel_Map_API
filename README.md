# Travel Map API

A Cloudflare Worker that generates interactive travel maps showing visited US states, Canadian provinces, and countries worldwide.

## Features

- **US States**: Track work and personal visits to all 50 states
- **Canadian Provinces**: All 13 provinces and territories
- **International**: 70+ countries including UK subdivisions (England, Scotland, Wales, Northern Ireland)
- **Color Coding**: Work (orange), Personal (pink), Both (purple)
- **Trip Counts**: Visual intensity based on visit frequency
- **Future Trips**: Faded styling for planned trips, dashed borders for upcoming visits
- **Interactive**: Hover tooltips, click-to-zoom, responsive design

## Quick Start

```
https://your-worker.dev/?work=NY,CA,TX&personal=OH,HI&workTrips=NY:40,CA:9&persTrips=OH:3,HI:2
```

## URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `work` | US states visited for work (2-letter codes) | `NY,CA,TX,FL` |
| `personal` | US states visited personally | `OH,HI,MI` |
| `prov` | Canadian provinces (work) | `ON,BC,QC` |
| `provPers` | Canadian provinces (personal) | `AB,NS` |
| `workCountries` | Countries visited for work (3-letter ISO codes) | `GBR,DEU,FRA` |
| `persCountries` | Countries visited personally | `IRL,ESP,ITA` |
| `workTrips` | Work trip counts per location | `NY:40,CA:9,TX:17` |
| `persTrips` | Personal trip counts per location | `OH:3,HI:2,IRL:1` |
| `workFuture` | States with planned work trips | `FL,DE,IL` |
| `personalFuture` | States with planned personal trips | `NV,AZ` |
| `provFuture` | Provinces with planned trips | `BC,AB` |
| `persCountriesFuture` | Countries with planned trips | `JPN,AUS` |
| `workTripsFuture` | Future work trip counts | `FL:2,DE:1` |
| `persTripsFuture` | Future personal trip counts | `NV:1` |
| `title` | Custom map title | `My Travel Map` |

## Deployment

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Install Dependencies

```bash
npm install
```

### Local Development

```bash
npm run dev
```

### Deploy to Cloudflare

```bash
npm run deploy
```

## Configuration

### Environment Variables

Configure these in `wrangler.toml` or via Cloudflare dashboard:

| Variable | Description | Required |
|----------|-------------|----------|
| `ENVIRONMENT` | Deployment environment (`production`, `staging`, etc.) | No |
| `SENTRY_DSN` | Sentry Data Source Name for error tracking | No |
| `ADMIN_PASSWORD` | Password for admin endpoints (see below) | No |

### Setting Secrets

For sensitive values like `ADMIN_PASSWORD` and `SENTRY_DSN`, use Wrangler secrets:

```bash
# Set admin password (won't appear in logs or dashboard)
wrangler secret put ADMIN_PASSWORD

# Set Sentry DSN
wrangler secret put SENTRY_DSN
```

## Error Tracking (Sentry)

This project includes [Sentry](https://sentry.io) integration for error monitoring.

### Setup

1. Create a Sentry project for Cloudflare Workers
2. Copy the DSN from your Sentry project settings
3. Set it as a secret:
   ```bash
   wrangler secret put SENTRY_DSN
   ```

### Custom Tags

Errors are automatically tagged with map context for filtering in Sentry:

| Tag | Description |
|-----|-------------|
| `map.has_data` | Whether the request included map data |
| `map.states_count` | Number of US states visited |
| `map.provinces_count` | Number of Canadian provinces visited |
| `map.countries_count` | Number of countries visited |
| `map.has_work` | Whether work locations are included |
| `map.has_personal` | Whether personal locations are included |
| `map.has_future` | Whether future trips are included |
| `map.has_trip_counts` | Whether trip counts are provided |

### Testing Sentry Integration

The `/debug-sentry` endpoint allows you to verify Sentry is working. **This endpoint requires admin authentication.**

```bash
# Test Sentry (requires ADMIN_PASSWORD to be configured)
curl "https://your-worker.dev/debug-sentry?key=your-admin-password"
```

**Responses:**
- `401 Unauthorized` - Missing or invalid admin key
- `503 Service Unavailable` - `ADMIN_PASSWORD` not configured
- `500 Internal Server Error` - Success! Error was sent to Sentry

## Admin Endpoints

### `/debug-sentry`

Triggers a test error to verify Sentry integration.

**Authentication:** Requires `?key=` query parameter matching `ADMIN_PASSWORD` environment variable.

**Setup:**
```bash
wrangler secret put ADMIN_PASSWORD
# Enter a secure password when prompted
```

**Usage:**
```
GET /debug-sentry?key=your-admin-password
```

## Project Structure

```
Travel_Map_API/
├── worker.js          # Main Cloudflare Worker entry point
├── wiki-embed.js      # Helper for MediaWiki embedding
├── wrangler.toml      # Cloudflare Worker configuration
├── package.json       # Node.js dependencies
└── README.md          # This file
```

## State & Country Codes

### US States
Use standard 2-letter postal codes: `AL`, `AK`, `AZ`, `AR`, `CA`, `CO`, `CT`, `DE`, `FL`, `GA`, `HI`, `ID`, `IL`, `IN`, `IA`, `KS`, `KY`, `LA`, `ME`, `MD`, `MA`, `MI`, `MN`, `MS`, `MO`, `MT`, `NE`, `NV`, `NH`, `NJ`, `NM`, `NY`, `NC`, `ND`, `OH`, `OK`, `OR`, `PA`, `RI`, `SC`, `SD`, `TN`, `TX`, `UT`, `VT`, `VA`, `WA`, `WV`, `WI`, `WY`, `DC`

### Canadian Provinces
Use standard 2-letter codes: `AB`, `BC`, `MB`, `NB`, `NL`, `NS`, `NT`, `NU`, `ON`, `PE`, `QC`, `SK`, `YT`

### Countries
Use 3-letter ISO codes. Some common examples:
- **Europe:** `GBR`, `FRA`, `DEU`, `ITA`, `ESP`, `NLD`, `BEL`, `CHE`, `AUT`, `PRT`, `IRL`, `GRC`, `POL`, `CZE`, `HUN`, `SWE`, `NOR`, `DNK`, `FIN`
- **UK Subdivisions:** `ENG`, `SCT`, `WLS`, `NIR`
- **Americas:** `CAN`, `MEX`, `BRA`, `ARG`, `CHL`, `COL`, `PER`, `CRI`, `PAN`
- **Asia:** `JPN`, `CHN`, `KOR`, `IND`, `THA`, `VNM`, `SGP`, `MYS`, `IDN`, `PHL`, `TWN`
- **Oceania:** `AUS`, `NZL`
- **Africa:** `ZAF`, `EGY`, `MAR`, `KEN`

## License

MIT
