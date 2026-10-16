"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { HotspotReport, HotspotTopic } from "../lib/hotspots";
import { layoutBubbles } from "../lib/bubble-layout";
import { archiveLookupPath, archiveTodayLookupUrl } from "../lib/wayback";

type Media = { id: string; domain: string; localName: string; masthead: string };
type Props = { date: string; today: string; sources: Media[]; source?: Media; refreshKey?: number; onOpenSource?: (id: string) => void };

function BubbleCloud({ topics, selected, onSelect, compact }: { topics: HotspotTopic[]; selected: string; onSelect: (id: string) => void; compact: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(Math.round(entries[0].contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const height = compact ? 360 : width < 480 ? 420 : 490;
  const displayed = topics.slice(0, 12);
  const positions = useMemo(() => layoutBubbles(topics.slice(0, 12).map(topic => topic.count), width, height), [topics, width, height]);
  return <div ref={host} className="hotspot-cloud" style={{ height }} aria-label="标题关注气泡图">
    <span className="cloud-axis cloud-axis-top" aria-hidden="true">THE WORLD IN HEADLINES</span>
    {displayed.map((topic, index) => {
      const circle = positions[index];
      if (!circle) return null;
      return <button key={topic.id} className={`hotspot-bubble bubble-tone-${index % 4} ${selected === topic.id ? "is-selected" : ""}`}
        aria-pressed={selected === topic.id} aria-label={`${topic.label}，${topic.count} 条相关标题，查看报道`}
        onClick={() => onSelect(topic.id)}
        style={{ left: circle.x - circle.radius, top: circle.y - circle.radius, width: circle.radius * 2, height: circle.radius * 2, "--bubble-font": `${Math.max(12, Math.min(22, circle.radius * 0.29))}px`, "--bubble-delay": `${index * 35}ms` } as CSSProperties}>
        <strong>{topic.label}</strong><span>{topic.count}<small> 条</small></span>
      </button>;
    })}
    <span className="cloud-axis cloud-axis-bottom">气泡大小 = 相关标题数量 · 点击查看</span>
  </div>;
}

export default function HotspotsPanel({ date, today, sources, source, refreshKey = 0, onOpenSource }: Props) {
  const [report, setReport] = useState<HotspotReport | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const rail = useRef<HTMLDivElement>(null);
  const compact = !!source;
  const domain = source?.domain;
  useEffect(() => {
    const controller = new AbortController();
    setReport(null); setError(false); setSelectedId("");
    const params = new URLSearchParams({ date });
    if (domain) { params.set("domain", domain); params.set("days", "7"); }
    fetch(`/api/hotspots?${params}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Hotspots unavailable");
      return await response.json() as HotspotReport;
    }).then(value => {
      if (controller.signal.aborted) return;
      setReport(value); setSelectedId(value.topics[0]?.id ?? "");
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [date, domain, refreshKey, attempt]);
  const selected = report?.topics.find(topic => topic.id === selectedId) ?? report?.topics[0];
  const maxDaily = Math.max(1, ...(selected?.dailyCounts ?? report?.dailyArticleCounts ?? []).map(day => day.count ?? 0));

  function slideTopics(direction: number) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.current?.scrollBy({ left: direction * Math.max(200, rail.current.clientWidth * 0.7), behavior: reduced ? "instant" : "smooth" });
  }

  return <section className={`hotspots-view ${compact ? "hotspots-compact" : ""}`} aria-label={compact ? "单家媒体近七天热点" : "世界热点"}>
    <header className="hotspots-heading">
      <div><p className="hotspots-kicker">{compact ? "SEVEN DAYS · ONE NEWSROOM" : "WORLD IN FOCUS"} <span>/ {date}</span></p>
        {compact ? <h3>近七天，关注什么？</h3> : <h1>{date === today ? "今日" : "当日"}世界<span>热点关注</span><i aria-hidden="true">✳</i></h1>}
        <p className="hotspots-intro">{compact ? "把这一家媒体的标题，放到一周里看。" : "看见共同关注的议题，再走近每一篇报道。"}</p>
      </div>
      {!compact && <div className="hotspots-edition">标题观察室<small>READ THE PATTERN.<br />FOLLOW THE SOURCE.</small></div>}
    </header>
    {!report && <div className="hotspots-empty" role="status"><span className="hotspots-empty-mark" aria-hidden="true">◎</span><h3>{error ? "这次热点暂时未能读取" : "正在整理真实新闻标题…"}</h3><p>{error ? "来源或档案服务暂时不可用，请稍后重试。" : "只统计已有新闻，不生成虚构热点。"}</p>{error && <button onClick={() => setAttempt(value => value + 1)}>重新读取 ↻</button>}</div>}
    {report && <>
      <div className="hotspots-summary"><span><b>{report.articleCount}</b> 条标题</span><span><b>{report.mediaCount}</b> 家媒体</span><span><b>{report.topics.length}</b> 个匹配议题</span><small>{compact ? `${report.startDate} — ${report.endDate}` : report.mode === "live" ? "当前可读取的媒体版面" : "所选日期的已存档案"}</small></div>
      {compact && <p className="hotspots-coverage">已有 <b>{report.coverage.availableDays} / 7</b> 天档案{report.coverage.missingDates.length > 0 ? " · 缺失日期留空，后续收录后会逐步积累" : " · 按北京时间收录日期排列"}</p>}
      {report.status !== "ready" && <div className="hotspots-empty" role="status"><span className="hotspots-empty-mark" aria-hidden="true">◎</span><h3>{report.status === "no-data" ? "这段时间还没有可用档案" : "暂未匹配到热点议题"}</h3><p>{report.message}</p></div>}
      {selected && <>
        <div className="hotspots-workspace">
          <div className="hotspots-map"><div className="hotspots-panel-label"><span>01 / 关注分布</span><span>{Math.min(12, report.topics.length)} 个主要议题</span></div>
            <BubbleCloud topics={report.topics} selected={selected.id} onSelect={setSelectedId} compact={compact} />
            <div className="hotspots-rail-wrap"><button aria-label="向前滑动议题" onClick={() => slideTopics(-1)}>←</button><div className="hotspots-rail" ref={rail} aria-label="全部热点议题">{report.topics.map(topic => <button key={topic.id} aria-pressed={topic.id === selected.id} className={topic.id === selected.id ? "active" : ""} onClick={() => setSelectedId(topic.id)}>{topic.label}<b>{topic.count}</b></button>)}</div><button aria-label="向后滑动议题" onClick={() => slideTopics(1)}>→</button></div>
          </div>
          <div className="hotspots-stories" aria-live="polite" aria-atomic="false">
            <div className="hotspots-panel-label"><span>02 / 沿着议题读新闻</span><span>↗ ORIGINAL SOURCES</span></div>
            <div className="hotspots-selection" key={selected.id}><h2>{selected.label}</h2><p>{selected.count} 条相关标题{!compact && ` · ${selected.mediaCount} 家媒体`}</p></div>
            {compact && <div className="hotspots-trend"><div className="hotspots-trend-heading"><strong>七日收录走势</strong><small>同一链接跨日出现，分别计入当天</small></div><div className="hotspots-bars">{selected.dailyCounts.map(day => <div className="hotspots-day" key={day.date} aria-label={`${day.date}：${day.count === null ? "无档案" : `${day.count} 条相关标题`}`}><span>{day.count === null ? "—" : day.count}</span><div className={`hotspots-bar-track ${day.count === null ? "is-missing" : ""}`}><i style={{ height: day.count === null ? 0 : `${day.count / maxDaily * 100}%` }} /></div><small>{day.date.slice(5).replace("-", "/")}</small><em>{day.count === null ? "无档案" : ""}</em></div>)}</div></div>}
            <div className="hotspots-story-list" key={`stories-${selected.id}`}>{selected.articles.map((article, index) => {
              const media = sources.find(item => item.domain === article.domain);
              return <article className="hotspots-story" key={article.url}><span className="hotspots-story-number">{String(index + 1).padStart(2, "0")}</span><div><div className="hotspots-story-meta">{media && onOpenSource ? <button onClick={() => onOpenSource(media.id)}>{media.localName} ↗</button> : <b>{media?.localName ?? article.domain}</b>}<span>{article.snapshotDate ? `收录 ${article.snapshotDate.slice(5)}` : "当前版面"}</span></div><h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3><div className="hotspots-story-links"><a href={article.url} target="_blank" rel="noopener noreferrer">阅读原文 ↗</a><a href={archiveLookupPath(article.url, article.snapshotDate ?? date)} target="_blank" rel="noopener noreferrer">Wayback</a><a href={archiveTodayLookupUrl(article.url)} target="_blank" rel="noopener noreferrer">archive.today</a></div></div></article>;
            })}</div>
          </div>
        </div>
      </>}
      <details className="hotspots-method"><summary>这些热点如何统计？</summary><p>根据已接入媒体的真实标题进行多语言关键词匹配，归入预设议题；气泡越大，匹配的标题越多。这是已收集来源的关注分布，不代表全网热度，也不是自动生成的新闻分析。</p><p>同一链接在所选时段内去重；一条标题可以涉及多个议题，议题数量不能相加作为总量。{compact ? "七日图按收录日期统计，缺少档案的日期显示“无档案”，不补写历史。" : "当天使用当前可读取的媒体版面，历史日期仅使用已保存档案；部分来源可能暂时不可用。"} 存档入口只查询已有快照，不保证存在。</p></details>
    </>}
  </section>;
}
