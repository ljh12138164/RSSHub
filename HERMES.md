# HERMES

## Active objective

Up to three public question comments are implemented on `feat/zhihu-hot-comments`. Live retrieval, downstream ingestion/rendering, isolated failure fallback, lint, types and Vercel build passed; 23 of 30 sampled hot questions carried 55 comments.

## Next action

Push the verified branch for the user to create and merge a PR into `master`, then publish RSSHub and verify the next rss-site ingestion. See `docs/development/zhihu-hot-comments.md`.

## Prior work

The skills.sh descriptions were locally verified; their prior next action was production validation. See `docs/development/skills-sh-feed.md`.
