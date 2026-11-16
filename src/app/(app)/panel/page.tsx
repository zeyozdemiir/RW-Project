import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  KeyRound,
  Plus,
  ShieldExclamationPoint,
  Tag,
  UserCheck,
  Wallet,
} from "lucide-react";
import { MonthlyRevenueChart } from "@/components/charts";
import { RankedBars, StatusSplit } from "@/components/data-bits";
import { Avatar, ButtonLink, Card, CardHeader, DealBadge, PageHeader, PillLink, StatTile } from "@/components/ui";
import { requireOffice } from "@/lib/auth/guards";
import { PERIODS, PERIOD_LABELS, formatDateISO, parsePeriod, periodRange } from "@/lib/domain/dates";
import { unitLabel } from "@/lib/domain/labels";
import { formatTL } from "@/lib/domain/money";
import { latestOpenAlerts } from "@/lib/services/alerts";
import { listDeals } from "@/lib/services/deals";
import {
  activeCount,
  loadStatDeals,
  monthlySeries,
  portfolioCounts,
  rangeOf,
  summarize,
  type Scope,
} from "@/lib/services/stats";
import { listTeams } from "@/lib/services/teams";
import { countPendingUsers, listActiveAgents } from "@/lib/services/users";
import { hrefWith, type SearchParams } from "@/lib/url";

export const metadata: Metadata = { title: "Panel" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { viewer, office } = await requireOffice();
  const period = parsePeriod(sp.donem);
  const range = periodRange(period);

  const manager = viewer.role === "manager";
  const leader = viewer.role === "leader" && viewer.teamId !== null;
  const scope: Scope = manager
    ? { kind: "office" }
    : leader
      ? { kind: "team", teamId: viewer.teamId! }
      : { kind: "agent", agentId: viewer.id };

  const [periodDeals, series, counts, recent, cross, alerts, pending, teams, agents] = await Promise.all([
    loadStatDeals(office.id, rangeOf(range)),
    monthlySeries(office.id, scope, 12),
    portfolioCounts(office.id, scope),
    listDeals(viewer, { pageSize: 6 }),
    listDeals(viewer, { cross: true, from: range.from, to: range.to, pageSize: 5 }),
    latestOpenAlerts(viewer, 4),
    manager ? countPendingUsers(office.id) : Promise.resolve(0),
    manager ? listTeams(office.id) : Promise.resolve([]),
    manager || leader ? listActiveAgents(office.id) : Promise.resolve([]),
  ]);

  const summary = summarize(periodDeals, scope);
  const scopeWord = manager ? "Ofis" : leader ? "Ekip" : "Sizin";
  const firstName = viewer.name.split(/\s+/)[0] ?? viewer.name;

  const teamRows = teams
    .map((t) => {
      const s = summarize(periodDeals, { kind: "team", teamId: t.id });
      return { key: t.id, label: t.name, sub: `${s.rentCount} kiralama · ${s.saleCount} satış`, value: s.revenue };
    })
    .sort((a, b) => b.value - a.value);

  const visibleAgents = manager ? agents : agents.filter((a) => a.teamId === viewer.teamId);
  const topAgents = visibleAgents
    .map((a) => ({ agent: a, s: summarize(periodDeals, { kind: "agent", agentId: a.id }) }))
    .filter((r) => r.s.revenue > 0 || r.s.rentCount + r.s.saleCount > 0)
    .sort((a, b) => b.s.revenue - a.s.revenue)
    .slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow={office.name}
        title={`Hoş geldiniz, ${firstName}`}
        description={
          manager
            ? "Ofisinizin portföy, kontrat ve ciro durumu."
            : leader
              ? "Ekibinizin portföy, kontrat ve ciro durumu."
              : "Portföyleriniz, kontratlarınız ve kazancınız."
        }
        actions={
          <>
            <ButtonLink href="/portfoyler/yeni" variant="secondary">
              <Plus className="size-4" aria-hidden />
              Portföy ekle
            </ButtonLink>
            <ButtonLink href="/kontratlar/yeni" variant="primary">
              <Plus className="size-4" aria-hidden />
              Kontrat gir
            </ButtonLink>
          </>
        }
      />

      {alerts.length > 0 ? (
        <section
          aria-label="Kayıtsız portföy uyarıları"
          className="mb-6 overflow-hidden rounded-2xl border border-amber-300 bg-linear-to-br from-amber-50 to-white shadow-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-5 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-300">
                <ShieldExclamationPoint className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-xl leading-tight text-ink-950">Kayıtsız portföy uyarısı</h2>
                <p className="text-sm text-ink-600">Sistemde portföyü bulunmayan dairelere kontrat girildi.</p>
              </div>
            </div>
            <ButtonLink href="/uyarilar" variant="primary" size="sm">
              Uyarıları incele
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
          <ul className="mt-4 divide-y divide-amber-200/70 border-t border-amber-200/70">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm sm:px-6">
                <span className="font-medium text-ink-900">{a.where}</span>
                <span className="text-ink-600">
                  {a.agentName} · Kontrat K-{a.dealRefNo}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pending > 0 ? (
        <Link
          href="/ekip"
          className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-gold-300 bg-gold-50 px-5 py-4 text-sm transition-colors hover:bg-gold-100 sm:px-6"
        >
          <span className="flex items-center gap-3 font-medium text-ink-900">
            <UserCheck className="size-5 text-gold-600" aria-hidden />
            {pending} kişi giriş onayınızı bekliyor
          </span>
          <ArrowRight className="size-4 text-ink-500" aria-hidden />
        </Link>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <PillLink key={p} href={hrefWith("/panel", sp, { donem: p === "bu-ay" ? null : p })} active={p === period}>
            {PERIOD_LABELS[p]}
          </PillLink>
        ))}
        <span className="ml-1 text-sm text-ink-500">{range.label}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          accent
          label={manager ? "Ofis cirosu" : leader ? "Ekip cirosu" : "Ciro payınız"}
          value={formatTL(summary.revenue)}
          hint={`${summary.rentCount + summary.saleCount} kontrat · ${range.label}`}
          icon={<Banknote className="size-[1.1rem]" aria-hidden />}
          href={hrefWith("/kazanc", {}, { donem: period === "bu-ay" ? null : period })}
        />
        <StatTile
          label={manager ? "Ofis kazancı" : leader ? "Ekip kazancı" : "Kazancınız"}
          value={formatTL(summary.earning)}
          hint={manager ? "Danışman payları düşüldükten sonra" : "Ciro payı üzerinden danışman kazancı"}
          icon={<Wallet className="size-[1.1rem]" aria-hidden />}
          href={hrefWith("/kazanc", {}, { donem: period === "bu-ay" ? null : period })}
        />
        <StatTile
          label="Kiralama"
          value={summary.rentCount}
          hint={`${formatTL(summary.rentRevenue)} ciro`}
          icon={<KeyRound className="size-[1.1rem]" aria-hidden />}
          href={hrefWith("/kontratlar", {}, { tur: "kiralama", donem: period === "bu-ay" ? null : period })}
        />
        <StatTile
          label="Satış"
          value={summary.saleCount}
          hint={`${formatTL(summary.saleRevenue)} ciro`}
          icon={<Tag className="size-[1.1rem]" aria-hidden />}
          href={hrefWith("/kontratlar", {}, { tur: "satis", donem: period === "bu-ay" ? null : period })}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Aylık ciro"
            description={`${scopeWord === "Sizin" ? "Sizin ciro payınız" : `${scopeWord} cirosu`} · son 12 ay`}
          />
          <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
            <MonthlyRevenueChart
              data={series.map((m) => ({
                key: m.key,
                label: m.label,
                shortLabel: m.shortLabel,
                rent: m.summary.rentRevenue,
                sale: m.summary.saleRevenue,
                rentCount: m.summary.rentCount,
                saleCount: m.summary.saleCount,
              }))}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title={manager ? "Portföy durumu" : leader ? "Ekip portföyü" : "Portföyleriniz"} />
          <div className="space-y-6 px-5 pt-5 pb-5 sm:px-6 sm:pb-6">
            {(["rent", "sale"] as const).map((type) => (
              <div key={type}>
                <div className="mb-3 flex items-baseline justify-between">
                  <Link
                    href={`/portfoyler?tur=${type === "rent" ? "kiralik" : "satilik"}`}
                    className="text-sm font-semibold text-ink-900 underline-offset-4 hover:underline"
                  >
                    {type === "rent" ? "Kiralık" : "Satılık"}
                  </Link>
                  <p className="text-[0.8125rem] text-ink-500">
                    <span className="text-lg font-semibold text-ink-950 tabular-nums">{activeCount(counts[type])}</span>{" "}
                    aktif
                  </p>
                </div>
                <StatusSplit counts={counts[type]} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Çapraz işlemler"
            description="Bir danışmanın portföyünü başka bir danışmanın kapattığı kontratlar"
            action={
              <Link href="/kontratlar?capraz=1" className="text-sm font-medium text-ink-600 underline-offset-4 hover:text-ink-950 hover:underline">
                Tümü
              </Link>
            }
          />
          {cross.rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-ink-400">{range.label} içinde çapraz işlem yok.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ivory-200">
              {cross.rows.map((d) => (
                <li key={d.id}>
                  <Link href={`/kontratlar/${d.id}`} className="block px-5 py-4 transition-colors hover:bg-ivory-50 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <DealBadge type={d.type} />
                      {d.isCrossTeam ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2.5 py-1 text-xs font-medium text-gold-700 ring-1 ring-gold-300 ring-inset">
                          <ArrowLeftRight className="size-3" aria-hidden />
                          Ekipler arası
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-200 ring-inset">
                          <ArrowLeftRight className="size-3" aria-hidden />
                          Ekip içi
                        </span>
                      )}
                      <span className="ml-auto text-xs text-ink-500">{formatDateISO(d.contractDate)}</span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-ink-900">{unitLabel(d)}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-ink-600">
                      <span>
                        <span className="text-ink-400">Portföy:</span> {d.listingAgentName}
                        {d.listingTeamName ? ` (${d.listingTeamName})` : ""}
                      </span>
                      <ArrowRight className="size-3.5 text-gold-500" aria-hidden />
                      <span>
                        <span className="text-ink-400">{d.type === "rent" ? "Kiralayan" : "Satan"}:</span> {d.closingAgentName}
                        {d.closingTeamName ? ` (${d.closingTeamName})` : ""}
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {manager ? (
          <Card>
            <CardHeader title="Ekipler" description={`Ekip cirosu · ${range.label}`} />
            <div className="px-5 pt-5 pb-5 sm:px-6 sm:pb-6">
              <RankedBars rows={teamRows} format={formatTL} emptyText="Henüz ekip oluşturulmadı. Ekip sayfasından ekleyebilirsiniz." />
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader
              title="Son kontratlar"
              action={
                <Link href="/kontratlar" className="text-sm font-medium text-ink-600 underline-offset-4 hover:text-ink-950 hover:underline">
                  Tümü
                </Link>
              }
            />
            <RecentDeals rows={recent.rows} />
          </Card>
        )}
      </div>

      {manager || leader ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Öne çıkan danışmanlar" description={`Ciro payına göre · ${range.label}`} />
            {topAgents.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-ink-400">{range.label} içinde kontrat yok.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ivory-200">
                {topAgents.map(({ agent, s }, i) => (
                  <li key={agent.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                    <span className="w-5 text-center text-sm font-semibold text-gold-600 tabular-nums">{i + 1}</span>
                    <Avatar name={agent.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">{agent.name}</p>
                      <p className="truncate text-xs text-ink-500">
                        {agent.teamName ?? "Ekipsiz"} · {s.rentCount} kiralama · {s.saleCount} satış
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-ink-950 tabular-nums">{formatTL(s.revenue)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {manager ? (
            <Card>
              <CardHeader
                title="Son kontratlar"
                action={
                  <Link href="/kontratlar" className="text-sm font-medium text-ink-600 underline-offset-4 hover:text-ink-950 hover:underline">
                    Tümü
                  </Link>
                }
              />
              <RecentDeals rows={recent.rows} />
            </Card>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function RecentDeals({ rows }: { rows: Awaited<ReturnType<typeof listDeals>>["rows"] }) {
  if (rows.length === 0) {
    return <p className="px-6 py-10 text-center text-sm text-ink-400">Henüz kontrat girilmedi.</p>;
  }
  return (
    <ul className="mt-3 divide-y divide-ivory-200">
      {rows.map((d) => (
        <li key={d.id}>
          <Link href={`/kontratlar/${d.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-ivory-50 sm:px-6">
            <DealBadge type={d.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{unitLabel(d)}</p>
              <p className="truncate text-xs text-ink-500">
                {d.closingAgentName} · {formatDateISO(d.contractDate)}
              </p>
            </div>
            <p className="text-sm font-semibold text-ink-950 tabular-nums">{formatTL(d.commission)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
