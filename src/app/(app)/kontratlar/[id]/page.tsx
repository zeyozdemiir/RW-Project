import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, ArrowRight, Ban, CircleCheck, ShieldExclamationPoint } from "lucide-react";
import { CancelDealButton } from "@/components/deal-actions";
import { Timeline } from "@/components/timeline";
import { Avatar, Badge, ButtonLink, Card, CardHeader, DealBadge, DefinitionList, Notice } from "@/components/ui";
import { requireOffice } from "@/lib/auth/guards";
import { formatDate, formatDateISO } from "@/lib/domain/dates";
import { unitLabel } from "@/lib/domain/labels";
import { formatTL } from "@/lib/domain/money";
import { getDealDetail } from "@/lib/services/deals";
import { isUuid, param, type SearchParams } from "@/lib/url";

export const metadata: Metadata = { title: "Kontrat" };

function PartyCard({
  role,
  name,
  team,
  revenue,
  earning,
  ratePct,
}: {
  role: string;
  name: string;
  team: string | null;
  revenue: number;
  earning: number | null;
  ratePct: number;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-ivory-300 bg-ivory-50 p-4">
      <p className="text-xs font-medium tracking-wide text-ink-500">{role}</p>
      <div className="mt-2.5 flex items-center gap-3">
        <Avatar name={name} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-950">{name}</p>
          <p className="truncate text-sm text-ink-500">{team ?? "Ekipsiz"}</p>
        </div>
      </div>
      <dl className="mt-4 space-y-1.5 border-t border-ivory-300 pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-500">Ciro payı</dt>
          <dd className="font-semibold text-ink-950 tabular-nums">{formatTL(revenue)}</dd>
        </div>
        {earning !== null ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Kazanç (%{ratePct})</dt>
            <dd className="font-semibold text-emerald-700 tabular-nums">{formatTL(earning)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { viewer } = await requireOffice();
  if (!isUuid(id)) notFound();
  const d = await getDealDetail(viewer, id);
  if (!d) notFound();

  const manager = viewer.role === "manager";
  const justCreated = Boolean(param(sp, "yeni"));
  const cancelled = d.status === "cancelled";
  const location = [d.neighborhood, d.district, d.city].filter(Boolean).join(", ");

  return (
    <>
      <Link href="/kontratlar" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden />
        Kontratlar
      </Link>

      <div className="mb-5 space-y-3">
        {justCreated && !cancelled ? (
          <Notice tone="success" icon={<CircleCheck className="size-5" aria-hidden />} title="Kontrat kaydedildi">
            {d.portfolioId
              ? `Portföy #${d.portfolioRefNo} “${d.type === "rent" ? "Kiralandı" : "Satıldı"}” olarak güncellendi.`
              : "Ciro ve kazanç hesaplarına eklendi."}
          </Notice>
        ) : null}
        {cancelled ? (
          <Notice tone="danger" icon={<Ban className="size-5" aria-hidden />} title="Bu kontrat iptal edildi">
            {d.cancelReason ?? "Neden belirtilmedi."} · {formatDate(d.cancelledAt)}
          </Notice>
        ) : null}
        {d.hasOpenAlert ? (
          <Notice
            tone="warning"
            icon={<ShieldExclamationPoint className="size-5" aria-hidden />}
            title="Bu daire sistemde kayıtlı bir portföy değil"
          >
            Kontrattaki daire ofis portföyünde bulunamadı; üst yönetime uyarı gönderildi.
            {manager ? (
              <>
                {" "}
                <Link href="/uyarilar" className="font-semibold underline underline-offset-4">
                  Uyarıyı incele
                </Link>
              </>
            ) : null}
          </Notice>
        ) : null}
        {d.isCross && !cancelled ? (
          <Notice
            tone="info"
            icon={<ArrowLeftRight className="size-5" aria-hidden />}
            title={d.isCrossTeam ? "Ekipler arası çapraz işlem" : "Çapraz işlem"}
          >
            {d.listingAgentName}
            {d.listingTeamName ? ` (${d.listingTeamName})` : ""} portföyünü {d.closingAgentName}
            {d.closingTeamName ? ` (${d.closingTeamName})` : ""} {d.type === "rent" ? "kiraladı" : "sattı"}. Ciro %
            {d.listingSharePct} / %{100 - d.listingSharePct} paylaşıldı.
          </Notice>
        ) : null}
      </div>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 sm:mb-8">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <DealBadge type={d.type} />
            {cancelled ? <Badge tone="red">İptal</Badge> : null}
            {d.wasUnregistered ? <Badge tone="amber">Kayıtsız portföy olarak girildi</Badge> : null}
            <span className="text-sm font-medium text-ink-400 tabular-nums">Kontrat K-{d.refNo}</span>
          </div>
          <h1 className="font-display text-[2rem] leading-[1.1] text-ink-950 sm:text-[2.5rem]">{unitLabel(d)}</h1>
          <p className="mt-2.5 text-[0.9375rem] text-ink-600">
            {location} · {formatDateISO(d.contractDate)}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-medium tracking-wide text-ink-500">Hizmet bedeli (ciro)</p>
          <p className="mt-1 text-[2rem] leading-none font-semibold tracking-tight text-ink-950 tabular-nums">
            {formatTL(d.commission)}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Taraflar ve paylaşım" />
            <div className="px-5 pt-5 pb-6 sm:px-6">
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                {d.isCross && d.listingAgentName ? (
                  <>
                    <PartyCard
                      role="Portföy sahibi"
                      name={d.listingAgentName}
                      team={d.listingTeamName}
                      revenue={d.listingAgentRevenue}
                      earning={d.listingAgentEarning}
                      ratePct={d.listingAgentRevenue > 0 ? Math.round(((d.listingAgentEarning ?? 0) / d.listingAgentRevenue) * 100) : 0}
                    />
                    <ArrowRight className="mx-auto size-5 shrink-0 rotate-90 text-gold-500 sm:rotate-0" aria-hidden />
                  </>
                ) : null}
                <PartyCard
                  role={d.type === "rent" ? "Kiralayan danışman" : "Satan danışman"}
                  name={d.closingAgentName}
                  team={d.closingTeamName}
                  revenue={d.closingAgentRevenue}
                  earning={d.closingAgentEarning}
                  ratePct={d.closingAgentRevenue > 0 ? Math.round(((d.closingAgentEarning ?? 0) / d.closingAgentRevenue) * 100) : 0}
                />
              </div>
              {d.officeEarning !== null ? (
                <p className="mt-4 flex justify-between gap-3 rounded-xl bg-ink-900 px-4 py-3 text-sm text-ink-200">
                  <span>Ofise kalan</span>
                  <span className="font-semibold text-white tabular-nums">{formatTL(d.officeEarning)}</span>
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Kontrat bilgileri" />
            <div className="px-5 pt-5 pb-6 sm:px-6">
              <DefinitionList
                items={[
                  { label: "Kontrat tarihi", value: formatDateISO(d.contractDate) },
                  { label: d.type === "rent" ? "Aylık kira" : "Satış bedeli", value: formatTL(d.price) },
                  { label: "Hizmet bedeli", value: formatTL(d.commission) },
                  { label: d.type === "rent" ? "Kiracı" : "Alıcı", value: d.customerName ?? "—" },
                  { label: "Kaydı giren", value: d.createdByName ?? "—" },
                  { label: "Kayıt tarihi", value: formatDate(d.createdAt) },
                ]}
              />
              {d.notes ? (
                <div className="mt-5 rounded-xl bg-ivory-100 px-4 py-3">
                  <p className="text-xs font-medium tracking-wide text-ink-500">Not</p>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink-800">{d.notes}</p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Geçmiş" />
            <div className="px-5 pt-5 pb-6 sm:px-6">
              <Timeline entries={d.activity} />
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Portföy" />
            <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
              {d.portfolioId ? (
                <>
                  <p className="text-sm text-ink-600">
                    Bu kontrat <span className="font-semibold text-ink-950">Portföy #{d.portfolioRefNo}</span> ile eşleşti.
                  </p>
                  <ButtonLink href={`/portfoyler/${d.portfolioId}`} variant="secondary" className="mt-4 w-full">
                    Portföyü aç
                  </ButtonLink>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-ink-600">
                  Bu kontrat sistemdeki bir portföye bağlı değil.
                  {manager && d.hasOpenAlert ? " Uyarılar sayfasından bir portföye bağlayabilir ya da yeni portföy oluşturabilirsiniz." : ""}
                </p>
              )}
            </div>
          </Card>

          {manager && !cancelled ? (
            <Card>
              <CardHeader title="Yönetici işlemleri" />
              <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
                <CancelDealButton dealId={d.id} />
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
