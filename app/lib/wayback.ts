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

// Folha's RSS wraps its canonical article URL in a known redirect URL.
// Unwrap only this exact host and a verified Folha target; never fetch redirects.
export function archiveTargetUrl(value: string) {
  try {
    const wrapper = new URL(value);
    if (wrapper.hostname !== "redir.folha.com.br" || !wrapper.pathname.startsWith("/redir/") || !["http:", "https:"].includes(wrapper.protocol)) return value;
    const marker = value.indexOf("/*");
    if (marker < 0) return value;
    const target = new URL(value.slice(marker + 2));
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return value;
    if (target.hostname !== "folha.uol.com.br" && !target.hostname.endsWith(".folha.uol.com.br")) return value;
    return target.toString();
  } catch { return value; }
}

// Official archive.ph exact-URL lookup path. This is not its /submit endpoint.
// Keep slashes as in its homepage examples; encode embedded query/hash delimiters.
export function archiveTodayLookupUrl(value: string) {
  const target = archiveTargetUrl(value);
  if (!isArchivableMediaUrl(target)) return "https://archive.ph/";
  const url = new URL(target);
  url.hash = "";
  return `https://archive.ph/${encodeURIComponent(url.toString()).replaceAll("%2F", "/")}`;
}

export function isArchivableMediaUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;
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
  const params = new URLSearchParams({ url: archiveTargetUrl(targetUrl), date });
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

