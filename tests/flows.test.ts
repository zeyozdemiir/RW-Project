import { afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, db } from "@/lib/db";
import { alerts, deals, loginAttempts, offices, portfolios, users } from "@/lib/db/schema";
import { createSession, destroyUserSessions, readSession } from "@/lib/auth/session";
import { ServiceError } from "@/lib/errors";
import { periodRange } from "@/lib/domain/dates";
import {
  dismissAlert,
  listAlerts,
  resolveAlertByCreating,
  resolveAlertByLinking,
  countOpenAlerts,
} from "@/lib/services/alerts";
import { cancelDeal, createDeal, getDealDetail, listDeals } from "@/lib/services/deals";
import { createOffice, findOfficeByEmail, parseDomainList, setOfficeActive } from "@/lib/services/offices";
import {
  createPortfolio,
  getPortfolioDetail,
  listPortfolios,
  searchPortfoliosForDeal,
  setPortfolioStatus,
  updatePortfolio,
} from "@/lib/services/portfolios";
import { loadStatDeals, portfolioCounts, summarize } from "@/lib/services/stats";
import { createTeam, deleteTeam } from "@/lib/services/teams";
import {
  approveUser,
  authenticate,
  changeOwnPassword,
  listMembers,
  registerUser,
  rejectUser,
  resetMemberPassword,
  setMemberActive,
  updateMember,
} from "@/lib/services/users";
import {
  TEST_PASSWORD,
  dealInput,
  makeOffice,
  makeRwOffice,
  makeTeam,
  makeUser,
  portfolioInput,
  uniq,
  userRow,
} from "./helpers";

afterAll(async () => {
  await closeDb();
});

async function expectServiceError(promise: Promise<unknown>, pattern?: RegExp): Promise<void> {
  let error: unknown;
  try {
    await promise;
  } catch (err) {
    error = err;
  }
  expect(error).toBeInstanceOf(ServiceError);
  if (pattern) expect((error as ServiceError).message).toMatch(pattern);
}

describe("ofis açma ve e-posta uzantısı", () => {
  it("kişisel e-posta sağlayıcıları ofis uzantısı olamaz", () => {
    expect(() => parseDomainList("gmail.com")).toThrow(ServiceError);
    expect(() => parseDomainList("gecersiz uzanti!")).toThrow(ServiceError);
    expect(parseDomainList("@RWPozitif.com, rwpozitif.com.tr rwpozitif.com")).toEqual([
      "rwpozitif.com",
      "rwpozitif.com.tr",
    ]);
  });

  it("ofis, üst yöneticisiyle birlikte açılır; uzantı ikinci bir ofise verilemez", async () => {
    const domain = `${uniq("rw")}.com`;
    const { office, manager } = await createOffice({
      name: "Realty World Pozitif",
      domains: [domain],
      managerName: "Sultan Hanım",
      managerEmail: `sultan@${domain}`,
      managerPassword: "Gecici-1234",
    });
    expect(manager.role).toBe("manager");
    expect(manager.status).toBe("active");
    expect(manager.mustChangePassword).toBe(true);
    expect((await findOfficeByEmail(`Silan@${domain.toUpperCase()}`))?.id).toBe(office.id);

    await expectServiceError(
      createOffice({
        name: "Kopya Ofis",
        domains: [domain],
        managerName: "Başkası",
        managerEmail: `baskasi@${domain}`,
        managerPassword: "Gecici-1234",
      }),
      /başka bir ofise kayıtlı/,
    );
    await expectServiceError(
      createOffice({
        name: "Uyumsuz",
        domains: [`${uniq("x")}.com`],
        managerName: "Yönetici",
        managerEmail: "yonetici@baska-uzanti.com",
        managerPassword: "Gecici-1234",
      }),
      /e-posta uzantılarından biriyle/,
    );
  });
});

describe("kayıt ve üst yönetici onayı", () => {
  it("ofis uzantısı olmayan e-posta kayıt olamaz", async () => {
    await expectServiceError(
      registerUser({ name: "Yabancı", email: `biri@${uniq("yok")}.com`, phone: null, password: TEST_PASSWORD }),
      /kayıtlı bir ofise ait değil/,
    );
  });

  it("onaylanmadan giriş yapılamaz; onaydan sonra yapılır", async () => {
    const t = await makeRwOffice();
    const email = `yeni.danisman@${t.office.domain}`;
    await registerUser({ name: "Yeni Danışman", email, phone: null, password: TEST_PASSWORD });

    const [created] = await db.select().from(users).where(eq(users.email, email));
    expect(created?.status).toBe("pending");
    expect(created?.officeId).toBe(t.office.id);
    expect(await authenticate(email, TEST_PASSWORD, null)).toEqual({ ok: false, reason: "pending" });

    // Danışman ya da ekip lideri onay veremez.
    await expectServiceError(approveUser(t.silan, created!.id, { role: "agent", teamId: t.teamA, agentRatePct: null }));
    await expectServiceError(approveUser(t.liderA, created!.id, { role: "agent", teamId: t.teamA, agentRatePct: null }));
    // Ekip lideri rolü ekip seçilmeden verilemez.
    await expectServiceError(
      approveUser(t.sultan, created!.id, { role: "leader", teamId: null, agentRatePct: null }),
      /ekip seçin/,
    );

    await approveUser(t.sultan, created!.id, { role: "agent", teamId: t.teamB, agentRatePct: 55 });
    const result = await authenticate(email.toUpperCase(), TEST_PASSWORD, null);
    expect(result.ok).toBe(true);
    const row = await userRow(created!.id);
    expect(row).toMatchObject({ status: "active", teamId: t.teamB, agentRatePct: 55, approvedById: t.sultan.id });

    // Aynı e-posta ile ikinci kayıt açılamaz.
    await expectServiceError(
      registerUser({ name: "Kopya", email, phone: null, password: TEST_PASSWORD }),
      /zaten bir hesap var/,
    );
  });

  it("reddedilen, kapatılan ve ofisi kapalı kullanıcı giremez; durum yalnızca doğru şifreyle açıklanır", async () => {
    const t = await makeRwOffice();
    const email = `aday@${t.office.domain}`;
    await registerUser({ name: "Aday", email, phone: null, password: TEST_PASSWORD });
    const [aday] = await db.select().from(users).where(eq(users.email, email));

    expect(await authenticate(email, "yanlis-sifre-1", null)).toEqual({ ok: false, reason: "invalid" });
    await rejectUser(t.sultan, aday!.id);
    expect(await authenticate(email, TEST_PASSWORD, null)).toEqual({ ok: false, reason: "rejected" });

    expect((await authenticate(t.zeynep.email, TEST_PASSWORD, null)).ok).toBe(true);
    const session = await createSession(t.zeynep.id, "test");
    expect((await readSession(session.token))?.user.id).toBe(t.zeynep.id);

    await setMemberActive(t.sultan, t.zeynep.id, false);
    expect(await authenticate(t.zeynep.email, TEST_PASSWORD, null)).toEqual({ ok: false, reason: "disabled" });
    expect(await readSession(session.token)).toBeNull();

    await setMemberActive(t.sultan, t.zeynep.id, true);
    const session2 = await createSession(t.zeynep.id, "test");
    await setOfficeActive(t.office.id, false);
    expect(await authenticate(t.zeynep.email, TEST_PASSWORD, null)).toEqual({ ok: false, reason: "office_inactive" });
    expect(await readSession(session2.token)).toBeNull();
    await setOfficeActive(t.office.id, true);
    expect((await readSession(session2.token))?.office?.id).toBe(t.office.id);
  });

  it("art arda hatalı denemelerde giriş geçici olarak kilitlenir", async () => {
    const office = await makeOffice();
    const user = await makeUser(office, { name: "Kilit Test" });
    for (let i = 0; i < 8; i++) {
      expect(await authenticate(user.email, "yanlis-sifre-1", "10.0.0.1")).toEqual({ ok: false, reason: "invalid" });
    }
    expect(await authenticate(user.email, TEST_PASSWORD, "10.0.0.1")).toEqual({ ok: false, reason: "throttled" });
    await db.delete(loginAttempts).where(eq(loginAttempts.email, user.email));
    expect((await authenticate(user.email, TEST_PASSWORD, "10.0.0.1")).ok).toBe(true);
  });

  it("son üst yönetici kaldırılamaz; yönetici kendi hesabını kapatamaz", async () => {
    const t = await makeRwOffice();
    await expectServiceError(setMemberActive(t.sultan, t.sultan.id, false), /Kendi hesabınızı/);
    await expectServiceError(
      updateMember(t.sultan, t.sultan.id, { role: "agent", teamId: null, agentRatePct: null }),
      /Kendi yönetici yetkinizi/,
    );
    // İkinci yönetici atanınca ilki devredilebilir.
    await updateMember(t.sultan, t.liderA.id, { role: "manager", teamId: t.teamA, agentRatePct: null });
    const ikinci = { ...t.liderA, role: "manager" as const };
    await updateMember(ikinci, t.sultan.id, { role: "agent", teamId: null, agentRatePct: null });
    await expectServiceError(setMemberActive(t.sultan, ikinci.id, false));
    expect((await userRow(t.sultan.id)).role).toBe("agent");
  });

  it("şifre sıfırlama geçici şifre üretir ve eski oturumları kapatır", async () => {
    const t = await makeRwOffice();
    const session = await createSession(t.silan.id, "test");
    const { tempPassword } = await resetMemberPassword(t.sultan, t.silan.id);
    expect(await readSession(session.token)).toBeNull();
    expect((await authenticate(t.silan.email, TEST_PASSWORD, null)).ok).toBe(false);
    const login = await authenticate(t.silan.email, tempPassword, null);
    expect(login.ok && login.user.mustChangePassword).toBe(true);

    await expectServiceError(changeOwnPassword(t.silan.id, "yanlis", "YeniSifre123", null), /Mevcut şifreniz/);
    await expectServiceError(changeOwnPassword(t.silan.id, tempPassword, "zayif", null));
    await changeOwnPassword(t.silan.id, tempPassword, "YeniSifre123", null);
    expect((await userRow(t.silan.id)).mustChangePassword).toBe(false);
    expect((await authenticate(t.silan.email, "YeniSifre123", null)).ok).toBe(true);
    await destroyUserSessions(t.silan.id);
  });

  it("üye listesi: yönetici herkesi, danışman yalnızca aktif üyeleri görür", async () => {
    const t = await makeRwOffice();
    await registerUser({ name: "Bekleyen", email: `bekleyen@${t.office.domain}`, phone: null, password: TEST_PASSWORD });
    const forManager = await listMembers(t.sultan);
    const forAgent = await listMembers(t.silan);
    expect(forManager.some((m) => m.status === "pending")).toBe(true);
    expect(forAgent.every((m) => m.status === "active")).toBe(true);
    expect(forAgent.every((m) => m.agentRatePct === null)).toBe(true);
  });
});

describe("portföyler", () => {
  it("numara sırayla verilir; aynı daire ikinci kez aktif portföy olamaz", async () => {
    const t = await makeRwOffice();
    const first = await createPortfolio(t.silan, portfolioInput());
    expect(first.refNo).toBe(1);
    expect(first.agentId).toBe(t.silan.id);
    expect(first.status).toBe("available");

    // Zeynep aynı daireyi farklı yazımla kendi adına açmaya çalışıyor.
    await expectServiceError(
      createPortfolio(
        t.zeynep,
        portfolioInput({ complexName: "NİDAPARK sit.", block: "b blok", unitNo: "No: 12", district: "kadıköy" }),
      ),
      /zaten kiralık olarak kayıtlı: Portföy #1 \(Şilan Danışman\)/,
    );
    // Aynı daire satılık olarak ayrıca kaydedilebilir.
    const sale = await createPortfolio(t.silan, portfolioInput({ listingType: "sale", price: 9_500_000_00 }));
    // Reddedilen kayıt numara tüketmez (işlem geri alınır).
    expect(sale.refNo).toBe(2);
    // Farklı daire sorun değil.
    const other = await createPortfolio(t.zeynep, portfolioInput({ unitNo: "14" }));
    expect(other.agentId).toBe(t.zeynep.id);
  });

  it("mal sahibi bilgileri başka danışmanlardan gizlenir", async () => {
    const t = await makeRwOffice();
    const p = await createPortfolio(t.silan, portfolioInput({ notes: "Mal sahibi akşam aranmalı" }));
    const own = await getPortfolioDetail(t.silan, p.id);
    const leader = await getPortfolioDetail(t.liderA, p.id);
    const manager = await getPortfolioDetail(t.sultan, p.id);
    const otherTeam = await getPortfolioDetail(t.zeynep, p.id);
    const otherLeader = await getPortfolioDetail(t.liderB, p.id);
    const sameTeam = await getPortfolioDetail(t.elif, p.id);

    for (const d of [own, leader, manager]) {
      expect(d?.portfolio.ownerPhone).toBe("0532 000 00 00");
      expect(d?.canManage).toBe(true);
    }
    for (const d of [otherTeam, otherLeader, sameTeam]) {
      expect(d?.portfolio.title).toBe("Deniz manzaralı 3+1");
      expect(d?.portfolio.ownerName).toBeNull();
      expect(d?.portfolio.ownerPhone).toBeNull();
      expect(d?.portfolio.notes).toBeNull();
      expect(d?.canManage).toBe(false);
    }
    // Liste hiçbir zaman mal sahibi bilgisi taşımaz.
    const list = await listPortfolios(t.zeynep, {});
    expect(JSON.stringify(list.rows)).not.toContain("0532");
  });

  it("danışman başkası adına portföy açamaz; lider ekibi için açabilir", async () => {
    const t = await makeRwOffice();
    await expectServiceError(createPortfolio(t.zeynep, portfolioInput({ agentId: t.silan.id })));
    await expectServiceError(createPortfolio(t.liderB, portfolioInput({ agentId: t.silan.id })));
    const byLeader = await createPortfolio(t.liderA, portfolioInput({ agentId: t.silan.id }));
    expect(byLeader.agentId).toBe(t.silan.id);
    const byManager = await createPortfolio(t.sultan, portfolioInput({ agentId: t.zeynep.id, unitNo: "20" }));
    expect(byManager.agentId).toBe(t.zeynep.id);
  });

  it("kapora, düzenleme ve durum yetkileri", async () => {
    const t = await makeRwOffice();
    const p = await createPortfolio(t.silan, portfolioInput());

    // Başka ekipten Zeynep kapora işaretleyebilir ama portföyü düzenleyemez ya da pasife alamaz.
    await setPortfolioStatus(t.zeynep, p.id, "deposit", "Müşteri: A. Demir");
    let detail = await getPortfolioDetail(t.silan, p.id);
    expect(detail?.portfolio.status).toBe("deposit");
    expect(detail?.statusChangedByName).toBe("Zeynep Danışman");
    await expectServiceError(updatePortfolio(t.zeynep, p.id, portfolioInput({ price: 1_00 })));
    await expectServiceError(setPortfolioStatus(t.zeynep, p.id, "inactive", null));
    // Elif'in koymadığı kaporayı Elif geri alamaz; Zeynep kendi kaporasını alabilir.
    await expectServiceError(setPortfolioStatus(t.elif, p.id, "available", null));
    await setPortfolioStatus(t.zeynep, p.id, "available", null);
    // Kiralandı durumu elle verilemez.
    await expectServiceError(setPortfolioStatus(t.silan, p.id, "rented", null));
    await expectServiceError(setPortfolioStatus(t.sultan, p.id, "sold", null));

    const updated = await updatePortfolio(
      t.silan,
      p.id,
      portfolioInput({ price: 50_000_00, listingUrl: "sahibinden.com/ilan/emlak-1234567890/detay" }),
    );
    expect(updated.price).toBe(50_000_00);
    expect(updated.listingUrl).toBe("https://sahibinden.com/ilan/emlak-1234567890/detay");
    await expectServiceError(
      updatePortfolio(t.silan, p.id, portfolioInput({ listingUrl: "https://kotu-site.com/ilan" })),
      /sahibinden\.com/,
    );
    // Danışman portföyünü başkasına devredemez; yönetici devredebilir.
    await expectServiceError(updatePortfolio(t.silan, p.id, portfolioInput({ agentId: t.zeynep.id })));
    const moved = await updatePortfolio(t.sultan, p.id, portfolioInput({ agentId: t.zeynep.id }));
    expect(moved.agentId).toBe(t.zeynep.id);
    detail = await getPortfolioDetail(t.sultan, p.id);
    expect(detail?.activity.length).toBeGreaterThanOrEqual(5);
  });

  it("kiralık ve satılık ayrı listelenir; arama Türkçe karakter duyarsızdır", async () => {
    const t = await makeRwOffice();
    await createPortfolio(t.silan, portfolioInput({ title: "Çınar Evleri bahçe katı", complexName: "Çınar Evleri", unitNo: "1" }));
    await createPortfolio(t.silan, portfolioInput({ title: "Işık Rezidans 2+1", complexName: "Işık Rezidans", unitNo: "2" }));
    await createPortfolio(
      t.zeynep,
      portfolioInput({ listingType: "sale", title: "Satılık villa", complexName: "Göl Konakları", unitNo: "3", price: 25_000_000_00 }),
    );

    const rent = await listPortfolios(t.can, { listingType: "rent" });
    const sale = await listPortfolios(t.can, { listingType: "sale" });
    expect(rent.total).toBe(2);
    expect(sale.total).toBe(1);
    expect(sale.rows[0]?.agentName).toBe("Zeynep Danışman");
    expect(sale.rows[0]?.teamName).toBe("Ekip B");

    expect((await listPortfolios(t.can, { q: "ISIK rezidans" })).total).toBe(1);
    expect((await listPortfolios(t.can, { q: "cinar" })).total).toBe(1);
    expect((await listPortfolios(t.can, { q: "#3" })).rows[0]?.title).toBe("Satılık villa");
    expect((await listPortfolios(t.can, { teamId: t.teamA })).total).toBe(2);
    expect((await listPortfolios(t.can, { agentId: t.zeynep.id })).total).toBe(1);
    expect((await listPortfolios(t.can, { q: "100%_" })).total).toBe(0);
    expect(rent.statusCounts.available).toBe(2);
  });
});

describe("kontratlar, çapraz işlemler ve kayıtsız portföy uyarısı", () => {
  it("danışman kendi portföyünü kiralar: portföy kiralandı olur, uyarı çıkmaz", async () => {
    const t = await makeRwOffice();
    const p = await createPortfolio(t.silan, portfolioInput());
    const r = await createDeal(t.silan, dealInput({ portfolioId: p.id }));
    expect(r).toMatchObject({ unregistered: false, isCross: false, isCrossTeam: false, portfolioRefNo: 1 });
    expect(r.deal.refNo).toBe(1);
    expect(r.deal.closingAgentRevenue).toBe(45_000_00);
    expect(r.deal.closingAgentEarning).toBe(22_500_00);
    expect(r.deal.officeEarning).toBe(22_500_00);
    expect((await getPortfolioDetail(t.silan, p.id))?.portfolio.status).toBe("rented");
    expect(await countOpenAlerts(t.office.id)).toBe(0);
    // Kiralanmış portföye ikinci kontrat girilemez.
    await expectServiceError(createDeal(t.zeynep, dealInput({ portfolioId: p.id })), /Kiralandı/);
  });

  it("Şilan'ın portföyünü başka ekipten Zeynep kiralar: çapraz işlem olarak görünür", async () => {
    const t = await makeRwOffice();
    const p = await createPortfolio(t.silan, portfolioInput());
    const r = await createDeal(t.zeynep, dealInput({ portfolioId: p.id, commission: 40_000_00 }));
    expect(r).toMatchObject({
      unregistered: false,
      isCross: true,
      isCrossTeam: true,
      listingAgentName: "Şilan Danışman",
    });
    expect(r.deal).toMatchObject({
      closingAgentId: t.zeynep.id,
      closingTeamId: t.teamB,
      listingAgentId: t.silan.id,
      listingTeamId: t.teamA,
      listingSharePct: 50,
      closingAgentRevenue: 20_000_00,
      listingAgentRevenue: 20_000_00,
      closingAgentEarning: 10_000_00,
      listingAgentEarning: 10_000_00,
      officeEarning: 20_000_00,
    });

    // Yönetici çapraz ekip işlemini listede görür.
    const cross = await listDeals(t.sultan, { crossTeam: true });
    expect(cross.total).toBe(1);
    expect(cross.rows[0]).toMatchObject({
      isCross: true,
      isCrossTeam: true,
      closingAgentName: "Zeynep Danışman",
      closingTeamName: "Ekip B",
      listingAgentName: "Şilan Danışman",
      listingTeamName: "Ekip A",
      officeEarning: 20_000_00,
    });

    // İki taraf da işlemi görür; ilgisiz danışman görmez.
    expect((await listDeals(t.zeynep)).total).toBe(1);
    expect((await listDeals(t.silan)).total).toBe(1);
    expect((await listDeals(t.liderA)).total).toBe(1);
    expect((await listDeals(t.elif)).total).toBe(0);
    expect((await listDeals(t.can)).total).toBe(0);
    expect(await getDealDetail(t.can, r.deal.id)).toBeNull();

    // Kazanç gizliliği: Şilan kendi kazancını görür, Zeynep'inkini ve ofisinkini görmez.
    const forSilan = (await listDeals(t.silan)).rows[0]!;
    expect(forSilan.listingAgentEarning).toBe(10_000_00);
    expect(forSilan.closingAgentEarning).toBeNull();
    expect(forSilan.officeEarning).toBeNull();
    const forLiderA = (await getDealDetail(t.liderA, r.deal.id))!;
    expect(forLiderA.listingAgentEarning).toBe(10_000_00);
    expect(forLiderA.closingAgentEarning).toBeNull();

    // Portföy sayfasında kimin kiraladığı herkese görünür.
    const detail = await getPortfolioDetail(t.can, p.id);
    expect(detail?.portfolio.status).toBe("rented");
    expect(detail?.deals[0]?.closingAgentName).toBe("Zeynep Danışman");
  });

  it("aynı ekip içinde başka danışmanın portföyü: çapraz ama ekipler arası değil", async () => {
    const t = await makeRwOffice();
    const p = await createPortfolio(t.silan, portfolioInput());
    const r = await createDeal(t.elif, dealInput({ portfolioId: p.id }));
    expect(r).toMatchObject({ isCross: true, isCrossTeam: false });
    expect((await listDeals(t.sultan, { cross: true })).total).toBe(1);
    expect((await listDeals(t.sultan, { crossTeam: true })).total).toBe(0);
  });

  it("kontrattaki daire elle yazılsa da kayıtlı portföyle eşleşir", async () => {
    const t = await makeRwOffice();
    const p = await createPortfolio(t.silan, portfolioInput());
    const r = await createDeal(
      t.zeynep,
      dealInput({
        manual: {
          city: null,
          district: "KADIKÖY",
          neighborhood: null,
          complexName: "nidapark sitesi",
          block: "B BLOK",
          unitNo: "daire 12",
        },
      }),
    );
    expect(r).toMatchObject({ unregistered: false, autoLinked: true, isCross: true, portfolioRefNo: p.refNo });
    expect(r.deal.portfolioId).toBe(p.id);
    expect(await countOpenAlerts(t.office.id)).toBe(0);
  });

  it("sistemde portföyü olmayan daireye kontrat: üst yönetime uyarı gider", async () => {
    const t = await makeRwOffice();
    await createPortfolio(t.silan, portfolioInput());
    const r = await createDeal(
      t.zeynep,
      dealInput({
        manual: {
          city: "İstanbul",
          district: "Kadıköy",
          neighborhood: "Göztepe",
          complexName: "Nida Park Sitesi",
          block: "B",
          unitNo: "27",
        },
      }),
    );
    expect(r).toMatchObject({ unregistered: true, autoLinked: false, isCross: false });
    expect(r.deal.portfolioId).toBeNull();
    expect(r.deal.wasUnregistered).toBe(true);
    expect(await countOpenAlerts(t.office.id)).toBe(1);

    // Uyarıyı yalnızca üst yönetici görür.
    await expectServiceError(listAlerts(t.liderB, "open"));
    await expectServiceError(listAlerts(t.zeynep, "open"));
    const open = await listAlerts(t.sultan, "open");
    expect(open).toHaveLength(1);
    expect(open[0]?.deal).toMatchObject({ unitNo: "27", closingAgentName: "Zeynep Danışman", closingTeamName: "Ekip B" });
    // Aynı sitedeki kayıtlı portföy "benzer kayıt" olarak önerilir.
    expect(open[0]?.candidates.map((c) => c.unitNo)).toContain("12");

    // Açıklamasız kapatılamaz; danışman kapatamaz.
    await expectServiceError(dismissAlert(t.sultan, open[0]!.id, null), /açıklama/);
    await expectServiceError(dismissAlert(t.zeynep, open[0]!.id, "ben kapattım"));
    await dismissAlert(t.sultan, open[0]!.id, "Mal sahibi tanıdık, ofis dışı işlem.");
    expect(await countOpenAlerts(t.office.id)).toBe(0);
    const resolved = await listAlerts(t.sultan, "resolved");
    expect(resolved[0]).toMatchObject({ resolution: "dismissed", resolvedByName: "Sultan Yönetici" });
    await expectServiceError(dismissAlert(t.sultan, open[0]!.id, "tekrar"), /zaten kapatılmış/);
  });

  it("tür uyuşmuyorsa (satılık kayıtlı, kiralama kontratı) yine uyarı gider", async () => {
    const t = await makeRwOffice();
    await createPortfolio(t.silan, portfolioInput({ listingType: "sale", price: 9_000_000_00 }));
    const r = await createDeal(
      t.zeynep,
      dealInput({
        manual: { city: null, district: "Kadıköy", neighborhood: null, complexName: "Nida Park", block: "B", unitNo: "12" },
      }),
    );
    expect(r.unregistered).toBe(true);
    const [alert] = await listAlerts(t.sultan, "open");
    expect(alert?.candidates[0]).toMatchObject({ unitNo: "12", linkable: false });
  });

  it("uyarı, kontrat mevcut portföye bağlanarak çözülür ve ciro yeniden paylaşılır", async () => {
    const t = await makeRwOffice();
    // Şilan'ın portföyü "Nida Park" diye kayıtlı; Zeynep kontrata siteyi yanlış yazıyor.
    const p = await createPortfolio(t.silan, portfolioInput());
    const r = await createDeal(
      t.zeynep,
      dealInput({
        commission: 60_000_00,
        manual: { city: null, district: "Kadıköy", neighborhood: null, complexName: "Nida Parkk Sitesi", block: "B", unitNo: "12" },
      }),
    );
    expect(r.unregistered).toBe(true);
    expect(r.deal.closingAgentRevenue).toBe(60_000_00);

    const [alert] = await listAlerts(t.sultan, "open");
    const candidate = alert!.candidates.find((c) => c.id === p.id);
    expect(candidate).toMatchObject({ linkable: true, agentName: "Şilan Danışman" });

    await resolveAlertByLinking(t.sultan, alert!.id, p.id, "Yazım hatası");
    const [deal] = await db.select().from(deals).where(eq(deals.id, r.deal.id));
    expect(deal).toMatchObject({
      portfolioId: p.id,
      listingAgentId: t.silan.id,
      listingTeamId: t.teamA,
      closingAgentRevenue: 30_000_00,
      listingAgentRevenue: 30_000_00,
      wasUnregistered: true,
    });
    expect(deal!.closingAgentEarning + deal!.listingAgentEarning + deal!.officeEarning).toBe(60_000_00);
    expect((await getPortfolioDetail(t.sultan, p.id))?.portfolio.status).toBe("rented");
    expect(await countOpenAlerts(t.office.id)).toBe(0);
    // Artık çapraz işlem olarak Şilan'ın listesinde de görünür.
    expect((await listDeals(t.silan)).total).toBe(1);
  });

  it("uyarı, kontrattan portföy oluşturularak çözülür", async () => {
    const t = await makeRwOffice();
    const r = await createDeal(
      t.zeynep,
      dealInput({
        type: "sale",
        price: 12_000_000_00,
        commission: 240_000_00,
        manual: { city: "İstanbul", district: "Beşiktaş", neighborhood: "Etiler", complexName: "Maya Residences", block: null, unitNo: "8" },
      }),
    );
    const [alert] = await listAlerts(t.sultan, "open");
    await resolveAlertByCreating(t.sultan, alert!.id, null, null);
    const [deal] = await db.select().from(deals).where(eq(deals.id, r.deal.id));
    expect(deal?.portfolioId).not.toBeNull();
    const [p] = await db.select().from(portfolios).where(eq(portfolios.id, deal!.portfolioId!));
    expect(p).toMatchObject({ agentId: t.zeynep.id, status: "sold", listingType: "sale", unitNo: "8", refNo: 1 });
    expect((await listAlerts(t.sultan, "resolved"))[0]?.resolution).toBe("created");
  });

  it("kontrat iptali: portföy yeniden sunulabilir olur, sayım ve ciro düşer, uyarı kapanır", async () => {
    const t = await makeRwOffice();
    const p = await createPortfolio(t.silan, portfolioInput());
    const linked = await createDeal(t.zeynep, dealInput({ portfolioId: p.id }));
    const unlinked = await createDeal(
      t.can,
      dealInput({
        manual: { city: null, district: "Kadıköy", neighborhood: null, complexName: "Başka Site", block: null, unitNo: "3" },
      }),
    );
    expect(await countOpenAlerts(t.office.id)).toBe(1);

    await expectServiceError(cancelDeal(t.zeynep, linked.deal.id, "vazgeçildi"));
    await expectServiceError(cancelDeal(t.liderB, linked.deal.id, "vazgeçildi"));
    await cancelDeal(t.sultan, linked.deal.id, "Kiracı vazgeçti");
    await cancelDeal(t.sultan, unlinked.deal.id, null);

    expect((await getPortfolioDetail(t.silan, p.id))?.portfolio.status).toBe("available");
    expect(await countOpenAlerts(t.office.id)).toBe(0);
    expect((await listDeals(t.sultan)).total).toBe(0);
    expect((await listDeals(t.sultan, { status: "cancelled" })).total).toBe(2);
    const stats = summarize(await loadStatDeals(t.office.id, { from: null, to: null }), { kind: "office" });
    expect(stats).toMatchObject({ rentCount: 0, revenue: 0 });
    // Portföy yeniden kiralanabilir.
    const again = await createDeal(t.silan, dealInput({ portfolioId: p.id }));
    expect(again.deal.refNo).toBe(3);
  });

  it("danışman başkası adına kontrat giremez; yönetici özel paylaşım oranı belirleyebilir", async () => {
    const t = await makeRwOffice();
    const p = await createPortfolio(t.silan, portfolioInput());
    await expectServiceError(createDeal(t.elif, dealInput({ portfolioId: p.id, closingAgentId: t.zeynep.id })));
    await expectServiceError(
      createDeal(t.silan, dealInput({ portfolioId: p.id, type: "sale" })),
      /kiralık olarak kayıtlı/,
    );
    await expectServiceError(createDeal(t.silan, dealInput()), /portföy seçin/i);

    // Danışmanın gönderdiği özel oran dikkate alınmaz (ofis varsayılanı %50).
    const p2 = await createPortfolio(t.silan, portfolioInput({ unitNo: "40" }));
    const byAgent = await createDeal(t.zeynep, dealInput({ portfolioId: p2.id, commission: 10_000_00, listingSharePct: 0 }));
    expect(byAgent.deal.listingSharePct).toBe(50);

    const byManager = await createDeal(
      t.sultan,
      dealInput({ portfolioId: p.id, closingAgentId: t.zeynep.id, commission: 10_000_00, listingSharePct: 30 }),
    );
    expect(byManager.deal).toMatchObject({
      closingAgentId: t.zeynep.id,
      listingSharePct: 30,
      listingAgentRevenue: 3_000_00,
      closingAgentRevenue: 7_000_00,
      createdById: t.sultan.id,
    });
  });

  it("aynı portföye eşzamanlı iki kontrat girilirse yalnızca biri kaydedilir", async () => {
    const t = await makeRwOffice();
    const p = await createPortfolio(t.silan, portfolioInput());
    const results = await Promise.allSettled([
      createDeal(t.zeynep, dealInput({ portfolioId: p.id })),
      createDeal(t.can, dealInput({ portfolioId: p.id })),
      createDeal(t.elif, dealInput({ portfolioId: p.id })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rows = await db
      .select()
      .from(deals)
      .where(and(eq(deals.officeId, t.office.id), eq(deals.portfolioId, p.id)));
    expect(rows).toHaveLength(1);
  });
});

describe("ciro, kazanç ve sayımlar", () => {
  it("ofis, ekip ve danışman özetleri birbiriyle tutarlıdır", async () => {
    const t = await makeRwOffice();
    const p1 = await createPortfolio(t.silan, portfolioInput({ unitNo: "1" }));
    const p2 = await createPortfolio(t.silan, portfolioInput({ unitNo: "2" }));
    const p3 = await createPortfolio(t.zeynep, portfolioInput({ unitNo: "3", listingType: "sale", price: 8_000_000_00 }));
    await createPortfolio(t.can, portfolioInput({ unitNo: "4" }));

    await createDeal(t.silan, dealInput({ portfolioId: p1.id, commission: 40_000_00, contractDate: "2026-11-03" }));
    await createDeal(t.zeynep, dealInput({ portfolioId: p2.id, commission: 60_000_00, contractDate: "2026-11-05" }));
    await createDeal(
      t.zeynep,
      dealInput({ type: "sale", portfolioId: p3.id, price: 8_000_000_00, commission: 160_000_00, contractDate: "2026-10-20" }),
    );

    const november = periodRange("bu-ay", new Date("2026-11-15T09:00:00Z"));
    const nov = await loadStatDeals(t.office.id, november);
    const all = await loadStatDeals(t.office.id, { from: null, to: null });
    expect(nov).toHaveLength(2);
    expect(all).toHaveLength(3);

    const office = summarize(all, { kind: "office" });
    expect(office).toMatchObject({ rentCount: 2, saleCount: 1, revenue: 260_000_00, crossCount: 1 });
    expect(office.rentRevenue).toBe(100_000_00);
    expect(office.saleRevenue).toBe(160_000_00);

    const silan = summarize(all, { kind: "agent", agentId: t.silan.id });
    const zeynep = summarize(all, { kind: "agent", agentId: t.zeynep.id });
    // Şilan: kendi kiralaması 40.000 + Zeynep'in kiraladığı portföyünden 30.000 pay.
    expect(silan).toMatchObject({ rentCount: 1, saleCount: 0, revenue: 70_000_00, earning: 35_000_00, listedByOthersCount: 1 });
    // Zeynep: çapraz kiralamadan 30.000 + kendi satışı 160.000.
    expect(zeynep).toMatchObject({ rentCount: 1, saleCount: 1, revenue: 190_000_00, earning: 95_000_00, listedByOthersCount: 0 });

    const teamA = summarize(all, { kind: "team", teamId: t.teamA });
    const teamB = summarize(all, { kind: "team", teamId: t.teamB });
    const teamC = summarize(all, { kind: "team", teamId: t.teamC });
    expect(teamA).toMatchObject({ rentCount: 1, revenue: 70_000_00 });
    expect(teamB).toMatchObject({ rentCount: 1, saleCount: 1, revenue: 190_000_00 });
    expect(teamC).toMatchObject({ rentCount: 0, saleCount: 0, revenue: 0 });
    // Ekip ciroları toplamı ofis cirosuna, kazançlar toplamı ciroya eşittir.
    expect(teamA.revenue + teamB.revenue + teamC.revenue).toBe(office.revenue);
    expect(teamA.earning + teamB.earning + teamC.earning + office.earning).toBe(office.revenue);

    const counts = await portfolioCounts(t.office.id, { kind: "office" });
    expect(counts.rent).toMatchObject({ available: 1, rented: 2 });
    expect(counts.sale).toMatchObject({ sold: 1, available: 0 });
    const mine = await portfolioCounts(t.office.id, { kind: "agent", agentId: t.silan.id });
    expect(mine.rent.rented).toBe(2);
    const teamCounts = await portfolioCounts(t.office.id, { kind: "team", teamId: t.teamC });
    expect(teamCounts.rent.available).toBe(1);
  });

  it("danışmana özel pay oranı kazanca yansır", async () => {
    const office = await makeOffice();
    const yildiz = await makeUser(office, { name: "Yıldız", agentRatePct: 70 });
    const p = await createPortfolio(yildiz, portfolioInput());
    const r = await createDeal(yildiz, dealInput({ portfolioId: p.id, commission: 100_000_00 }));
    expect(r.deal).toMatchObject({ closingAgentRatePct: 70, closingAgentEarning: 70_000_00, officeEarning: 30_000_00 });
  });
});

describe("ofisler arası yalıtım (çok kiracılı yapı)", () => {
  it("bir ofis diğerinin portföyünü, kontratını, üyesini ve uyarısını göremez ya da değiştiremez", async () => {
    const rw = await makeRwOffice();
    const remaxOffice = await makeOffice("Remax Demo");
    const remaxTeam = await makeTeam(remaxOffice.id, "Ekip 1");
    const remaxManager = await makeUser(remaxOffice, { name: "Remax Yönetici", role: "manager" });
    const remaxAgent = await makeUser(remaxOffice, { name: "Remax Danışman", teamId: remaxTeam });

    const rwPortfolio = await createPortfolio(rw.silan, portfolioInput());
    const rwDeal = await createDeal(
      rw.zeynep,
      dealInput({
        manual: { city: null, district: "Kadıköy", neighborhood: null, complexName: "Kayıtsız Site", block: null, unitNo: "9" },
      }),
    );
    const [rwAlert] = await listAlerts(rw.sultan, "open");

    // Okuma
    expect((await listPortfolios(remaxManager, {})).total).toBe(0);
    expect(await getPortfolioDetail(remaxManager, rwPortfolio.id)).toBeNull();
    expect(await searchPortfoliosForDeal(remaxAgent, "rent", "nida")).toHaveLength(0);
    expect((await listDeals(remaxManager, { status: "all" })).total).toBe(0);
    expect(await getDealDetail(remaxManager, rwDeal.deal.id)).toBeNull();
    expect(await listAlerts(remaxManager, "open")).toHaveLength(0);
    expect(await countOpenAlerts(remaxOffice.id)).toBe(0);
    expect((await listMembers(remaxManager)).map((m) => m.name).sort()).toEqual(["Remax Danışman", "Remax Yönetici"]);
    expect(await loadStatDeals(remaxOffice.id, { from: null, to: null })).toHaveLength(0);

    // Yazma
    await expectServiceError(updatePortfolio(remaxManager, rwPortfolio.id, portfolioInput()), /bulunamadı/);
    await expectServiceError(setPortfolioStatus(remaxManager, rwPortfolio.id, "inactive", null), /bulunamadı/);
    await expectServiceError(createDeal(remaxAgent, dealInput({ portfolioId: rwPortfolio.id })), /bulunamadı/);
    await expectServiceError(createDeal(remaxManager, dealInput({ portfolioId: null, closingAgentId: rw.zeynep.id, manual: { city: null, district: "X", neighborhood: null, complexName: "Y", block: null, unitNo: "1" } })), /danışman bulunamadı/);
    await expectServiceError(cancelDeal(remaxManager, rwDeal.deal.id, "iptal"), /bulunamadı/);
    await expectServiceError(dismissAlert(remaxManager, rwAlert!.id, "kapat"), /bulunamadı/);
    await expectServiceError(resolveAlertByLinking(remaxManager, rwAlert!.id, rwPortfolio.id, null), /bulunamadı/);
    await expectServiceError(setMemberActive(remaxManager, rw.silan.id, false), /bulunamadı/);
    await expectServiceError(resetMemberPassword(remaxManager, rw.silan.id), /bulunamadı/);
    await expectServiceError(
      updateMember(remaxManager, rw.silan.id, { role: "manager", teamId: null, agentRatePct: null }),
      /bulunamadı/,
    );
    await expectServiceError(
      updateMember(remaxManager, remaxAgent.id, { role: "agent", teamId: rw.teamA, agentRatePct: null }),
      /ekip bulunamadı/,
    );
    await expectServiceError(createPortfolio(remaxManager, portfolioInput({ agentId: rw.silan.id })), /danışman bulunamadı/);
    await expectServiceError(deleteTeam(remaxManager, rw.teamA), /bulunamadı/);

    // Aynı daire iki ofiste birbirinden bağımsız kaydedilebilir; numaralar ofis içinde 1'den başlar.
    const remaxPortfolio = await createPortfolio(remaxAgent, portfolioInput());
    expect(remaxPortfolio.refNo).toBe(1);
    const remaxDeal = await createDeal(remaxAgent, dealInput({ portfolioId: remaxPortfolio.id }));
    expect(remaxDeal.deal.refNo).toBe(1);
    expect((await getPortfolioDetail(rw.silan, rwPortfolio.id))?.portfolio.status).toBe("available");

    // Hiçbir şey değişmedi.
    expect((await userRow(rw.silan.id)).status).toBe("active");
    expect(await countOpenAlerts(rw.office.id)).toBe(1);
  });

  it("veritabanı, başka ofisin kaydına işaret eden satırı reddeder", async () => {
    const a = await makeRwOffice();
    const b = await makeOffice("Diğer Ofis");
    const bAgent = await makeUser(b, { name: "Diğer Danışman" });
    const pA = await createPortfolio(a.silan, portfolioInput());

    // Uygulama katmanı atlanıp doğrudan yazılmaya çalışılsa bile bileşik yabancı anahtar engeller.
    await expect(
      db.update(portfolios).set({ agentId: bAgent.id }).where(eq(portfolios.id, pA.id)),
    ).rejects.toThrow();
    await expect(
      db.update(users).set({ teamId: a.teamA }).where(eq(users.id, bAgent.id)),
    ).rejects.toThrow();
    const [officeB] = await db.select().from(offices).where(eq(offices.id, b.id));
    await expect(
      db.insert(deals).values({
        officeId: officeB!.id,
        refNo: 999,
        type: "rent",
        portfolioId: pA.id,
        district: "x",
        complexName: "x",
        unitNo: "1",
        matchKey: "x|x||1",
        contractDate: "2026-11-01",
        price: 1,
        commission: 1,
        closingAgentId: bAgent.id,
        closingAgentRevenue: 1,
        closingAgentRatePct: 50,
        closingAgentEarning: 1,
        officeEarning: 0,
        createdById: bAgent.id,
      }),
    ).rejects.toThrow();
    expect(await db.select().from(alerts).where(eq(alerts.officeId, b.id))).toHaveLength(0);
  });
});

describe("ekipler", () => {
  it("yalnızca yönetici ekip açar; üyesi olan ekip silinemez", async () => {
    const t = await makeRwOffice();
    await expectServiceError(createTeam(t.liderA, "Yeni Ekip"));
    await expectServiceError(createTeam(t.sultan, "Ekip A"), /zaten var/);
    const team = await createTeam(t.sultan, "Ekip D");
    await expectServiceError(deleteTeam(t.sultan, t.teamA), /üyeler var/);
    await deleteTeam(t.sultan, team.id);
  });
});

