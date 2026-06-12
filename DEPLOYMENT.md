# Vercel Deployment

This project is prepared for Vercel's native Express support:

- `api/[...path].js` exports the Express application as the API catch-all
  serverless entry point.
- `server/index.js` remains the local Node.js listener.
- `public/` contains browser assets served by Vercel's CDN.
- `vercel.json` configures the function and baseline response headers.
- `.env` and `.vercel/` are excluded from Git.

Vercel runs the Express application as one Vercel Function. ESPN requests are
made by the backend, and raw provider responses are never passed directly to
the spoiler-safe browser endpoints.

## First deployment

The installed Vercel CLI must be authenticated:

```powershell
vercel login
```

From this directory, link or create the Vercel project:

```powershell
vercel link
```

Add or confirm the non-secret configuration:

```powershell
vercel env add ESPN_API_BASE_URL
vercel env add ESPN_WORLD_CUP_LEAGUE
vercel env add WORLD_CUP_SEASON
vercel env add SPOILER_SAFE_MODE
```

Recommended values:

```env
ESPN_API_BASE_URL=https://site.api.espn.com/apis/site/v2/sports/soccer
ESPN_WORLD_CUP_LEAGUE=fifa.world
WORLD_CUP_SEASON=2026
SPOILER_SAFE_MODE=true
```

Deploy production:

```powershell
npm run deploy
```

Vercel will print the production URL. Verify:

```text
https://your-project.vercel.app/
https://your-project.vercel.app/api/health
```

## Git-based deployments

For automatic preview and production deployments:

1. Create a GitHub repository for this project.
2. Push the local repository.
3. In Vercel, choose **Add New Project** and import that repository.
4. Configure the environment variables above.
5. Deploy.

After the Git integration is connected:

- pushes to the production branch create production deployments;
- pushes to other branches and pull requests create preview deployments;
- environment secrets remain in Vercel rather than Git.

## Local Vercel runtime

After `vercel link` and `vercel env pull .env.local`, run:

```powershell
npm run vercel:dev
```

The existing local workflow remains:

```powershell
npm run dev
```

## Operational notes

- ESPN's unofficial endpoint availability and rate limits still apply to
  serverless requests.
- Full details are never prefetched and responses use `Cache-Control: no-store`.
- Browser watched state remains in `localStorage`; Vercel stores no user state.
- There is no database or persistent filesystem requirement.
- Provider outages return controlled API errors instead of raw provider data.
