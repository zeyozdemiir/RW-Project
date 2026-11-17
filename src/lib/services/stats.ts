import { and, count, eq, gte, lt, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { deals, portfolios, users, type DealType, type ListingType, type PortfolioStatus } from "@/lib/db/schema";
import { lastMonths, type DateRange, type MonthBucket } from "@/lib/domain/dates";

/** İstatistik hesabı için bir kontratın yalın hâli. */
export type StatDeal = {
  id: string;
  type: DealType;
  contractDate: string;
  commission: number;
  officeEarning: number;
  closingAgentId: string;
  closingTeamId: string | null;
  closingAgentRevenue: number;
  closingAgentEarning: number;
  listingAgentId: string | null;
  listingTeamId: string | null;
  listingAgentRevenue: number;
  listingAgentEarning: number;
};

/** Belirtilen tarih aralığındaki geçerli (iptal edilmemiş) kontratlar. */
export async function loadStatDeals(
  officeId: string,
  range: { from: string | null; to: string | null },
): Promise<StatDeal[]> {
  const conditions: SQL[] = [eq(deals.officeId, officeId), eq(deals.status, "active")];
  if (range.from) conditions.push(gte(deals.contractDate, range.from));
  if (range.to) conditions.push(lt(deals.contractDate, range.to));
  return db
    .select({
      id: deals.id,
      type: deals.type,
      contractDate: deals.contractDate,
      commission: deals.commission,
      officeEarning: deals.officeEarning,
      closingAgentId: deals.closingAgentId,
      closingTeamId: deals.closingTeamId,
      closingAgentRevenue: deals.closingAgentRevenue,
      closingAgentEarning: deals.closingAgentEarning,
      listingAgentId: deals.listingAgentId,
      listingTeamId: deals.listingTeamId,
      listingAgentRevenue: deals.listingAgentRevenue,
      listingAgentEarning: deals.listingAgentEarning,
    })
    .from(deals)
    .where(and(...conditions));
}

export type Scope = { kind: "office" } | { kind: "team"; teamId: string } | { kind: "agent"; agentId: string };

export type Summary = {
  /** Kapsamdaki kişi(ler)in yaptığı kiralama sayısı. */
  rentCount: number;
  /** Kapsamdaki kişi(ler)in yaptığı satış sayısı. */
  saleCount: number;
  /** Ciro: ofis kapsamında toplam hizmet bedeli; ekip/danışman kapsamında ciro payı. */
  revenue: number;
  rentRevenue: number;
  saleRevenue: number;
  /** Kazanç: ofis kapsamında ofise kalan; ekip/danışman kapsamında danışman kazancı. */
  earning: number;
  /** Kapsamdaki portföylerden başkalarının yaptığı işlem sayısı (çapraz işlem, portföy tarafı). */
  listedByOthersCount: number;
  /** Çapraz işlem sayısı (kapsam herhangi bir tarafta). */
  crossCount: number;
};

export function emptySummary(): Summary {
  return {
    rentCount: 0,
    saleCount: 0,
    revenue: 0,
    rentRevenue: 0,
    saleRevenue: 0,
    earning: 0,
    listedByOthersCount: 0,
    crossCount: 0,
  };
}

function isCross(d: StatDeal): boolean {
  return d.listingAgentId !== null && d.listingAgentId !== d.closingAgentId;
}

function inScope(scope: Scope, agentId: string | null, teamId: string | null): boolean {
  if (scope.kind === "office") return true;
  if (scope.kind === "team") return teamId !== null && teamId === scope.teamId;
  return agentId !== null && agentId === scope.agentId;
}

/**
 * Kontratları bir kapsama (ofis / ekip / danışman) göre özetler.
 *
 * İşlem adedi işlemi yapan (kapatan) tarafa yazılır. Ciro ve kazanç ise her
 * iki tarafa kendi payı kadar yazılır; böylece çapraz işlemde portföy sahibi
 * de payını görür ve ekip toplamları ofis toplamını aşmaz.
 */
export function summarize(list: StatDeal[], scope: Scope): Summary {
  const s = emptySummary();
  for (const d of list) {
    const cross = isCross(d);
    const closingIn = inScope(scope, d.closingAgentId, d.closingTeamId);
    const listingIn = cross && inScope(scope, d.listingAgentId, d.listingTeamId);
    if (!closingIn && !listingIn) continue;

    let revenue = 0;
    if (scope.kind === "office") {
      revenue = d.commission;
      s.earning += d.officeEarning;
    } else {
      if (closingIn) {
        revenue += d.closingAgentRevenue;
        s.earning += d.closingAgentEarning;
      }
      if (listingIn) {
        revenue += d.listingAgentRevenue;
        s.earning += d.listingAgentEarning;
      }
    }
    s.revenue += revenue;
    if (d.type === "rent") s.rentRevenue += revenue;
    else s.saleRevenue += revenue;

    if (closingIn) {
      if (d.type === "rent") s.rentCount += 1;
      else s.saleCount += 1;
    }
    if (listingIn && !closingIn) s.listedByOthersCount += 1;
    if (cross) s.crossCount += 1;
  }
  return s;
}

export type MonthPoint = MonthBucket & { summary: Summary };

/** Son `months` ayın aylık özeti (grafik için). */
export async function monthlySeries(officeId: string, scope: Scope, months = 12, now = new Date()): Promise<MonthPoint[]> {
  const buckets = lastMonths(months, now);
  const first = buckets[0]!;
  const last = buckets[buckets.length - 1]!;
  const list = await loadStatDeals(officeId, { from: first.from, to: last.to });
  return buckets.map((b) => ({
    ...b,
    summary: summarize(
      list.filter((d) => d.contractDate >= b.from && d.contractDate < b.to),
      scope,
    ),
  }));
}

export type PortfolioCounts = Record<ListingType, Record<PortfolioStatus, number>>;

function emptyCounts(): PortfolioCounts {
  const zero = (): Record<PortfolioStatus, number> => ({ available: 0, deposit: 0, rented: 0, sold: 0, inactive: 0 });
  return { rent: zero(), sale: zero() };
}

/** Kapsamdaki portföylerin tür ve duruma göre sayıları. */
export async function portfolioCounts(officeId: string, scope: Scope): Promise<PortfolioCounts> {
  const conditions: SQL[] = [eq(portfolios.officeId, officeId)];
  if (scope.kind === "agent") conditions.push(eq(portfolios.agentId, scope.agentId));
  if (scope.kind === "team") conditions.push(eq(users.teamId, scope.teamId));
  const rows = await db
    .select({ listingType: portfolios.listingType, status: portfolios.status, n: count() })
    .from(portfolios)
    .innerJoin(users, eq(users.id, portfolios.agentId))
    .where(and(...conditions))
    .groupBy(portfolios.listingType, portfolios.status);
  const out = emptyCounts();
  for (const r of rows) out[r.listingType][r.status] = r.n;
  return out;
}

/** Danışman başına aktif (sunulabilir + kapora) portföy sayısı. */
export async function activePortfoliosByAgent(officeId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ agentId: portfolios.agentId, status: portfolios.status, n: count() })
    .from(portfolios)
    .where(eq(portfolios.officeId, officeId))
    .groupBy(portfolios.agentId, portfolios.status);
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.status === "available" || r.status === "deposit") {
      out.set(r.agentId, (out.get(r.agentId) ?? 0) + r.n);
    }
  }
  return out;
}

export function activeCount(c: Record<PortfolioStatus, number>): number {
  return c.available + c.deposit;
}

export function rangeOf(range: DateRange): { from: string | null; to: string | null } {
  return { from: range.from, to: range.to };
}
