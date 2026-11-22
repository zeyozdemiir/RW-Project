import type { Metadata } from "next";
import { PortfolioForm, type PortfolioFormValues } from "@/components/portfolio-form";
import { PageHeader } from "@/components/ui";
import { savePortfolioAction } from "@/lib/actions/portfolios";
import { requireOffice } from "@/lib/auth/guards";
import { canAssignPortfolioTo } from "@/lib/domain/permissions";
import { listComplexNames } from "@/lib/services/portfolios";
import { listActiveAgents } from "@/lib/services/users";
import { param, type SearchParams } from "@/lib/url";

export const metadata: Metadata = { title: "Portföy ekle" };

export default async function NewPortfolioPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { viewer, office } = await requireOffice();
  const [agents, complexNames] = await Promise.all([listActiveAgents(office.id), listComplexNames(office.id)]);
  const assignable = agents.filter((a) => canAssignPortfolioTo(viewer, a));

  const initial: PortfolioFormValues = {
    listingType: param(sp, "tur") === "satilik" ? "sale" : "rent",
    propertyType: "daire",
    title: "",
    city: "",
    district: "",
    neighborhood: "",
    complexName: "",
    block: "",
    floor: "",
    unitNo: "",
    rooms: "",
    grossM2: "",
    netM2: "",
    buildingAge: "",
    furnished: false,
    price: "",
    ownerName: "",
    ownerPhone: "",
    listingUrl: "",
    notes: "",
    agentId: viewer.id,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Portföy"
        title="Yeni portföy"
        description="Portföy kaydedildiğinde ofisinizdeki herkes görebilir ve müşterisine sunabilir."
      />
      <PortfolioForm
        action={savePortfolioAction.bind(null, null)}
        initial={initial}
        agents={assignable.length > 1 ? assignable : []}
        complexNames={complexNames}
        cancelHref="/portfoyler"
        submitLabel="Portföyü kaydet"
      />
    </div>
  );
}
