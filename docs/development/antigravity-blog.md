# Google Antigravity 全文与封面

## Background

官方 `https://antigravity.google/blog/rss.xml` 只提供标题、链接、日期、作者和分类。用户要求为 rss-site 的站内阅读补齐正文和封面。

## Scope

新增 Google 命名空间路由 `/google/antigravity/blog`，从官方 RSS 读取元数据，抓取文章正文和封面，供配套 rss-site PR #45 消费。

## Out of scope

浏览器自动化、分页、参数、依赖变更、生产部署和 Cron 启用。

## Acceptance criteria

- 官方首屏 25 篇能抓到正文与封面，保留真实时间、作者、分类和唯一链接。
- 正文排除标题、作者栏、分享、下载按钮及邮件订阅组件。
- 封面及正文图片可供 rss-site 现有解析器识别；媒体和链接使用绝对地址，延迟加载视频恢复 src。
- 文章详情用 cache.tryGet 缓存，pMap 并发 3；不新增路由测试文件，使用真实上游验证。

## Feasibility

可行。沿用已有 Cloudflare Blog 的官方 RSS 加全文补抓模式。页面为服务端 HTML，稳定类名 `.post .content-section` 和 `.hero-image-wrapper` 包含正文和封面，`og:image` 提供封面元数据；不依赖带构建 hash 的 JS 或 Playwright。

## Implementation

- `lib/routes/google/antigravity.ts` 注册路由与 Radar。
- 官方 RSS 保留标题、日期、作者、分类和 guid；正文与封面按文章链接缓存。
- 将头图与正文合并，排除分享、订阅和 CTA 组件；保留段落、图片、代码、列表及视频。
- 相对 src/href/poster 转为绝对地址；恢复 data-src 媒体，移除 srcset 避免相对候选地址。
- 维护者 `ljh12138164` 已通过 GitHub API 验证存在。

## Verification

- TypeScript、ESLint、Oxlint 与 Oxfmt 检查通过，`build:routes` 成功；构建提示本机缓存不可用，不将它冒称为生产缓存验证。
- 使用真实官方列表与全部文章运行 handler：25/25 正文和封面，正文 HTML 最短 3,024 字符；真实 RSS 模板输出 369,006 bytes。检查无标题栏、订阅或分享组件残留，src/href/poster 无相对地址，视频具有可播放 src/source。
- 真实 RSS 输出交给 rss-site 的 `parseSignalFeed`：25/25 正文、25/25 封面、25/25 发布时间，最短正文 3,024 字符。
- Standards/Spec 自审无阻塞项或接受的后续事项，不创建空 roadmap；无路由测试文件，未部署生产。
- 配套消费方：rss-site PR https://github.com/ljh12138164/rss-site/pull/45。

## Risks

上游 HTML 结构变化会触发明确的正文缺失错误；首次无缓存抓取需访问 25 篇文章，生产需验证耗时。先部署本路由，再发布 rss-site API 并完成云端数据验收，之后启用 Cron。
