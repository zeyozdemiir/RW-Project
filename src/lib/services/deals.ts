import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type DbOrTx } from "@/lib/db";
import {
  alerts,
  deals,
  offices,
  portfolios,
  teams,
  users,
  type Deal,
  type DealStatus,
  type DealType,
  type Office,
} from "@/lib/db/schema";
import { ServiceError, forbidden, notFound } from "@/lib/errors";
import { computeCommission } from "@/lib/domain/commission";
import { DEAL_LABELS, LISTING_LABELS, STATUS_LABELS, unitLabel } from "@/lib/domain/labels";
import { buildMatchKey, foldTr } from "@/lib/domain/normalize";
import {
  canCreateDealFor,
  canViewDeal,
  canViewEarningsOf,
  isManager,
  type Viewer,
} from "@/lib/domain/permissions";
import type { DealInput } from "@/lib/validation";
import { listActivity, logActivity, type ActivityRow } from "./activity";
import {
  ACTIVE_STATUSES,
  assertNoActiveDuplicate,
  loadPortfolioForUpdate,
  lockOffice,
  type PortfolioWithTeam,
} from "./portfolios";

type AgentInfo = { id: string; name: string; teamId: string | null; agentRatePct: number | null };

async function loadAgentInfo(tx: DbOrTx, officeId: string, agentId: string, mustBeActive: boolean): Promise<AgentInfo> {
  const [agent] = await tx
    .select({
      id: users.id,
      name: users.name,
      teamId: users.teamId,
      agentRatePct: users.agentRatePct,
      status: users.status,
    })
    .from(users)
    .where(and(eq(users.id, agentId), eq(users.officeId, officeId)))
    .limit(1);
  if (!agent || (mustBeActive && agent.status !== "active")) {
    throw new ServiceError("Seçilen danışman bulunamadı.");
  }
  return agent;
}

async function nextDealRef(tx: DbOrTx, officeId: string): Promise<Office> {
  const [office] = await tx
    .update(offices)
    .set({ dealSeq: sql`${offices.dealSeq} + 1` })
    .where(eq(offices.id, officeId))
    .returning();
  if (!office) throw notFound("Ofis bulunamadı.");
  return office;
}

function closedStatusFor(type: DealType): "rented" | "sold" {
  return type === "rent" ? "rented" : "sold";
}

export type CreateDealResult = {
  deal: Deal;
  /** Kontrattaki daire sistemde kayıtlı değildi; üst yönetime uyarı gitti. */
  unregistered: boolean;
  /** Daire elle yazıldı ama sistemdeki bir portföyle eşleşti. */
  autoLinked: boolean;
  isCross: boolean;
  isCrossTeam: boolean;
  listingAgentName: string | null;
  portfolioRefNo: number | null;
};

/**
 * Kontrat (kiralama / satış) kaydı.
 *
 * 1. Kontrattaki daire sistemdeki bir portföyle eşleşiyorsa işlem o portföye
 *    bağlanır ve portföy "Kiralandı" / "Satıldı" olur. Portföy başka bir
 *    danışmana aitse işlem çapraz işlem olarak kaydedilir ve ciro paylaşılır.
 * 2. Eşleşen portföy yoksa kontrat yine kaydedilir ama üst yönetime
 *    "kayıtsız portföy" uyarısı açılır.
 */
export async function createDeal(viewer: Viewer, input: DealInput): Promise<CreateDealResult> {
  return db.transaction(async (tx) => {
    // Ofis satırı kilitlenir: aynı daire için eşzamanlı iki kontrat girilemez.
    const office = await nextDealRef(tx, viewer.officeId);
    const refNo = office.dealSeq;

    const closing = await loadAgentInfo(tx, viewer.officeId, input.closingAgentId ?? viewer.id, true);
    if (!canCreateDealFor(viewer, closing)) {
      throw forbidden("Bu danışman adına kontrat girme yetkiniz yok.");
    }

    let portfolio: PortfolioWithTeam | null = null;
    let autoLinked = false;

    if (input.portfolioId) {
      portfolio = await loadPortfolioForUpdate(tx, viewer.officeId, input.portfolioId);
      if (portfolio.listingType !== input.type) {
        throw new ServiceError(
          `Bu portföy ${LISTING_LABELS[portfolio.listingType].toLocaleLowerCase("tr-TR")} olarak kayıtlı; ${DEAL_LABELS[input.type].toLocaleLowerCase("tr-TR")} kontratı girilemez.`,
        );
      }
      if (!ACTIVE_STATUSES.includes(portfolio.status)) {
        throw new ServiceError(
          `Bu portföy "${STATUS_LABELS[portfolio.status]}" durumunda; yeni kontrat girilemez.`,
        );
      }
    } else {
      if (!input.manual) {
        throw new ServiceError("Listeden bir portföy seçin veya kontrattaki daire bilgilerini yazın.");
      }
      const key = buildMatchKey(input.manual);
      const [match] = await tx
        .select({ id: portfolios.id })
        .from(portfolios)
        .where(
          and(
            eq(portfolios.officeId, viewer.officeId),
            eq(portfolios.matchKey, key),
            eq(portfolios.listingType, input.type),
            inArray(portfolios.status, ACTIVE_STATUSES),
          ),
        )
        .orderBy(asc(portfolios.createdAt))
        .limit(1);
      if (match) {
        portfolio = await loadPortfolioForUpdate(tx, viewer.officeId, match.id);
        autoLinked = true;
      }
    }

    const address = input.manual ?? {
      city: portfolio!.city,
      district: portfolio!.district,
      neighborhood: portfolio!.neighborhood,
      complexName: portfolio!.complexName,
      block: portfolio!.block,
      unitNo: portfolio!.unitNo,
    };

    const listing = portfolio ? await loadAgentInfo(tx, viewer.officeId, portfolio.agentId, false) : null;
    const customShare = isManager(viewer) && input.listingSharePct !== null && input.listingSharePct !== undefined;
    const split = computeCommission({
      commission: input.commission,
      closingAgentId: closing.id,
      closingRatePct: closing.agentRatePct ?? office.agentRatePct,
      listingAgentId: listing?.id ?? null,
      listingRatePct: listing?.agentRatePct ?? office.agentRatePct,
      listingSharePct: customShare ? input.listingSharePct! : office.listingSharePct,
    });

    const [deal] = await tx
      .insert(deals)
      .values({
        officeId: viewer.officeId,
        refNo,
        type: input.type,
        portfolioId: portfolio?.id ?? null,
        city: address.city,
        district: address.district,
        neighborhood: address.neighborhood,
        complexName: address.complexName,
        block: address.block,
        unitNo: address.unitNo,
        matchKey: buildMatchKey(address),
        contractDate: input.contractDate,
        price: input.price,
        commission: input.commission,
        closingAgentId: closing.id,
        closingTeamId: closing.teamId,
        listingAgentId: listing?.id ?? null,
        listingTeamId: listing?.teamId ?? null,
        listingSharePct: split.listingSharePct,
        closingAgentRevenue: split.closingAgentRevenue,
        listingAgentRevenue: split.listingAgentRevenue,
        closingAgentRatePct: split.closingAgentRatePct,
        listingAgentRatePct: split.listingAgentRatePct,
        closingAgentEarning: split.closingAgentEarning,
        listingAgentEarning: split.listingAgentEarning,
        officeEarning: split.officeEarning,
        customerName: input.customerName,
        notes: input.notes,
        wasUnregistered: portfolio === null,
        createdById: viewer.id,
      })
      .returning();
    if (!deal) throw new Error("Kontrat kaydedilemedi.");

    const where = unitLabel(address);
    if (portfolio) {
      const closed = closedStatusFor(input.type);
      await tx
        .update(portfolios)
        .set({
          status: closed,
          statusChangedAt: new Date(),
          statusChangedById: viewer.id,
          statusNote: `Kontrat K-${refNo}`,
          updatedAt: new Date(),
        })
        .where(eq(portfolios.id, portfolio.id));
      await logActivity(tx, {
        officeId: viewer.officeId,
        actorId: viewer.id,
        entityType: "portfolio",
        entityId: portfolio.id,
        action: `portfolio.status.${closed}`,
        summary: `${STATUS_LABELS[closed]}: ${closing.name} tarafından (Kontrat K-${refNo}).`,
        meta: { dealId: deal.id },
      });
    } else {
      await tx.insert(alerts).values({
        officeId: viewer.officeId,
        type: "unregistered_portfolio",
        dealId: deal.id,
      });
    }

    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "deal",
      entityId: deal.id,
      action: "deal.created",
      summary: portfolio
        ? `${DEAL_LABELS[input.type]} kontratı girildi: ${where} (Portföy #${portfolio.refNo}).`
        : `${DEAL_LABELS[input.type]} kontratı girildi: ${where} — sistemde kayıtlı portföy bulunamadı, üst yönetime uyarı gönderildi.`,
    });

    return {
      deal,
      unregistered: portfolio === null,
      autoLinked,
      isCross: split.isCross,
      isCrossTeam: split.isCross && closing.teamId !== (listing?.teamId ?? null),
      listingAgentName: split.isCross ? (listing?.name ?? null) : null,
      portfolioRefNo: portfolio?.refNo ?? null,
    };
  });
}

/**
 * Kontratı sonradan bir portföye bağlar (kayıtsız portföy uyarısı çözülürken).
 * Ciro paylaşımı portföy sahibine göre yeniden hesaplanır.
 * Çağıran, işlem içinde ofis satırını kilitlemiş olmalıdır.
 */
export async function linkDealToPortfolio(
  tx: DbOrTx,
  viewer: Viewer,
  office: Office,
  deal: Deal,
  portfolio: PortfolioWithTeam,
): Promise<void> {
  if (portfolio.listingType !== deal.type) {
    throw new ServiceError(
      `Bu portföy ${LISTING_LABELS[portfolio.listingType].toLocaleLowerCase("tr-TR")} olarak kayıtlı; ${DEAL_LABELS[deal.type].toLocaleLowerCase("tr-TR")} kontratına bağlanamaz.`,
    );
  }
  if (portfolio.status === "rented" || portfolio.status === "sold") {
    throw new ServiceError("Bu portföy başka bir kontratla kapatılmış; önce durumunu güncelleyin.");
  }

  const closing = await loadAgentInfo(tx, viewer.officeId, deal.closingAgentId, false);
  const listing = await loadAgentInfo(tx, viewer.officeId, portfolio.agentId, false);
  const split = computeCommission({
    commission: deal.commission,
    closingAgentId: deal.closingAgentId,
    closingRatePct: deal.closingAgentRatePct,
    listingAgentId: listing.id,
    listingRatePct: listing.agentRatePct ?? office.agentRatePct,
    listingSharePct: office.listingSharePct,
  });

  await tx
    .update(deals)
    .set({
      portfolioId: portfolio.id,
      listingAgentId: listing.id,
      listingTeamId: listing.teamId,
      listingSharePct: split.listingSharePct,
      closingAgentRevenue: split.closingAgentRevenue,
      listingAgentRevenue: split.listingAgentRevenue,
      listingAgentRatePct: split.listingAgentRatePct,
      closingAgentEarning: split.closingAgentEarning,
      listingAgentEarning: split.listingAgentEarning,
      officeEarning: split.officeEarning,
    })
    .where(eq(deals.id, deal.id));

  const closed = closedStatusFor(deal.type);
  await tx
    .update(portfolios)
    .set({
      status: closed,
      statusChangedAt: new Date(),
      statusChangedById: viewer.id,
      statusNote: `Kontrat K-${deal.refNo}`,
      updatedAt: new Date(),
    })
    .where(eq(portfolios.id, portfolio.id));

  await logActivity(tx, {
    officeId: viewer.officeId,
    actorId: viewer.id,
    entityType: "portfolio",
    entityId: portfolio.id,
    action: `portfolio.status.${closed}`,
    summary: `${STATUS_LABELS[closed]}: ${closing.name} tarafından (Kontrat K-${deal.refNo}).`,
    meta: { dealId: deal.id },
  });
  await logActivity(tx, {
    officeId: viewer.officeId,
    actorId: viewer.id,
    entityType: "deal",
    entityId: deal.id,
    action: "deal.linked",
    summary: `Kontrat Portföy #${portfolio.refNo} (${listing.name}) ile eşleştirildi.`,
  });
}

/** Kontrat iptali: kayıt silinmez, sayım ve ciroya dahil edilmez; portföy yeniden yayına döner. */
export async function cancelDeal(viewer: Viewer, dealId: string, reason: string | null): Promise<void> {
  if (!isManager(viewer)) throw forbidden("Kontratı yalnızca üst yönetici iptal edebilir.");
  await db.transaction(async (tx) => {
    await lockOffice(tx, viewer.officeId);
    const [deal] = await tx
      .select()
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.officeId, viewer.officeId)))
      .for("update")
      .limit(1);
    if (!deal) throw notFound("Kontrat bulunamadı.");
    if (deal.status === "cancelled") return;

    await tx
      .update(deals)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelledById: viewer.id, cancelReason: reason })
      .where(eq(deals.id, deal.id));

    if (deal.portfolioId) {
      const portfolio = await loadPortfolioForUpdate(tx, viewer.officeId, deal.portfolioId);
      const [other] = await tx
        .select({ n: count() })
        .from(deals)
        .where(
          and(
            eq(deals.officeId, viewer.officeId),
            eq(deals.portfolioId, portfolio.id),
            eq(deals.status, "active"),
            ne(deals.id, deal.id),
          ),
        );
      if (portfolio.status === closedStatusFor(deal.type) && (other?.n ?? 0) === 0) {
        // Aynı daire bu arada yeniden kaydedildiyse çift aktif portföy oluşmasın.
        let next: "available" | "inactive" = "available";
        try {
          await assertNoActiveDuplicate(tx, viewer.officeId, portfolio.matchKey, portfolio.listingType, portfolio.id);
        } catch (err) {
          if (!(err instanceof ServiceError)) throw err;
          next = "inactive";
        }
        await tx
          .update(portfolios)
          .set({
            status: next,
            statusChangedAt: new Date(),
            statusChangedById: viewer.id,
            statusNote: `Kontrat K-${deal.refNo} iptal edildi`,
            updatedAt: new Date(),
          })
          .where(eq(portfolios.id, portfolio.id));
        await logActivity(tx, {
          officeId: viewer.officeId,
          actorId: viewer.id,
          entityType: "portfolio",
          entityId: portfolio.id,
          action: `portfolio.status.${next}`,
          summary: `Kontrat K-${deal.refNo} iptal edildi; durum: ${STATUS_LABELS[next]}.`,
        });
      }
    }

    await tx
      .update(alerts)
      .set({
        status: "resolved",
        resolution: "dismissed",
        resolutionNote: "Kontrat iptal edildi.",
        resolvedById: viewer.id,
        resolvedAt: new Date(),
      })
      .where(and(eq(alerts.officeId, viewer.officeId), eq(alerts.dealId, deal.id), eq(alerts.status, "open")));

    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "deal",
      entityId: deal.id,
      action: "deal.cancelled",
      summary: `Kontrat iptal edildi${reason ? `: ${reason}` : "."}`,
    });
  });
}

export type DealFilters = {
  type?: DealType;
  from?: string | null;
  to?: string | null;
  /** Yalnızca çapraz işlemler (portföy sahibi ≠ işlemi yapan). */
  cross?: boolean;
  /** Yalnızca farklı ekipler arası çapraz işlemler. */
  crossTeam?: boolean;
  unregistered?: boolean;
  agentId?: string;
  teamId?: string;
  q?: string;
  status?: DealStatus | "all";
  page?: number;
  pageSize?: number;
};

export type DealRow = {
  id: string;
  refNo: number;
  type: DealType;
  status: DealStatus;
  contractDate: string;
  district: string;
  complexName: string;
  block: string | null;
  unitNo: string;
  portfolioId: string | null;
  portfolioRefNo: number | null;
  price: number;
  commission: number;
  customerName: string | null;
  closingAgentId: string;
  closingAgentName: string;
  closingTeamId: string | null;
  closingTeamName: string | null;
  listingAgentId: string | null;
  listingAgentName: string | null;
  listingTeamId: string | null;
  listingTeamName: string | null;
  listingSharePct: number;
  closingAgentRevenue: number;
  listingAgentRevenue: number;
  /** Yetki yoksa `null`. */
  closingAgentEarning: number | null;
  listingAgentEarning: number | null;
  officeEarning: number | null;
  isCross: boolean;
  isCrossTeam: boolean;
  wasUnregistered: boolean;
  hasOpenAlert: boolean;
  createdAt: Date;
};

const closingUser = alias(users, "closing_user");
const listingUser = alias(users, "listing_user");
const closingTeam = alias(teams, "closing_team");
const listingTeam = alias(teams, "listing_team");

const openAlertExists = sql<boolean>`exists (
  select 1 from ${alerts}
  where ${alerts.dealId} = ${deals.id} and ${alerts.officeId} = ${deals.officeId} and ${alerts.status} = 'open'
)`;

const isCrossSql = sql`(${deals.listingAgentId} is not null and ${deals.listingAgentId} <> ${deals.closingAgentId})`;
const isCrossTeamSql = sql`(${isCrossSql} and ${deals.listingTeamId} is distinct from ${deals.closingTeamId})`;

const dealColumns = {
  id: deals.id,
  refNo: deals.refNo,
  type: deals.type,
  status: deals.status,
  contractDate: deals.contractDate,
  district: deals.district,
  complexName: deals.complexName,
  block: deals.block,
  unitNo: deals.unitNo,
  portfolioId: deals.portfolioId,
  portfolioRefNo: portfolios.refNo,
  price: deals.price,
  commission: deals.commission,
  customerName: deals.customerName,
  closingAgentId: deals.closingAgentId,
  closingAgentName: closingUser.name,
  closingTeamId: deals.closingTeamId,
  closingTeamName: closingTeam.name,
  listingAgentId: deals.listingAgentId,
  listingAgentName: listingUser.name,
  listingTeamId: deals.listingTeamId,
  listingTeamName: listingTeam.name,
  listingSharePct: deals.listingSharePct,
  closingAgentRevenue: deals.closingAgentRevenue,
  listingAgentRevenue: deals.listingAgentRevenue,
  closingAgentEarning: deals.closingAgentEarning,
  listingAgentEarning: deals.listingAgentEarning,
  officeEarning: deals.officeEarning,
  wasUnregistered: deals.wasUnregistered,
  hasOpenAlert: openAlertExists,
  createdAt: deals.createdAt,
};

type RawDealRow = Omit<DealRow, "isCross" | "isCrossTeam" | "closingAgentEarning" | "listingAgentEarning" | "officeEarning"> & {
  closingAgentEarning: number;
  listingAgentEarning: number;
  officeEarning: number;
};

/** Kazanç bilgilerini görüntüleyenin yetkisine göre gizler. */
function present(viewer: Viewer, r: RawDealRow): DealRow {
  const isCross = r.listingAgentId !== null && r.listingAgentId !== r.closingAgentId;
  return {
    ...r,
    isCross,
    isCrossTeam: isCross && r.listingTeamId !== r.closingTeamId,
    closingAgentEarning: canViewEarningsOf(viewer, { id: r.closingAgentId, teamId: r.closingTeamId })
      ? r.closingAgentEarning
      : null,
    listingAgentEarning:
      r.listingAgentId && isCross && canViewEarningsOf(viewer, { id: r.listingAgentId, teamId: r.listingTeamId })
        ? r.listingAgentEarning
        : null,
    officeEarning: isManager(viewer) ? r.officeEarning : null,
  };
}

/** Görüntüleyenin görebileceği kontratlar: yönetici hepsini, lider ekibini, danışman kendi işlemlerini. */
export function dealVisibility(viewer: Viewer): SQL | undefined {
  if (isManager(viewer)) return undefined;
  const own = or(eq(deals.closingAgentId, viewer.id), eq(deals.listingAgentId, viewer.id));
  if (viewer.role === "leader" && viewer.teamId) {
    return or(own, eq(deals.closingTeamId, viewer.teamId), eq(deals.listingTeamId, viewer.teamId));
  }
  return own;
}

function selectDeals() {
  return db
    .select(dealColumns)
    .from(deals)
    .innerJoin(closingUser, eq(closingUser.id, deals.closingAgentId))
    .leftJoin(listingUser, eq(listingUser.id, deals.listingAgentId))
    .leftJoin(closingTeam, eq(closingTeam.id, deals.closingTeamId))
    .leftJoin(listingTeam, eq(listingTeam.id, deals.listingTeamId))
    .leftJoin(portfolios, eq(portfolios.id, deals.portfolioId));
}

export type DealList = { rows: DealRow[]; total: number; page: number; pageCount: number };

export async function listDeals(viewer: Viewer, filters: DealFilters = {}): Promise<DealList> {
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const conditions: SQL[] = [eq(deals.officeId, viewer.officeId)];
  const visibility = dealVisibility(viewer);
  if (visibility) conditions.push(visibility);

  const status = filters.status ?? "active";
  if (status !== "all") conditions.push(eq(deals.status, status));
  if (filters.type) conditions.push(eq(deals.type, filters.type));
  if (filters.from) conditions.push(gte(deals.contractDate, filters.from));
  if (filters.to) conditions.push(lt(deals.contractDate, filters.to));
  if (filters.cross) conditions.push(isCrossSql);
  if (filters.crossTeam) conditions.push(isCrossTeamSql);
  if (filters.unregistered) conditions.push(eq(deals.wasUnregistered, true));
  if (filters.agentId) {
    conditions.push(or(eq(deals.closingAgentId, filters.agentId), eq(deals.listingAgentId, filters.agentId))!);
  }
  if (filters.teamId) {
    conditions.push(or(eq(deals.closingTeamId, filters.teamId), eq(deals.listingTeamId, filters.teamId))!);
  }
  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${foldTr(q).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    // Kontrat adresi ve müşteri adı üzerinde Türkçe karakter duyarsız arama.
    conditions.push(
      sql`lower(translate(concat_ws(' ', ${deals.complexName}, ${deals.district}, ${deals.unitNo}, ${deals.customerName}), 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')) like ${pattern}`,
    );
  }
  const where = and(...conditions);

  const [totalRow] = await db.select({ n: count() }).from(deals).where(where);
  const total = totalRow?.n ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageCount, Math.max(1, filters.page ?? 1));

  const rows = await selectDeals()
    .where(where)
    .orderBy(desc(deals.contractDate), desc(deals.refNo))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { rows: rows.map((r) => present(viewer, r)), total, page, pageCount };
}

export type DealDetail = DealRow & {
  city: string | null;
  neighborhood: string | null;
  notes: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdByName: string | null;
  activity: ActivityRow[];
};

export async function getDealDetail(viewer: Viewer, id: string): Promise<DealDetail | null> {
  const [row] = await selectDeals()
    .where(and(eq(deals.id, id), eq(deals.officeId, viewer.officeId)))
    .limit(1);
  if (!row) return null;
  if (!canViewDeal(viewer, row)) return null;

  const [extra] = await db
    .select({
      city: deals.city,
      neighborhood: deals.neighborhood,
      notes: deals.notes,
      cancelledAt: deals.cancelledAt,
      cancelReason: deals.cancelReason,
      createdByName: users.name,
    })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.createdById))
    .where(eq(deals.id, id))
    .limit(1);

  return {
    ...present(viewer, row),
    city: extra?.city ?? null,
    neighborhood: extra?.neighborhood ?? null,
    notes: extra?.notes ?? null,
    cancelledAt: extra?.cancelledAt ?? null,
    cancelReason: extra?.cancelReason ?? null,
    createdByName: extra?.createdByName ?? null,
    activity: await listActivity(viewer.officeId, "deal", id),
  };
}

/** Portföyü olmayan (kayıtsız) açık kontrat sayısı gibi hızlı sayımlar için. */
export async function countDeals(officeId: string, where: "linked" | "unlinked"): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(deals)
    .where(
      and(
        eq(deals.officeId, officeId),
        eq(deals.status, "active"),
        where === "linked" ? isNotNull(deals.portfolioId) : isNull(deals.portfolioId),
      ),
    );
  return row?.n ?? 0;
}
