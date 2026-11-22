/**
 * Ciro ve kazanç hesabı (tüm tutarlar kuruş cinsinden tam sayıdır).
 *
 * - Ciro: Ofisin bir kontrattan aldığı toplam hizmet bedeli.
 * - Çapraz işlem: Portföy sahibi ile işlemi yapan danışman farklıysa ciro
 *   ikisi arasında paylaşılır (varsayılan %50 / %50).
 * - Kazanç: Danışmanın kendi ciro payından aldığı tutar (danışman payı %).
 * - Ofis kazancı: Cirodan danışman kazançları düşüldükten sonra kalan.
 */

export type CommissionInput = {
  commission: number;
  closingAgentId: string;
  closingRatePct: number;
  listingAgentId: string | null;
  listingRatePct: number;
  listingSharePct: number;
};

export type CommissionSplit = {
  isCross: boolean;
  listingSharePct: number;
  closingAgentRevenue: number;
  listingAgentRevenue: number;
  closingAgentRatePct: number;
  listingAgentRatePct: number;
  closingAgentEarning: number;
  listingAgentEarning: number;
  officeEarning: number;
};

function pct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function computeCommission(input: CommissionInput): CommissionSplit {
  const commission = Math.max(0, Math.round(input.commission));
  const isCross = input.listingAgentId !== null && input.listingAgentId !== input.closingAgentId;
  const listingSharePct = isCross ? pct(input.listingSharePct) : 0;
  const closingRate = pct(input.closingRatePct);
  const listingRate = isCross ? pct(input.listingRatePct) : 0;

  const listingAgentRevenue = isCross ? Math.round((commission * listingSharePct) / 100) : 0;
  const closingAgentRevenue = commission - listingAgentRevenue;
  const closingAgentEarning = Math.round((closingAgentRevenue * closingRate) / 100);
  const listingAgentEarning = Math.round((listingAgentRevenue * listingRate) / 100);

  return {
    isCross,
    listingSharePct,
    closingAgentRevenue,
    listingAgentRevenue,
    closingAgentRatePct: closingRate,
    listingAgentRatePct: listingRate,
    closingAgentEarning,
    listingAgentEarning,
    officeEarning: commission - closingAgentEarning - listingAgentEarning,
  };
}
