# RSSHub production migration

## Background

The production deployment was created from a standalone Vercel-import repository, so GitHub could not identify it as a fork or provide reliable upstream synchronization. The validated DeepSeek route and Vercel build fixes must move to the real `ljh12138164/RSSHub` fork.

## Scope

- Restore the DeepSeek official-news feed against the current documentation site.
- Prevent development route discovery from importing colocated test modules during Vercel builds.
- Add a safe scheduled/manual upstream synchronization workflow for the fork.
- Verify the focused tests, lint, and Vercel production build locally.

## Out of scope

- Changing the `rss-site` API or its Supabase schema and Cron jobs before the new RSSHub deployment is live.
- Storing or migrating deployment secrets in the repository.
- Force-updating the fork when upstream conflicts with local changes.

## Acceptance criteria

- `/deepseek/news` discovers only official `/zh-cn/news/news*` pages and returns unique items with plausible dates.
- Route discovery accepts runtime TypeScript modules and rejects `*.test.*` and `*.spec.*` modules.
- `pnpm run vercel-build` succeeds with the route test colocated under `lib/routes`.
- The fork can merge `DIYgod/RSSHub:master` automatically when there is no conflict and fails visibly instead of overwriting local work when there is a conflict.

## Feasibility

Feasible. The new repository is a real fork with `origin` and `upstream` remotes, and its `master` branch was fast-forwarded to the latest upstream commit before development. The current DeepSeek selector assumes the second sidebar group is news and can return guide pages after upstream layout changes. Discovering the current news page first and filtering links by the stable news path avoids that failure. The Vercel builder loads the development registry, whose broad TypeScript import pattern currently includes Vitest files; excluding test/spec suffixes removes the build-time side effect without changing runtime route files.

The synchronization workflow performs a normal merge. Conflicts intentionally stop the job for manual resolution; force push is not used. Repository Actions must allow the workflow token to write contents.

## Implementation

- Use the official DeepSeek documentation pages and existing RSSHub cache/date utilities.
- Keep route tests beside the route and fix the registry glob centrally.
- Run upstream synchronization daily and on manual dispatch against this fork only.
- Keep `GITHUB_ACCESS_TOKEN` and `NODE_OPTIONS` in Vercel environment settings, never in Git.

## Verification

- Fast-forwarded and pushed the fork's `master` branch from `3e11afc95` to upstream `bc8757ee5` before branching.
- `pnpm exec vitest run lib/registry-dev.test.ts lib/routes/deepseek/news.test.ts`: 2 files and 15 tests passed.
- `pnpm exec eslint .github/workflows/sync-upstream.yml lib/registry-dev.ts lib/registry-dev.test.ts lib/routes/deepseek/news.ts lib/routes/deepseek/news.test.ts`: passed.
- `pnpm exec oxfmt --check ...`: all seven changed code, workflow, and documentation files passed.
- Direct no-credential route invocation returned 17 official DeepSeek news items. The feed link and first item link used `/zh-cn/news/news260821`; the first item had a non-empty title and a plausible publication timestamp.
- `pnpm run vercel-build`: passed and produced the Vercel bundle. Existing RSSHub cache and transform warnings were non-blocking.
- Final standards and acceptance-criteria review found no blocking findings and no accepted follow-ups requiring a roadmap.

## Risks

- DeepSeek may change its documentation structure or news URL convention again.
- An upstream conflict requires a manual merge before scheduled synchronization can continue.
- Production ingestion remains disabled until the deployed route is verified against cloud Supabase.
