import { defaultParseSearch } from "@tanstack/react-router";

/**
 * Whole-search-object URL codec: the entire search state is one base64url
 * JSON blob under a single param (`?_s=eyJzb3J0aW5nIjp...`). Wire both halves
 * into the router:
 *
 *   createRouter({ parseSearch: parseSearchBlob, stringifySearch: stringifySearchBlob })
 *
 * Trade-off, made deliberately: URLs are opaque, but any JSON-serializable
 * state round-trips exactly — no per-slice codec, no delimiter grammar, no
 * "ids must not contain `.`" rules, no ambiguity between a string that looks
 * like a range and a range. Validation is unaffected: the router runs each
 * route's `validateSearch` (the zod schemas) on the parsed object, after this
 * codec has already decoded it.
 *
 * Contract for stored values: JSON-serializable only. `undefined` object
 * fields drop out (that IS the "absent from URL" signal the sync hook relies
 * on); `undefined` inside arrays becomes `null`, so schemas for tuple-ish
 * values use `.nullable()` — e.g. a range filter's unset bound.
 *
 * `parseSearchBlob` is total: a truncated/tampered blob (atob or JSON.parse
 * throwing, or a non-object payload) is dropped and parsing falls back to the
 * plain params, so the page degrades to defaults instead of crashing the
 * router. Plain non-blob params still parse (and override blob keys), which
 * keeps hand-typed URLs like the legacy `?tab=` redirects working.
 */

const BLOB_PARAM = "_s";

// btoa/atob alone are Latin1-only and throw on the first "Göteborg"; go
// through TextEncoder/TextDecoder for real UTF-8. base64url alphabet
// (`-`/`_`, no `=` padding) keeps the blob out of percent-encoding.
function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(blob: string): string {
  const binary = atob(blob.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function stringifySearchBlob(search: Record<string, unknown>): string {
  const defined = Object.fromEntries(
    Object.entries(search).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(defined).length === 0) return "";
  return `?${BLOB_PARAM}=${encodeBase64Url(JSON.stringify(defined))}`;
}

export function parseSearchBlob(searchStr: string): Record<string, unknown> {
  const plain = defaultParseSearch(searchStr) as Record<string, unknown>;
  const blob = plain[BLOB_PARAM];
  delete plain[BLOB_PARAM];
  if (typeof blob !== "string") return plain;
  try {
    const decoded: unknown = JSON.parse(decodeBase64Url(blob));
    if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
      return plain;
    }
    return { ...decoded, ...plain };
  } catch {
    return plain;
  }
}
