import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { CreateOfficeButton, DomainChips, ManagerRow, OfficeActiveToggle } from "@/components/platform-admin";
import { Badge, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { formatDate } from "@/lib/domain/dates";
import { listOffices } from "@/lib/services/offices";

export const metadata: Metadata = { title: "Platform Yönetimi" };

export default async function PlatformPage() {
  await requirePlatformAdmin();
  const offices = await listOffices();
  const activeOffices = offices.filter((o) => o.office.isActive).length;
  const totalUsers = offices.reduce((sum, o) => sum + o.activeUsers, 0);

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Ofisler"
        description="Platformu kullanan gayrimenkul ofisleri. Her ofisin verileri birbirinden tamamen ayrıdır; burada yalnızca özet sayılar görünür."
        actions={<CreateOfficeButton />}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile accent label="Aktif ofis" value={activeOffices} hint={`${offices.length} ofis kayıtlı`} />
        <StatTile label="Aktif kullanıcı" value={totalUsers} hint="Tüm ofislerde" />
        <StatTile label="Portföy" value={offices.reduce((sum, o) => sum + o.portfolios, 0)} hint="Tüm ofislerde" />
      </div>

      {offices.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Landmark className="size-6" aria-hidden />}
            title="Henüz ofis yok"
            description="İlk ofisi oluşturun. Ofisin e-posta uzantısını ve üst yöneticisini belirlemeniz yeterli."
            action={<CreateOfficeButton />}
          />
        </div>
      ) : (
        <ul className="space-y-5">
          {offices.map((o) => (
            <li key={o.office.id} className="card overflow-hidden">
              <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-ivory-200 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-display text-2xl leading-tight text-ink-950">{o.office.name}</h2>
                    <Badge tone={o.office.isActive ? "green" : "red"}>{o.office.isActive ? "Aktif" : "Erişim durduruldu"}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-500">Oluşturulma: {formatDate(o.office.createdAt)}</p>
                </div>
                <OfficeActiveToggle officeId={o.office.id} officeName={o.office.name} active={o.office.isActive} />
              </header>

              <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <p className="eyebrow mb-3">E-posta uzantıları</p>
                  <DomainChips officeId={o.office.id} domains={o.domains} />

                  <dl className="mt-6 grid grid-cols-4 gap-3 text-center">
                    {[
                      { label: "Kullanıcı", value: o.activeUsers },
                      { label: "Bekleyen", value: o.pendingUsers },
                      { label: "Portföy", value: o.portfolios },
                      { label: "Kontrat", value: o.deals },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl bg-ivory-100 px-2 py-3">
                        <dd className="text-xl font-semibold text-ink-950 tabular-nums">{s.value}</dd>
                        <dt className="mt-0.5 text-xs text-ink-500">{s.label}</dt>
                      </div>
                    ))}
                  </dl>
                </div>

                <div>
                  <p className="eyebrow mb-1">Üst yöneticiler</p>
                  {o.managers.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-500">Aktif üst yönetici yok.</p>
                  ) : (
                    <ul className="divide-y divide-ivory-200">
                      {o.managers.map((m) => (
                        <ManagerRow key={m.id} manager={m} />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
