import "./load-env";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/lib/auth/password";
import { closeDb, db } from "../src/lib/db";
import { officeDomains, offices, portfolios, teams, users, type UserRole } from "../src/lib/db/schema";
import { lastMonths, todayISO } from "../src/lib/domain/dates";
import type { Viewer } from "../src/lib/domain/permissions";
import { dismissAlert, listAlerts } from "../src/lib/services/alerts";
import { createDeal } from "../src/lib/services/deals";
import { createPortfolio, setPortfolioStatus } from "../src/lib/services/portfolios";
import { registerUser } from "../src/lib/services/users";
import type { PortfolioInput } from "../src/lib/validation";

/**
 * Tanıtım (demo) verisi: 30 kişilik bir ofis (1 üst yönetici, 3 ekip),
 * portföyler, kontratlar, çapraz işlemler ve kayıtsız portföy uyarıları ile
 * ofisler arası yalıtımı göstermek için ikinci bir ofis.
 *
 * Gerçek kullanımda bu betik ÇALIŞTIRILMAZ; ofisler platform panelinden açılır.
 */

const DEMO_PASSWORD = "Demo1234";
const RW_DOMAIN = "rwpozitif.com";
const OTHER_DOMAIN = "remaxdemo.com";

/** Her çalıştırmada aynı veriyi üretmek için tohumlu rastgele sayı üreteci. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261115);
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

function emailFor(name: string, domain: string): string {
  const ascii = name
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim()
    .split(/\s+/)
    .join(".");
  return `${ascii}@${domain}`;
}

async function addUser(
  office: { id: string; domain: string },
  passwordHash: string,
  opts: { name: string; role: UserRole; teamId: string | null; phone?: string; agentRatePct?: number },
): Promise<Viewer> {
  const email = emailFor(opts.name, office.domain);
  const [row] = await db
    .insert(users)
    .values({
      officeId: office.id,
      email,
      name: opts.name,
      phone: opts.phone ?? `05${between(30, 59)} ${between(100, 999)} ${between(10, 99)} ${between(10, 99)}`,
      passwordHash,
      role: opts.role,
      status: "active",
      teamId: opts.teamId,
      agentRatePct: opts.agentRatePct ?? null,
      approvedAt: new Date(),
    })
    .returning();
  return {
    id: row!.id,
    officeId: office.id,
    role: opts.role === "manager" ? "manager" : opts.role === "leader" ? "leader" : "agent",
    teamId: opts.teamId,
    name: opts.name,
    email,
  };
}

const SITES = [
  { complexName: "Nida Park Sitesi", district: "Kadıköy", neighborhood: "Göztepe", blocks: ["A", "B", "C"] },
  { complexName: "Çınar Evleri", district: "Kadıköy", neighborhood: "Erenköy", blocks: [null] },
  { complexName: "Mavi Koru Konutları", district: "Ataşehir", neighborhood: "Barbaros", blocks: ["A", "B"] },
  { complexName: "Işık Rezidans", district: "Ataşehir", neighborhood: "Küçükbakkalköy", blocks: [null] },
  { complexName: "Panorama Evleri", district: "Üsküdar", neighborhood: "Acıbadem", blocks: ["A", "B", "C", "D"] },
  { complexName: "Yeşil Vadi Sitesi", district: "Üsküdar", neighborhood: "Altunizade", blocks: ["1", "2"] },
  { complexName: "Bahçe Konakları", district: "Maltepe", neighborhood: "Altayçeşme", blocks: [null] },
  { complexName: "Sahil Park Rezidans", district: "Maltepe", neighborhood: "İdealtepe", blocks: ["A", "B"] },
  { complexName: "Gül Apartmanı", district: "Kadıköy", neighborhood: "Suadiye", blocks: [null] },
  { complexName: "Defne Konutları", district: "Ataşehir", neighborhood: "İçerenköy", blocks: ["A", "B", "C"] },
] as const;

const ROOMS = ["1+1", "2+1", "2+1", "3+1", "3+1", "4+1"] as const;
const TITLE_BITS = [
  "Deniz manzaralı",
  "Yeni binada",
  "Metroya yakın",
  "Geniş balkonlu",
  "Site içinde",
  "Bakımlı",
  "Otoparklı",
  "Ferah",
  "Güney cepheli",
  "Bahçe katı",
] as const;
const OWNERS = ["Mehmet Kaya", "Ayşe Demir", "Hüseyin Çelik", "Fatma Öztürk", "Ali Yılmaz", "Emine Aksoy", "Mustafa Polat"] as const;
const CUSTOMERS = ["Burak Tekin", "Selin Aydoğan", "Onur Kılıç", "Deniz Erdem", "Gizem Uçar", "Tolga Bulut", "İpek Sarı"] as const;

function buildPortfolio(index: number, type: "rent" | "sale"): PortfolioInput {
  const site = SITES[index % SITES.length]!;
  const block = site.blocks[index % site.blocks.length] ?? null;
  const rooms = pick(ROOMS);
  const gross = rooms === "1+1" ? between(55, 75) : rooms === "2+1" ? between(85, 115) : rooms === "3+1" ? between(125, 165) : between(180, 240);
  const price =
    type === "rent" ? between(28, 120) * 1_000 * 100 : between(45, 320) * 100_000 * 100;
  const withListing = rand() < 0.65;
  return {
    listingType: type,
    propertyType: site.complexName.includes("Rezidans") ? "rezidans" : "daire",
    title: `${pick(TITLE_BITS)} ${rooms} ${type === "rent" ? "kiralık" : "satılık"} daire`,
    city: "İstanbul",
    district: site.district,
    neighborhood: site.neighborhood,
    complexName: site.complexName,
    block,
    floor: String(between(1, 14)),
    // Her portföy farklı bir daire olsun.
    unitNo: String(index + 1),
    rooms,
    grossM2: gross,
    netM2: Math.round(gross * 0.86),
    buildingAge: between(0, 22),
    furnished: type === "rent" && rand() < 0.25,
    price,
    ownerName: pick(OWNERS),
    ownerPhone: `05${between(30, 59)} ${between(100, 999)} ${between(10, 99)} ${between(10, 99)}`,
    listingUrl: withListing
      ? `https://www.sahibinden.com/ilan/emlak-konut-${type === "rent" ? "kiralik" : "satilik"}-demo-${1_200_000_000 + index * 7919}/detay`
      : null,
    notes: rand() < 0.3 ? "Mal sahibi hafta içi 18:00'den sonra aranmalı." : null,
    agentId: null,
  };
}

async function officeExists(domain: string): Promise<boolean> {
  const rows = await db.select().from(officeDomains).where(eq(officeDomains.domain, domain)).limit(1);
  return rows.length > 0;
}

async function createOfficeRow(name: string, domain: string) {
  const [office] = await db.insert(offices).values({ name }).returning();
  await db.insert(officeDomains).values({ domain, officeId: office!.id });
  return { id: office!.id, domain };
}

async function seedRw(passwordHash: string) {
  const office = await createOfficeRow("Realty World Pozitif", RW_DOMAIN);
  const sultan = await addUser(office, passwordHash, { name: "Sultan Aydemir", role: "manager", teamId: null });

  const teamDefs = [
    {
      name: "Altın Ekip",
      leader: "Kerem Aydın",
      members: ["Şilan Yıldız", "Elif Kara", "Baran Öz", "Merve Güneş", "Okan Tunç", "Sibel Akın", "Emre Doğan", "Nazlı Er", "Cem Uysal"],
    },
    {
      name: "Safir Ekip",
      leader: "Derya Koç",
      members: ["Zeynep Arslan", "Can Bozkurt", "Aslı Yaman", "Volkan Şen", "Pınar Acar", "Serkan Ateş", "Ebru Kurt", "Tuna Özer", "Melis Ay"],
    },
    {
      name: "Zümrüt Ekip",
      leader: "Murat Şahin",
      members: ["Gökhan Eren", "Buse Taş", "Hakan Yücel", "İrem Sönmez", "Umut Kaplan", "Ceren Avcı", "Kaan Özkan", "Seda Bilgin", "Arda Çakır"],
    },
  ];

  const byName = new Map<string, Viewer>();
  const teamIds: string[] = [];
  for (const def of teamDefs) {
    const [team] = await db.insert(teams).values({ officeId: office.id, name: def.name }).returning();
    teamIds.push(team!.id);
    byName.set(def.leader, await addUser(office, passwordHash, { name: def.leader, role: "leader", teamId: team!.id, agentRatePct: 60 }));
    for (const member of def.members) {
      byName.set(member, await addUser(office, passwordHash, { name: member, role: "agent", teamId: team!.id }));
    }
  }
  const agents = [...byName.values()];
  const silan = byName.get("Şilan Yıldız")!;
  const zeynep = byName.get("Zeynep Arslan")!;

  // Portföyler: önce senaryoda adı geçenler, sonra rastgele dağıtım.
  type Created = { id: string; type: "rent" | "sale"; owner: Viewer; price: number };
  const created: Created[] = [];
  const total = 84;
  for (let i = 0; i < total; i++) {
    const type: "rent" | "sale" = i % 10 < 7 ? "rent" : "sale";
    const owner = i === 0 || i === 3 ? silan : i === 1 ? zeynep : agents[(i * 7) % agents.length]!;
    const input = buildPortfolio(i, type);
    const p = await createPortfolio(owner, input);
    created.push({ id: p.id, type, owner, price: input.price });
  }

  // Kontratlar: son 12 aya yayılmış; yaklaşık üçte biri çapraz işlem.
  const months = lastMonths(12);
  const today = todayISO();
  const dateIn = (monthIndex: number): string => {
    const m = months[monthIndex]!;
    const lastDay = monthIndex === months.length - 1 ? Number(today.slice(8, 10)) : 28;
    return `${m.key}-${String(between(1, Math.max(1, lastDay))).padStart(2, "0")}`;
  };
  const dealPlan: number[] = [];
  months.forEach((_, mi) => {
    const count = mi === months.length - 1 ? 9 : between(2, 5);
    for (let k = 0; k < count; k++) dealPlan.push(mi);
  });

  const commissionFor = (c: Created) =>
    c.type === "rent" ? c.price : Math.round((c.price * between(20, 40)) / 1000 / 100) * 100;

  // Senaryo: Şilan'ın portföyünü başka ekipten Zeynep kiralıyor (bu ay).
  const scenario = created[0]!;
  await createDeal(zeynep, {
    type: scenario.type,
    portfolioId: scenario.id,
    contractDate: today,
    price: scenario.price,
    commission: commissionFor(scenario),
    closingAgentId: null,
    customerName: "Selin Aydoğan",
    notes: null,
    listingSharePct: null,
    manual: null,
  });

  const available = created.slice(4);
  let cursor = 0;
  for (const monthIndex of dealPlan) {
    const target = available[cursor++];
    if (!target) break;
    const roll = rand();
    let closer = target.owner;
    if (roll < 0.2) {
      closer = pick(agents.filter((a) => a.teamId !== target.owner.teamId));
    } else if (roll < 0.33) {
      closer = pick(agents.filter((a) => a.teamId === target.owner.teamId && a.id !== target.owner.id));
    }
    await createDeal(closer, {
      type: target.type,
      portfolioId: target.id,
      contractDate: dateIn(monthIndex),
      price: target.price,
      commission: commissionFor(target),
      closingAgentId: null,
      customerName: pick(CUSTOMERS),
      notes: null,
      listingSharePct: null,
      manual: null,
    });
  }

  // Kalan portföylerden birkaçı: kapora alındı / pasif.
  const rest = available.slice(cursor);
  for (const [i, p] of rest.entries()) {
    if (i % 6 === 0) {
      const other = pick(agents.filter((a) => a.id !== p.owner.id));
      await setPortfolioStatus(i % 12 === 0 ? other : p.owner, p.id, "deposit", `Müşteri: ${pick(CUSTOMERS)}`);
    } else if (i % 17 === 5) {
      await setPortfolioStatus(p.owner, p.id, "inactive", "Mal sahibi kiralamaktan vazgeçti");
    }
  }

  // Kayıtsız portföy uyarıları.
  await createDeal(zeynep, {
    type: "rent",
    portfolioId: null,
    contractDate: today,
    price: 62_000_00,
    commission: 62_000_00,
    closingAgentId: null,
    customerName: "Onur Kılıç",
    notes: null,
    listingSharePct: null,
    manual: { city: "İstanbul", district: "Üsküdar", neighborhood: "Acıbadem", complexName: "Panorama Evleri", block: "C", unitNo: "214" },
  });
  // Site adı farklı yazıldığı için eşleşmeyen kontrat: benzer kayıt önerisi çıkar.
  const typoTarget = rest.find((p) => p.type === "rent" && p.owner.id !== zeynep.id);
  if (typoTarget) {
    const [row] = await db.select().from(portfolios).where(eq(portfolios.id, typoTarget.id)).limit(1);
    if (row && (row.status === "available" || row.status === "deposit")) {
      await createDeal(byName.get("Can Bozkurt")!, {
        type: "rent",
        portfolioId: null,
        contractDate: today,
        price: row.price,
        commission: row.price,
        closingAgentId: null,
        customerName: "Deniz Erdem",
        notes: null,
        listingSharePct: null,
        manual: {
          city: row.city,
          district: row.district,
          neighborhood: row.neighborhood,
          complexName: `${row.complexName} 2. Etap`,
          block: row.block,
          unitNo: row.unitNo,
        },
      });
    }
  }
  // Daha önce açıklamayla kapatılmış bir uyarı.
  await createDeal(byName.get("Gökhan Eren")!, {
    type: "sale",
    portfolioId: null,
    contractDate: dateIn(months.length - 2),
    price: 14_500_000_00,
    commission: 290_000_00,
    closingAgentId: null,
    customerName: "Tolga Bulut",
    notes: null,
    listingSharePct: null,
    manual: { city: "İstanbul", district: "Beşiktaş", neighborhood: "Levent", complexName: "Levent Konakları", block: null, unitNo: "3" },
  });
  const openAlerts = await listAlerts(sultan, "open");
  const old = openAlerts.find((a) => a.deal.complexName === "Levent Konakları");
  if (old) await dismissAlert(sultan, old.id, "Danışmanla görüşüldü; mal sahibi yakını, portföy sonradan girilecekti.");

  // Giriş onayı bekleyen iki yeni kayıt.
  await registerUser({ name: "Yağmur Özdemir", email: `yagmur.ozdemir@${RW_DOMAIN}`, phone: "0532 555 01 01", password: DEMO_PASSWORD });
  await registerUser({ name: "Deniz Korkmaz", email: `deniz.korkmaz@${RW_DOMAIN}`, phone: null, password: DEMO_PASSWORD });

  return { sultan, silan, zeynep, leader: byName.get("Kerem Aydın")! };
}

async function seedOther(passwordHash: string) {
  const office = await createOfficeRow("Remax Demo Ofis", OTHER_DOMAIN);
  const manager = await addUser(office, passwordHash, { name: "Hakan Demir", role: "manager", teamId: null });
  const [team] = await db.insert(teams).values({ officeId: office.id, name: "Merkez Ekip" }).returning();
  const names = ["Leyla Tan", "Koray Ünal", "Esra Çetin", "Yusuf Altın"];
  const agents: Viewer[] = [];
  for (const [i, name] of names.entries()) {
    agents.push(await addUser(office, passwordHash, { name, role: i === 0 ? "leader" : "agent", teamId: team!.id }));
  }
  for (let i = 0; i < 9; i++) {
    const owner = agents[i % agents.length]!;
    const type: "rent" | "sale" = i % 3 === 2 ? "sale" : "rent";
    const input = buildPortfolio(200 + i, type);
    const p = await createPortfolio(owner, input);
    if (i < 3) {
      await createDeal(i === 1 ? agents[(i + 1) % agents.length]! : owner, {
        type,
        portfolioId: p.id,
        contractDate: todayISO(),
        price: input.price,
        commission: type === "rent" ? input.price : Math.round(input.price * 0.03),
        closingAgentId: null,
        customerName: pick(CUSTOMERS),
        notes: null,
        listingSharePct: null,
        manual: null,
      });
    }
  }
  return { manager };
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Demo verisi canlı ortamda yüklenmez. Bilerek yüklemek için ALLOW_DEMO_SEED=1 verin.");
  }
  if ((await officeExists(RW_DOMAIN)) || (await officeExists(OTHER_DOMAIN))) {
    console.log("Demo ofisleri zaten var; hiçbir şey değiştirilmedi.");
    return;
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const rw = await seedRw(passwordHash);
  const other = await seedOther(passwordHash);

  console.log("\nDemo verisi yüklendi. Tüm demo hesaplarının şifresi:", DEMO_PASSWORD);
  console.log("  Üst yönetici (RW) :", rw.sultan.email);
  console.log("  Ekip lideri (RW)  :", rw.leader.email);
  console.log("  Danışman (RW)     :", rw.silan.email, "/", rw.zeynep.email);
  console.log("  Diğer ofis        :", other.manager.email);
}

main()
  .catch((err) => {
    console.error("Demo verisi yüklenemedi:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
