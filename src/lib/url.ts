export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  const value = Array.isArray(v) ? v[0] : v;
  return value === undefined || value === "" ? undefined : value;
}

/** Mevcut sorgu parametrelerini koruyarak yeni bir bağlantı üretir. `null` parametreyi siler. */
export function hrefWith(path: string, sp: SearchParams, patch: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, raw] of Object.entries(sp)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value !== undefined && value !== "") q.set(key, value);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") q.delete(key);
    else q.set(key, value);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | undefined | null): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
