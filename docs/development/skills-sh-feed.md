# skills.sh trending feed

## Background

skills.sh exposes authenticated JSON leaderboard views but no first-party RSS feed. The self-hosted RSSHub deployment runs on Vercel, whose request-scoped OIDC token can authenticate the API without a stored long-lived credential.

## Scope

- Add RSS feeds for the skills.sh `trending` and `hot` leaderboard views.
- Forward the request-scoped Vercel OIDC token to the official skills.sh API.
- Show the stable leaderboard metadata and the author-provided description from each `SKILL.md`.
- Deploy and validate both feeds on the linked Vercel project.

## Out of scope

- Scraping the skills.sh HTML leaderboard.
- Inferring categories or scraping generated summaries/topics from skills.sh HTML pages.
- Supporting the route on non-Vercel deployments without an externally supplied short-lived token.

## Acceptance criteria

- `/skills-sh` and `/skills-sh/trending` return the current trending leaderboard.
- `/skills-sh/hot` returns the hot leaderboard and includes change metadata when supplied upstream.
- Each item displays its author-provided description when a `SKILL.md` snapshot is available.
- Unsupported views fail with an actionable error.
- The route reads OIDC credentials per request and does not persist or log them.
- Focused tests, lint, and the Vercel build pass.
- Both production feed URLs return successful RSS after deployment.

## Feasibility

Feasible on Vercel. skills.sh accepts a Vercel-issued OIDC bearer token, and Vercel Functions inject it as `x-vercel-oidc-token`. Local development can fall back to `VERCEL_OIDC_TOKEN`. The token must be read inside each request because it is short-lived. Descriptions require one detail request per skill, so detail responses are cached and fetched with bounded concurrency. A missing description does not fail the whole feed. The API does not provide per-item timestamps; the feed must leave `pubDate` absent rather than inventing one.

## Implementation

- Added a single optional `view` path parameter, defaulting to `trending` and accepting `hot`.
- Read the Vercel OIDC token from the request header with a local-development environment fallback.
- Used the official leaderboard API once per feed request and mapped its stable metadata directly to RSS items.
- Cached detail responses and extracted the author-provided `description` from `SKILL.md` frontmatter with concurrency limited to five requests.
- Kept item publication dates absent because the upstream API does not provide them.

## Verification

- Confirmed the existing `rss-hub` Vercel project has OIDC enabled by linking it and receiving a development token without exposing its value.
- Called the real `trending` and `hot` APIs with that token: both returned HTTP 200, and the response fields matched the implementation; `hot` included `installsYesterday` and `change`.
- `vitest run tests/skills-sh.test.ts`: 5 tests passed, including plain, quoted, and folded frontmatter descriptions.
- `eslint lib/routes/skills-sh/index.ts lib/routes/skills-sh/namespace.ts tests/skills-sh.test.ts`: passed.
- `npm run vercel-build`: passed, and the generated route registry included `skills-sh`.
- Deployed the description-enriched feed to the existing `rss-hub` Vercel production project on 2026-09-13; the production deployment reached `READY` and was aliased to `rss.ljhboard.cn`.
- `https://rss.ljhboard.cn/skills-sh/trending`: HTTP 200 in 15.90 seconds on the validation request, 100 items, and all 100 included an author-provided description.
- `https://rss.ljhboard.cn/skills-sh/hot`: HTTP 200 in 13.88 seconds on the validation request, 100 items, and 96 included an author-provided description; the four missing descriptions were tolerated as designed.
- Final review found no blocking findings and no accepted follow-ups requiring a roadmap.

## Risks

- Non-Vercel deployments will not have an OIDC token unless one is injected at runtime.
- skills.sh may change its authenticated API response shape.
- A cold feed request requires up to 100 detail API calls; bounded concurrency and detail caching limit upstream load, but the first response can take around 14–16 seconds.
