import type { DealType, ListingType, PortfolioStatus, UserRole, UserStatus } from "@/lib/db/schema";

export const ROLE_LABELS: Record<UserRole, string> = {
  platform_admin: "Platform Yöneticisi",
  manager: "Üst Yönetici",
  leader: "Ekip Lideri",
  agent: "Danışman",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  pending: "Onay bekliyor",
  active: "Aktif",
  disabled: "Pasif",
  rejected: "Reddedildi",
};

export const LISTING_LABELS: Record<ListingType, string> = {
  rent: "Kiralık",
  sale: "Satılık",
};

export const DEAL_LABELS: Record<DealType, string> = {
  rent: "Kiralama",
  sale: "Satış",
};

export const STATUS_LABELS: Record<PortfolioStatus, string> = {
  available: "Sunulabilir",
  deposit: "Kapora Alındı",
  rented: "Kiralandı",
  sold: "Satıldı",
  inactive: "Pasif",
};

export const PORTFOLIO_STATUSES: PortfolioStatus[] = ["available", "deposit", "rented", "sold", "inactive"];

export const PROPERTY_TYPES = [
  { value: "daire", label: "Daire" },
  { value: "rezidans", label: "Rezidans" },
  { value: "villa", label: "Villa" },
  { value: "mustakil", label: "Müstakil Ev" },
  { value: "ofis", label: "Ofis / Büro" },
  { value: "dukkan", label: "Dükkan / Mağaza" },
  { value: "arsa", label: "Arsa" },
  { value: "diger", label: "Diğer" },
] as const;

export const PROPERTY_TYPE_VALUES = PROPERTY_TYPES.map((p) => p.value) as [string, ...string[]];

export function propertyTypeLabel(value: string): string {
  return PROPERTY_TYPES.find((p) => p.value === value)?.label ?? value;
}

/** "Nida Park Sitesi · B Blok · No 12" */
export function unitLabel(p: { complexName: string; block?: string | null; unitNo: string }): string {
  const parts = [p.complexName];
  if (p.block) parts.push(/blok/i.test(p.block) ? p.block : `${p.block} Blok`);
  parts.push(`No ${p.unitNo}`);
  return parts.join(" · ");
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toLocaleUpperCase("tr-TR");
}
