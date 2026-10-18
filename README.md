# 世界版面室

在线访问：[World Press Desk CN](https://world-press-desk-cn.joanmike223.chatgpt.site/)。普通读者免注册、免 ChatGPT 登录。

全球媒体新闻链接收集器。12 家媒体的公开 RSS/官网标题，GDELT 补充索引，Wayback 原有网页快照入口。RSS 按 BOM、HTTP charset、XML 编码声明解码，支持 Folha 的 ISO-8859-1；无声明默认 UTF-8，解码错误不会静默写入坏标题。中文议题使用有限的多语言词典，不提供自动翻译、完整报纸版面、全文镜像或自动立场分析。

## 热点关注

- **今日世界热点**：从顶部“世界热点”或首页入口进入。当天统计当前可读取的媒体标题，历史日期只统计已保存档案。气泡大小表示匹配议题的去重链接数，点击气泡或横向滑动议题条，可查看相关报道和原文、Wayback、archive.today 入口。
- **单家媒体近七天热点**：打开一家媒体的详情，切换“近七天热点”。统计截至所选收录日期的连续七天，展示该媒体的议题气泡、逐日收录走势和对应报道。无档案的日期留空并标注“无档案”，不会用当前新闻补写历史。
- **交互与动效**：气泡进入与选中效果、议题条平滑滑动，以及小屏幕布局；遵循系统“减少动态效果”设置。

热点使用预设议题的多语言关键词匹配真实标题，不代表全网热度，也不使用大模型生成新闻分析。同一链接在整个统计时段内去重；逐日走势按当天去重链接计数，所以跨日重复链接会分别计入对应日期。一条标题可以涉及多个议题，议题数量不能相加作为总量。

只读接口示例（日期需替换为实际收录日期）：

```text
GET /api/hotspots?date=2026-10-17
GET /api/hotspots?date=2026-10-17&domain=bbc.com&days=7
```

全球视图只支持单日；媒体接口支持 1、3、7 天，页面默认展示七天。日期、媒体或天数无效时返回 400，服务不可用时返回 503。

## 链接档案

D1 只保存链接、标题、媒体域名、来源类型及分开的发布时间、采集时间、索引时间和北京时间收录日期。不存正文、图片或摘要。链接原文失效时不能还原。每次采集每媒体最多20条；多次采集按收录日期与规范化URL去重，不保证覆盖全天所有报道。

过去日期只查询已保存档案，不用当前新闻补造历史。官网无可靠发布时间则留空；GDELT时间是索引时间。失败来源会记录为不可用，不等同于无新闻。失败重试不删除既有记录。

## 运行及验证

保留 npm/package-lock。安装 `npm ci`，本地开发 `npm run dev`，测试 `npm test`，类型检查 `npm run typecheck`，构建 `npm run build`。数据库变更通过 `npm run db:generate` 生成追加迁移。D1 逻辑绑定为 DB，平台负责实际资源及迁移；运行时不建表。SQLite测试验证实际保存、读取、去重、日期边界和失败行为。

## 每日收录操作

站点固定标识：appgprj_6a62353f03a481918d6c15e873c52a85。

每日北京时间23:50收录当时可取得的当天新闻链接。任务无需用户打开网页，不重建或重新发布网站。

1. 通过 Sites get_site 核对同一站点处于 active 状态及当前网址。公众阅读已开放，管理写入由服务端管理员鉴权保护。
2. 通过已连接的站点工具，以平台认证的管理员身份操作。管理员的站点用户标识由运行时变量 `DESK_OWNER_SITE_ID` 配置；未配置时拒绝写入。旧的仅所有者网站访问凭据本身不能授权收录，凭据不得写入仓库、日志或安装包。
3. 计算 Asia/Shanghai 当天 YYYY-MM-DD，调用 `collect_daily_news`，参数为 {"date":"YYYY-MM-DD"}。服务端仅抓取固定 RSS/官网及 GDELT 来源，不接受任意目标 URL。只允许当天采集，午夜过后不可用当前新闻回填昨日。
4. 再独立调用 `read_daily_archive`，核对 requestedDate、archivedCount、collection.attemptedAt 和 collection.status。partial 表示部分来源不可用，incomplete 表示这次没有可用结果；既有记录仍保留。
5. 请求不确定时先读取；仅对瞬时错误在同一天幂等重试一次，不删除记录。若全部来源失败、数据库不可用、需要付费或访问受阻，向所有者报告具体问题。正常成功保持安静；不购买空间、不接受收费或另开账号。

网页收录操作调用受管理员鉴权保护的 POST /api/daily-archive；公众可以通过 GET /api/daily-archive 读取历史档案。只读 GET /api/headlines 为今天提供实时预览，不隐式写库。历史议题检索只搜索已保存标题。

## 访问与费用

公众免登录阅读，收录和管理写入仅允许经过平台认证且符合服务端配置的管理员。平台具体容量/收费以实际提示为准，不保证永久免费；需要付费时由所有者决定。未来迁移保留当前数据字段及来源语义。

## 源码与部署

本次同步以 Sites 已发布第 11 版的源码提交 `cdb41ca52eab67b0c5304d240e32da87a658b237` 为基础，包含热点功能及此前的链接归档、来源修复和管理员鉴权改动。线上站点由 Sites 管理的代码仓库发布，本 GitHub 仓库保存同步后的源码；向 GitHub 提交不会自动触发 Sites 部署。

## 快照入口

新闻详情及搜索结果提供原文、Wayback 和 archive.today 三个入口。archive.today 使用 archive.ph 官方已有快照查询路径，不自动提交保存，不保证完整正文或存在快照；查询不限定所选日期。Folha 存档查询仅解开已知 RSS 重定向包装，核验目标域名后查询真实文章 URL，数据库中的原始 URL 不变。

## NHK 地址迁移

RSS 使用 https://news.web.nhk/n-data/conf/na/rss/cat0.xml，主页为 https://news.web.nhk/ 。保持逻辑媒体标识 nhk.or.jp，防止旧档案和筛选失联；GDELT 查询同时包含新旧域并映射回这一标识，存档入口允许新域。新RSS地址来自迁移说明的第三方摘录及RSS示例；开发环境自动访问受robots限制，切换时未验证当前源返回的日期或条数。不要将一次源响应为空解读为NHK没有新闻。

## Public reader / administrator boundary

Public reading does not require registration. The Android reader must never contain
Sites bypass tokens or administrator credentials. All archive writes now require
an exact platform-verified per-Site user ID configured as `DESK_OWNER_SITE_ID`.
Unset configuration denies every write. Never use a ChatGPT account/workspace ID
as a substitute for the per-Site ID, and never grant the first visitor admin.

The `/mcp` endpoint provides `desk_identity`, `collect_daily_news`, and
`read_daily_archive`. Connect the owner through the platform-managed Site plugin,
verify their identity while the Site remains private, then configure the exact ID
using Sites runtime environment tools and deploy that revision. Verify collection
and independent readback through the connected tools before enabling public access.
The old owner-private bypass-header automation no longer authorizes writes and
must be migrated to the connected Site tools; never accept the mere presence of
`OAI-Sites-Authorization` as application authorization.

Public source refreshes share a bounded, two-minute in-memory cache with
single-flight requests and a 24 cache-miss/minute budget per Worker isolate.
This reduces source fan-out; it is not a global rate limit or a DDoS guarantee.
Saved link records remain unchanged; no article body/image/summary is persisted.
