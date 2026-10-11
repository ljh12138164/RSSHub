# 知乎热榜附带公开评论

## Background

rss-site 的知乎详情只有问题简介，部分页面只有“求经验分享！”一类占位内容。用户要求在 RSSHub 抓取时附带几条评论，使阅读内容更丰富。

## Scope

- 只修改 `/zhihu/hot` 输出，在问题简介后附带最多三条按热度排序的公开根评论。
- 保留问题标题、链接、发布时间及顺序；评论标明作者，并提供返回原问题的链接。
- 使用现有知乎访客会话、缓存和依赖；评论失败时保留简介，不影响其他问题。

## Out of scope

- 不采集回答或子评论，不翻页，不增加新路由、数据库字段或前端组件。
- 不修改 rss-site 当前未提交的 ingestion 文件。
- 不把评论补充当作搜索排名或索引质量的保证。

## Acceptance criteria

- 真实热榜条目包含最多三条可读评论及作者和原问题链接，保留原条目身份及顺序。
- 删除、折叠、审核中和仅自己可见的评论不输出；评论正文和作者按文本转义。
- 评论按问题缓存，过期使用 routeExpire，不在命中时无限续期；最多三个问题并发请求，共享一个知乎客户端。
- 评论空列表或接口失败保留原简介；失败结果不写入正常缓存。
- 格式、定向 lint、类型检查和部署构建完成，真实 route handler 验证输出。

## Feasibility

Feasible for public question comments. No-credential hot-list request returned HTTP 200 and 30 questions. Direct comment API request returned 403, while the repository's existing withZhihuClient guest session fetched 2 comments for question 19985938 and 3 for current hot question 2092635424363476073. The answer endpoint returned 403 in both probes; answers are outside this change. No credentials or generated session values were recorded.

The downstream rss-site parser already archives description/content HTML, and its reader supports h2, ol, li, p, a and blockquote. Reuse that existing article surface and sanitization with no UI code or visual changes. The user asked for comments; an optional clarification about answers versus comments was sent, and implementation uses the literal question-comment scope while awaiting any correction.

## Implementation

- Fetch only the first comment page with limit=3 and order_by=score.
- Reuse one withZhihuClient session for the whole hot feed; bound p-map concurrency to 3.
- Cache rendered comments per question using the route TTL and refresh=false. Catch failures outside cache.tryGet so a transient failure does not persist as an empty successful result.
- Strip comment HTML to plain text with Cheerio and escape text using the existing entities dependency; use the existing reader's basic typography.

## Verification

- `pnpm exec eslint lib/routes/zhihu/hot.ts`: passed.
- `pnpm exec oxlint --type-aware lib/routes/zhihu/hot.ts`: passed.
- `pnpm exec oxfmt --check lib/routes/zhihu/hot.ts docs/development/zhihu-hot-comments.md HERMES.md`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run vercel-build`: passed. Existing cache-unavailable and JSX namespace warnings were non-blocking. Removed the generated untracked `src/` bundle after inspection.
- `pnpm exec tsx tmp/zhihu-hot-live.mts`: live Hono route invocation on 2026-10-11 22:18 Beijing time returned HTTP 200 and 30 questions; 23 carried a total of 55 comments. Cold run: 2,907 ms; warm run in the same process: 174 ms. All comment lists had at most three non-empty entries and linked back to the question.
- Passed actual enriched RSS HTML through rss-site's existing feed parser and article sanitizer: three comment blockquotes and the section heading survived. No rss-site code change is needed.
- Injected a 403 for one real question's comment request after clearing only that question's local cache: the route still returned all 30 items, retained its title and excerpt, and other questions retained comments. The failed result was not cached.
- No route unit tests were added, following RSSHub AGENTS.md; ignored temporary live verification scripts and non-secret result summaries remain under `tmp/`.

## Review

Standards and acceptance-criteria review completed. The route keeps the existing path/default/category redirect and question identity, uses cached first-page API requests, shares one client with bounded concurrency, escapes added author/content text and excludes non-public comment states. Local upstream retrieval, downstream rendering, isolated failure, types, lint and deployment packaging were verified. No blocking findings or accepted out-of-scope follow-ups remain; no empty roadmap was created. Production publishing is the remaining delivery step and is not claimed as completed.

## Risks

- Zhihu may return 403, throttle requests or change comment API fields. Optional comments fall back to the existing excerpt; a cold feed adds at most one comment request per question.
- Comments are a sampled discussion snapshot and may change or disappear upstream; refresh at route cache expiry. They are not answers and may not address the question.
- Production requires publishing RSSHub before the next rss-site ingestion. This request has not explicitly authorized production deployment; local verified changes will be prepared and pushed for review first.
