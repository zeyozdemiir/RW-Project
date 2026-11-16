import type { Metadata } from "next";
import { Mail, Phone, UserCheck, Users } from "lucide-react";
import { ApprovalForm, CreateTeamButton, MemberEditButton, TeamAdminButtons } from "@/components/team-admin";
import { Avatar, Badge, EmptyState, PageHeader, PillLink, RoleBadge } from "@/components/ui";
import { requireOffice } from "@/lib/auth/guards";
import { PERIODS, PERIOD_LABELS, formatDate, parsePeriod, periodRange } from "@/lib/domain/dates";
import { USER_STATUS_LABELS } from "@/lib/domain/labels";
import { formatTL } from "@/lib/domain/money";
import { canViewEarningsOf } from "@/lib/domain/permissions";
import { activePortfoliosByAgent, loadStatDeals, rangeOf, summarize, type StatDeal } from "@/lib/services/stats";
import { listTeams } from "@/lib/services/teams";
import { listMembers, type MemberRow } from "@/lib/services/users";
import { hrefWith, type SearchParams } from "@/lib/url";

export const metadata: Metadata = { title: "Ekip" };

const ROLE_ORDER = { manager: 0, leader: 1, agent: 2, platform_admin: 3 } as const;

function sortMembers(list: MemberRow[]): MemberRow[] {
  return [...list].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name, "tr"));
}

export default async function TeamPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { viewer, office } = await requireOffice();
  const manager = viewer.role === "manager";
  const period = parsePeriod(sp.donem);
  const range = periodRange(period);

  const [members, teams, deals, activeByAgent] = await Promise.all([
    listMembers(viewer),
    listTeams(office.id),
    loadStatDeals(office.id, rangeOf(range)),
    activePortfoliosByAgent(office.id),
  ]);

  const pending = members.filter((m) => m.status === "pending");
  const active = members.filter((m) => m.status === "active");
  const inactive = members.filter((m) => m.status === "disabled" || m.status === "rejected");
  const teamOptions = teams.map((t) => ({ id: t.id, name: t.name }));
  const showStats = manager || viewer.role === "leader";

  const groups: Array<{ team: { id: string; name: string } | null; members: MemberRow[] }> = [
    ...teams.map((t) => ({
      team: { id: t.id, name: t.name },
      members: sortMembers(active.filter((m) => m.teamId === t.id)),
    })),
    { team: null, members: sortMembers(active.filter((m) => m.teamId === null)) },
  ].filter((g) => g.team !== null || g.members.length > 0);

  return (
    <>
      <PageHeader
        eyebrow={office.name}
        title="Ekip"
        description={
          manager
            ? "Ekipler, ekip liderleri ve danışmanlar. Yeni kayıtlara giriş izni verin, rol ve ekip atayın."
            : "Ofisinizdeki ekipler ve çalışma arkadaşlarınız."
        }
        actions={manager ? <CreateTeamButton /> : null}
      />

      {manager && pending.length > 0 ? (
        <section
          aria-label="Onay bekleyenler"
          className="mb-8 overflow-hidden rounded-2xl border border-gold-300 bg-white shadow-card"
        >
          <header className="flex items-center gap-3 border-b border-gold-200 bg-gold-50 px-5 py-4 sm:px-6">
            <UserCheck className="size-5 shrink-0 text-gold-600" aria-hidden />
            <div className="min-w-0">
              <h2 className="font-display text-xl leading-tight text-ink-950">Giriş onayı bekleyenler</h2>
              <p className="text-sm text-ink-600">Siz izin verene kadar bu kişiler giriş yapamaz.</p>
            </div>
            <span className="ml-auto rounded-full bg-gold-400 px-2.5 py-0.5 text-sm font-semibold text-ink-950 tabular-nums">
              {pending.length}
            </span>
          </header>
          <ul className="divide-y divide-ivory-200">
            {pending.map((m) => (
              <li key={m.id} className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
                <div className="flex items-start gap-3">
                  <Avatar name={m.name} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-950">{m.name}</p>
                    <p className="truncate text-sm text-ink-600">{m.email}</p>
                    {m.phone ? <p className="text-sm text-ink-500">{m.phone}</p> : null}
                    <p className="mt-1 text-xs text-ink-400">Kayıt: {formatDate(m.createdAt)}</p>
                  </div>
                </div>
                <ApprovalForm userId={m.id} teams={teamOptions} officeRate={office.agentRatePct} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showStats ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <PillLink key={p} href={hrefWith("/ekip", sp, { donem: p === "bu-ay" ? null : p })} active={p === period}>
              {PERIOD_LABELS[p]}
            </PillLink>
          ))}
          <span className="ml-1 text-sm text-ink-500">{range.label}</span>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users className="size-6" aria-hidden />}
            title="Henüz ekip yok"
            description={
              manager
                ? "İlk ekibi oluşturun, ardından danışmanları ekiplere atayın."
                : "Üst yönetici ekipleri oluşturduğunda burada görünür."
            }
            action={manager ? <CreateTeamButton /> : null}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const leaders = g.members.filter((m) => m.role === "leader");
            const canSeeTotals = manager || (g.team !== null && viewer.role === "leader" && viewer.teamId === g.team.id);
            const totals = g.team && canSeeTotals ? summarize(deals, { kind: "team", teamId: g.team.id }) : null;
            const teamId = g.team?.id ?? null;
            return (
              <section key={teamId ?? "none"} className="card overflow-hidden">
                <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ivory-200 px-5 py-4 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-2xl leading-tight text-ink-950">{g.team?.name ?? "Ekipsiz"}</h2>
                    <p className="text-sm text-ink-500">
                      {g.members.length} kişi
                      {leaders.length > 0
                        ? ` · Lider: ${leaders.map((l) => l.name).join(", ")}`
                        : g.team
                          ? " · Lider atanmadı"
                          : ""}
                    </p>
                  </div>
                  {totals ? (
                    <p className="text-sm text-ink-600">
                      {totals.rentCount} kiralama · {totals.saleCount} satış ·{" "}
                      <span className="font-semibold text-ink-950 tabular-nums">{formatTL(totals.revenue)}</span> ciro
                    </p>
                  ) : null}
                  {manager && g.team ? (
                    <TeamAdminButtons team={g.team} empty={members.every((m) => m.teamId !== teamId)} />
                  ) : null}
                </header>

                {g.members.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-ink-400">Bu ekipte henüz kimse yok.</p>
                ) : (
                  <ul className="divide-y divide-ivory-200">
                    {g.members.map((m) => (
                      <MemberLine
                        key={m.id}
                        m={m}
                        deals={deals}
                        activePortfolios={activeByAgent.get(m.id) ?? 0}
                        showStats={showStats && canViewEarningsOf(viewer, { id: m.id, teamId: m.teamId })}
                        isSelf={m.id === viewer.id}
                        editor={
                          manager ? (
                            <MemberEditButton
                              member={m}
                              teams={teamOptions}
                              officeRate={office.agentRatePct}
                              isSelf={m.id === viewer.id}
                            />
                          ) : null
                        }
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {manager && inactive.length > 0 ? (
        <section className="card mt-8 overflow-hidden">
          <header className="border-b border-ivory-200 px-5 py-4 sm:px-6">
            <h2 className="font-display text-xl leading-tight text-ink-950">Kapalı hesaplar</h2>
            <p className="text-sm text-ink-500">Bu kişiler giriş yapamaz; kayıtları korunur.</p>
          </header>
          <ul className="divide-y divide-ivory-200">
            {inactive.map((m) => (
              <li key={m.id} className="px-5 py-3.5 sm:px-6">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{m.name}</p>
                    <p className="truncate text-xs text-ink-500">{m.email}</p>
                  </div>
                  <Badge tone={m.status === "rejected" ? "red" : "neutral"}>{USER_STATUS_LABELS[m.status]}</Badge>
                  {m.status === "disabled" ? (
                    <MemberEditButton member={m} teams={teamOptions} officeRate={office.agentRatePct} isSelf={false} />
                  ) : null}
                </div>
                {m.status === "rejected" ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-ink-600 hover:text-ink-950">
                      Başvuruyu yeniden değerlendir
                    </summary>
                    <div className="mt-3">
                      <ApprovalForm userId={m.id} teams={teamOptions} officeRate={office.agentRatePct} allowReject={false} />
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function MemberLine({
  m,
  deals,
  activePortfolios,
  showStats,
  isSelf,
  editor,
}: {
  m: MemberRow;
  deals: StatDeal[];
  activePortfolios: number;
  showStats: boolean;
  isSelf: boolean;
  editor: React.ReactNode;
}) {
  const s = showStats ? summarize(deals, { kind: "agent", agentId: m.id }) : null;
  const stats = s
    ? [
        { label: "Portföy", value: String(activePortfolios) },
        { label: "Kiralama", value: String(s.rentCount) },
        { label: "Satış", value: String(s.saleCount) },
        { label: "Ciro", value: formatTL(s.revenue) },
      ]
    : [];

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
        <Avatar name={m.name} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-ink-950">{m.name}</span>
            {isSelf ? <span className="text-xs text-gold-600">(siz)</span> : null}
            <RoleBadge role={m.role} />
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-ink-500">
            <a href={`mailto:${m.email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-ink-900">
              <Mail className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{m.email}</span>
            </a>
            {m.phone ? (
              <a href={`tel:${m.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-ink-900">
                <Phone className="size-3.5" aria-hidden />
                {m.phone}
              </a>
            ) : null}
          </p>
        </div>
      </div>

      {stats.length > 0 ? (
        <dl className="grid grid-cols-4 gap-x-5 text-right text-sm sm:gap-x-7">
          {stats.map((st) => (
            <div key={st.label}>
              <dt className="text-[0.6875rem] font-medium tracking-wide text-ink-400 uppercase">{st.label}</dt>
              <dd className="mt-0.5 font-semibold text-ink-900 tabular-nums">{st.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {editor}
    </li>
  );
}
