import type { Metadata } from "next";
import Link from "next/link";
import { BuildingComplex, ExternalLink, MapPin, Plus, Search } from "lucide-react";
import { CardCopyLink } from "@/components/portfolio-actions";
import {
  Avatar,
  ButtonLink,
  EmptyState,
  ListingBadge,
  PageHeader,
  Pagination,
  PillLink,
  StatusBadge,
} from "@/components/ui";
import type { ListingType, PortfolioStatus } from "@/lib/db/schema";
import { requireOffice } from "@/lib/auth/guards";
import { STATUS_LABELS, propertyTypeLabel, unitLabel } from "@/lib/domain/labels";
import { formatTL } from "@/lib/domain/money";
import { listPortfolios, type PortfolioFilters, type PortfolioRow } from "@/lib/services/portfolios";
import { activeCount, portfolioCounts } from "@/lib/services/stats";
import { listTeams } from "@/lib/services/teams";
import { listActiveAgents } from "@/lib/services/users";
import { hrefWith, isUuid, param, type SearchParams } from "@/lib/url";

export const metadata: Metadata = { title: "Portföyler" };

const TYPE_PARAM: Record<string, ListingType> = { kiralik: "rent", satilik: "sale" };
const STATUS_PARAM: Record<string, PortfolioStatus | "active"> = {
  aktif: "active",
  sunulabilir: "available",
  kapora: "deposit",
  kiralandi: "rented",
  satildi: "sold",
  pasif: "inactive",
};
const STATUS_CHIPS: Array<{ key: string; status: PortfolioStatus }> = [
  { key: "sunulabilir", status: "available" },
  { key: "kapora", status: "deposit" },
  { key: "kiralandi", status: "rented" },
  { key: "satildi", status: "sold" },
  { key: "pasif", status: "inactive" },
];

export default async function PortfoliosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { viewer, office } = await requireOffice();

  const typeKey = param(sp, "tur");
  const listingType = typeKey ? TYPE_PARAM[typeKey] : undefined;
  // Varsayılan görünüm: müşteriye sunulabilecek (aktif) portföyler.
  const statusKey = param(sp, "durum") ?? "aktif";
  const status = statusKey === "tum" ? undefined : (STATUS_PARAM[statusKey] ?? "active");
  const q = param(sp, "q");
  const agentParam = param(sp, "danisman");
  const teamParam = param(sp, "ekip");
  const page = Number(param(sp, "sayfa") ?? "1") || 1;

  const filters: PortfolioFilters = {
    listingType,
    status,
    q,
    agentId: agentParam === "ben" ? viewer.id : isUuid(agentParam) ? agentParam : undefined,
    teamId: isUuid(teamParam) ? teamParam : undefined,
    page,
  };

  const [list, officeCounts, agents, teams] = await Promise.all([
    listPortfolios(viewer, filters),
    portfolioCounts(office.id, { kind: "office" }),
    listActiveAgents(office.id),
    listTeams(office.id),
  ]);

  const counts = list.statusCounts;
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const activeTotal = counts.available + counts.deposit;
  const base = (patch: Record<string, string | null>) => hrefWith("/portfoyler", sp, { sayfa: null, ...patch });
  const hasFilters = Boolean(q || agentParam || teamParam);

  return (
    <>
      <PageHeader
        eyebrow="Portföy"
        title="Portföyler"
        description="Ofisinizdeki tüm kiralık ve satılık portföyler. Durumlarını görün, ilan linkini müşterinizle paylaşın."
        actions={
          <ButtonLink href="/portfoyler/yeni">
            <Plus className="size-4" aria-hidden />
            Portföy ekle
          </ButtonLink>
        }
      />

      {/* Kiralık / Satılık ayrımı */}
      <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-ivory-300 bg-white p-1.5 shadow-card sm:inline-grid sm:min-w-[30rem]">
        {(
          [
            { key: null, label: "Tümü", count: activeCount(officeCounts.rent) + activeCount(officeCounts.sale) },
            { key: "kiralik", label: "Kiralık", count: activeCount(officeCounts.rent) },
            { key: "satilik", label: "Satılık", count: activeCount(officeCounts.sale) },
          ] as const
        ).map((tab) => {
          const active = (typeKey && TYPE_PARAM[typeKey] ? typeKey : null) === tab.key;
          return (
            <Link
              key={tab.label}
              href={base({ tur: tab.key })}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-xl bg-ink-900 px-4 py-2.5 text-center text-white"
                  : "rounded-xl px-4 py-2.5 text-center text-ink-600 transition-colors hover:bg-ivory-100 hover:text-ink-950"
              }
            >
              <span className="block text-[0.9375rem] font-semibold">{tab.label}</span>
              <span className={active ? "text-xs text-gold-200" : "text-xs text-ink-400"}>{tab.count} aktif</span>
            </Link>
          );
        })}
      </div>

      {/* Durum filtreleri */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <PillLink href={base({ durum: null })} active={status === "active"} count={activeTotal}>
          Aktif
        </PillLink>
        {STATUS_CHIPS.filter((c) => counts[c.status] > 0 || status === c.status).map((c) => (
          <PillLink key={c.key} href={base({ durum: c.key })} active={status === c.status} count={counts[c.status]}>
            {STATUS_LABELS[c.status]}
          </PillLink>
        ))}
        <PillLink href={base({ durum: "tum" })} active={status === undefined} count={allCount}>
          Tümü
        </PillLink>
      </div>

      {/* Arama ve danışman / ekip filtresi */}
      <form method="get" action="/portfoyler" className="card mb-6 grid grid-cols-1 gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_13rem_11rem_auto] sm:p-4">
        {typeKey ? <input type="hidden" name="tur" value={typeKey} /> : null}
        {param(sp, "durum") ? <input type="hidden" name="durum" value={statusKey} /> : null}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Site, mahalle, başlık veya portföy no ara"
            aria-label="Portföy ara"
            className="input pl-10"
          />
        </div>
        <select name="danisman" defaultValue={agentParam ?? ""} aria-label="Danışman" className="input">
          <option value="">Tüm danışmanlar</option>
          <option value="ben">Benim portföylerim</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select name="ekip" defaultValue={teamParam ?? ""} aria-label="Ekip" className="input">
          <option value="">Tüm ekipler</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1">
            Filtrele
          </button>
          {hasFilters ? (
            <Link href={base({ q: null, danisman: null, ekip: null })} className="btn btn-ghost">
              Temizle
            </Link>
          ) : null}
        </div>
      </form>

      {list.rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BuildingComplex className="size-6" aria-hidden />}
            title={hasFilters || allCount > 0 ? "Bu filtrelere uyan portföy yok" : "Henüz portföy eklenmedi"}
            description={
              hasFilters || allCount > 0
                ? "Filtreleri değiştirerek tekrar deneyin."
                : "İlk portföyü ekleyin; ekibiniz buradan görüp müşterilerine sunabilsin."
            }
            action={
              <ButtonLink href="/portfoyler/yeni">
                <Plus className="size-4" aria-hidden />
                Portföy ekle
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-500">{list.total} portföy</p>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.rows.map((p) => (
              <li key={p.id}>
                <PortfolioCard p={p} mine={p.agentId === viewer.id} />
              </li>
            ))}
          </ul>
          <Pagination page={list.page} pageCount={list.pageCount} hrefFor={(n) => hrefWith("/portfoyler", sp, { sayfa: n === 1 ? null : String(n) })} />
        </>
      )}
    </>
  );
}

function PortfolioCard({ p, mine }: { p: PortfolioRow; mine: boolean }) {
  const specs = [propertyTypeLabel(p.propertyType), p.rooms, p.grossM2 ? `${p.grossM2} m²` : null].filter(Boolean);
  return (
    <article className="card group relative flex h-full flex-col p-5 transition-shadow hover:shadow-lift">
      <div className="flex flex-wrap items-center gap-2">
        <ListingBadge type={p.listingType} />
        <StatusBadge status={p.status} />
        <span className="ml-auto text-xs font-medium text-ink-400 tabular-nums">#{p.refNo}</span>
      </div>

      <h2 className="mt-4 text-[1.0625rem] leading-snug font-semibold text-ink-950">
        <Link href={`/portfoyler/${p.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
          {p.title}
        </Link>
      </h2>
      <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-600">
        <MapPin className="mt-0.5 size-4 shrink-0 text-gold-500" aria-hidden />
        <span>
          {unitLabel(p)}
          <span className="block text-ink-400">{[p.neighborhood, p.district].filter(Boolean).join(", ")}</span>
        </span>
      </p>
      <p className="mt-3 text-[0.8125rem] text-ink-500">{specs.join(" · ")}</p>

      <p className="mt-4 text-2xl leading-none font-semibold tracking-tight text-ink-950 tabular-nums">
        {formatTL(p.price)}
        {p.listingType === "rent" ? <span className="ml-1 text-sm font-normal text-ink-400">/ ay</span> : null}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ivory-200 pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={p.agentName} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-900">
              {p.agentName}
              {mine ? <span className="ml-1.5 text-xs font-normal text-gold-600">(siz)</span> : null}
            </p>
            <p className="truncate text-xs text-ink-500">{p.teamName ?? "Ekipsiz"}</p>
          </div>
        </div>
        {p.listingUrl ? (
          <div className="relative z-10 flex items-center gap-2">
            <CardCopyLink url={p.listingUrl} />
            <a
              href={p.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm px-2.5"
              aria-label="Sahibinden ilanını aç"
              title="Sahibinden ilanını aç"
            >
              <ExternalLink className="size-4" aria-hidden />
            </a>
          </div>
        ) : null}
      </div>
    </article>
  );
}
