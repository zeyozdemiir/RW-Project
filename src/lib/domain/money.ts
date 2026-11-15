/** Para tutarları veritabanında kuruş (tam sayı) olarak tutulur. */

const tlWhole = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});
const tlCents = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compact = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatTL(kurus: number | null | undefined): string {
  if (kurus === null || kurus === undefined) return "—";
  return kurus % 100 === 0 ? tlWhole.format(kurus / 100) : tlCents.format(kurus / 100);
}

/** Grafik eksenleri gibi dar alanlar için: "1,2 Mn", "450 B". */
export function formatTLCompact(kurus: number): string {
  return `₺${compact.format(kurus / 100)}`;
}

/** Form alanına yazılacak biçim: "1.250.000" veya "1.250.000,50". */
export function toMoneyInput(kurus: number | null | undefined): string {
  if (kurus === null || kurus === undefined) return "";
  const whole = Math.trunc(kurus / 100);
  const cents = Math.abs(kurus % 100);
  const base = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(whole);
  return cents === 0 ? base : `${base},${String(cents).padStart(2, "0")}`;
}

/**
 * Kullanıcının yazdığı tutarı kuruşa çevirir. Türkçe yazımı esas alır:
 * nokta binlik ayırıcı, virgül ondalık ayırıcıdır ("1.250.000,50").
 * Geçersiz veya negatif girişte `null` döner.
 */
export function parseMoney(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).replace(/[₺\s]|TL|tl/g, "");
  if (s === "") return null;
  if (!/^[0-9.,]+$/.test(s)) return null;

  if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length !== 2) return null;
    s = `${parts[0]!.replace(/\./g, "")}.${parts[1]}`;
  } else if (s.includes(".")) {
    const groups = s.split(".");
    const allThousands = groups.slice(1).every((g) => g.length === 3) && groups[0]!.length > 0;
    if (allThousands) {
      s = groups.join("");
    } else if (groups.length !== 2) {
      return null;
    }
  }

  const value = Number(s);
  if (!Number.isFinite(value) || value < 0) return null;
  const kurus = Math.round(value * 100);
  if (!Number.isSafeInteger(kurus)) return null;
  return kurus;
}
