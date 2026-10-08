// Keep the existing NHK media ID stable across its official URL migration.
export function logicalMediaDomain(value: string) {
  const hostname = value.toLowerCase().replace(/^www\./, "");
  return hostname === "news.web.nhk" || hostname.endsWith(".news.web.nhk")
    ? "nhk.or.jp" : hostname;
}
export function mediaQueryDomains(domains: string[]) {
  return [...new Set(domains.flatMap(domain => domain === "nhk.or.jp"
    ? [domain, "news.web.nhk"] : [domain]))];
}
