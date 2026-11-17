import type { Metadata } from "next";
import { OfficeSettingsForm, PasswordForm, ProfileForm } from "@/components/settings-forms";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { requireOffice } from "@/lib/auth/guards";
import { getOfficeDomains } from "@/lib/services/offices";

export const metadata: Metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const { viewer, user, office } = await requireOffice();
  const manager = viewer.role === "manager";
  const domains = await getOfficeDomains(office.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={office.name} title="Ayarlar" />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Hesabım" description="Ekip arkadaşlarınız adınızı ve telefonunuzu görebilir." />
          <div className="px-5 pt-5 pb-6 sm:px-6">
            <ProfileForm name={user.name} phone={user.phone ?? ""} email={user.email} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Şifre" description="Şifrenizi değiştirdiğinizde diğer cihazlardaki oturumlarınız kapatılır." />
          <div className="px-5 pt-5 pb-6 sm:px-6">
            <PasswordForm />
          </div>
        </Card>

        {manager ? (
          <Card>
            <CardHeader title="Ofis ayarları" description="Ciro paylaşımı ve kazanç hesabında kullanılan oranlar." />
            <div className="px-5 pt-5 pb-6 sm:px-6">
              <OfficeSettingsForm
                name={office.name}
                agentRatePct={office.agentRatePct}
                listingSharePct={office.listingSharePct}
              />
            </div>
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Ofis e-posta uzantısı"
            description="Yalnızca bu uzantıya sahip e-posta adresleriyle kayıt olunabilir. Değişiklik için platform yöneticinize başvurun."
          />
          <div className="flex flex-wrap gap-2 px-5 pt-4 pb-6 sm:px-6">
            {domains.map((d) => (
              <Badge key={d} tone="gold">
                @{d}
              </Badge>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
