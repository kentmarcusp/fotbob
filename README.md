# World Cup Spoiler Safe

A small Node.js application for browsing World Cup fixtures and match events
without accidentally seeing results. Express serves a plain HTML, CSS, and
JavaScript frontend and retrieves football data through API-Football/API-Sports.

## Spoiler-safe design

The default browser experience receives only backend-sanitized data:

- `GET /api/matches` returns neutral team names, kickoff time, status, and venue.
  It does not return scores, winners, penalties, or event data.
- `GET /api/matches/:fixtureId/events` returns only event minute, extra time,
  and a normalized event type.
- Safe events omit team, player, assist, home/away side, score, comments, and
  provider-specific detail text.
- Goals, red cards, penalties, and VAR/disallowed-goal events are collapsed to
  `Goal`, `Red Card`, `Penalty`, or `Disallowed Goal / VAR Check`. Penalty
  outcomes and VAR beneficiaries are never included.
- Teams on the match list are alphabetized to avoid implying home/away roles.
- Unknown provider event types become the neutral label `Match Event`.
- Raw API-Sports responses are mapped to internal objects and are never passed
  directly to spoiler-safe endpoints.

Spoiler-containing data is isolated in
`GET /api/matches/:fixtureId/full-details`. The browser does not preload this
endpoint. It calls it only after the match is marked watched and the user
confirms the spoiler warning. Full-detail responses use `Cache-Control:
no-store` and are not written to `localStorage`.

## Watched matches

Each match has a `Mark as watched` toggle. Watched fixture IDs are stored in the
current browser's `localStorage`, so they remain marked after a refresh.

Marking a match watched does not reveal anything automatically. It only makes
the `Reveal full details` button available. Revealing still requires a separate
confirmation. Cancelling the dialog makes no request. Unmarking a match removes
any full details currently displayed for it.

This is a product safety measure, not an authorization boundary. A person who
directly calls the full-details endpoint can receive spoilers.

## Requirements

- Node.js 18 or newer
- An API-Football/API-Sports API key with fixture coverage

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`.

3. Add your provider API key and review the tournament configuration:

   ```env
   FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
   FOOTBALL_API_KEY=your_key_here
   WORLD_CUP_LEAGUE_ID=1
   WORLD_CUP_SEASON=2026
   SPOILER_SAFE_MODE=true
   PORT=3000
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

For a normal server process without automatic restarts, run:

```bash
npm start
```

Run the sanitizer tests with:

```bash
npm test
```

## Deploy to Vercel

The app includes a Vercel-compatible Express entry point, CDN-served assets in
`public/`, and `vercel.json`. See [DEPLOYMENT.md](DEPLOYMENT.md) for CLI,
environment-variable, GitHub integration, preview, and production deployment
instructions.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `FOOTBALL_API_BASE_URL` | Provider base URL. Defaults to API-Sports v3. |
| `FOOTBALL_API_KEY` | Required API-Sports key sent only by the backend. |
| `WORLD_CUP_LEAGUE_ID` | Provider competition ID. Defaults to `1`. |
| `WORLD_CUP_SEASON` | Provider season value. Defaults to `2026`. |
| `SPOILER_SAFE_MODE` | Reserved configuration flag. Safe endpoints remain sanitized regardless of its value. |
| `PORT` | Local Express port. Defaults to `3000`. |

If the API key is missing, fixture endpoints return a clear `503` error. Provider
network failures and unexpected provider response shapes return `502` errors.

## API provider notes

All provider-specific URLs, headers, and response mapping live in
`server/services/footballApiClient.js`. The current implementation uses:

- `/fixtures?league=...&season=...`
- `/fixtures/events?fixture=...`
- `/fixtures?id=...`

API-Sports plans, rate limits, tournament IDs, historical coverage, and event
availability can change. Confirm that the configured league and season are
available for your account. Scheduled fixtures commonly have no events yet;
the UI treats that as a normal empty recap.

## Project structure

```text
server/routes/matches.js             Thin HTTP route handlers
server/services/footballApiClient.js Provider requests and response mapping
server/utils/spoilerSanitizer.js      Safe response and full-detail transforms
public/                              Static browser application and CDN assets
test/                                Sanitizer regression tests
```

## Known limitations

- Watched state is local to one browser.
- The app depends on the selected API provider's World Cup coverage.
- The initial version does not include authentication.
- The initial version does not include server-side persistence.
- The full-details endpoint is not protected by server-side watched state.
- Spoiler safety depends on preserving backend sanitization and endpoint
  separation.
- There is no pagination, filtering, or API response cache.

## Future improvements

- Add user accounts.
- Store watched matches server-side.
- Add tournament stage filters.
- Add country filters.
- Add calendar grouping.
- Add a `hide live matches` option.
- Add more sanitizer tests for additional provider variants, plus broader route
  and browser interaction tests.
- Add deployment configuration.
