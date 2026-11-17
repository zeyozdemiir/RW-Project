/** Sahibinden ilan bağlantısı doğrulama ve müşteriyle paylaşım yardımcıları. */

const ALLOWED_HOSTS = ["sahibinden.com", "shbd.io"];

export type ListingUrlResult = { ok: true; url: string | null } | { ok: false; error: string };

export function parseListingUrl(raw: string | null | undefined): ListingUrlResult {
  const value = (raw ?? "").trim();
  if (value === "") return { ok: true, url: null };

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: "Geçerli bir sahibinden.com bağlantısı girin." };
  }
  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  if (!allowed) {
    return { ok: false, error: "Bağlantı sahibinden.com adresine ait olmalı." };
  }
  url.protocol = "https:";
  url.username = "";
  url.password = "";
  url.hash = "";
  return { ok: true, url: url.toString() };
}

/** Bağlantının sonundaki ilan numarasını bulur (ör. ".../1234567890/detay"). */
export function listingNumber(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(\d{8,12})(?:\/detay)?\/?(?:\?.*)?$/);
  return match?.[1] ?? null;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
