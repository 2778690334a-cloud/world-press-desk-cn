"use client";

import { useEffect, useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

type Source = {
  id: string;
  masthead: string;
  localName: string;
  country: string;
  flag: string;
  region: string;
  language: string;
  domain: string;
  homepage: string;
  access: "免费" | "部分免费" | "订阅";
  archive: "可查" | "有限" | "不稳定";
  focus: string;
  seedTitle: string;
  seedDeck: string;
  liveTitle?: string;
  liveUrl?: string;
  seenAt?: string;
};

type LiveArticle = {
  title: string;
  url: string;
  domain: string;
  seenAt?: string;
  language?: string;
};

const SOURCES: Source[] = [
  {
    id: "xinhua",
    masthead: "新华网",
    localName: "XINHUA",
    country: "中国",
    flag: "CN",
    region: "亚洲",
    language: "中文",
    domain: "news.cn",
    homepage: "https://www.news.cn/",
    access: "免费",
    archive: "可查",
    focus: "政策 · 外交 · 国内发展",
    seedTitle: "从政策部署到全球合作，中国议题的官方观察窗口",
    seedDeck: "以权威发布、政策动向和国际合作为主要线索。",
  },
  {
    id: "nhk",
    masthead: "NHK",
    localName: "日本放送協会",
    country: "日本",
    flag: "JP",
    region: "亚洲",
    language: "日本語",
    domain: "nhk.or.jp",
    homepage: "https://www3.nhk.or.jp/news/",
    access: "免费",
    archive: "可查",
    focus: "公共政策 · 灾害 · 社会",
    seedTitle: "公共服务、社会运行与地区安全成为版面主轴",
    seedDeck: "公共媒体视角更重视民生、应急与制度信息。",
  },
  {
    id: "nikkei",
    masthead: "日本経済新聞",
    localName: "NIKKEI",
    country: "日本",
    flag: "JP",
    region: "亚洲",
    language: "日本語",
    domain: "nikkei.com",
    homepage: "https://www.nikkei.com/",
    access: "订阅",
    archive: "有限",
    focus: "产业 · 市场 · 亚洲经济",
    seedTitle: "供应链、产业政策与市场预期构成经济版面的三条线",
    seedDeck: "适合观察日本企业与东亚产业链的风险定价。",
  },
  {
    id: "bbc",
    masthead: "BBC",
    localName: "BRITISH BROADCASTING CORPORATION",
    country: "英国",
    flag: "GB",
    region: "欧洲",
    language: "English",
    domain: "bbc.com",
    homepage: "https://www.bbc.com/news",
    access: "免费",
    archive: "可查",
    focus: "国际 · 英国政治 · 公共议题",
    seedTitle: "全球事件的公共媒体叙事：影响、责任与政策回应",
    seedDeck: "覆盖面广，强调解释性背景与普通人的处境。",
  },
  {
    id: "guardian",
    masthead: "The Guardian",
    localName: "THE GUARDIAN",
    country: "英国",
    flag: "GB",
    region: "欧洲",
    language: "English",
    domain: "theguardian.com",
    homepage: "https://www.theguardian.com/international",
    access: "免费",
    archive: "可查",
    focus: "政治 · 气候 · 社会公平",
    seedTitle: "气候、权利与问责框架下的国际新闻选择",
    seedDeck: "开放网页与 RSS 使其成为较友好的长期采集源。",
  },
  {
    id: "lemonde",
    masthead: "Le Monde",
    localName: "LE MONDE",
    country: "法国",
    flag: "FR",
    region: "欧洲",
    language: "Français",
    domain: "lemonde.fr",
    homepage: "https://www.lemonde.fr/",
    access: "部分免费",
    archive: "有限",
    focus: "欧洲 · 法国政治 · 文化",
    seedTitle: "欧洲自主、国内政治与公共财政占据显著位置",
    seedDeck: "法国视角常把全球议题放入欧洲制度框架。",
  },
  {
    id: "dw",
    masthead: "DW",
    localName: "DEUTSCHE WELLE",
    country: "德国",
    flag: "DE",
    region: "欧洲",
    language: "Deutsch",
    domain: "dw.com",
    homepage: "https://www.dw.com/",
    access: "免费",
    archive: "可查",
    focus: "欧洲 · 德国 · 国际传播",
    seedTitle: "欧洲安全、经济转型与德国政策辩论并列呈现",
    seedDeck: "多语种公共媒体，适合跨语言对照。",
  },
  {
    id: "cnn",
    masthead: "CNN",
    localName: "CABLE NEWS NETWORK",
    country: "美国",
    flag: "US",
    region: "北美",
    language: "English",
    domain: "cnn.com",
    homepage: "https://edition.cnn.com/",
    access: "部分免费",
    archive: "有限",
    focus: "美国政治 · 突发 · 国际",
    seedTitle: "突发新闻和美国国内政治继续主导新闻节奏",
    seedDeck: "更新速度快，版面选择更受实时事件驱动。",
  },
  {
    id: "nytimes",
    masthead: "The New York Times",
    localName: "THE NEW YORK TIMES",
    country: "美国",
    flag: "US",
    region: "北美",
    language: "English",
    domain: "nytimes.com",
    homepage: "https://www.nytimes.com/",
    access: "订阅",
    archive: "有限",
    focus: "美国 · 国际 · 调查报道",
    seedTitle: "权力、制度与社会后果构成长篇报道的核心结构",
    seedDeck: "付费墙较强，适合保留标题、摘要和原文入口。",
  },
  {
    id: "aljazeera",
    masthead: "Al Jazeera",
    localName: "الجزيرة",
    country: "卡塔尔",
    flag: "QA",
    region: "中东",
    language: "العربية / English",
    domain: "aljazeera.com",
    homepage: "https://www.aljazeera.com/",
    access: "免费",
    archive: "可查",
    focus: "中东 · 全球南方 · 冲突",
    seedTitle: "中东与全球南方的现场视角改变议题的中心位置",
    seedDeck: "与欧美媒体并读时，叙事重心差异尤为明显。",
  },
  {
    id: "abcau",
    masthead: "ABC",
    localName: "AUSTRALIAN BROADCASTING CORPORATION",
    country: "澳大利亚",
    flag: "AU",
    region: "大洋洲",
    language: "English",
    domain: "abc.net.au",
    homepage: "https://www.abc.net.au/news/",
    access: "免费",
    archive: "可查",
    focus: "澳洲 · 太平洋 · 公共事务",
    seedTitle: "太平洋地区、公共服务与生活成本进入首页视野",
    seedDeck: "补足全球新闻中常被忽略的大洋洲议题。",
  },
  {
    id: "folha",
    masthead: "Folha",
    localName: "FOLHA DE S.PAULO",
    country: "巴西",
    flag: "BR",
    region: "拉美",
    language: "Português",
    domain: "folha.uol.com.br",
    homepage: "https://www.folha.uol.com.br/",
    access: "部分免费",
    archive: "有限",
    focus: "巴西政治 · 经济 · 拉美",
    seedTitle: "增长、财政与社会政策构成巴西公共讨论的核心",
    seedDeck: "为全球议题补充拉丁美洲的国内政治与发展视角。",
  },
];

const REGIONS = ["全部", "亚洲", "欧洲", "北美", "中东", "拉美", "大洋洲"];

function archiveUrl(source: Source, date: string) {
  const stamp = date.replaceAll("-", "");
  return `https://web.archive.org/web/${stamp}/${source.homepage}`;
}

function shortTime(value?: string) {
  if (!value) return "待同步";
  const parsed = value.match(
    /(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})?Z?/,
  );
  if (!parsed) return value;
  return `${parsed[2]}/${parsed[3]} ${parsed[4]}:${parsed[5]}`;
}

export default function Home() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [region, setRegion] = useState("全部");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"desk" | "compare" | "ledger">("desk");
  const [sources, setSources] = useState(SOURCES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [syncState, setSyncState] = useState<
    "idle" | "loading" | "live" | "fallback"
  >("idle");
  const [generatedAt, setGeneratedAt] = useState<string>("");

  useEffect(() => {
    const stored = window.localStorage.getItem("worldpress-saved");
    if (stored) setSaved(JSON.parse(stored));
  }, []);

  async function sync() {
    setSyncState("loading");
    try {
      const response = await fetch(
        `/api/headlines?date=${encodeURIComponent(date)}&t=${Date.now()}`,
      );
      if (!response.ok) throw new Error("sync failed");
      const payload = (await response.json()) as {
        articles?: LiveArticle[];
        generatedAt?: string;
        status?: string;
      };
      const articles = payload.articles ?? [];
      setSources((current) =>
        current.map((source) => {
          const article = articles.find(
            (item) =>
              item.domain === source.domain ||
              item.domain.endsWith(`.${source.domain}`),
          );
          return article
            ? {
                ...source,
                liveTitle: article.title,
                liveUrl: article.url,
                seenAt: article.seenAt,
              }
            : source;
        }),
      );
      setGeneratedAt(payload.generatedAt ?? new Date().toISOString());
      setSyncState(articles.length ? "live" : "fallback");
    } catch {
      setSyncState("fallback");
    }
  }

  useEffect(() => {
    void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return sources.filter((source) => {
      const regionMatch = region === "全部" || source.region === region;
      const queryMatch =
        !needle ||
        [
          source.masthead,
          source.localName,
          source.country,
          source.focus,
          source.liveTitle,
          source.seedTitle,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle);
      return regionMatch && queryMatch;
    });
  }, [query, region, sources]);

  const selected = sources.find((item) => item.id === selectedId);

  function toggleSaved(id: string) {
    const next = saved.includes(id)
      ? saved.filter((item) => item !== id)
      : [...saved, id];
    setSaved(next);
    window.localStorage.setItem("worldpress-saved", JSON.stringify(next));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="世界版面室首页">
          <span className="brand-mark">世</span>
          <span>
            <strong>世界版面室</strong>
            <small>WORLD PRESS DESK</small>
          </span>
        </a>
        <nav className="view-nav" aria-label="主要视图">
          <button
            className={view === "desk" ? "active" : ""}
            onClick={() => setView("desk")}
          >
            今日版面
          </button>
          <button
            className={view === "compare" ? "active" : ""}
            onClick={() => setView("compare")}
          >
            同题对照
          </button>
          <button
            className={view === "ledger" ? "active" : ""}
            onClick={() => setView("ledger")}
          >
            来源台账
          </button>
        </nav>
        <div className="top-actions">
          <label className="date-field">
            <span>版面日期</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <button
            className="sync-button"
            onClick={() => void sync()}
            disabled={syncState === "loading"}
          >
            <span className={syncState === "loading" ? "spin" : ""}>↻</span>
            {syncState === "loading" ? "正在收报" : "同步今日版"}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className={`live-dot ${syncState}`} />
            {syncState === "live"
              ? "实时来源已接入"
              : syncState === "loading"
                ? "正在连接全球信源"
                : "全球公开信源 · 每日归档"}
          </p>
          <h1>
            今天，世界把什么
            <br />
            放在了<span>头版？</span>
          </h1>
          <p className="hero-deck">
            汇集各国权威媒体的首页与头条线索，保留原文和网页存档入口，
            让你在十分钟内看见不同社会真正关心的事情。
          </p>
        </div>
        <aside className="desk-note">
          <div className="note-index">NO. {date.replaceAll("-", "")}</div>
          <h2>今日编辑台</h2>
          <div className="desk-stats">
            <div>
              <strong>{sources.length}</strong>
              <span>核心媒体</span>
            </div>
            <div>
              <strong>{new Set(sources.map((item) => item.country)).size}</strong>
              <span>国家地区</span>
            </div>
            <div>
              <strong>{sources.filter((item) => item.liveTitle).length}</strong>
              <span>实时头条</span>
            </div>
          </div>
          <p>
            {generatedAt
              ? `最近同步：${new Date(generatedAt).toLocaleString("zh-CN", {
                  hour12: false,
                })}`
              : "系统将优先读取公开网页、RSS 与 GDELT 索引。"}
          </p>
        </aside>
      </section>

      <section className="control-strip">
        <div className="region-list" aria-label="地区筛选">
          {REGIONS.map((item) => (
            <button
              key={item}
              className={region === item ? "active" : ""}
              onClick={() => setRegion(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="search-box">
          <span>⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索媒体、国家或议题"
          />
        </label>
      </section>

      {view === "desk" && (
        <section className="desk-view">
          <div className="section-heading">
            <div>
              <p>FRONT PAGES · {date}</p>
              <h2>全球版面</h2>
            </div>
            <span>{filtered.length} 份报纸 / 权威媒体</span>
          </div>
          {syncState === "loading" && !sources.some((item) => item.liveTitle) ? (
            <div className="paper-grid loading-grid" aria-label="正在加载">
              {[0, 1, 2, 3].map((item) => (
                <div className="paper-card" key={item}>
                  <Skeleton height={18} width="50%" />
                  <Skeleton height={48} style={{ marginTop: 34 }} />
                  <Skeleton count={4} style={{ marginTop: 9 }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="paper-grid">
              {filtered.map((source, index) => (
                <article
                  className="paper-card"
                  key={source.id}
                  onClick={() => setSelectedId(source.id)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      setSelectedId(source.id);
                    }
                  }}
                >
                  <div className="paper-meta">
                    <span>
                      {source.flag} · {source.country}
                    </span>
                    <button
                      className={saved.includes(source.id) ? "saved" : ""}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSaved(source.id);
                      }}
                      aria-label={
                        saved.includes(source.id) ? "取消收藏" : "收藏版面"
                      }
                    >
                      {saved.includes(source.id) ? "★" : "☆"}
                    </button>
                  </div>
                  <div className="masthead">
                    <h3>{source.masthead}</h3>
                    <small>{source.localName}</small>
                  </div>
                  <div className="paper-rule">
                    <span>{source.language}</span>
                    <span>{source.access}</span>
                    <span>{shortTime(source.seenAt)}</span>
                  </div>
                  <p className="paper-kicker">{source.focus}</p>
                  <h4>{source.liveTitle ?? source.seedTitle}</h4>
                  <p className="paper-deck">
                    {source.liveTitle
                      ? "实时标题来自公开新闻索引；打开版面可查看原文、存档与采集状态。"
                      : source.seedDeck}
                  </p>
                  <div className="paper-columns" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <footer>
                    <span>{source.liveTitle ? "LIVE INDEX" : "SOURCE PROFILE"}</span>
                    <span>0{index + 1}</span>
                  </footer>
                </article>
              ))}
            </div>
          )}
          {!filtered.length && (
            <div className="empty-state">
              <strong>没有找到相符版面</strong>
              <p>换一个地区，或减少搜索关键词。</p>
            </div>
          )}
        </section>
      )}

      {view === "compare" && (
        <section className="compare-view">
          <div className="section-heading">
            <div>
              <p>ONE STORY · MANY FRAMES</p>
              <h2>同一世界，不同头版</h2>
            </div>
            <span>按议题框架对照，而不是简单罗列观点</span>
          </div>
          <div className="compare-hero">
            <div>
              <p className="compare-label">今日高重合议题</p>
              <h3>全球经济与供应链调整</h3>
              <p>
                以下是编辑台根据媒体长期报道重心提供的观察框架。
                实时标题接入后，可直接从各媒体原文验证。
              </p>
            </div>
            <div className="signal-bars" aria-label="议题热度 82%">
              <span style={{ height: "32%" }} />
              <span style={{ height: "50%" }} />
              <span style={{ height: "76%" }} />
              <span style={{ height: "63%" }} />
              <span style={{ height: "90%" }} />
              <strong>82%</strong>
            </div>
          </div>
          <div className="lens-grid">
            {[
              {
                number: "01",
                region: "东亚媒体",
                title: "产业竞争与供应链安全",
                text: "更关注制造业、技术能力、出口与企业投资决策。",
                source: "日本经济新闻 · 新华网 · NHK",
              },
              {
                number: "02",
                region: "欧美媒体",
                title: "政策责任与生活成本",
                text: "将贸易、选举政治、通胀与普通家庭的影响放在一起。",
                source: "BBC · CNN · Le Monde",
              },
              {
                number: "03",
                region: "全球南方媒体",
                title: "发展空间与规则不平等",
                text: "强调外部冲击、资源议价与新兴市场的发展选择。",
                source: "Al Jazeera · Folha",
              },
            ].map((lens) => (
              <article className="lens-card" key={lens.number}>
                <span>{lens.number}</span>
                <p>{lens.region}</p>
                <h3>{lens.title}</h3>
                <div />
                <p>{lens.text}</p>
                <small>{lens.source}</small>
              </article>
            ))}
          </div>
          <div className="compare-list">
            <h3>打开一组真实版面</h3>
            {sources.slice(0, 6).map((source) => (
              <button key={source.id} onClick={() => setSelectedId(source.id)}>
                <span>{source.flag}</span>
                <strong>{source.masthead}</strong>
                <em>{source.liveTitle ?? source.focus}</em>
                <b>查看 →</b>
              </button>
            ))}
          </div>
        </section>
      )}

      {view === "ledger" && (
        <section className="ledger-view">
          <div className="section-heading">
            <div>
              <p>SOURCE TRANSPARENCY</p>
              <h2>来源与版权台账</h2>
            </div>
            <span>公开记录每个信源的可用性与边界</span>
          </div>
          <div className="rights-note">
            <strong>采集原则</strong>
            <p>
              系统优先保存标题、导语、发布时间、原文链接与网页存档指针。
              只有媒体明确提供开放全文（例如许可允许的 RSS）时才保存正文；
              不绕过付费墙，也不把 Wayback Machine 当作批量复制版权内容的工具。
            </p>
          </div>
          <div className="ledger-table">
            <div className="ledger-row ledger-head">
              <span>媒体</span>
              <span>地区 / 语言</span>
              <span>网页访问</span>
              <span>存档状态</span>
              <span>采集方式</span>
              <span />
            </div>
            {sources.map((source) => (
              <div className="ledger-row" key={source.id}>
                <span>
                  <b>{source.flag}</b>
                  <strong>{source.masthead}</strong>
                </span>
                <span>
                  {source.country}
                  <small>{source.language}</small>
                </span>
                <span>
                  <i className={`status ${source.access}`} />
                  {source.access}
                </span>
                <span>
                  <i className={`status ${source.archive}`} />
                  {source.archive}
                </span>
                <span>{source.liveTitle ? "GDELT 索引" : "主页探测"}</span>
                <span>
                  <button onClick={() => setSelectedId(source.id)}>
                    详情
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="method-strip">
        <div>
          <span>01</span>
          <strong>公开信源</strong>
          <p>官方主页、RSS、GDELT 与许可开放内容。</p>
        </div>
        <div>
          <span>02</span>
          <strong>每日快照</strong>
          <p>记录头条元数据，并链接 Wayback 历史版本。</p>
        </div>
        <div>
          <span>03</span>
          <strong>人工可核验</strong>
          <p>每条结论都回到媒体原文，不生成虚假全文。</p>
        </div>
      </section>

      <footer className="site-footer">
        <div className="brand footer-brand">
          <span className="brand-mark">世</span>
          <span>
            <strong>世界版面室</strong>
            <small>WORLD PRESS DESK</small>
          </span>
        </div>
        <p>为跨语言观察而建 · 来源归原媒体所有</p>
        <a href="https://www.gdeltproject.org/" target="_blank" rel="noreferrer">
          数据索引：GDELT ↗
        </a>
      </footer>

      {selected && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onClick={() => setSelectedId(null)}
        >
          <aside
            className="source-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.masthead} 版面详情`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="drawer-close"
              onClick={() => setSelectedId(null)}
              aria-label="关闭"
            >
              ×
            </button>
            <div className="drawer-country">
              {selected.flag} · {selected.country} · {selected.language}
            </div>
            <div className="drawer-masthead">
              <h2>{selected.masthead}</h2>
              <p>{selected.localName}</p>
            </div>
            <p className="drawer-focus">{selected.focus}</p>
            <h3>{selected.liveTitle ?? selected.seedTitle}</h3>
            <p className="drawer-summary">
              {selected.liveTitle
                ? "这是从公开新闻索引同步到的最新标题。系统保留标题与链接，不复制未获授权的全文。"
                : selected.seedDeck}
            </p>
            <div className="drawer-facts">
              <div>
                <span>网页访问</span>
                <strong>{selected.access}</strong>
              </div>
              <div>
                <span>历史存档</span>
                <strong>{selected.archive}</strong>
              </div>
              <div>
                <span>索引时间</span>
                <strong>{shortTime(selected.seenAt)}</strong>
              </div>
            </div>
            <div className="drawer-actions">
              <a
                className="primary"
                href={selected.liveUrl ?? selected.homepage}
                target="_blank"
                rel="noreferrer"
              >
                打开原文 ↗
              </a>
              <a
                href={archiveUrl(selected, date)}
                target="_blank"
                rel="noreferrer"
              >
                查看当日存档
              </a>
              <button onClick={() => toggleSaved(selected.id)}>
                {saved.includes(selected.id) ? "★ 已收藏" : "☆ 收藏版面"}
              </button>
            </div>
            <div className="archive-tip">
              <strong>存档提示</strong>
              <p>
                Wayback Machine 是否有当日快照取决于其抓取记录与媒体规则。
                若精确日期无结果，可在存档页选择最近一次快照。
              </p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
