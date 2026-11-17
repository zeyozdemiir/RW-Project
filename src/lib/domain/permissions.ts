import type { PortfolioStatus } from "@/lib/db/schema";

export type OfficeRole = "manager" | "leader" | "agent";

/** Oturum açmış, onaylı bir ofis kullanıcısı. Tüm yetki kararları bunun üzerinden verilir. */
export type Viewer = {
  id: string;
  officeId: string;
  role: OfficeRole;
  teamId: string | null;
  name: string;
  email: string;
};

type OwnedByAgent = { agentId: string; agentTeamId: string | null };

export function isManager(v: Viewer): boolean {
  return v.role === "manager";
}

function leadsTeam(v: Viewer, teamId: string | null): boolean {
  return v.role === "leader" && v.teamId !== null && v.teamId === teamId;
}

/** Portföyü düzenleme ve mal sahibi iletişim bilgilerini görme yetkisi. */
export function canManagePortfolio(v: Viewer, p: OwnedByAgent): boolean {
  return isManager(v) || p.agentId === v.id || leadsTeam(v, p.agentTeamId);
}

/** Mal sahibi bilgileri portföy kaçırmayı önlemek için sınırlı kişilere açıktır. */
export function canSeeOwnerContact(v: Viewer, p: OwnedByAgent): boolean {
  return canManagePortfolio(v, p);
}

/** Portföyü başka bir danışmana devretme. */
export function canAssignPortfolioTo(v: Viewer, target: { id: string; teamId: string | null }): boolean {
  if (isManager(v)) return true;
  if (target.id === v.id) return true;
  return leadsTeam(v, target.teamId);
}

/** Hangi danışman adına kontrat girilebilir. */
export function canCreateDealFor(v: Viewer, agent: { id: string; teamId: string | null }): boolean {
  if (isManager(v)) return true;
  if (agent.id === v.id) return true;
  return leadsTeam(v, agent.teamId);
}

export type DealParties = {
  closingAgentId: string;
  closingTeamId: string | null;
  listingAgentId: string | null;
  listingTeamId: string | null;
};

/** Kontratı (ve ciro bilgisini) görme yetkisi. */
export function canViewDeal(v: Viewer, d: DealParties): boolean {
  if (isManager(v)) return true;
  if (d.closingAgentId === v.id || d.listingAgentId === v.id) return true;
  return leadsTeam(v, d.closingTeamId) || leadsTeam(v, d.listingTeamId);
}

/** Bir danışmanın kazancını (kendi payını) görme yetkisi. */
export function canViewEarningsOf(v: Viewer, agent: { id: string; teamId: string | null }): boolean {
  return isManager(v) || agent.id === v.id || leadsTeam(v, agent.teamId);
}

export function canManageOffice(v: Viewer): boolean {
  return isManager(v);
}

/**
 * Elle yapılabilecek durum geçişleri. "Kiralandı" ve "Satıldı" yalnızca kontrat
 * girilerek oluşur; böylece her kapanış bir kontrata bağlanır.
 */
const MANUAL_TRANSITIONS: Record<PortfolioStatus, PortfolioStatus[]> = {
  available: ["deposit", "inactive"],
  deposit: ["available", "inactive"],
  rented: ["available"],
  sold: ["available"],
  inactive: ["available"],
};

export function allowedStatusChanges(
  v: Viewer,
  p: OwnedByAgent & { status: PortfolioStatus; statusChangedById: string | null },
): PortfolioStatus[] {
  const options = MANUAL_TRANSITIONS[p.status];
  if (canManagePortfolio(v, p)) return options;
  // Başka danışmanlar yalnızca kapora işaretleyebilir ve kendi koyduğu kaporayı geri alabilir.
  if (p.status === "available") return ["deposit"];
  if (p.status === "deposit" && p.statusChangedById === v.id) return ["available"];
  return [];
}
