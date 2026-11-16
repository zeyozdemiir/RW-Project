import type { Metadata } from "next";
import { Banknote, KeyRound, Tag, Wallet } from "lucide-react";
import { MonthlyRevenueChart } from "@/components/charts";
import { Avatar, Card, CardHeader, PageHeader, PillLink, StatTile } from "@/components/ui";
import { requireOffice } from "@/lib/auth/guards";
import { PERIODS, PERIOD_LABELS, parsePeriod, periodRange } from "@/lib/domain/dates";
import { formatTL } from "@/lib/domain/money";
import { canViewEarningsOf } from "@/lib/domain/permissions";
import {
  activePortfoliosByAgent,
  loadStatDeals,
  monthlySeries,
  rangeOf,
  summarize,
  type Scope,
} from "@/lib/services/stats";
import { listTeams } from "@/lib/services/teams";
import { listMembers } from "@/lib/services/users";
import { hrefWith, type SearchParams } from "@/lib/url";

export const metadata: Metadata = { title: "Ciro ve Kazanç" };

export default async function EarningsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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

  const [deals, series, members, teams, activeByAgent] = await Promise.all([
    loadStatDeals(office.id, rangeOf(range)),
    monthlySeries(office.id, scope, 12),
    listMembers(viewer),
    listTeams(office.id),
    activePortfoliosByAgent(office.id),
  ]);

  const summary = summarize(deals, scope);
  const agentEarnings = manager ? summary.revenue - summary.earning : summary.earning;

  // Kimin kazancı görülebilir: yönetici herkesin, lider ekibinin, danışman yalnızca kendisinin.
  const rows = members
    .filter((m) => m.status === "active" || m.status === "disabled")
    .filter((m) => canViewEarningsOf(viewer, { id: m.id, teamId: m.teamId }))
    .map((m) => ({ member: m, s: summarize(deals, { kind: "agent", agentId: m.id }) }))
    .filter((r) => r.member.status === "active" || r.s.revenue > 0 || r.s.rentCount + r.s.saleCount > 0)
    .sort((a, b) => b.s.revenue - a.s.revenue || a.member.name.localeCompare(b.member.name, "tr"));

  const totals = rows.reduce(
    (acc, r) => ({
      rent: acc.rent + r.s.rentCount,
      sale: acc.sale + r.s.saleCount,
      listed: acc.listed + r.s.listedByOthersCount,
      revenue: acc.revenue + r.s.revenue,
      earning: acc.earning + r.s.earning,
    }),
    { rent: 0, sale: 0, listed: 0, revenue: 0, earning: 0 },
  );

  const teamRows = manager
    ? teams.map((t) => ({ team: t, s: summarize(deals, { kind: "team", teamId: t.id }) }))
    : [];

  return (
    <>
      <PageHeader
        eyebrow={office.name}
        title="Ciro ve Kazanç"
        description={
          manager
            ? "Ofisin cirosu, ekip ve danışman bazında dağılımı ve ofise kalan kazanç."
            : leader
              ? "Ekibinizin cirosu ve danışman kazançları."
              : "Yaptığınız işlemlerden ciro payınız ve kazancınız."
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <PillLink key={p} href={hrefWith("/kazanc", sp, { donem: p === "bu-ay" ? null : p })} active={p === period}>
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
          hint="Toplam hizmet bedeli"
          icon={<Banknote className="size-[1.1rem]" aria-hidden />}
        />
        {manager ? (
          <StatTile
            label="Ofis kazancı"
            value={formatTL(summary.earning)}
            hint={`Danışman kazançları: ${formatTL(agentEarnings)}`}
            icon={<Wallet className="size-[1.1rem]" aria-hidden />}
          />
        ) : (
          <StatTile
            label={leader ? "Ekip kazancı" : "Kazancınız"}
            value={formatTL(summary.earning)}
            hint="Ciro payı üzerinden danışman kazancı"
            icon={<Wallet className="size-[1.1rem]" aria-hidden />}
          />
        )}
        <StatTile
          label="Kiralama"
          value={summary.rentCount}
          hint={`${formatTL(summary.rentRevenue)} ciro`}
          icon={<KeyRound className="size-[1.1rem]" aria-hidden />}
        />
        <StatTile
          label="Satış"
          value={summary.saleCount}
          hint={`${formatTL(summary.saleRevenue)} ciro`}
          icon={<Tag className="size-[1.1rem]" aria-hidden />}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Aylık ciro"
          description={`${manager ? "Ofis cirosu" : leader ? "Ekip cirosu" : "Ciro payınız"} · son 12 ay`}
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

      {manager && teamRows.length > 0 ? (
        <Card className="mt-6 overflow-hidden">
          <CardHeader title="Ekipler" description={range.label} />
          <div className="table-wrap mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Ekip</th>
                  <th className="num">Kiralama</th>
                  <th className="num">Satış</th>
                  <th className="num">Çapraz işlem</th>
                  <th className="num">Ciro</th>
                  <th className="num">Danışman kazancı</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map(({ team, s }) => (
                  <tr key={team.id}>
                    <td className="font-medium text-ink-950">{team.name}</td>
                    <td className="num">{s.rentCount}</td>
                    <td className="num">{s.saleCount}</td>
                    <td className="num">{s.crossCount}</td>
                    <td className="num font-semibold text-ink-950">{formatTL(s.revenue)}</td>
                    <td className="num">{formatTL(s.earning)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title={manager ? "Danışmanlar" : leader ? "Ekibiniz" : "Sizin özetiniz"}
          description={
            <>
              {range.label} · <span className="whitespace-nowrap">“Portföyünden” sütunu,</span> danışmanın portföyünü
              başka bir danışmanın kapattığı işlemleri gösterir.
            </>
          }
        />
        <div className="table-wrap mt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Danışman</th>
                <th className="num">Aktif portföy</th>
                <th className="num">Kiralama</th>
                <th className="num">Satış</th>
                <th className="num">Portföyünden</th>
                <th className="num">Ciro payı</th>
                <th className="num">Kazanç</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, s }) => (
                <tr key={member.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-950">
                          {member.name}
                          {member.status === "disabled" ? <span className="ml-2 text-xs font-normal text-ink-400">(kapalı hesap)</span> : null}
                        </p>
                        <p className="truncate text-xs text-ink-500">{member.teamName ?? "Ekipsiz"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="num">{activeByAgent.get(member.id) ?? 0}</td>
                  <td className="num">{s.rentCount}</td>
                  <td className="num">{s.saleCount}</td>
                  <td className="num">{s.listedByOthersCount}</td>
                  <td className="num font-semibold text-ink-950">{formatTL(s.revenue)}</td>
                  <td className="num font-semibold text-emerald-700">{formatTL(s.earning)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 1 ? (
              <tfoot>
                <tr className="bg-ivory-50">
                  <td className="border-t border-ivory-300 px-4 py-3.5 text-sm font-semibold text-ink-950">Toplam</td>
                  <td className="border-t border-ivory-300" />
                  <td className="num border-t border-ivory-300 px-4 py-3.5 text-sm font-semibold">{totals.rent}</td>
                  <td className="num border-t border-ivory-300 px-4 py-3.5 text-sm font-semibold">{totals.sale}</td>
                  <td className="num border-t border-ivory-300 px-4 py-3.5 text-sm font-semibold">{totals.listed}</td>
                  <td className="num border-t border-ivory-300 px-4 py-3.5 text-sm font-semibold text-ink-950">
                    {formatTL(totals.revenue)}
                  </td>
                  <td className="num border-t border-ivory-300 px-4 py-3.5 text-sm font-semibold text-emerald-700">
                    {formatTL(totals.earning)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </Card>

      <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-500">
        Ciro, kontratlardaki hizmet bedellerinin toplamıdır. Çapraz işlemde ciro, portföy sahibi ile işlemi yapan danışman
        arasında paylaşılır. Kazanç, danışmanın kendi ciro payı üzerinden danışman payı oranıyla hesaplanır
        {manager ? "; oranları Ayarlar ve Ekip sayfalarından değiştirebilirsiniz" : ""}. İptal edilen kontratlar dahil
        edilmez.
      </p>
    </>
  );
}
