// Response.text() always assumes UTF-8, even when an RSS XML document declares
// another encoding (Folha currently declares ISO-8859-1).
export function decodeFeedBytes(input: ArrayBuffer | Uint8Array, contentType = "") {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let encoding: string | undefined;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) encoding = "utf-8";
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = "utf-16le";
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = "utf-16be";
  else {
    const charset = contentType.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1];
    const prefix = Array.from(bytes.subarray(0, 512), byte => String.fromCharCode(byte)).join("");
    const declared = prefix.match(/^\s*<\?xml\b[^>]*\bencoding\s*=\s*["']([^"']+)["']/i)?.[1];
    encoding = charset ?? declared ?? "utf-8";
  }
  // Reject unsupported encodings or invalid byte sequences instead of silently
  // replacing characters and permanently storing a corrupted title.
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}
