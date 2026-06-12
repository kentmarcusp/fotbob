# World Cup Spoiler Safe

A small Node.js application for browsing World Cup fixtures and match events
without accidentally seeing results. Express serves a plain HTML, CSS, and
JavaScript frontend and retrieves football data through ESPN's unofficial
public soccer endpoints.

## Spoiler-safe design

The default browser experience receives only backend-sanitized data:

- `GET /api/matches` returns neutral team names, kickoff time, status, and venue.
  It does not return scores, winners, penalties, or event data.
- `GET /api/matches/:fixtureId/events` returns only event minute, extra time,
  and a normalized category such as `Goal`, `Yellow Card`, or `Substitution`.
- The browser initially renders those events as the neutral label
  `Event happened`. A separate button at the bottom of the recap reveals the
  normalized categories.
- Safe events omit team, player, assist, home/away side, score, comments, and
  provider-specific detail text.
- Safe recap categories distinguish goals, cards, substitutions, penalties,
  and VAR without revealing the team, player, score, or who benefited.
- Teams on the match list are alphabetized to avoid implying home/away roles.
- Unknown provider event types become the neutral label `Match Event`.
- Raw ESPN responses are mapped to internal objects and are never passed
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

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and review the tournament configuration:

   ```env
   ESPN_API_BASE_URL=https://site.api.espn.com/apis/site/v2/sports/soccer
   ESPN_WORLD_CUP_LEAGUE=fifa.world
   WORLD_CUP_SEASON=2026
   SPOILER_SAFE_MODE=true
   PORT=3000
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

For a normal server process without automatic restarts, run:

```bash
npm start
```

Run the sanitizer tests with:

```bash
npm test
```

## Deploy to Vercel

The app includes a Vercel-compatible Express API function, CDN-served assets in
`public/`, and `vercel.json`. See [DEPLOYMENT.md](DEPLOYMENT.md) for CLI,
environment-variable, GitHub integration, preview, and production deployment
instructions.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ESPN_API_BASE_URL` | ESPN soccer API base URL. |
| `ESPN_WORLD_CUP_LEAGUE` | ESPN league slug. Defaults to `fifa.world`. |
| `WORLD_CUP_SEASON` | Provider season value. Defaults to `2026`. |
| `SPOILER_SAFE_MODE` | Reserved configuration flag. Safe endpoints remain sanitized regardless of its value. |
| `PORT` | Local Express port. Defaults to `3000`. |

Provider network failures and unexpected response shapes return `502` errors.

## API provider notes

All provider-specific URLs, headers, and response mapping live in
`server/services/footballApiClient.js`. The current implementation uses:

- `/{league}/scoreboard?dates={season}&limit=1000`
- `/{league}/summary?event={fixtureId}`

These ESPN endpoints are public but unofficial and undocumented. Their URLs,
response fields, availability, and rate limits may change without notice.
Scheduled fixtures commonly have no events yet; the UI treats that as a normal
empty recap. Event coverage depends on what ESPN supplies for each match.

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
