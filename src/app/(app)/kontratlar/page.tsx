import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Plus, Search, ShieldExclamationPoint, Signature } from "lucide-react";
import { Badge, ButtonLink, DealBadge, EmptyState, PageHeader, Pagination, PillLink } from "@/components/ui";
import type { DealType } from "@/lib/db/schema";
import { requireOffice } from "@/lib/auth/guards";
import { PERIODS, PERIOD_LABELS, formatDateISO, parsePeriod, periodRange } from "@/lib/domain/dates";
import { unitLabel } from "@/lib/domain/labels";
import { formatTL } from "@/lib/domain/money";
import { listDeals, type DealRow } from "@/lib/services/deals";
import { hrefWith, param, type SearchParams } from "@/lib/url";

export const metadata: Metadata = { title: "Kontratlar" };

const TYPE_PARAM: Record<string, DealType> = { kiralama: "rent", satis: "sale" };

export default async function DealsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { viewer } = await requireOffice();
  const manager = viewer.role === "manager";

  // Kontrat listesinde varsayılan dönem "Tümü"dür; panelden gelen bağlantılar dönemi taşır.
  const periodKey = param(sp, "donem") ? parsePeriod(sp.donem) : "tum";
  const range = periodRange(periodKey);
  const typeKey = param(sp, "tur");
  const type = typeKey ? TYPE_PARAM[typeKey] : undefined;
  const cross = param(sp, "capraz") === "1";
  const crossTeam = param(sp, "capraz") === "ekip";
  const unregistered = manager && param(sp, "kayitsiz") === "1";
  const cancelled = param(sp, "durum") === "iptal";
  const q = param(sp, "q");
  const page = Number(param(sp, "sayfa") ?? "1") || 1;

  const list = await listDeals(viewer, {
    type,
    from: range.from,
    to: range.to,
    cross: cross || undefined,
    crossTeam: crossTeam || undefined,
    unregistered: unregistered || undefined,
    status: cancelled ? "cancelled" : "active",
    q,
    page,
  });

  const base = (patch: Record<string, string | null>) => hrefWith("/kontratlar", sp, { sayfa: null, ...patch });
  const anyFilter = Boolean(type || cross || crossTeam || unregistered || cancelled || q || periodKey !== "tum");

  return (
    <>
      <PageHeader
        eyebrow="Kontrat"
        title="Kontratlar"
        description={
          manager
            ? "Ofiste yapılan tüm kiralama ve satış kontratları."
            : viewer.role === "leader"
              ? "Ekibinizin yaptığı ve ekibinizin portföylerinden yapılan kontratlar."
              : "Sizin yaptığınız ve sizin portföylerinizden yapılan kontratlar."
        }
        actions={
          <ButtonLink href="/kontratlar/yeni">
            <Plus className="size-4" aria-hidden />
            Kontrat gir
          </ButtonLink>
        }
      />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {PERIODS.map((p) => (
          <PillLink key={p} href={base({ donem: p === "tum" ? null : p })} active={p === periodKey}>
            {PERIOD_LABELS[p]}
          </PillLink>
        ))}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <PillLink href={base({ tur: null })} active={!type}>
          Kiralama ve satış
        </PillLink>
        <PillLink href={base({ tur: "kiralama" })} active={type === "rent"}>
          Kiralama
        </PillLink>
        <PillLink href={base({ tur: "satis" })} active={type === "sale"}>
          Satış
        </PillLink>
        <span className="mx-1 w-px shrink-0 self-stretch bg-ivory-300" aria-hidden />
        <PillLink href={base({ capraz: cross ? null : "1" })} active={cross}>
          Çapraz işlemler
        </PillLink>
        <PillLink href={base({ capraz: crossTeam ? null : "ekip" })} active={crossTeam}>
          Ekipler arası
        </PillLink>
        {manager ? (
          <PillLink href={base({ kayitsiz: unregistered ? null : "1" })} active={unregistered}>
            Kayıtsız portföy
          </PillLink>
        ) : null}
        <PillLink href={base({ durum: cancelled ? null : "iptal" })} active={cancelled}>
          İptal edilenler
        </PillLink>
      </div>

      <form method="get" action="/kontratlar" className="card mb-6 flex gap-3 p-3 sm:p-4">
        {(["donem", "tur", "capraz", "kayitsiz", "durum"] as const).map((key) =>
          param(sp, key) ? <input key={key} type="hidden" name={key} value={param(sp, key)} /> : null,
        )}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Site, daire no veya müşteri adı ara"
            aria-label="Kontrat ara"
            className="input pl-10"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Ara
        </button>
      </form>

      {list.rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Signature className="size-6" aria-hidden />}
            title={anyFilter ? "Bu filtrelere uyan kontrat yok" : "Henüz kontrat girilmedi"}
            description={
              anyFilter
                ? "Dönemi veya filtreleri değiştirerek tekrar deneyin."
                : "İlk kiralama ya da satış kontratını girin; portföy durumu, ciro ve kazanç kendiliğinden güncellenir."
            }
            action={
              <ButtonLink href="/kontratlar/yeni">
                <Plus className="size-4" aria-hidden />
                Kontrat gir
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-500">
            {list.total} kontrat · {range.label}
          </p>

          {/* Masaüstü: tablo */}
          <div className="card hidden overflow-hidden lg:block">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Tarih</th>
                    <th>Tür</th>
                    <th>Daire</th>
                    <th>İşlemi yapan</th>
                    <th>Portföy sahibi</th>
                    <th className="num">Bedel</th>
                    <th className="num">Ciro</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((d) => (
                    <tr key={d.id} className="relative">
                      <td className="font-medium whitespace-nowrap tabular-nums">
                        <Link href={`/kontratlar/${d.id}`} className="after:absolute after:inset-0">
                          K-{d.refNo}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-ink-600">{formatDateISO(d.contractDate)}</td>
                      <td>
                        <DealBadge type={d.type} />
                      </td>
                      <td>
                        <p className="font-medium text-ink-900">{unitLabel(d)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-ink-500">{d.district}</span>
                          <DealFlags d={d} />
                        </div>
                      </td>
                      <td>
                        <p className="text-ink-900">{d.closingAgentName}</p>
                        <p className="text-xs text-ink-500">{d.closingTeamName ?? "Ekipsiz"}</p>
                      </td>
                      <td>
                        {d.listingAgentName ? (
                          <>
                            <p className="text-ink-900">{d.isCross ? d.listingAgentName : "Kendi portföyü"}</p>
                            {d.isCross ? <p className="text-xs text-ink-500">{d.listingTeamName ?? "Ekipsiz"}</p> : null}
                          </>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="num">{formatTL(d.price)}</td>
                      <td className="num font-semibold text-ink-950">{formatTL(d.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobil: kartlar */}
          <ul className="space-y-3 lg:hidden">
            {list.rows.map((d) => (
              <li key={d.id}>
                <Link href={`/kontratlar/${d.id}`} className="card block p-4 transition-shadow hover:shadow-lift">
                  <div className="flex flex-wrap items-center gap-2">
                    <DealBadge type={d.type} />
                    <DealFlags d={d} />
                    <span className="ml-auto text-xs font-medium text-ink-400 tabular-nums">K-{d.refNo}</span>
                  </div>
                  <p className="mt-3 font-semibold text-ink-950">{unitLabel(d)}</p>
                  <p className="mt-0.5 text-[0.8125rem] text-ink-500">
                    {d.district} · {formatDateISO(d.contractDate)}
                  </p>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-ivory-200 pt-3">
                    <p className="min-w-0 text-[0.8125rem] text-ink-600">
                      <span className="block truncate font-medium text-ink-900">{d.closingAgentName}</span>
                      {d.isCross ? <span className="block truncate">Portföy: {d.listingAgentName}</span> : null}
                    </p>
                    <p className="shrink-0 text-right">
                      <span className="block text-xs text-ink-500">Ciro</span>
                      <span className="font-semibold text-ink-950 tabular-nums">{formatTL(d.commission)}</span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={list.page} pageCount={list.pageCount} hrefFor={(n) => hrefWith("/kontratlar", sp, { sayfa: n === 1 ? null : String(n) })} />
        </>
      )}
    </>
  );
}

function DealFlags({ d }: { d: DealRow }) {
  return (
    <>
      {d.status === "cancelled" ? <Badge tone="red">İptal</Badge> : null}
      {d.isCrossTeam ? (
        <Badge tone="gold">
          <ArrowLeftRight className="size-3" aria-hidden />
          Ekipler arası
        </Badge>
      ) : d.isCross ? (
        <Badge tone="blue">
          <ArrowLeftRight className="size-3" aria-hidden />
          Çapraz
        </Badge>
      ) : null}
      {d.hasOpenAlert ? (
        <Badge tone="amber">
          <ShieldExclamationPoint className="size-3" aria-hidden />
          Kayıtsız portföy
        </Badge>
      ) : null}
    </>
  );
}
