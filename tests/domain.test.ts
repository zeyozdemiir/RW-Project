import { describe, expect, it } from "vitest";
import { computeCommission } from "@/lib/domain/commission";
import { lastMonths, periodRange, todayISO, isValidISODate } from "@/lib/domain/dates";
import { listingNumber, parseListingUrl } from "@/lib/domain/listing-url";
import { formatTL, parseMoney, toMoneyInput } from "@/lib/domain/money";
import { buildMatchKey, emailDomain, foldTr, normalizeDomain, normalizeUnit } from "@/lib/domain/normalize";
import {
  allowedStatusChanges,
  canCreateDealFor,
  canManagePortfolio,
  canSeeOwnerContact,
  canViewDeal,
  type Viewer,
} from "@/lib/domain/permissions";
import { checkPasswordStrength, generateTempPassword, hashPassword, verifyPassword } from "@/lib/auth/password";

describe("daire eşleştirme anahtarı", () => {
  const base = { district: "Kadıköy", complexName: "Nida Park Sitesi", block: "B Blok", unitNo: "Daire 12" };

  it("yazım farklarına rağmen aynı daireyi tanır", () => {
    const variants = [
      { district: "KADIKÖY", complexName: "NİDA PARK SİTESİ", block: "b", unitNo: "12" },
      { district: "kadikoy", complexName: "nidapark sit.", block: "B-Blok", unitNo: "No:12" },
      { district: " Kadıköy ", complexName: "Nida Park", block: "B blok", unitNo: "D.12" },
      { district: "Kadıköy", complexName: "Nida  Park  Sitesi", block: "B", unitNo: "012" },
    ];
    for (const v of variants) expect(buildMatchKey(v)).toBe(buildMatchKey(base));
  });

  it("farklı daireleri ayırır", () => {
    expect(buildMatchKey({ ...base, unitNo: "13" })).not.toBe(buildMatchKey(base));
    expect(buildMatchKey({ ...base, block: "C" })).not.toBe(buildMatchKey(base));
    expect(buildMatchKey({ ...base, complexName: "Gül Apartmanı" })).not.toBe(buildMatchKey(base));
    expect(buildMatchKey({ ...base, district: "Üsküdar" })).not.toBe(buildMatchKey(base));
  });

  it("Türkçe büyük/küçük harfleri sadeleştirir", () => {
    expect(foldTr("IŞIK İĞNE ÇÖĞÜŞ")).toBe("isik igne cogus");
    expect(normalizeUnit("12/A")).toBe("12a");
    expect(normalizeUnit("0")).toBe("0");
  });

  it("e-posta uzantısını ayrıştırır", () => {
    expect(emailDomain("Silan@RWPozitif.com")).toBe("rwpozitif.com");
    expect(emailDomain("gecersiz")).toBeNull();
    expect(normalizeDomain("@RWPozitif.com")).toBe("rwpozitif.com");
    expect(normalizeDomain("rw pozitif")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
  });
});

describe("ciro ve kazanç hesabı", () => {
  it("kendi portföyünü kapatan danışman cironun tamamını alır", () => {
    const s = computeCommission({
      commission: 100_000_00,
      closingAgentId: "a",
      closingRatePct: 50,
      listingAgentId: "a",
      listingRatePct: 50,
      listingSharePct: 50,
    });
    expect(s.isCross).toBe(false);
    expect(s.closingAgentRevenue).toBe(100_000_00);
    expect(s.listingAgentRevenue).toBe(0);
    expect(s.closingAgentEarning).toBe(50_000_00);
    expect(s.officeEarning).toBe(50_000_00);
  });

  it("çapraz işlemde ciro paylaşılır ve toplam korunur", () => {
    const s = computeCommission({
      commission: 33_333_33,
      closingAgentId: "zeynep",
      closingRatePct: 60,
      listingAgentId: "silan",
      listingRatePct: 45,
      listingSharePct: 40,
    });
    expect(s.isCross).toBe(true);
    expect(s.closingAgentRevenue + s.listingAgentRevenue).toBe(33_333_33);
    expect(s.closingAgentEarning + s.listingAgentEarning + s.officeEarning).toBe(33_333_33);
    expect(s.listingAgentRevenue).toBe(Math.round((33_333_33 * 40) / 100));
  });

  it("kayıtsız portföyde (portföy sahibi yok) pay ayrılmaz", () => {
    const s = computeCommission({
      commission: 10_000_00,
      closingAgentId: "a",
      closingRatePct: 50,
      listingAgentId: null,
      listingRatePct: 50,
      listingSharePct: 50,
    });
    expect(s.isCross).toBe(false);
    expect(s.listingSharePct).toBe(0);
    expect(s.closingAgentRevenue).toBe(10_000_00);
  });
});

describe("para ve tarih", () => {
  it("Türkçe yazılmış tutarları kuruşa çevirir", () => {
    expect(parseMoney("1.250.000")).toBe(125_000_000);
    expect(parseMoney("1.250.000,50")).toBe(125_000_050);
    expect(parseMoney("45000")).toBe(4_500_000);
    expect(parseMoney("₺ 45.000 TL")).toBe(4_500_000);
    expect(parseMoney("1250,5")).toBe(125_050);
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
    expect(parseMoney("1,2,3")).toBeNull();
  });

  it("tutarları Türk lirası olarak biçimlendirir", () => {
    expect(formatTL(125_000_000)).toBe("₺1.250.000");
    expect(formatTL(125_050)).toBe("₺1.250,50");
    expect(toMoneyInput(125_000_050)).toBe("1.250.000,50");
    expect(parseMoney(toMoneyInput(987_654_321))).toBe(987_654_321);
  });

  it("dönemleri Türkiye saatine göre hesaplar", () => {
    // 31 Ekim 2026 22:30 UTC = 1 Kasım 2026 01:30 Türkiye saati
    const now = new Date("2026-10-31T22:30:00Z");
    expect(todayISO(now)).toBe("2026-11-01");
    expect(periodRange("bu-ay", now)).toMatchObject({ from: "2026-11-01", to: "2026-12-01" });
    expect(periodRange("gecen-ay", now)).toMatchObject({ from: "2026-10-01", to: "2026-11-01" });
    expect(periodRange("bu-yil", now)).toMatchObject({ from: "2026-01-01", to: "2027-01-01" });
    expect(periodRange("tum", now)).toMatchObject({ from: null, to: null });
  });

  it("yıl geçişinde ayları doğru sıralar", () => {
    const months = lastMonths(3, new Date("2026-01-15T10:00:00Z"));
    expect(months.map((m) => m.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(months[1]).toMatchObject({ from: "2025-12-01", to: "2026-01-01" });
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-02-28")).toBe(true);
  });
});

describe("sahibinden bağlantısı", () => {
  it("sahibinden adreslerini kabul eder ve düzenler", () => {
    const r = parseListingUrl("www.sahibinden.com/ilan/emlak-konut-kiralik-3-1-1234567890/detay#foto");
    expect(r).toEqual({
      ok: true,
      url: "https://www.sahibinden.com/ilan/emlak-konut-kiralik-3-1-1234567890/detay",
    });
    expect(listingNumber(r.ok ? r.url : null)).toBe("1234567890");
    expect(parseListingUrl("https://shbd.io/s/AbCd")).toMatchObject({ ok: true });
    expect(parseListingUrl("")).toEqual({ ok: true, url: null });
  });

  it("başka sitelere ve sahte adreslere izin vermez", () => {
    expect(parseListingUrl("https://sahibinden.com.sahte-site.com/ilan/1")).toMatchObject({ ok: false });
    expect(parseListingUrl("https://example.com/sahibinden.com")).toMatchObject({ ok: false });
    expect(parseListingUrl("javascript:alert(1)")).toMatchObject({ ok: false });
  });
});

describe("yetkiler", () => {
  const v = (role: Viewer["role"], id: string, teamId: string | null): Viewer => ({
    id,
    officeId: "o",
    role,
    teamId,
    name: id,
    email: `${id}@x.com`,
  });
  const silanPortfolio = { agentId: "silan", agentTeamId: "A" };

  it("mal sahibi bilgisini yalnızca sahibi, ekip lideri ve yönetici görür", () => {
    expect(canSeeOwnerContact(v("agent", "silan", "A"), silanPortfolio)).toBe(true);
    expect(canSeeOwnerContact(v("leader", "liderA", "A"), silanPortfolio)).toBe(true);
    expect(canSeeOwnerContact(v("manager", "sultan", null), silanPortfolio)).toBe(true);
    expect(canSeeOwnerContact(v("agent", "zeynep", "B"), silanPortfolio)).toBe(false);
    expect(canSeeOwnerContact(v("agent", "elif", "A"), silanPortfolio)).toBe(false);
    expect(canSeeOwnerContact(v("leader", "liderB", "B"), silanPortfolio)).toBe(false);
    expect(canManagePortfolio(v("leader", "liderX", null), { agentId: "x", agentTeamId: null })).toBe(false);
  });

  it("başka danışman yalnızca kapora işaretleyebilir ve kendi kaporasını geri alabilir", () => {
    const zeynep = v("agent", "zeynep", "B");
    expect(allowedStatusChanges(zeynep, { ...silanPortfolio, status: "available", statusChangedById: "silan" })).toEqual([
      "deposit",
    ]);
    expect(allowedStatusChanges(zeynep, { ...silanPortfolio, status: "deposit", statusChangedById: "zeynep" })).toEqual([
      "available",
    ]);
    expect(allowedStatusChanges(zeynep, { ...silanPortfolio, status: "deposit", statusChangedById: "silan" })).toEqual([]);
    expect(allowedStatusChanges(zeynep, { ...silanPortfolio, status: "rented", statusChangedById: "silan" })).toEqual([]);
  });

  it("kiralandı / satıldı durumu elle seçilemez", () => {
    const silan = v("agent", "silan", "A");
    for (const status of ["available", "deposit", "inactive"] as const) {
      const options = allowedStatusChanges(silan, { ...silanPortfolio, status, statusChangedById: null });
      expect(options).not.toContain("rented");
      expect(options).not.toContain("sold");
    }
  });

  it("kontrat görünürlüğü ve başkası adına kontrat", () => {
    const deal = { closingAgentId: "zeynep", closingTeamId: "B", listingAgentId: "silan", listingTeamId: "A" };
    expect(canViewDeal(v("agent", "zeynep", "B"), deal)).toBe(true);
    expect(canViewDeal(v("agent", "silan", "A"), deal)).toBe(true);
    expect(canViewDeal(v("leader", "liderA", "A"), deal)).toBe(true);
    expect(canViewDeal(v("agent", "elif", "A"), deal)).toBe(false);
    expect(canViewDeal(v("leader", "liderC", "C"), deal)).toBe(false);
    expect(canCreateDealFor(v("agent", "elif", "A"), { id: "silan", teamId: "A" })).toBe(false);
    expect(canCreateDealFor(v("leader", "liderA", "A"), { id: "silan", teamId: "A" })).toBe(true);
    expect(canCreateDealFor(v("leader", "liderA", "A"), { id: "zeynep", teamId: "B" })).toBe(false);
  });
});

describe("şifreler", () => {
  it("özetler ve doğrular", async () => {
    const hash = await hashPassword("Gizli-Sifre-1");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Gizli-Sifre-1", hash)).toBe(true);
    expect(await verifyPassword("gizli-sifre-1", hash)).toBe(false);
    expect(await verifyPassword("x", "bozuk")).toBe(false);
    expect(await hashPassword("Gizli-Sifre-1")).not.toBe(hash);
  });

  it("zayıf şifreleri reddeder, geçici şifre kurala uyar", () => {
    expect(checkPasswordStrength("kisa1").ok).toBe(false);
    expect(checkPasswordStrength("sadeceharf").ok).toBe(false);
    expect(checkPasswordStrength("12345678").ok).toBe(false);
    expect(checkPasswordStrength("Deneme1234").ok).toBe(true);
    for (let i = 0; i < 20; i++) expect(checkPasswordStrength(generateTempPassword()).ok).toBe(true);
  });
});
