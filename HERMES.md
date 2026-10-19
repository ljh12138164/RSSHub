# HERMES

## 2026-10-19 Antigravity 云端解析内存

- #7 和 rss-site #47 已合并；Vercel 实际中文路由发现 raw transfer 的 6 GiB ArrayBuffer 分配失败，原 PR 合并后的修复不在 master。
- 从最新 master `a7a3887c` 创建 `feat/antigravity-parser-memory` 移植修复；记录 `docs/development/antigravity-parser-memory.md`。
- 本地 25 篇内容/媒体/代码块/日期对比、类型、lint 和格式通过。下一步提交补丁 PR、等待构建，再验证真实云端 Feed；不自动合并部署。

## 2026-10-19 Antigravity 官方中文

- 当前目标：`feat/antigravity-chinese`，为现有 Antigravity 全文路由添加显式 zh-CN 路径，rss-site 同名分支消费；保留英文默认和原文章链接。
- 记录：`docs/development/antigravity-chinese.md`。官方中文资源已探明，25 个 RSS 标题均有官方翻译，采用已有解析器提取静态数据、动态查找 hash，不执行远端脚本。
- 动态资源解析和官方中文替换已完成；25/25 标题正文、媒体/代码块、原 URL/日期逐篇验证，真实 RSS 经 rss-site 解析通过，类型、lint、格式和路由构建通过。
- 已交付 RSSHub PR https://github.com/ljh12138164/RSSHub/pull/7，配套 rss-site https://github.com/ljh12138164/rss-site/pull/47；本地检查通过，CI/预览待完成。
- 首次预览发现 Oxc raw transfer 的 6 GiB 虚拟缓冲区在 Vercel 分配失败；本路由已关闭该优化（工具默认不变），本地 25 篇验证重新通过。
- 下一步等待修复构建后回归真实云端路由；不直接合并部署。需先部署 RSSHub，再发布 rss-site API，最后回归生产采集和页面更新。

## 2026-10-19 Antigravity Blog

- 当前目标：`feat/antigravity-blog` 新增 `/google/antigravity/blog` 全文与封面，配套 rss-site PR #45。
- 开发记录：`docs/development/antigravity-blog.md`。沿用官方 RSS 元数据加缓存 HTML 正文模式，无浏览器或新依赖。
- 真实上游 25/25 篇正文和封面通过；真实 RSS 模板与 rss-site 解析器验证全部正文、封面和时间，369,006 bytes。类型、ESLint、Oxlint、格式和路由构建通过，自审无阻塞。
- 已交付 PR https://github.com/ljh12138164/RSSHub/pull/6，提交 `4b56979`。先发布 RSSHub 再发布 rss-site 并完成云端数据门禁；未部署或启用 Cron。

## Active objective

Author-provided descriptions are implemented and locally verified for the skills.sh trending and hot RSS feeds.

## Next action

Deploy the description-enriched feeds, validate production latency and content, then push `feat/skills-sh-feed`.
