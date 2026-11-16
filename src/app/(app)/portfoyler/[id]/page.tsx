import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, Lock, Mail, MapPin, Pencil, Phone, Signature } from "lucide-react";
import { ListingShare, StatusActions } from "@/components/portfolio-actions";
import { Timeline } from "@/components/timeline";
import {
  Avatar,
  ButtonLink,
  Card,
  CardHeader,
  DealBadge,
  DefinitionList,
  ListingBadge,
  Notice,
  StatusBadge,
} from "@/components/ui";
import { requireOffice } from "@/lib/auth/guards";
import { formatDate, formatDateISO } from "@/lib/domain/dates";
import { LISTING_LABELS, propertyTypeLabel, unitLabel } from "@/lib/domain/labels";
import { listingNumber } from "@/lib/domain/listing-url";
import { formatTL } from "@/lib/domain/money";
import { canViewDeal } from "@/lib/domain/permissions";
import { getPortfolioDetail } from "@/lib/services/portfolios";
import { isUuid, param, type SearchParams } from "@/lib/url";

export const metadata: Metadata = { title: "Portföy" };

export default async function PortfolioDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { viewer } = await requireOffice();
  if (!isUuid(id)) notFound();
  const detail = await getPortfolioDetail(viewer, id);
  if (!detail) notFound();

  const p = detail.portfolio;
  const active = p.status === "available" || p.status === "deposit";
  const location = [p.neighborhood, p.district, p.city].filter(Boolean).join(", ");
  const ilanNo = listingNumber(p.listingUrl);
  const shareText = `${p.title} — ${formatTL(p.price)}${p.listingType === "rent" ? " / ay" : ""}`;

  return (
    <>
      <Link href="/portfoyler" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" aria-hidden />
        Portföyler
      </Link>

      {param(sp, "yeni") ? (
        <div className="mb-5">
          <Notice tone="success" icon={<CircleCheck className="size-5" aria-hidden />} title="Portföy kaydedildi">
            Ofisinizdeki herkes bu portföyü artık görebilir.
          </Notice>
        </div>
      ) : null}
      {param(sp, "guncellendi") ? (
        <div className="mb-5">
          <Notice tone="success" icon={<CircleCheck className="size-5" aria-hidden />} title="Değişiklikler kaydedildi" />
        </div>
      ) : null}

      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 sm:mb-8">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <ListingBadge type={p.listingType} />
            <StatusBadge status={p.status} />
            <span className="text-sm font-medium text-ink-400 tabular-nums">Portföy #{p.refNo}</span>
          </div>
          <h1 className="font-display text-[2rem] leading-[1.1] text-ink-950 sm:text-[2.5rem]">{p.title}</h1>
          <p className="mt-2.5 flex items-center gap-1.5 text-[0.9375rem] text-ink-600">
            <MapPin className="size-4 shrink-0 text-gold-500" aria-hidden />
            {unitLabel(p)}
            {location ? <span className="text-ink-400">· {location}</span> : null}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-medium tracking-wide text-ink-500">
            {p.listingType === "rent" ? "Aylık kira" : "Satış fiyatı"}
          </p>
          <p className="mt-1 text-[2rem] leading-none font-semibold tracking-tight text-ink-950 tabular-nums">
            {formatTL(p.price)}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Özellikler"
              action={
                detail.canManage ? (
                  <ButtonLink href={`/portfoyler/${p.id}/duzenle`} variant="secondary" size="sm">
                    <Pencil className="size-3.5" aria-hidden />
                    Düzenle
                  </ButtonLink>
                ) : null
              }
            />
            <div className="px-5 pt-5 pb-6 sm:px-6">
              <DefinitionList
                items={[
                  { label: "Tür", value: `${LISTING_LABELS[p.listingType]} ${propertyTypeLabel(p.propertyType)}` },
                  { label: "Oda sayısı", value: p.rooms ?? "—" },
                  { label: "Brüt / Net", value: p.grossM2 || p.netM2 ? `${p.grossM2 ?? "—"} / ${p.netM2 ?? "—"} m²` : "—" },
                  { label: "Kat", value: p.floor ?? "—" },
                  { label: "Bina yaşı", value: p.buildingAge ?? "—" },
                  { label: "Eşya", value: p.furnished ? "Eşyalı" : "Eşyasız" },
                  { label: "Site / bina", value: p.complexName },
                  { label: "Blok", value: p.block ?? "—" },
                  { label: "Daire / kapı no", value: p.unitNo },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Mal sahibi" />
            <div className="px-5 pt-4 pb-6 sm:px-6">
              {detail.canSeeOwner ? (
                <>
                  <DefinitionList
                    items={[
                      { label: "Ad Soyad", value: p.ownerName ?? "—" },
                      {
                        label: "Telefon",
                        value: p.ownerPhone ? (
                          <a href={`tel:${p.ownerPhone.replace(/[^\d+]/g, "")}`} className="underline decoration-gold-400 underline-offset-4">
                            {p.ownerPhone}
                          </a>
                        ) : (
                          "—"
                        ),
                      },
                    ]}
                  />
                  {p.notes ? (
                    <div className="mt-5 rounded-xl bg-ivory-100 px-4 py-3">
                      <p className="text-xs font-medium tracking-wide text-ink-500">Notlar</p>
                      <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink-800">{p.notes}</p>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex gap-3 rounded-xl bg-ivory-100 px-4 py-3.5 text-sm leading-relaxed text-ink-600">
                  <Lock className="mt-0.5 size-4 shrink-0 text-gold-600" aria-hidden />
                  <p>
                    Mal sahibi bilgilerini yalnızca portföyün danışmanı, ekip lideri ve üst yönetici görebilir. Bu daireyi
                    müşterinize sunmak için <strong className="font-semibold text-ink-900">{detail.agentName}</strong> ile
                    iletişime geçin.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Geçmiş" description="Bu portföyde yapılan tüm işlemler" />
            <div className="px-5 pt-5 pb-6 sm:px-6">
              <Timeline entries={detail.activity} />
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Durum" />
            <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
              <StatusBadge status={p.status} />
              <p className="mt-3 text-sm text-ink-600">
                {detail.statusChangedByName ?? "—"} · {formatDate(p.statusChangedAt)}
              </p>
              {p.statusNote ? <p className="mt-1.5 text-sm text-ink-800">“{p.statusNote}”</p> : null}

              <div className="mt-5 space-y-2.5">
                {active ? (
                  <ButtonLink href={`/kontratlar/yeni?portfoy=${p.id}`} className="w-full">
                    <Signature className="size-4" aria-hidden />
                    {p.listingType === "rent" ? "Kiralama kontratı gir" : "Satış kontratı gir"}
                  </ButtonLink>
                ) : null}
                <StatusActions portfolioId={p.id} options={detail.statusOptions} />
              </div>
              {active ? (
                <p className="mt-4 text-xs leading-relaxed text-ink-500">
                  “{p.listingType === "rent" ? "Kiralandı" : "Satıldı"}” durumu, kontrat girildiğinde kendiliğinden oluşur.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Sahibinden ilanı" />
            <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
              {p.listingUrl ? (
                <>
                  <p className="mb-4 text-sm break-all text-ink-600">
                    {ilanNo ? (
                      <>
                        İlan no: <span className="font-semibold text-ink-900 tabular-nums">{ilanNo}</span>
                      </>
                    ) : (
                      p.listingUrl.replace(/^https?:\/\//, "")
                    )}
                  </p>
                  <ListingShare url={p.listingUrl} shareText={shareText} />
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-ink-500">
                    Bu portföye henüz ilan linki eklenmedi. Link eklendiğinde buradan tek tıkla kopyalayıp müşteriye
                    gönderebilirsiniz.
                  </p>
                  {detail.canManage ? (
                    <ButtonLink href={`/portfoyler/${p.id}/duzenle`} variant="secondary" className="mt-4 w-full">
                      İlan linki ekle
                    </ButtonLink>
                  ) : null}
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Danışman" />
            <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
              <div className="flex items-center gap-3">
                <Avatar name={detail.agentName} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink-950">{detail.agentName}</p>
                  <p className="truncate text-sm text-ink-500">{detail.teamName ?? "Ekipsiz"}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {detail.agentPhone ? (
                  <a href={`tel:${detail.agentPhone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2.5 text-ink-700 hover:text-ink-950">
                    <Phone className="size-4 text-gold-600" aria-hidden />
                    {detail.agentPhone}
                  </a>
                ) : null}
                <a href={`mailto:${detail.agentEmail}`} className="flex items-center gap-2.5 break-all text-ink-700 hover:text-ink-950">
                  <Mail className="size-4 shrink-0 text-gold-600" aria-hidden />
                  {detail.agentEmail}
                </a>
              </div>
            </div>
          </Card>

          {detail.deals.length > 0 ? (
            <Card>
              <CardHeader title="Kontratlar" />
              <ul className="mt-3 divide-y divide-ivory-200">
                {detail.deals.map((d) => {
                  // Portföy sayfası herkese açık; kontrat ayrıntısı yalnızca taraflara ve yöneticilere.
                  const viewable =
                    viewer.role === "manager" ||
                    canViewDeal(viewer, {
                      closingAgentId: d.closingAgentId,
                      closingTeamId: null,
                      listingAgentId: p.agentId,
                      listingTeamId: detail.agentTeamId,
                    });
                  const body = (
                    <>
                      <div className="flex items-center gap-2">
                        <DealBadge type={d.type} />
                        <span className="text-xs font-medium text-ink-400 tabular-nums">K-{d.refNo}</span>
                        {d.status === "cancelled" ? <span className="text-xs font-medium text-rose-700">İptal</span> : null}
                      </div>
                      <p className="mt-2 text-sm font-medium text-ink-900">{d.closingAgentName}</p>
                      <p className="text-xs text-ink-500">{formatDateISO(d.contractDate)}</p>
                    </>
                  );
                  return (
                    <li key={d.id}>
                      {viewable ? (
                        <Link href={`/kontratlar/${d.id}`} className="block px-5 py-4 transition-colors hover:bg-ivory-50 sm:px-6">
                          {body}
                        </Link>
                      ) : (
                        <div className="px-5 py-4 sm:px-6">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
