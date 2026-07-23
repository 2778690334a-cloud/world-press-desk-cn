export type IndexedArticle = {
  title: string;
  url: string;
  domain: string;
  seenAt?: string;
  language?: string;
  sourceCountry?: string;
  summary?: string;
};

const RSS_SOURCES = [
  {
    domain: "bbc.com",
    country: "United Kingdom",
    language: "English",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    domain: "theguardian.com",
    country: "United Kingdom",
    language: "English",
    url: "https://www.theguardian.com/world/rss",
  },
  {
    domain: "nytimes.com",
    country: "United States",
    language: "English",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  },
  {
    domain: "aljazeera.com",
    country: "Qatar",
    language: "English",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },
  {
    domain: "cnn.com",
    country: "United States",
    language: "English",
    url: "https://rss.cnn.com/rss/edition_world.rss",
  },
  {
    domain: "nhk.or.jp",
    country: "Japan",
    language: "Japanese",
    url: "https://www3.nhk.or.jp/rss/news/cat0.xml",
  },
  {
    domain: "lemonde.fr",
    country: "France",
    language: "English",
    url: "https://www.lemonde.fr/en/international/rss_full.xml",
  },
  {
    domain: "dw.com",
    country: "Germany",
    language: "English",
    url: "https://rss.dw.com/rdf/rss-en-all",
  },
] as const;

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function stripMarkup(value: string) {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(block: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(":", "\\:");
    const match = block.match(
      new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"),
    );
    if (match?.[1]) return match[1];
  }
  return "";
}

function entryLink(block: string) {
  const textLink = stripMarkup(tagValue(block, ["link"]));
  if (textLink.startsWith("http")) return textLink;

  const atomLink = block.match(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i,
  );
  return atomLink?.[1] ? decodeXml(atomLink[1]) : "";
}

function normaliseDate(value: string) {
  if (!value) return undefined;
  const parsed = new Date(stripMarkup(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function parseFeed(
  xml: string,
  source: (typeof RSS_SOURCES)[number],
): IndexedArticle[] {
  const blocks =
    xml.match(/<item\b[\s\S]*?<\/item>/gi) ??
    xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ??
    [];

  const articles: IndexedArticle[] = [];
  for (const block of blocks) {
    const title = stripMarkup(tagValue(block, ["title"]));
    const url = entryLink(block);
    const rawSummary = tagValue(block, [
      "description",
      "summary",
      "content:encoded",
      "content",
    ]);
    const summary = stripMarkup(rawSummary);
    const seenAt = normaliseDate(
      tagValue(block, ["pubDate", "published", "updated", "dc:date"]),
    );

    if (!title || !url) continue;
    articles.push({
      title,
      url,
      domain: source.domain,
      seenAt,
      language: source.language,
      sourceCountry: source.country,
      summary: summary ? summary.slice(0, 360) : undefined,
    });
  }
  return articles;
}

async function fetchFeed(source: (typeof RSS_SOURCES)[number]) {
  try {
    const response = await fetch(source.url, {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        "User-Agent": "WorldPressDesk/1.0 (public RSS reader)",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return [];
    return parseFeed(await response.text(), source);
  } catch {
    return [];
  }
}

export async function fetchRssArticles() {
  const results = await Promise.all(RSS_SOURCES.map(fetchFeed));
  return results.flat();
}
