import type { Metadata } from "next";
import { DealForm } from "@/components/deal-form";
import { PageHeader } from "@/components/ui";
import { requireOffice } from "@/lib/auth/guards";
import { todayISO } from "@/lib/domain/dates";
import { canCreateDealFor } from "@/lib/domain/permissions";
import { getPortfolioOption, listComplexNames } from "@/lib/services/portfolios";
import { listActiveAgents } from "@/lib/services/users";
import { isUuid, param, type SearchParams } from "@/lib/url";

export const metadata: Metadata = { title: "Kontrat gir" };

export default async function NewDealPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { viewer, office } = await requireOffice();
  const portfolioId = param(sp, "portfoy");

  const [agents, complexNames, option] = await Promise.all([
    listActiveAgents(office.id),
    listComplexNames(office.id),
    isUuid(portfolioId) ? getPortfolioOption(viewer, portfolioId) : Promise.resolve(null),
  ]);
  const initialPortfolio = option && (option.status === "available" || option.status === "deposit") ? option : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Kontrat"
        title="Yeni kontrat"
        description="Kiralama veya satış kontratını girin. Portföy kendiliğinden “Kiralandı” ya da “Satıldı” olur; ciro ve kazanç hesaplanır."
      />
      <DealForm
        viewerId={viewer.id}
        viewerRole={viewer.role}
        agents={agents.filter((a) => canCreateDealFor(viewer, a)).map((a) => ({ id: a.id, name: a.name, teamName: a.teamName }))}
        initialPortfolio={initialPortfolio}
        complexNames={complexNames}
        today={todayISO()}
        defaultSharePct={office.listingSharePct}
      />
    </div>
  );
}
