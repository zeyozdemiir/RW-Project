import { and, asc, count, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type DbOrTx } from "@/lib/db";
import {
  deals,
  offices,
  portfolios,
  teams,
  users,
  type DealStatus,
  type DealType,
  type ListingType,
  type Portfolio,
  type PortfolioStatus,
} from "@/lib/db/schema";
import { ServiceError, forbidden, notFound } from "@/lib/errors";
import { LISTING_LABELS, STATUS_LABELS } from "@/lib/domain/labels";
import { parseListingUrl } from "@/lib/domain/listing-url";
import { buildMatchKey, buildSearchText, foldTr } from "@/lib/domain/normalize";
import {
  allowedStatusChanges,
  canAssignPortfolioTo,
  canManagePortfolio,
  canSeeOwnerContact,
  type Viewer,
} from "@/lib/domain/permissions";
import type { PortfolioInput } from "@/lib/validation";
import { listActivity, logActivity, type ActivityRow } from "./activity";

export const ACTIVE_STATUSES: PortfolioStatus[] = ["available", "deposit"];

async function loadAgent(
  tx: DbOrTx,
  officeId: string,
  agentId: string,
): Promise<{ id: string; name: string; teamId: string | null }> {
  const [agent] = await tx
    .select({ id: users.id, name: users.name, teamId: users.teamId, status: users.status })
    .from(users)
    .where(and(eq(users.id, agentId), eq(users.officeId, officeId)))
    .limit(1);
  if (!agent || agent.status !== "active") throw new ServiceError("Seçilen danışman bulunamadı.");
  return agent;
}

/**
 * Ofis satırını kilitler. Portföy ve kontrat yazan tüm işlemler önce bu kilidi
 * alır; böylece kilit sırası hep aynıdır (ofis → portföy) ve aynı daire için
 * eşzamanlı çift kayıt ya da çift kontrat oluşamaz.
 */
export async function lockOffice(tx: DbOrTx, officeId: string): Promise<void> {
  const rows = await tx.select({ id: offices.id }).from(offices).where(eq(offices.id, officeId)).for("update");
  if (rows.length === 0) throw notFound("Ofis bulunamadı.");
}

/** Ofis içinde sıradaki portföy numarasını alır (satır kilidiyle, çakışmasız). */
export async function nextPortfolioRef(tx: DbOrTx, officeId: string): Promise<number> {
  const [row] = await tx
    .update(offices)
    .set({ portfolioSeq: sql`${offices.portfolioSeq} + 1` })
    .where(eq(offices.id, officeId))
    .returning({ seq: offices.portfolioSeq });
  if (!row) throw notFound("Ofis bulunamadı.");
  return row.seq;
}

/**
 * Aynı daire için aynı türde (kiralık/satılık) ikinci bir aktif portföy açılamaz.
 * Bu, bir danışmanın başkasının portföyünü kopyalayıp sahiplenmesini önler.
 */
export async function assertNoActiveDuplicate(
  tx: DbOrTx,
  officeId: string,
  matchKey: string,
  type: ListingType,
  exceptId?: string,
): Promise<void> {
  const conditions: SQL[] = [
    eq(portfolios.officeId, officeId),
    eq(portfolios.matchKey, matchKey),
    eq(portfolios.listingType, type),
    inArray(portfolios.status, ACTIVE_STATUSES),
  ];
  if (exceptId) conditions.push(ne(portfolios.id, exceptId));
  const [dup] = await tx
    .select({ refNo: portfolios.refNo, agentName: users.name })
    .from(portfolios)
    .innerJoin(users, eq(users.id, portfolios.agentId))
    .where(and(...conditions))
    .limit(1);
  if (dup) {
    throw new ServiceError(
      `Bu daire zaten ${LISTING_LABELS[type].toLocaleLowerCase("tr-TR")} olarak kayıtlı: Portföy #${dup.refNo} (${dup.agentName}).`,
      "duplicate",
    );
  }
}

function resolveListingUrl(raw: string | null): string | null {
  const parsed = parseListingUrl(raw);
  if (!parsed.ok) throw new ServiceError(parsed.error, "listing_url");
  return parsed.url;
}

function derivedColumns(input: PortfolioInput, refNo: number) {
  return {
    matchKey: buildMatchKey(input),
    searchText: buildSearchText([
      `#${refNo}`,
      input.title,
      input.complexName,
      input.neighborhood,
      input.district,
      input.city,
      input.rooms,
      input.block,
      input.unitNo,
    ]),
  };
}

function editableColumns(input: PortfolioInput) {
  return {
    listingType: input.listingType,
    propertyType: input.propertyType,
    title: input.title,
    city: input.city,
    district: input.district,
    neighborhood: input.neighborhood,
    complexName: input.complexName,
    block: input.block,
    floor: input.floor,
    unitNo: input.unitNo,
    rooms: input.rooms,
    grossM2: input.grossM2,
    netM2: input.netM2,
    buildingAge: input.buildingAge,
    furnished: input.furnished,
    price: input.price,
    ownerName: input.ownerName,
    ownerPhone: input.ownerPhone,
    notes: input.notes,
  };
}

export async function createPortfolio(viewer: Viewer, input: PortfolioInput): Promise<Portfolio> {
  const listingUrl = resolveListingUrl(input.listingUrl);
  return db.transaction(async (tx) => {
    const agent = await loadAgent(tx, viewer.officeId, input.agentId ?? viewer.id);
    if (!canAssignPortfolioTo(viewer, agent)) {
      throw forbidden("Bu danışman adına portföy ekleme yetkiniz yok.");
    }
    // Numara alımı ofis satırını kilitler (bkz. lockOffice).
    const refNo = await nextPortfolioRef(tx, viewer.officeId);
    const derived = derivedColumns(input, refNo);
    await assertNoActiveDuplicate(tx, viewer.officeId, derived.matchKey, input.listingType);

    const [created] = await tx
      .insert(portfolios)
      .values({
        ...editableColumns(input),
        ...derived,
        officeId: viewer.officeId,
        refNo,
        agentId: agent.id,
        listingUrl,
        status: "available",
        statusChangedById: viewer.id,
        createdById: viewer.id,
      })
      .returning();
    if (!created) throw new Error("Portföy oluşturulamadı.");

    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "portfolio",
      entityId: created.id,
      action: "portfolio.created",
      summary:
        agent.id === viewer.id
          ? "Portföy eklendi."
          : `Portföy ${agent.name} adına eklendi.`,
    });
    return created;
  });
}

export type PortfolioWithTeam = Portfolio & { agentTeamId: string | null; agentName: string };

/** Çağıran, önce `lockOffice` ile ofis satırını kilitlemiş olmalıdır. */
export async function loadPortfolioForUpdate(tx: DbOrTx, officeId: string, id: string): Promise<PortfolioWithTeam> {
  const [row] = await tx
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, id), eq(portfolios.officeId, officeId)))
    .for("update")
    .limit(1);
  if (!row) throw notFound("Portföy bulunamadı.");
  const [agent] = await tx
    .select({ teamId: users.teamId, name: users.name })
    .from(users)
    .where(eq(users.id, row.agentId))
    .limit(1);
  return { ...row, agentTeamId: agent?.teamId ?? null, agentName: agent?.name ?? "" };
}

export async function updatePortfolio(viewer: Viewer, id: string, input: PortfolioInput): Promise<Portfolio> {
  const listingUrl = resolveListingUrl(input.listingUrl);
  return db.transaction(async (tx) => {
    await lockOffice(tx, viewer.officeId);
    const current = await loadPortfolioForUpdate(tx, viewer.officeId, id);
    if (!canManagePortfolio(viewer, current)) {
      throw forbidden("Bu portföyü düzenleme yetkiniz yok.");
    }

    let agentId = current.agentId;
    let reassignedTo: string | null = null;
    if (input.agentId && input.agentId !== current.agentId) {
      const agent = await loadAgent(tx, viewer.officeId, input.agentId);
      if (!canAssignPortfolioTo(viewer, agent)) {
        throw forbidden("Portföyü bu danışmana devretme yetkiniz yok.");
      }
      agentId = agent.id;
      reassignedTo = agent.name;
    }

    const closed = current.status === "rented" || current.status === "sold";
    if (closed && input.listingType !== current.listingType) {
      throw new ServiceError("Kontratı yapılmış bir portföyün türü (kiralık/satılık) değiştirilemez.");
    }

    const derived = derivedColumns(input, current.refNo);
    if (ACTIVE_STATUSES.includes(current.status)) {
      await assertNoActiveDuplicate(tx, viewer.officeId, derived.matchKey, input.listingType, current.id);
    }

    const [updated] = await tx
      .update(portfolios)
      .set({ ...editableColumns(input), ...derived, agentId, listingUrl, updatedAt: new Date() })
      .where(eq(portfolios.id, current.id))
      .returning();
    if (!updated) throw new Error("Portföy güncellenemedi.");

    const changes: string[] = [];
    if (updated.price !== current.price) changes.push("fiyat");
    if (updated.matchKey !== current.matchKey) changes.push("adres");
    if (updated.listingUrl !== current.listingUrl) changes.push("ilan linki");
    if (reassignedTo) changes.push(`danışman → ${reassignedTo}`);
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "portfolio",
      entityId: current.id,
      action: reassignedTo ? "portfolio.reassigned" : "portfolio.updated",
      summary: changes.length > 0 ? `Portföy güncellendi (${changes.join(", ")}).` : "Portföy güncellendi.",
    });
    return updated;
  });
}

/** Elle durum değişikliği (kapora alındı, sunulabilir, pasif). */
export async function setPortfolioStatus(
  viewer: Viewer,
  id: string,
  next: PortfolioStatus,
  note: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockOffice(tx, viewer.officeId);
    const current = await loadPortfolioForUpdate(tx, viewer.officeId, id);
    if (current.status === next) return;
    if (!allowedStatusChanges(viewer, current).includes(next)) {
      throw forbidden("Bu durum değişikliği için yetkiniz yok.");
    }
    if (next === "available") {
      await assertNoActiveDuplicate(tx, viewer.officeId, current.matchKey, current.listingType, current.id);
    }
    await tx
      .update(portfolios)
      .set({
        status: next,
        statusChangedAt: new Date(),
        statusChangedById: viewer.id,
        statusNote: note,
        updatedAt: new Date(),
      })
      .where(eq(portfolios.id, current.id));
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "portfolio",
      entityId: current.id,
      action: `portfolio.status.${next}`,
      summary: `Durum: ${STATUS_LABELS[current.status]} → ${STATUS_LABELS[next]}${note ? ` — ${note}` : ""}`,
    });
  });
}

export type PortfolioFilters = {
  listingType?: ListingType;
  /** "active" = sunulabilir + kapora alındı */
  status?: PortfolioStatus | "active";
  q?: string;
  agentId?: string;
  teamId?: string;
  page?: number;
  pageSize?: number;
};

export type PortfolioRow = {
  id: string;
  refNo: number;
  title: string;
  listingType: ListingType;
  status: PortfolioStatus;
  propertyType: string;
  city: string;
  district: string;
  neighborhood: string | null;
  complexName: string;
  block: string | null;
  unitNo: string;
  rooms: string | null;
  grossM2: number | null;
  price: number;
  listingUrl: string | null;
  agentId: string;
  agentName: string;
  teamName: string | null;
  statusChangedAt: Date;
  createdAt: Date;
};

function likePattern(q: string): string {
  return `%${foldTr(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function baseFilters(officeId: string, f: PortfolioFilters): SQL[] {
  const conditions: SQL[] = [eq(portfolios.officeId, officeId)];
  if (f.listingType) conditions.push(eq(portfolios.listingType, f.listingType));
  if (f.agentId) conditions.push(eq(portfolios.agentId, f.agentId));
  if (f.teamId) conditions.push(eq(users.teamId, f.teamId));
  const q = f.q?.trim();
  if (q) {
    for (const word of q.split(/\s+/).slice(0, 6)) {
      conditions.push(sql`${portfolios.searchText} like ${likePattern(word)}`);
    }
  }
  return conditions;
}

function statusFilter(status: PortfolioFilters["status"]): SQL | null {
  if (!status) return null;
  if (status === "active") return inArray(portfolios.status, ACTIVE_STATUSES);
  return eq(portfolios.status, status);
}

export type PortfolioList = {
  rows: PortfolioRow[];
  total: number;
  page: number;
  pageCount: number;
  /** Durum filtresi dışındaki filtrelere göre, her durumdaki portföy sayısı. */
  statusCounts: Record<PortfolioStatus, number>;
};

/** Ofisteki herkes tüm portföyleri görür (mal sahibi bilgileri bu listede yer almaz). */
export async function listPortfolios(viewer: Viewer, filters: PortfolioFilters): Promise<PortfolioList> {
  const pageSize = Math.min(60, Math.max(1, filters.pageSize ?? 24));
  const base = baseFilters(viewer.officeId, filters);
  const status = statusFilter(filters.status);
  const where = and(...base, ...(status ? [status] : []));

  const [countRows, totalRows] = await Promise.all([
    db
      .select({ status: portfolios.status, n: count() })
      .from(portfolios)
      .innerJoin(users, eq(users.id, portfolios.agentId))
      .where(and(...base))
      .groupBy(portfolios.status),
    db
      .select({ n: count() })
      .from(portfolios)
      .innerJoin(users, eq(users.id, portfolios.agentId))
      .where(where),
  ]);

  const total = totalRows[0]?.n ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageCount, Math.max(1, filters.page ?? 1));

  const rows = await db
    .select({
      id: portfolios.id,
      refNo: portfolios.refNo,
      title: portfolios.title,
      listingType: portfolios.listingType,
      status: portfolios.status,
      propertyType: portfolios.propertyType,
      city: portfolios.city,
      district: portfolios.district,
      neighborhood: portfolios.neighborhood,
      complexName: portfolios.complexName,
      block: portfolios.block,
      unitNo: portfolios.unitNo,
      rooms: portfolios.rooms,
      grossM2: portfolios.grossM2,
      price: portfolios.price,
      listingUrl: portfolios.listingUrl,
      agentId: portfolios.agentId,
      agentName: users.name,
      teamName: teams.name,
      statusChangedAt: portfolios.statusChangedAt,
      createdAt: portfolios.createdAt,
    })
    .from(portfolios)
    .innerJoin(users, eq(users.id, portfolios.agentId))
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(where)
    .orderBy(desc(portfolios.createdAt), desc(portfolios.refNo))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const statusCounts: Record<PortfolioStatus, number> = {
    available: 0,
    deposit: 0,
    rented: 0,
    sold: 0,
    inactive: 0,
  };
  for (const r of countRows) statusCounts[r.status] = r.n;

  return { rows, total, page, pageCount, statusCounts };
}

export type PortfolioDeal = {
  id: string;
  refNo: number;
  type: DealType;
  status: DealStatus;
  contractDate: string;
  closingAgentId: string;
  closingAgentName: string;
};

export type PortfolioDetail = {
  portfolio: Portfolio;
  agentName: string;
  agentPhone: string | null;
  agentEmail: string;
  agentTeamId: string | null;
  teamName: string | null;
  statusChangedByName: string | null;
  canManage: boolean;
  canSeeOwner: boolean;
  statusOptions: PortfolioStatus[];
  deals: PortfolioDeal[];
  activity: ActivityRow[];
};

export async function getPortfolioDetail(viewer: Viewer, id: string): Promise<PortfolioDetail | null> {
  const statusUser = alias(users, "status_user");
  const [row] = await db
    .select({
      portfolio: portfolios,
      agentName: users.name,
      agentPhone: users.phone,
      agentEmail: users.email,
      agentTeamId: users.teamId,
      teamName: teams.name,
      statusChangedByName: statusUser.name,
    })
    .from(portfolios)
    .innerJoin(users, eq(users.id, portfolios.agentId))
    .leftJoin(teams, eq(teams.id, users.teamId))
    .leftJoin(statusUser, eq(statusUser.id, portfolios.statusChangedById))
    .where(and(eq(portfolios.id, id), eq(portfolios.officeId, viewer.officeId)))
    .limit(1);
  if (!row) return null;

  const owned = { agentId: row.portfolio.agentId, agentTeamId: row.agentTeamId };
  const canSeeOwner = canSeeOwnerContact(viewer, owned);
  const portfolio: Portfolio = canSeeOwner
    ? row.portfolio
    : { ...row.portfolio, ownerName: null, ownerPhone: null, notes: null };

  const [dealRows, activity] = await Promise.all([
    db
      .select({
        id: deals.id,
        refNo: deals.refNo,
        type: deals.type,
        status: deals.status,
        contractDate: deals.contractDate,
        closingAgentId: deals.closingAgentId,
        closingAgentName: users.name,
      })
      .from(deals)
      .innerJoin(users, eq(users.id, deals.closingAgentId))
      .where(and(eq(deals.officeId, viewer.officeId), eq(deals.portfolioId, id)))
      .orderBy(desc(deals.contractDate), desc(deals.refNo)),
    listActivity(viewer.officeId, "portfolio", id),
  ]);

  return {
    portfolio,
    agentName: row.agentName,
    agentPhone: row.agentPhone,
    agentEmail: row.agentEmail,
    agentTeamId: row.agentTeamId,
    teamName: row.teamName,
    statusChangedByName: row.statusChangedByName,
    canManage: canManagePortfolio(viewer, owned),
    canSeeOwner,
    statusOptions: allowedStatusChanges(viewer, {
      ...owned,
      status: row.portfolio.status,
      statusChangedById: row.portfolio.statusChangedById,
    }),
    deals: dealRows,
    activity,
  };
}

export type PortfolioOption = {
  id: string;
  refNo: number;
  title: string;
  listingType: ListingType;
  status: PortfolioStatus;
  city: string;
  district: string;
  neighborhood: string | null;
  complexName: string;
  block: string | null;
  unitNo: string;
  price: number;
  agentId: string;
  agentName: string;
  teamName: string | null;
};

const optionColumns = {
  id: portfolios.id,
  refNo: portfolios.refNo,
  title: portfolios.title,
  listingType: portfolios.listingType,
  status: portfolios.status,
  city: portfolios.city,
  district: portfolios.district,
  neighborhood: portfolios.neighborhood,
  complexName: portfolios.complexName,
  block: portfolios.block,
  unitNo: portfolios.unitNo,
  price: portfolios.price,
  agentId: portfolios.agentId,
  agentName: users.name,
  teamName: teams.name,
};

/** Kontrat formundaki portföy araması: yalnızca kontrata uygun (aktif) portföyler. */
export async function searchPortfoliosForDeal(
  viewer: Viewer,
  type: ListingType,
  q: string,
  limit = 12,
): Promise<PortfolioOption[]> {
  const conditions: SQL[] = [
    eq(portfolios.officeId, viewer.officeId),
    eq(portfolios.listingType, type),
    inArray(portfolios.status, ACTIVE_STATUSES),
  ];
  for (const word of q.trim().split(/\s+/).filter(Boolean).slice(0, 6)) {
    conditions.push(sql`${portfolios.searchText} like ${likePattern(word)}`);
  }
  return db
    .select(optionColumns)
    .from(portfolios)
    .innerJoin(users, eq(users.id, portfolios.agentId))
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(and(...conditions))
    // Önce danışmanın kendi portföyleri, sonra en yeniler.
    .orderBy(desc(sql`${portfolios.agentId} = ${viewer.id}`), desc(portfolios.createdAt))
    .limit(limit);
}

export async function getPortfolioOption(viewer: Viewer, id: string): Promise<PortfolioOption | null> {
  const [row] = await db
    .select(optionColumns)
    .from(portfolios)
    .innerJoin(users, eq(users.id, portfolios.agentId))
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(and(eq(portfolios.id, id), eq(portfolios.officeId, viewer.officeId)))
    .limit(1);
  return row ?? null;
}

/** Formlardaki otomatik tamamlama için ofiste kayıtlı site/bina adları. */
export async function listComplexNames(officeId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ name: portfolios.complexName })
    .from(portfolios)
    .where(eq(portfolios.officeId, officeId))
    .orderBy(asc(portfolios.complexName))
    .limit(500);
  return rows.map((r) => r.name);
}
