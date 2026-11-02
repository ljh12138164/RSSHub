# AIHOT 大模型排行榜与单项评测

## Background

用户要求在自部署的 RSSHub 中实现 AIHOT 大模型排行榜功能，包含多领域分榜、单模型详细评分与证据链、以及单项评测排行榜，供 rss-site 消费与展示。

## Scope

新增 AIHOT 命名空间 (`/aihot`) 下的三组路由：

1. `/aihot/leaderboard/:category?`：大模型综合榜与 4 大分榜（编程、科研、专业办公、知识问答），支持 `limit` 与 `filter`（国产/开源）。
2. `/aihot/model/:slug`：单模型详细评测成绩与 39 项证据链，还原原始百分比与折算能力分。
3. `/aihot/source/:sourceKey`：单项评测（Benchmark）专项排行榜，展示所有模型在该项测试中的单独得分与名次。

## Implementation

- `lib/routes/aihot/namespace.ts`：定义 AIHOT 命名空间元数据。
- `lib/routes/aihot/utils.ts`：通用 TurboStream 逆向解析工具与基准 URL/UA。
- `lib/routes/aihot/leaderboard.ts`：榜单主路由，聚合五大领域分项分、价格与覆盖率。
- `lib/routes/aihot/model.ts`：单模型证据链路由，按领域分组输出各项 Benchmark 实测原始分、折算分与运行配置。
- `lib/routes/aihot/source.ts`：单项评测排行榜路由，输出特定 Benchmark 下全量参评模型的名次与得分。
- `tests/aihot-leaderboard.test.ts`：全量单元测试，覆盖参数校验、解包逻辑、榜单输出与明细证据链。

## Verification

- `build:routes` 成功注册新路由。
- `npm run typecheck`（`tsc --noEmit`）0 错误通过。
- `oxlint` 0 警告 0 错误通过。
- `vitest run tests/aihot-leaderboard.test.ts` 5/5 单元测试通过。
- 真实网络探测：`/leaderboard`、`/leaderboard/:slug`、`/leaderboard/sources/:sourceKey` 均可成功无凭据获取结构化数据。
