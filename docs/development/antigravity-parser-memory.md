# Antigravity 中文解析内存修复

## Background

中文适配 [RSSHub #7](https://github.com/ljh12138164/RSSHub/pull/7) 和 [rss-site #47](https://github.com/ljh12138164/rss-site/pull/47) 在云端实际运行复验结束前已合并。Vercel 预览中文路由返回 HTTP 503：`RangeError: Array buffer allocation failed`。配套功能和决策沿用 [中文适配](antigravity-chinese.md)。

## Scope

允许现有脚本解析工具关闭 raw transfer 优化，并仅由 Antigravity 路由关闭；保持工具默认行为、Worker 实现及中英文内容协议兼容。

## Out of scope

UI、翻译策略、依赖、数据库或 Cron 变更；自动合并和直接生产部署。

## Acceptance criteria

- 修复后的 Vercel 真实中文路由返回有效 Feed，并由 rss-site 识别 25 篇中文正文、封面和日期。
- 默认英文、文章原 URL/GUID/日期、正文媒体和 pre 代码块保持不变。
- 类型及变更文件静态检查通过；CI/预览完成后复验，不能仅以构建通过作为运行成功依据。

## Feasibility

可行。Oxc `raw-transfer/common.js` 的 createBuffer 创建 6 GiB ArrayBuffer，现有 parse-js 工具只依据运行时是否支持开启它，本地支持不代表 Vercel 能够分配。关闭 experimentalRawTransfer 仍调用同一解析器并返回相同 AST，不执行脚本或改变翻译数据。新增可选布尔参数默认为 true，当前路由传 false；Worker 原本不启用 raw transfer，接受同参数后继续原实现。无需 UI 或架构决策变更。

## Implementation

- 从最新 origin/master `a7a3887c` 创建 `feat/antigravity-parser-memory`，移植在旧 PR 合并后提交的内存修复。
- 仅修改解析工具签名、raw transfer 条件和路由调用，附原因注释。

## Verification

- 真实上游响应复验 25/25 中文标题和正文，未发现长英文段落；中英文媒体/代码块及 URL/GUID/日期一致，非法语言正确拒绝。
- 全仓 `pnpm typecheck` 通过；三个变更代码文件 ESLint、type-aware Oxlint 和 Oxfmt 通过。
- 首次静态检查发现 Windows CRLF，格式化后重跑通过；`git diff --check` 通过。
- [补丁 #8](https://github.com/ljh12138164/RSSHub/pull/8) 已由用户合并，主分支 `41e9dc518581af3d72eef1bd122b5accd1bb285b` 的 Vercel 检查成功；非本代理自动合并或直接部署。
- 预览中文路由 HTTP 200（6.84 秒），生产 `/google/antigravity/blog/zh-CN` HTTP 200（6.54 秒、343,458 bytes）。rss-site 解析 25/25 中文标题、正文、封面、日期及唯一 URL，最短 HTML 2,176 字符，未发现长英文正文段落。
- 原英文路由 HTTP 200（19.36 秒）。生产中英文 Feed 经同一消费方解析后，媒体 URL、pre 代码文本、文章 URL 和日期逐篇一致；默认英文未被中文缓存污染。此前直接与原始 HTML 比较代码出现 tab 差异，来自 RSS 输出处理；两种语言通过同一输出链路比较完全一致。
- Supabase 用现有 Vault 凭据调用同一 Cron API，pg_net 请求 8627 返回 HTTP 200、未超时：批次 `4546c12d-f932-4184-96a9-79ec94d403ca`、20 条、changed=true、publication=revalidated。入库 succeeded，完成时间 `2026-10-19T07:33:12.785Z`。
- `signal_articles` 原有 20 条全部中文标题/正文，封面和日期完整、URL 唯一；本次新增行 0。`hot_items` 20 条中文、20 张封面、排名 1–20；source_status 同一批次。Cron 119 active，UTC `35 4,10,16,22 * * *`，未修改任务或等待下次自然调度。
- 浏览器确认来源页 20 篇中文，首篇正文 3,135 字符、三节中文目录和正确原文入口。首次读取仍为旧缓存，随后正常刷新显示新内容；没有额外人工调用刷新 API。
- Standards/Spec 自审完成：默认行为保持、Worker 签名兼容、无新依赖或路由测试；云端真实运行门槛已满足。无阻塞发现或接受的后续事项，不创建空 roadmap。

## Risks

本次 Antigravity 中文采集与自动刷新已验证成功；此前其他来源的缓存通知异常仍独立存在，不能将本补丁视为跨来源通知问题的全面修复。官方只有纯文本译文的段落仍采用纯文本，暂无译文的新文章保留原文。
