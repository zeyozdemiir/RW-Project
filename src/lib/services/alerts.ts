import { and, count, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type DbOrTx } from "@/lib/db";
import {
  alerts,
  deals,
  offices,
  portfolios,
  teams,
  users,
  type DealType,
  type ListingType,
  type PortfolioStatus,
} from "@/lib/db/schema";
import { ServiceError, forbidden, notFound } from "@/lib/errors";
import { DEAL_LABELS, unitLabel } from "@/lib/domain/labels";
import { buildSearchText, normalizeComplex, normalizeUnit } from "@/lib/domain/normalize";
import { isManager, type Viewer } from "@/lib/domain/permissions";
import { logActivity } from "./activity";
import { linkDealToPortfolio } from "./deals";
import { loadPortfolioForUpdate, lockOffice, nextPortfolioRef } from "./portfolios";

export async function countOpenAlerts(officeId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(alerts)
    .where(and(eq(alerts.officeId, officeId), eq(alerts.status, "open")));
  return row?.n ?? 0;
}

export type AlertCandidate = {
  id: string;
  refNo: number;
  title: string;
  listingType: ListingType;
  status: PortfolioStatus;
  complexName: string;
  block: string | null;
  unitNo: string;
  district: string;
  agentName: string;
  /** Bu kontrata doğrudan bağlanabilir mi (tür uyumlu ve kapatılmamış). */
  linkable: boolean;
};

export type AlertRow = {
  id: string;
  status: "open" | "resolved";
  resolution: "linked" | "created" | "dismissed" | null;
  resolutionNote: string | null;
  resolvedByName: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  deal: {
    id: string;
    refNo: number;
    type: DealType;
    status: "active" | "cancelled";
    contractDate: string;
    city: string | null;
    district: string;
    neighborhood: string | null;
    complexName: string;
    block: string | null;
    unitNo: string;
    price: number;
    commission: number;
    customerName: string | null;
    closingAgentId: string;
    closingAgentName: string;
    closingTeamName: string | null;
    portfolioId: string | null;
    portfolioRefNo: number | null;
  };
  candidates: AlertCandidate[];
};

/**
 * Kontrattaki daireye benzeyen kayıtlı portföyler: aynı kapı numarası ve
 * benzer site adı. Yazım farkı yüzünden kaçan eşleşmeleri yöneticinin elle
 * bağlayabilmesi için gösterilir.
 */
async function findCandidates(
  officeId: string,
  deal: { type: DealType; complexName: string; unitNo: string; district: string },
): Promise<AlertCandidate[]> {
  const complexKey = normalizeComplex(deal.complexName);
  const unitKey = normalizeUnit(deal.unitNo);
  if (!complexKey) return [];

  // match_key biçimi: ilçe|site|blok|daire
  const complexCol = sql<string>`split_part(${portfolios.matchKey}, '|', 2)`;
  const unitCol = sql<string>`split_part(${portfolios.matchKey}, '|', 4)`;
  const rows = await db
    .select({
      id: portfolios.id,
      refNo: portfolios.refNo,
      title: portfolios.title,
      listingType: portfolios.listingType,
      status: portfolios.status,
      complexName: portfolios.complexName,
      block: portfolios.block,
      unitNo: portfolios.unitNo,
      district: portfolios.district,
      agentName: users.name,
      sameUnit: sql<boolean>`${unitCol} = ${unitKey}`,
    })
    .from(portfolios)
    .innerJoin(users, eq(users.id, portfolios.agentId))
    .where(
      and(
        eq(portfolios.officeId, officeId),
        or(
          sql`${complexCol} = ${complexKey}`,
          sql`(length(${complexCol}) >= 4 and position(${complexCol} in ${complexKey}) > 0)`,
          sql`(length(${complexKey}) >= 4 and position(${complexKey} in ${complexCol}) > 0)`,
        ),
      ),
    )
    .orderBy(desc(sql`${unitCol} = ${unitKey}`), desc(portfolios.createdAt))
    .limit(6);

  return rows.map(({ sameUnit: _sameUnit, ...r }) => ({
    ...r,
    linkable: r.listingType === deal.type && r.status !== "rented" && r.status !== "sold",
  }));
}

/** Üst yönetimin uyarı listesi: sistemde kaydı olmayan dairelere yapılan kontratlar. */
export async function listAlerts(viewer: Viewer, status: "open" | "resolved"): Promise<AlertRow[]> {
  if (!isManager(viewer)) throw forbidden();
  const resolver = alias(users, "resolver");
  const rows = await db
    .select({
      id: alerts.id,
      status: alerts.status,
      resolution: alerts.resolution,
      resolutionNote: alerts.resolutionNote,
      resolvedByName: resolver.name,
      resolvedAt: alerts.resolvedAt,
      createdAt: alerts.createdAt,
      dealId: deals.id,
      dealRefNo: deals.refNo,
      dealType: deals.type,
      dealStatus: deals.status,
      contractDate: deals.contractDate,
      city: deals.city,
      district: deals.district,
      neighborhood: deals.neighborhood,
      complexName: deals.complexName,
      block: deals.block,
      unitNo: deals.unitNo,
      price: deals.price,
      commission: deals.commission,
      customerName: deals.customerName,
      closingAgentId: deals.closingAgentId,
      closingAgentName: users.name,
      closingTeamName: teams.name,
      portfolioId: deals.portfolioId,
      portfolioRefNo: portfolios.refNo,
    })
    .from(alerts)
    .innerJoin(deals, eq(deals.id, alerts.dealId))
    .innerJoin(users, eq(users.id, deals.closingAgentId))
    .leftJoin(teams, eq(teams.id, deals.closingTeamId))
    .leftJoin(portfolios, eq(portfolios.id, deals.portfolioId))
    .leftJoin(resolver, eq(resolver.id, alerts.resolvedById))
    .where(and(eq(alerts.officeId, viewer.officeId), eq(alerts.status, status)))
    .orderBy(desc(alerts.createdAt))
    .limit(status === "open" ? 200 : 50);

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      status: r.status,
      resolution: r.resolution,
      resolutionNote: r.resolutionNote,
      resolvedByName: r.resolvedByName,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
      deal: {
        id: r.dealId,
        refNo: r.dealRefNo,
        type: r.dealType,
        status: r.dealStatus,
        contractDate: r.contractDate,
        city: r.city,
        district: r.district,
        neighborhood: r.neighborhood,
        complexName: r.complexName,
        block: r.block,
        unitNo: r.unitNo,
        price: r.price,
        commission: r.commission,
        customerName: r.customerName,
        closingAgentId: r.closingAgentId,
        closingAgentName: r.closingAgentName,
        closingTeamName: r.closingTeamName,
        portfolioId: r.portfolioId,
        portfolioRefNo: r.portfolioRefNo,
      },
      candidates:
        r.status === "open"
          ? await findCandidates(viewer.officeId, {
              type: r.dealType,
              complexName: r.complexName,
              unitNo: r.unitNo,
              district: r.district,
            })
          : [],
    })),
  );
}

async function loadOpenAlert(tx: DbOrTx, viewer: Viewer, alertId: string) {
  const [alert] = await tx
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.officeId, viewer.officeId)))
    .for("update")
    .limit(1);
  if (!alert) throw notFound("Uyarı bulunamadı.");
  if (alert.status !== "open") throw new ServiceError("Bu uyarı zaten kapatılmış.");
  const [deal] = await tx
    .select()
    .from(deals)
    .where(and(eq(deals.id, alert.dealId), eq(deals.officeId, viewer.officeId)))
    .for("update")
    .limit(1);
  if (!deal) throw notFound("Kontrat bulunamadı.");
  return { alert, deal };
}

/** Uyarıyı, kontratı mevcut bir portföye bağlayarak kapatır. */
export async function resolveAlertByLinking(
  viewer: Viewer,
  alertId: string,
  portfolioId: string,
  note: string | null,
): Promise<void> {
  if (!isManager(viewer)) throw forbidden();
  await db.transaction(async (tx) => {
    await lockOffice(tx, viewer.officeId);
    const [office] = await tx.select().from(offices).where(eq(offices.id, viewer.officeId)).limit(1);
    if (!office) throw notFound("Ofis bulunamadı.");
    const { alert, deal } = await loadOpenAlert(tx, viewer, alertId);
    const portfolio = await loadPortfolioForUpdate(tx, viewer.officeId, portfolioId);
    await linkDealToPortfolio(tx, viewer, office, deal, portfolio);
    await tx
      .update(alerts)
      .set({
        status: "resolved",
        resolution: "linked",
        resolutionNote: note,
        resolvedById: viewer.id,
        resolvedAt: new Date(),
      })
      .where(eq(alerts.id, alert.id));
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "alert",
      entityId: alert.id,
      action: "alert.linked",
      summary: `Uyarı kapatıldı: Kontrat K-${deal.refNo}, Portföy #${portfolio.refNo} ile eşleştirildi.`,
    });
  });
}

/**
 * Uyarıyı, kontrattaki daire için portföy kaydı açarak kapatır. Portföy,
 * seçilen danışmanın (varsayılan: işlemi yapan) adına ve kapatılmış olarak oluşur.
 */
export async function resolveAlertByCreating(
  viewer: Viewer,
  alertId: string,
  agentId: string | null,
  note: string | null,
): Promise<void> {
  if (!isManager(viewer)) throw forbidden();
  await db.transaction(async (tx) => {
    const refNo = await nextPortfolioRef(tx, viewer.officeId);
    const [office] = await tx.select().from(offices).where(eq(offices.id, viewer.officeId)).limit(1);
    if (!office) throw notFound("Ofis bulunamadı.");
    const { alert, deal } = await loadOpenAlert(tx, viewer, alertId);

    const ownerId = agentId ?? deal.closingAgentId;
    const [owner] = await tx
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.id, ownerId), eq(users.officeId, viewer.officeId)))
      .limit(1);
    if (!owner) throw new ServiceError("Seçilen danışman bulunamadı.");

    const title = `${unitLabel(deal)} (kontrattan oluşturuldu)`;
    const [created] = await tx
      .insert(portfolios)
      .values({
        officeId: viewer.officeId,
        refNo,
        agentId: owner.id,
        listingType: deal.type,
        status: "inactive",
        title,
        city: deal.city ?? "—",
        district: deal.district,
        neighborhood: deal.neighborhood,
        complexName: deal.complexName,
        block: deal.block,
        unitNo: deal.unitNo,
        price: deal.price,
        matchKey: deal.matchKey,
        searchText: buildSearchText([
          `#${refNo}`,
          title,
          deal.complexName,
          deal.neighborhood,
          deal.district,
          deal.city,
          deal.block,
          deal.unitNo,
        ]),
        statusChangedById: viewer.id,
        createdById: viewer.id,
      })
      .returning({ id: portfolios.id });
    if (!created) throw new Error("Portföy oluşturulamadı.");
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "portfolio",
      entityId: created.id,
      action: "portfolio.created",
      summary: `Portföy, kayıtsız ${DEAL_LABELS[deal.type].toLocaleLowerCase("tr-TR")} kontratından (K-${deal.refNo}) ${owner.name} adına oluşturuldu.`,
    });

    const portfolio = await loadPortfolioForUpdate(tx, viewer.officeId, created.id);
    await linkDealToPortfolio(tx, viewer, office, deal, portfolio);
    await tx
      .update(alerts)
      .set({
        status: "resolved",
        resolution: "created",
        resolutionNote: note,
        resolvedById: viewer.id,
        resolvedAt: new Date(),
      })
      .where(eq(alerts.id, alert.id));
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "alert",
      entityId: alert.id,
      action: "alert.created_portfolio",
      summary: `Uyarı kapatıldı: Kontrat K-${deal.refNo} için Portföy #${refNo} oluşturuldu (${owner.name}).`,
    });
  });
}

/** Uyarıyı açıklama yazarak kapatır (ör. ofis dışı işlem, mükerrer kayıt). */
export async function dismissAlert(viewer: Viewer, alertId: string, note: string | null): Promise<void> {
  if (!isManager(viewer)) throw forbidden();
  if (!note) throw new ServiceError("Uyarıyı kapatırken kısa bir açıklama yazın.");
  await db.transaction(async (tx) => {
    const { alert, deal } = await loadOpenAlert(tx, viewer, alertId);
    await tx
      .update(alerts)
      .set({
        status: "resolved",
        resolution: "dismissed",
        resolutionNote: note,
        resolvedById: viewer.id,
        resolvedAt: new Date(),
      })
      .where(eq(alerts.id, alert.id));
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "alert",
      entityId: alert.id,
      action: "alert.dismissed",
      summary: `Uyarı açıklamayla kapatıldı (Kontrat K-${deal.refNo}): ${note}`,
    });
  });
}

/** Panelde gösterilecek en yeni açık uyarılar. */
export async function latestOpenAlerts(
  viewer: Viewer,
  limit = 4,
): Promise<Array<{ id: string; createdAt: Date; dealRefNo: number; dealType: DealType; where: string; agentName: string }>> {
  if (!isManager(viewer)) return [];
  const rows = await db
    .select({
      id: alerts.id,
      createdAt: alerts.createdAt,
      dealRefNo: deals.refNo,
      dealType: deals.type,
      complexName: deals.complexName,
      block: deals.block,
      unitNo: deals.unitNo,
      agentName: users.name,
    })
    .from(alerts)
    .innerJoin(deals, eq(deals.id, alerts.dealId))
    .innerJoin(users, eq(users.id, deals.closingAgentId))
    .where(and(eq(alerts.officeId, viewer.officeId), eq(alerts.status, "open")))
    .orderBy(desc(alerts.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    dealRefNo: r.dealRefNo,
    dealType: r.dealType,
    where: unitLabel(r),
    agentName: r.agentName,
  }));
}
