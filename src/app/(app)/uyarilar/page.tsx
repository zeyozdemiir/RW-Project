import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ShieldExclamationPoint } from "lucide-react";
import { AlertResolveButtons, LinkCandidateButton } from "@/components/alert-actions";
import { Avatar, Badge, DealBadge, EmptyState, ListingBadge, PageHeader, PillLink, StatusBadge } from "@/components/ui";
import { requireManager } from "@/lib/auth/guards";
import { formatDate, formatDateISO, formatDateTime } from "@/lib/domain/dates";
import { unitLabel } from "@/lib/domain/labels";
import { formatTL } from "@/lib/domain/money";
import { countOpenAlerts, listAlerts, type AlertRow } from "@/lib/services/alerts";
import { listActiveAgents } from "@/lib/services/users";
import { param, type SearchParams } from "@/lib/url";

export const metadata: Metadata = { title: "Uyarılar" };

const RESOLUTION_LABEL = {
  linked: "Mevcut portföye bağlandı",
  created: "Portföy kaydı oluşturuldu",
  dismissed: "Açıklamayla kapatıldı",
} as const;

export default async function AlertsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { viewer, office } = await requireManager();
  const showResolved = param(sp, "durum") === "kapali";

  const [alerts, openCount, agents] = await Promise.all([
    listAlerts(viewer, showResolved ? "resolved" : "open"),
    countOpenAlerts(office.id),
    listActiveAgents(office.id),
  ]);
  const agentOptions = agents.map((a) => ({ id: a.id, name: a.name, teamName: a.teamName }));

  return (
    <>
      <PageHeader
        eyebrow="Portföy güvencesi"
        title="Uyarılar"
        description="Kontratta yazan daire sistemde kayıtlı bir portföyle eşleşmediğinde burada uyarı oluşur. Her uyarıyı bir portföye bağlayarak ya da açıklama yazarak kapatabilirsiniz."
      />

      <div className="mb-6 flex gap-2">
        <PillLink href="/uyarilar" active={!showResolved} count={openCount}>
          Açık uyarılar
        </PillLink>
        <PillLink href="/uyarilar?durum=kapali" active={showResolved}>
          Kapatılanlar
        </PillLink>
      </div>

      {alerts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ShieldCheck className="size-6" aria-hidden />}
            title={showResolved ? "Kapatılmış uyarı yok" : "Açık uyarı yok"}
            description={
              showResolved
                ? "Kapattığınız uyarılar burada listelenir."
                : "Girilen tüm kontratlar sistemdeki portföylerle eşleşiyor."
            }
          />
        </div>
      ) : (
        <ul className="space-y-5">
          {alerts.map((a) => (
            <li key={a.id}>
              <AlertCard alert={a} agents={agentOptions} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AlertCard({ alert, agents }: { alert: AlertRow; agents: Array<{ id: string; name: string; teamName: string | null }> }) {
  const d = alert.deal;
  const open = alert.status === "open";
  const location = [d.neighborhood, d.district, d.city].filter(Boolean).join(", ");
  // İşlemi yapan danışman pasifleştirilmiş olsa da seçilebilsin.
  const agentOptions = agents.some((x) => x.id === d.closingAgentId)
    ? agents
    : [{ id: d.closingAgentId, name: d.closingAgentName, teamName: d.closingTeamName }, ...agents];

  return (
    <article className={open ? "card overflow-hidden border-amber-300" : "card overflow-hidden"}>
      <header
        className={
          open
            ? "flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3.5 sm:px-6"
            : "flex flex-wrap items-center gap-3 border-b border-ivory-200 bg-ivory-50 px-5 py-3.5 sm:px-6"
        }
      >
        <span className={open ? "text-amber-700" : "text-emerald-600"}>
          {open ? <ShieldExclamationPoint className="size-5" aria-hidden /> : <ShieldCheck className="size-5" aria-hidden />}
        </span>
        <p className="font-semibold text-ink-950">Kayıtsız portföy</p>
        <span className="text-sm text-ink-500">{formatDateTime(alert.createdAt)}</span>
        <Link href={`/kontratlar/${d.id}`} className="ml-auto text-sm font-medium text-ink-700 underline underline-offset-4 hover:text-ink-950">
          Kontrat K-{d.refNo}
        </Link>
      </header>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="eyebrow">Kontratta yazan daire</p>
          <p className="mt-2 font-display text-2xl leading-tight text-ink-950">{unitLabel(d)}</p>
          <p className="mt-1 text-sm text-ink-600">{location}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DealBadge type={d.type} />
            {d.status === "cancelled" ? <Badge tone="red">Kontrat iptal</Badge> : null}
            <span className="text-sm text-ink-600">{formatDateISO(d.contractDate)}</span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-medium tracking-wide text-ink-500">{d.type === "rent" ? "Aylık kira" : "Satış bedeli"}</dt>
              <dd className="mt-0.5 font-semibold text-ink-950 tabular-nums">{formatTL(d.price)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-ink-500">Hizmet bedeli</dt>
              <dd className="mt-0.5 font-semibold text-ink-950 tabular-nums">{formatTL(d.commission)}</dd>
            </div>
          </dl>

          <div className="mt-5 flex items-center gap-3 rounded-xl bg-ivory-100 px-4 py-3">
            <Avatar name={d.closingAgentName} />
            <div className="min-w-0">
              <p className="text-xs text-ink-500">Kontratı yapan</p>
              <p className="truncate font-semibold text-ink-950">{d.closingAgentName}</p>
              <p className="truncate text-sm text-ink-500">{d.closingTeamName ?? "Ekipsiz"}</p>
            </div>
          </div>
        </div>

        <div>
          {open ? (
            <>
              <p className="eyebrow">Sistemdeki benzer kayıtlar</p>
              {alert.candidates.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-ivory-400 px-4 py-5 text-sm text-ink-500">
                  Bu site adıyla kayıtlı bir portföy bulunamadı.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-ivory-200 rounded-xl border border-ivory-300">
                  {alert.candidates.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ListingBadge type={c.listingType} />
                          <StatusBadge status={c.status} />
                          {c.sameUnit ? <Badge tone="gold">Aynı daire no</Badge> : null}
                        </div>
                        <Link href={`/portfoyler/${c.id}`} className="mt-1.5 block truncate text-sm font-semibold text-ink-950 hover:underline">
                          #{c.refNo} · {unitLabel(c)}
                        </Link>
                        <p className="truncate text-xs text-ink-500">{c.agentName}</p>
                      </div>
                      {c.linkable ? (
                        <LinkCandidateButton
                          alertId={alert.id}
                          portfolioId={c.id}
                          portfolioLabel={`Portföy #${c.refNo} — ${unitLabel(c)} (${c.agentName})`}
                        />
                      ) : (
                        <span className="text-xs text-ink-400">
                          {c.listingType !== d.type ? "Tür uyuşmuyor" : "Kapatılmış portföy"}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5">
                <AlertResolveButtons alertId={alert.id} agents={agentOptions} defaultAgentId={d.closingAgentId} />
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">Sonuç</p>
              <p className="mt-2 font-semibold text-ink-950">{alert.resolution ? RESOLUTION_LABEL[alert.resolution] : "Kapatıldı"}</p>
              <p className="mt-1 text-sm text-ink-500">
                {alert.resolvedByName ?? "—"} · {formatDate(alert.resolvedAt)}
              </p>
              {alert.resolutionNote ? (
                <p className="mt-3 rounded-xl bg-ivory-100 px-4 py-3 text-sm leading-relaxed text-ink-800">“{alert.resolutionNote}”</p>
              ) : null}
              {d.portfolioId ? (
                <Link href={`/portfoyler/${d.portfolioId}`} className="btn btn-secondary btn-sm mt-4">
                  Portföy #{d.portfolioRefNo}
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
