# Antigravity language loader repair

## Scope

Restore the existing `/google/antigravity/blog/zh-CN` route after the upstream Astro build changed its script entry point. Keep the existing route, official translations, article cache, original URLs, media, and publication dates.

## Cause and implementation

The blog now loads `SharedHeadBootstrap` instead of `BaseLayout`. Its runtime uses a `../locales/zh-CN/blog.json` key and backtick import strings. Discover all three dynamically rather than pinning build hashes. Retain the previous loader pattern for compatible upstream builds.

The separate STCN route parsed successfully against the live site. Its production Vercel failures were connection timeouts to stcn.com, so its parser is unchanged. The rss-site application will fetch STCN on ECS as requested.

## Verification

- Live handler: 28 entries with official Chinese titles and full article bodies
- `pnpm exec oxfmt lib/routes/google/antigravity.ts`: passed
- `pnpm exec oxlint --type-aware lib/routes/google/antigravity.ts`: passed
- Protected Vercel preview `dpl_74MrZ2yHxgY6FrsJLyxoCaYbrBVF`: HTTP 200, 28 entries, first description 10,299 characters
- Production `dpl_BcKv7pErkoaoN2VLwcCZ1KmiPCpc`: READY, `rss.ljhboard.cn` alias assigned; public route HTTP 200, 475,356 bytes on 2026-11-06
- No route unit tests added, following repository instructions; verification uses the real upstream

## Review

Only loader discovery changed. Existing routes and data contracts remain compatible. No blocking findings or accepted follow-ups.
