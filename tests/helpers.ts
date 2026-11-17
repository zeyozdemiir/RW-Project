import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { offices, officeDomains, teams, users, type UserRole, type UserStatus } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import type { Viewer } from "@/lib/domain/permissions";
import type { DealInput, PortfolioInput } from "@/lib/validation";

export const TEST_PASSWORD = "Deneme1234";
let cachedHash: Promise<string> | null = null;
function testHash(): Promise<string> {
  cachedHash ??= hashPassword(TEST_PASSWORD);
  return cachedHash;
}

let seq = 0;
export function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq}`;
}

export async function makeOffice(name = "Test Ofis"): Promise<{ id: string; domain: string }> {
  const domain = `${uniq("ofis")}.com`;
  const [office] = await db.insert(offices).values({ name }).returning();
  await db.insert(officeDomains).values({ domain, officeId: office!.id });
  return { id: office!.id, domain };
}

export async function makeTeam(officeId: string, name: string): Promise<string> {
  const [team] = await db.insert(teams).values({ officeId, name }).returning();
  return team!.id;
}

export async function makeUser(
  office: { id: string; domain: string },
  opts: { name: string; role?: UserRole; teamId?: string | null; status?: UserStatus; agentRatePct?: number | null },
): Promise<Viewer> {
  const email = `${uniq("u")}@${office.domain}`;
  const [user] = await db
    .insert(users)
    .values({
      officeId: office.id,
      email,
      name: opts.name,
      passwordHash: await testHash(),
      role: opts.role ?? "agent",
      status: opts.status ?? "active",
      teamId: opts.teamId ?? null,
      agentRatePct: opts.agentRatePct ?? null,
    })
    .returning();
  return {
    id: user!.id,
    officeId: office.id,
    role: user!.role === "manager" ? "manager" : user!.role === "leader" ? "leader" : "agent",
    teamId: user!.teamId,
    name: user!.name,
    email,
  };
}

export async function userRow(id: string) {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row!;
}

export function portfolioInput(overrides: Partial<PortfolioInput> = {}): PortfolioInput {
  return {
    listingType: "rent",
    propertyType: "daire",
    title: "Deniz manzaralı 3+1",
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Göztepe",
    complexName: "Nida Park Sitesi",
    block: "B",
    floor: "4",
    unitNo: "12",
    rooms: "3+1",
    grossM2: 140,
    netM2: 120,
    buildingAge: 5,
    furnished: false,
    price: 45_000_00,
    ownerName: "Mehmet Kaya",
    ownerPhone: "0532 000 00 00",
    listingUrl: null,
    notes: null,
    agentId: null,
    ...overrides,
  };
}

export function dealInput(overrides: Partial<DealInput> = {}): DealInput {
  return {
    type: "rent",
    portfolioId: null,
    contractDate: "2026-11-10",
    price: 45_000_00,
    commission: 45_000_00,
    closingAgentId: null,
    customerName: "Ayşe Demir",
    notes: null,
    listingSharePct: null,
    manual: null,
    ...overrides,
  };
}

/** RW Pozitif benzeri kurulum: 1 üst yönetici, 3 ekip, her ekipte lider ve danışmanlar. */
export async function makeRwOffice() {
  const office = await makeOffice("Realty World Pozitif");
  const teamA = await makeTeam(office.id, "Ekip A");
  const teamB = await makeTeam(office.id, "Ekip B");
  const teamC = await makeTeam(office.id, "Ekip C");
  const sultan = await makeUser(office, { name: "Sultan Yönetici", role: "manager" });
  const liderA = await makeUser(office, { name: "Lider A", role: "leader", teamId: teamA });
  const liderB = await makeUser(office, { name: "Lider B", role: "leader", teamId: teamB });
  const silan = await makeUser(office, { name: "Şilan Danışman", teamId: teamA });
  const zeynep = await makeUser(office, { name: "Zeynep Danışman", teamId: teamB });
  const elif = await makeUser(office, { name: "Elif Danışman", teamId: teamA });
  const can = await makeUser(office, { name: "Can Danışman", teamId: teamC });
  return { office, teamA, teamB, teamC, sultan, liderA, liderB, silan, zeynep, elif, can };
}
