import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioForm, type PortfolioFormValues } from "@/components/portfolio-form";
import { PageHeader } from "@/components/ui";
import { savePortfolioAction } from "@/lib/actions/portfolios";
import { requireOffice } from "@/lib/auth/guards";
import { toMoneyInput } from "@/lib/domain/money";
import { canAssignPortfolioTo } from "@/lib/domain/permissions";
import { getPortfolioDetail, listComplexNames } from "@/lib/services/portfolios";
import { listActiveAgents } from "@/lib/services/users";
import { isUuid } from "@/lib/url";

export const metadata: Metadata = { title: "Portföyü düzenle" };

export default async function EditPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { viewer, office } = await requireOffice();
  if (!isUuid(id)) notFound();
  const detail = await getPortfolioDetail(viewer, id);
  if (!detail || !detail.canManage) notFound();

  const [agents, complexNames] = await Promise.all([listActiveAgents(office.id), listComplexNames(office.id)]);
  const p = detail.portfolio;
  // Mevcut danışman (pasif olsa bile) listede kalır; diğerleri yetkiye göre süzülür.
  const assignable = agents.filter((a) => a.id === p.agentId || canAssignPortfolioTo(viewer, a));
  if (!assignable.some((a) => a.id === p.agentId)) {
    assignable.unshift({ id: p.agentId, name: detail.agentName, teamId: detail.agentTeamId, teamName: detail.teamName, role: "agent" });
  }

  const initial: PortfolioFormValues = {
    listingType: p.listingType,
    propertyType: p.propertyType,
    title: p.title,
    city: p.city,
    district: p.district,
    neighborhood: p.neighborhood ?? "",
    complexName: p.complexName,
    block: p.block ?? "",
    floor: p.floor ?? "",
    unitNo: p.unitNo,
    rooms: p.rooms ?? "",
    grossM2: p.grossM2?.toString() ?? "",
    netM2: p.netM2?.toString() ?? "",
    buildingAge: p.buildingAge?.toString() ?? "",
    furnished: p.furnished,
    price: toMoneyInput(p.price),
    ownerName: p.ownerName ?? "",
    ownerPhone: p.ownerPhone ?? "",
    listingUrl: p.listingUrl ?? "",
    notes: p.notes ?? "",
    agentId: p.agentId,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={`Portföy #${p.refNo}`} title="Portföyü düzenle" />
      <PortfolioForm
        action={savePortfolioAction.bind(null, p.id)}
        initial={initial}
        agents={assignable.length > 1 ? assignable : []}
        complexNames={complexNames}
        cancelHref={`/portfoyler/${p.id}`}
        submitLabel="Değişiklikleri kaydet"
        lockListingType={p.status === "rented" || p.status === "sold"}
      />
    </div>
  );
}
