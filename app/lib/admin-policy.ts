// Sites dispatch owns these headers. Never accept identity from JSON or query strings.
export function isDeskAdmin(headers: Headers, configuredId: unknown): boolean {
  return typeof configuredId === "string" && configuredId.length > 0 &&
    headers.get("oai-authenticated-user-id") === configuredId;
}
export function sameOriginWrite(headers: Headers, origin: string): boolean {
  const sent = headers.get("origin");
  return (!sent || sent === origin) && headers.get("sec-fetch-site") !== "cross-site";
}
