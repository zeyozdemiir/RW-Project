/** Tarih yardımcıları. Ofis saati olarak Türkiye (Europe/Istanbul) esas alınır. */

const TZ = "Europe/Istanbul";

const isoFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const longFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** Türkiye saatine göre bugünün tarihi: "YYYY-AA-GG". */
export function todayISO(now: Date = new Date()): string {
  return isoFmt.format(now);
}

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

function iso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Ay kaydırma: (2026, 1) - 1 → (2025, 12). */
function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { y, m, d } = parts(value);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const PERIODS = ["bu-ay", "gecen-ay", "bu-yil", "tum"] as const;
export type PeriodKey = (typeof PERIODS)[number];

export type DateRange = {
  key: PeriodKey;
  label: string;
  /** Dahil. `null` ise alt sınır yok. */
  from: string | null;
  /** Hariç. `null` ise üst sınır yok. */
  to: string | null;
};

export function parsePeriod(value: string | string[] | undefined): PeriodKey {
  const v = Array.isArray(value) ? value[0] : value;
  return (PERIODS as readonly string[]).includes(v ?? "") ? (v as PeriodKey) : "bu-ay";
}

export function periodRange(key: PeriodKey, now: Date = new Date()): DateRange {
  const { y, m } = parts(todayISO(now));
  switch (key) {
    case "bu-ay": {
      const next = shiftMonth(y, m, 1);
      return { key, label: `${MONTHS[m - 1]} ${y}`, from: iso(y, m, 1), to: iso(next.y, next.m, 1) };
    }
    case "gecen-ay": {
      const prev = shiftMonth(y, m, -1);
      return {
        key,
        label: `${MONTHS[prev.m - 1]} ${prev.y}`,
        from: iso(prev.y, prev.m, 1),
        to: iso(y, m, 1),
      };
    }
    case "bu-yil":
      return { key, label: `${y} yılı`, from: iso(y, 1, 1), to: iso(y + 1, 1, 1) };
    case "tum":
      return { key, label: "Tüm zamanlar", from: null, to: null };
  }
}

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "bu-ay": "Bu ay",
  "gecen-ay": "Geçen ay",
  "bu-yil": "Bu yıl",
  tum: "Tümü",
};

export type MonthBucket = { key: string; label: string; shortLabel: string; from: string; to: string };

/** İçinde bulunulan ay dahil, geriye doğru `count` ay (eskiden yeniye sıralı). */
export function lastMonths(count: number, now: Date = new Date()): MonthBucket[] {
  const { y, m } = parts(todayISO(now));
  const out: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const cur = shiftMonth(y, m, -i);
    const next = shiftMonth(cur.y, cur.m, 1);
    out.push({
      key: `${cur.y}-${String(cur.m).padStart(2, "0")}`,
      label: `${MONTHS[cur.m - 1]} ${cur.y}`,
      shortLabel: MONTHS_SHORT[cur.m - 1]!,
      from: iso(cur.y, cur.m, 1),
      to: iso(next.y, next.m, 1),
    });
  }
  return out;
}

/** "2026-11-15" → "15 Kasım 2026" */
export function formatDateISO(value: string | null | undefined): string {
  if (!value) return "—";
  const { y, m, d } = parts(value);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDate(value: Date | null | undefined): string {
  return value ? longFmt.format(value) : "—";
}

export function formatDateShort(value: Date | null | undefined): string {
  return value ? shortFmt.format(value) : "—";
}

export function formatDateTime(value: Date | null | undefined): string {
  return value ? dateTimeFmt.format(value) : "—";
}
