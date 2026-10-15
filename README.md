# 世界版面室

全球媒体新闻链接收集器。12 家媒体的公开 RSS/官网标题，GDELT 补充索引，Wayback 原有网页快照入口。RSS 按 BOM、HTTP charset、XML 编码声明解码，支持 Folha 的 ISO-8859-1；无声明默认 UTF-8，解码错误不会静默写入坏标题。中文议题使用有限的多语言词典，不提供自动翻译、完整报纸版面、全文镜像或自动立场分析。

## 链接档案

D1 只保存链接、标题、媒体域名、来源类型及分开的发布时间、采集时间、索引时间和北京时间收录日期。不存正文、图片或摘要。链接原文失效时不能还原。每次采集每媒体最多20条；多次采集按收录日期与规范化URL去重，不保证覆盖全天所有报道。

过去日期只查询已保存档案，不用当前新闻补造历史。官网无可靠发布时间则留空；GDELT时间是索引时间。失败来源会记录为不可用，不等同于无新闻。失败重试不删除既有记录。

## 运行及验证

保留 npm/package-lock。安装 `npm ci`，本地开发 `npm run dev`，测试 `npm test`，类型检查 `npm run typecheck`，构建 `npm run build`。数据库变更通过 `npm run db:generate` 生成追加迁移。D1 逻辑绑定为 DB，平台负责实际资源及迁移；运行时不建表。SQLite测试验证实际保存、读取、去重、日期边界和失败行为。

## 每日收录操作

站点固定标识：appgprj_6a62353f03a481918d6c15e873c52a85。

每日北京时间23:50收录当时可取得的当天新闻链接。任务无需用户打开网页，不重建或重新发布网站。

1. 通过 Sites get_site 重新打开同一站点，确认 active、owner-only，读取当前 current_live_url。若变为公开/共享，停止写入并重新核对写入授权。此写接口依赖平台的仅所有者访问边界。
2. 使用 get_site 返回的平台服务访问凭据，只在内存中构造该站点的 OAI-Sites-Authorization 请求头。不把凭据存入文件、源码、日志、计划提示或消息；不向新闻源发送它。若凭据未提供，停止并报告访问受阻，不能以游客身份替代。
3. 计算 Asia/Shanghai 当天 YYYY-MM-DD。向该站点 POST /api/daily-archive，Content-Type: application/json，请求体 {"date":"YYYY-MM-DD"}。服务端仅抓取固定RSS/官网及GDELT来源，不接受任意目标URL。只允许当天采集，午夜过后不可用当前新闻回填昨日。
4. GET /api/daily-archive?date=YYYY-MM-DD，核对 requestedDate、archivedCount、collection.attemptedAt 和 collection.status。必须经独立读取确认保存。partial 表示部分媒体不可用，incomplete 表示这次没有可用结果；既有记录仍保留。
5. 请求不确定时先读取；仅对瞬时错误在同一天幂等重试一次，不删除记录。若全部来源失败、数据库不可用、需要付费或访问受阻，向所有者报告具体问题。正常成功保持安静；不购买空间、不接受收费或另开账号。

网页“收录今天”调用同一接口；历史日期“重读档案”只读。只读 GET /api/headlines 为今天提供实时预览，不隐式写库。历史议题检索只搜索已保存标题。

## 访问与费用

保持现有仅所有者访问。公开或扩展共享前必须为写接口增加适当授权。平台具体容量/收费以实际提示为准，不保证永久免费；需要付费时停止，由所有者选择其他存储。未来迁移保留当前数据字段及来源语义。

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
