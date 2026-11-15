import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { deals, officeDomains, offices, portfolios, users, type Office, type User } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { destroyUserSessions } from "@/lib/auth/session";
import { ServiceError, forbidden, notFound } from "@/lib/errors";
import { PUBLIC_EMAIL_DOMAINS, emailDomain, normalizeDomain, normalizeEmail } from "@/lib/domain/normalize";
import { isManager, type Viewer } from "@/lib/domain/permissions";
import type { OfficeSettingsInput } from "@/lib/validation";
import { logActivity } from "./activity";

/** "a.com, b.com.tr" → ["a.com", "b.com.tr"]; geçersiz veya kişisel uzantıda hata verir. */
export function parseDomainList(raw: string): string[] {
  const out: string[] = [];
  for (const piece of raw.split(/[\s,;]+/).filter(Boolean)) {
    const domain = normalizeDomain(piece);
    if (!domain) throw new ServiceError(`"${piece}" geçerli bir e-posta uzantısı değil. Örnek: ofisiniz.com`);
    if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
      throw new ServiceError(
        `"${domain}" herkese açık bir e-posta sağlayıcısı; ofis uzantısı olarak kullanılamaz. Ofise ait kurumsal uzantıyı yazın.`,
      );
    }
    if (!out.includes(domain)) out.push(domain);
  }
  if (out.length === 0) throw new ServiceError("En az bir e-posta uzantısı yazın.");
  return out;
}

export async function findOfficeByEmail(email: string): Promise<Office | null> {
  const domain = emailDomain(normalizeEmail(email));
  if (!domain) return null;
  const rows = await db
    .select({ office: offices })
    .from(officeDomains)
    .innerJoin(offices, eq(offices.id, officeDomains.officeId))
    .where(eq(officeDomains.domain, domain))
    .limit(1);
  return rows[0]?.office ?? null;
}

export async function getOfficeDomains(officeId: string): Promise<string[]> {
  const rows = await db
    .select({ domain: officeDomains.domain })
    .from(officeDomains)
    .where(eq(officeDomains.officeId, officeId))
    .orderBy(officeDomains.domain);
  return rows.map((r) => r.domain);
}

async function assertDomainsFree(domains: string[], exceptOfficeId?: string): Promise<void> {
  const taken = await db
    .select({ domain: officeDomains.domain, officeId: officeDomains.officeId })
    .from(officeDomains)
    .where(inArray(officeDomains.domain, domains));
  const conflict = taken.find((t) => t.officeId !== exceptOfficeId);
  if (conflict) throw new ServiceError(`"${conflict.domain}" uzantısı başka bir ofise kayıtlı.`);
}

export type CreateOfficeInput = {
  name: string;
  domains: string[];
  managerName: string;
  managerEmail: string;
  managerPassword: string;
};

/**
 * Yeni ofis (kiracı) açar ve üst yöneticisinin hesabını geçici şifreyle oluşturur.
 * Üst yönetici ilk girişinde şifresini değiştirmek zorundadır.
 */
export async function createOffice(input: CreateOfficeInput): Promise<{ office: Office; manager: User }> {
  const email = normalizeEmail(input.managerEmail);
  const domain = emailDomain(email);
  if (!domain || !input.domains.includes(domain)) {
    throw new ServiceError("Üst yöneticinin e-postası ofisin e-posta uzantılarından biriyle bitmeli.");
  }
  await assertDomainsFree(input.domains);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) throw new ServiceError("Bu e-posta adresiyle zaten bir hesap var.");

  const passwordHash = await hashPassword(input.managerPassword);
  return db.transaction(async (tx) => {
    const [office] = await tx.insert(offices).values({ name: input.name }).returning();
    if (!office) throw new Error("Ofis oluşturulamadı.");
    await tx.insert(officeDomains).values(input.domains.map((d) => ({ domain: d, officeId: office.id })));
    const [manager] = await tx
      .insert(users)
      .values({
        officeId: office.id,
        email,
        name: input.managerName,
        passwordHash,
        role: "manager",
        status: "active",
        mustChangePassword: true,
        approvedAt: new Date(),
      })
      .returning();
    if (!manager) throw new Error("Yönetici oluşturulamadı.");
    await logActivity(tx, {
      officeId: office.id,
      actorId: null,
      entityType: "office",
      entityId: office.id,
      action: "office.created",
      summary: `Ofis oluşturuldu. Üst yönetici: ${manager.name}`,
    });
    return { office, manager };
  });
}

export type OfficeOverview = {
  office: Office;
  domains: string[];
  activeUsers: number;
  pendingUsers: number;
  portfolios: number;
  deals: number;
  managers: Array<{ id: string; name: string; email: string }>;
};

/** Platform paneli: tüm ofislerin özeti. */
export async function listOffices(): Promise<OfficeOverview[]> {
  const [officeRows, domainRows, userRows, portfolioRows, dealRows, managerRows] = await Promise.all([
    db.select().from(offices).orderBy(offices.createdAt),
    db.select().from(officeDomains).orderBy(officeDomains.domain),
    db
      .select({ officeId: users.officeId, status: users.status, n: count() })
      .from(users)
      .where(sql`${users.officeId} is not null`)
      .groupBy(users.officeId, users.status),
    db.select({ officeId: portfolios.officeId, n: count() }).from(portfolios).groupBy(portfolios.officeId),
    db
      .select({ officeId: deals.officeId, n: count() })
      .from(deals)
      .where(eq(deals.status, "active"))
      .groupBy(deals.officeId),
    db
      .select({ id: users.id, officeId: users.officeId, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.role, "manager"), eq(users.status, "active")))
      .orderBy(users.createdAt),
  ]);

  return officeRows.map((office) => ({
    office,
    domains: domainRows.filter((d) => d.officeId === office.id).map((d) => d.domain),
    activeUsers: userRows.find((u) => u.officeId === office.id && u.status === "active")?.n ?? 0,
    pendingUsers: userRows.find((u) => u.officeId === office.id && u.status === "pending")?.n ?? 0,
    portfolios: portfolioRows.find((p) => p.officeId === office.id)?.n ?? 0,
    deals: dealRows.find((d) => d.officeId === office.id)?.n ?? 0,
    managers: managerRows
      .filter((m) => m.officeId === office.id)
      .map((m) => ({ id: m.id, name: m.name, email: m.email })),
  }));
}

export async function setOfficeActive(officeId: string, active: boolean): Promise<void> {
  const updated = await db
    .update(offices)
    .set({ isActive: active })
    .where(eq(offices.id, officeId))
    .returning({ id: offices.id });
  if (updated.length === 0) throw notFound("Ofis bulunamadı.");
}

export async function addOfficeDomains(officeId: string, domains: string[]): Promise<void> {
  const office = await db.select({ id: offices.id }).from(offices).where(eq(offices.id, officeId)).limit(1);
  if (office.length === 0) throw notFound("Ofis bulunamadı.");
  await assertDomainsFree(domains, officeId);
  await db
    .insert(officeDomains)
    .values(domains.map((d) => ({ domain: d, officeId })))
    .onConflictDoNothing();
}

export async function removeOfficeDomain(officeId: string, domain: string): Promise<void> {
  const current = await getOfficeDomains(officeId);
  if (!current.includes(domain)) throw notFound("Uzantı bulunamadı.");
  if (current.length === 1) throw new ServiceError("Ofisin en az bir e-posta uzantısı olmalı.");
  await db.delete(officeDomains).where(and(eq(officeDomains.officeId, officeId), eq(officeDomains.domain, domain)));
}

/** Platform yöneticisi, bir ofisin üst yöneticisinin şifresini sıfırlar. */
export async function platformResetManagerPassword(userId: string, tempPassword: string): Promise<User> {
  const passwordHash = await hashPassword(tempPassword);
  const [updated] = await db
    .update(users)
    .set({ passwordHash, mustChangePassword: true })
    .where(and(eq(users.id, userId), eq(users.role, "manager")))
    .returning();
  if (!updated) throw notFound("Yönetici bulunamadı.");
  await destroyUserSessions(userId);
  return updated;
}

export async function updateOfficeSettings(viewer: Viewer, input: OfficeSettingsInput): Promise<void> {
  if (!isManager(viewer)) throw forbidden();
  await db.transaction(async (tx) => {
    await tx
      .update(offices)
      .set({ name: input.name, agentRatePct: input.agentRatePct, listingSharePct: input.listingSharePct })
      .where(eq(offices.id, viewer.officeId));
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "office",
      entityId: viewer.officeId,
      action: "office.settings",
      summary: `Ofis ayarları güncellendi (danışman payı %${input.agentRatePct}, çapraz işlem portföy payı %${input.listingSharePct}).`,
    });
  });
}
