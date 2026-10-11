# 中新网发布时间修复

## Background and scope

用户要求修复新闻RSSHub发布时间；无效/缺失日期在下游rss-site按抓取当天北京时间00:00兜底。RSSHub保持上游真实性，遵守AGENTS.md无日期不造日期规则。Github、Skills和知乎路由不改。

分支feat/news-publication-dates从origin/master 8c6fca579创建，独立工作区不带原仓库HERMES和知乎未完成改动。

## Feasibility and implementation

真实页面证明中新网日期存在。现有分支正文/视频解析保留，只补充#pubtime_baidu、图片.source_time与明确“发布时间”段落提取；严格日期格式验证后使用parseDate和timezone(...,8)，非法结果省略pubDate。内层详情cache key升级为chinanews:published-v2，避免复用旧Invalid Date详情缓存。

其他新闻源：新华社/央视/界面已有日期，澎湃列表API有日期但详情403是独立采集可用性问题；百度热搜没有发布时间，不猜测，留给下游兜底。

## Acceptance and verification

- 真实handler使用limit=30，旧代码items=30、validDates=3、missingOrInvalid=27；修复后items=30、validDates=30、missingOrInvalid=0；hasBodies前后均29，不额外变更正文。
- 实际原页验证覆盖正文26、视频3和图片1（滚动列表随时间有新条目，handler重新验收仍30/30）。
- oxlint --type-aware lib/routes/chinanews/index.ts、oxfmt与全仓tsc --noEmit --incremental false通过。
- 按AGENTS.md不在lib/routes新增测试文件；用真实路由handler验证，临时工具不提交。
- 源站缺少日期时不生成现在时间，下游承担用户批准的排序兜底。

## Review and delivery

标准与规格审查无阻塞项。变更仅日期和cache key，无新依赖、路由或配置。需要用户创建合并到master的PR，部署后请求正式/chinanews?limit=30确认日期并使外层Feed缓存过期，再让下游重新采集。

未部署。历史数据回填由rss-site分支feat/news-publication-dates的版本化迁移承担，必须在下游新API部署后执行。后续接受项仅上线验收，无额外路线图。
