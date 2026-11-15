/**
 * Metin normalleştirme ve kontrat–portföy eşleştirme anahtarı.
 *
 * Amaç: "Nida Park Sitesi, B Blok, Daire 12" ile "NİDAPARK sit. b blok no:12"
 * aynı daire olarak tanınsın; böylece kontratta yazan daire sistemde kayıtlı
 * bir portföyle eşleştirilebilsin.
 */

const TR_FOLD: Record<string, string> = {
  ı: "i",
  İ: "i",
  I: "i",
  ş: "s",
  Ş: "s",
  ğ: "g",
  Ğ: "g",
  ü: "u",
  Ü: "u",
  ö: "o",
  Ö: "o",
  ç: "c",
  Ç: "c",
};

/** Türkçe karakterleri sadeleştirir ve küçük harfe çevirir. */
export function foldTr(input: string): string {
  return input
    .replace(/[ıİIşŞğĞüÜöÖçÇ]/g, (ch) => TR_FOLD[ch] ?? ch)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

function tokens(input: string): string[] {
  return foldTr(input)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

const COMPLEX_NOISE = new Set([
  "site",
  "sitesi",
  "sit",
  "apartman",
  "apartmani",
  "apt",
  "rezidans",
  "rezidansi",
  "residence",
  "konutlari",
  "evleri",
]);
const BLOCK_NOISE = new Set(["blok", "blogu", "blk", "block"]);
const UNIT_NOISE = new Set(["no", "nolu", "numara", "daire", "d", "kapi", "bagimsiz", "bolum"]);

export function normalizeComplex(input: string | null | undefined): string {
  if (!input) return "";
  const all = tokens(input);
  const kept = all.filter((t) => !COMPLEX_NOISE.has(t));
  // Ad yalnızca "Site" gibi genel bir kelimeden oluşuyorsa onu koru.
  return (kept.length > 0 ? kept : all).join("");
}

export function normalizeBlock(input: string | null | undefined): string {
  if (!input) return "";
  return tokens(input)
    .filter((t) => !BLOCK_NOISE.has(t))
    .join("");
}

export function normalizeUnit(input: string | null | undefined): string {
  if (!input) return "";
  const joined = tokens(input)
    .filter((t) => !UNIT_NOISE.has(t))
    .join("");
  return joined.replace(/^0+(?=.)/, "");
}

export function normalizeDistrict(input: string | null | undefined): string {
  if (!input) return "";
  return tokens(input).join("");
}

export type AddressParts = {
  district: string | null | undefined;
  complexName: string | null | undefined;
  block: string | null | undefined;
  unitNo: string | null | undefined;
};

/** Aynı daireyi gösteren kayıtlar için aynı değeri üreten anahtar. */
export function buildMatchKey(parts: AddressParts): string {
  return [
    normalizeDistrict(parts.district),
    normalizeComplex(parts.complexName),
    normalizeBlock(parts.block),
    normalizeUnit(parts.unitNo),
  ].join("|");
}

/** Arama için: Türkçe karakter ve büyük/küçük harf duyarsız düz metin. */
export function buildSearchText(values: Array<string | number | null | undefined>): string {
  return values
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map((v) => foldTr(String(v)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

/** Kişisel e-posta sağlayıcıları ofis uzantısı olarak kullanılamaz. */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.tr",
  "outlook.com",
  "outlook.com.tr",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.tr",
  "icloud.com",
  "me.com",
  "yandex.com",
  "yandex.com.tr",
  "proton.me",
  "protonmail.com",
  "mynet.com",
  "windowslive.com",
  "aol.com",
  "gmx.com",
]);

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

export function normalizeDomain(input: string): string | null {
  const d = input.trim().toLowerCase().replace(/^@/, "");
  return DOMAIN_RE.test(d) ? d : null;
}
