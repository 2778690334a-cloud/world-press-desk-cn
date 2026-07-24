const ARCHIVABLE_DOMAINS = [
  "news.cn",
  "xinhuanet.com",
  "nhk.or.jp",
  "nikkei.com",
  "bbc.com",
  "theguardian.com",
  "lemonde.fr",
  "dw.com",
  "cnn.com",
  "nytimes.com",
  "aljazeera.com",
  "abc.net.au",
  "folha.uol.com.br",
];

export function isArchivableMediaUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const hostname = url.hostname.toLocaleLowerCase().replace(/^www\./, "");
    return ARCHIVABLE_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export function waybackTimestamp(date: string) {
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date
    : new Date().toISOString().slice(0, 10);
  return `${validDate.replaceAll("-", "")}120000`;
}

export function waybackFallbackUrl(targetUrl: string, date: string) {
  return `https://web.archive.org/web/${waybackTimestamp(date)}/${targetUrl}`;
}

export function archiveLookupPath(targetUrl: string, date: string) {
  const params = new URLSearchParams({ url: targetUrl, date });
  return `/api/archive?${params.toString()}`;
}

export function safeWaybackSnapshotUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.hostname !== "web.archive.org" &&
      !url.hostname.endsWith(".web.archive.org")
    ) {
      return null;
    }
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

