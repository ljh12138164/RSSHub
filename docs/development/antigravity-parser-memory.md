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
- 待补丁 PR 构建和真实 Vercel Feed 回归。
- Standards/Spec 自审：默认行为保持、Worker 签名兼容、无新依赖或路由测试；尚无接受的后续事项，不创建空 roadmap。云端真实运行仍是交付门槛。

## Risks

主分支中文路由仍需发布此修复后才能稳定运行。此前跨来源缓存通知异常独立存在，不能将本补丁视为通知问题的修复。
