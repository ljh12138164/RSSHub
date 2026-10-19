# Antigravity 官方中文全文

## Background

rss-site 为中文站点，用户要求 Antigravity 的标题和正文也采用官方中文。官网 `?hl=zh-cn` 在浏览器内本地化，原始 HTML 与官方 RSS 仍是英文。

## Scope

在既有路由增加 `/google/antigravity/blog/zh-CN`；动态定位官方中文资源，替换正文并保留封面、媒体和官方日期。rss-site 使用新路径，保留来源 ID 和文章 URL。

## Out of scope

机器翻译、浏览器自动化、新依赖、数据库迁移、UI 改版，以及本轮 PR 中的生产部署和缓存通知排障。

## Acceptance criteria

- 真实首屏 25 篇标题与正文采用官方中文，保留封面、正文媒体和有效链接。
- 无语言参数的英文路由保持行为；中英文缓存隔离。
- 不硬编码任何构建 hash，不执行远端 JavaScript，不新增路由测试文件。
- 真实 RSS 输出经 rss-site 解析后保留中文正文、封面、日期与原有唯一 URL。

## Feasibility

可行。复用已合并 Antigravity 正文/封面方案和现有站内阅读界面，无新增 UI 决策。实测官方中文模块包含 26 个文章翻译对象和 711 个通用映射，25 个 RSS 标题均在文章映射中。沿页面引用的 BaseLayout、runtime、zh-CN/blog 模块逐层定位动态资源；使用现有 Oxc 解析器读取静态 JSON 字符串，不执行模块。正文按官方映射替换 HTML 与文本，保持原媒体结构。后续新增文章若尚无官方译文，保留原文；资源定位失败应明确报错。

## Implementation

- 基于最新 `origin/master` `b32582c8b` 创建 `feat/antigravity-chinese`。
- 增加可选 lang 参数，仅支持 en（默认）与 zh-CN，保留现有英文 example 和 Radar。
- 按页面脚本依赖定位官方中文模块，通过现有 `parseScriptSource` 提取 JSON.parse 的静态模板字符串，合并文章与通用 textMap；不执行远端代码，不增加依赖。
- 正文先匹配 HTML 译文，再匹配纯文本译文，最后处理剩余文本节点；跳过代码块和包含媒体/嵌套块的父节点，保留正文媒体结构。官方仅提供纯文本的段落采用纯文本，可能失去行内强调与链接格式，原文 URL 保持可用。
- 翻译资源与中文详情单独缓存，英文详情 cache key 不变。保留官方 GUID、文章 URL、发布时间和三路并发。

## Verification

- 2026-10-19 真实 handler 抓取官方 Feed、动态语言资源和 25 篇文章；逐篇对比中英文：25/25 中文标题和正文，无长度超过 70 字符的未翻译正文段落。图片、视频、source、iframe 和 pre 代码块序列完全一致，GUID、URL、日期不变；非法语言参数正确拒绝。
- 本机网络曾连接超时/断流；成功抓取后将原始 HTTP 响应暂存于仓库外，复用同一组真实响应检查中英文差异。未将探针或快照加入 lib/routes 测试。
- 真实 RSS 模板输出 340,487 bytes，25 张封面，无订阅/分享组件或相对媒体地址。rss-site 的 `parseSignalFeed` 识别 25/25 中文标题、正文、封面、日期和唯一 URL；最短 HTML 2,128 字符。
- `pnpm typecheck`、`pnpm build:routes`、变更文件 ESLint、type-aware Oxlint 和 Oxfmt 检查通过。构建过程中出现本地 cache unavailable 提示，命令退出 0。
- Standards/Spec 自审完成：可选参数与默认兼容、动态 hash、静态数据解析、按语言缓存、媒体与日期保留、无新依赖或路由测试。未发现阻塞问题，无接受的后续事项，不创建空 roadmap。

## Risks

官网本地化资源结构变化需要更新定位逻辑；尚无官方译文的新文章保留英文。仅有纯文本译文的段落不保留其行内链接和强调，可通过原文入口访问。发布顺序为 RSSHub 在先、rss-site API 在后，再验证生产采集原地更新而不增加重复文章。此前发现的跨来源缓存通知异常属于独立排障，不因本次中文实现宣称已解决。
