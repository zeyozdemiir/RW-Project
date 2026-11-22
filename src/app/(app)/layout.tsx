import { eq } from "drizzle-orm";
import { AppShell, type NavItem } from "@/components/shell";
import { logoutAction } from "@/lib/actions/auth";
import { requireOffice } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { countOpenAlerts } from "@/lib/services/alerts";
import { countPendingUsers } from "@/lib/services/users";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const { viewer, user, office } = await requireOffice();
  const manager = viewer.role === "manager";

  const [openAlerts, pendingUsers, teamRows] = await Promise.all([
    manager ? countOpenAlerts(office.id) : Promise.resolve(0),
    manager ? countPendingUsers(office.id) : Promise.resolve(0),
    viewer.teamId
      ? db.select({ name: teams.name }).from(teams).where(eq(teams.id, viewer.teamId)).limit(1)
      : Promise.resolve([]),
  ]);

  const items: NavItem[] = [
    { key: "panel", href: "/panel", label: "Panel" },
    { key: "portfoyler", href: "/portfoyler", label: "Portföyler" },
    { key: "kontratlar", href: "/kontratlar", label: "Kontratlar" },
    ...(manager ? [{ key: "uyarilar" as const, href: "/uyarilar", label: "Uyarılar", badge: openAlerts }] : []),
    { key: "ekip", href: "/ekip", label: "Ekip", badge: pendingUsers },
    { key: "kazanc", href: "/kazanc", label: "Ciro ve Kazanç" },
    { key: "ayarlar", href: "/ayarlar", label: "Ayarlar" },
  ];

  return (
    <AppShell
      officeName={office.name}
      userName={user.name}
      roleLabel={ROLE_LABELS[user.role]}
      teamName={teamRows[0]?.name ?? null}
      items={items}
      logout={logoutAction}
    >
      {children}
    </AppShell>
  );
}
