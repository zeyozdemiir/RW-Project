import { LogOut } from "lucide-react";
import { Brand } from "@/components/brand";
import { logoutAction } from "@/lib/actions/auth";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  return (
    <div className="min-h-dvh">
      <header className="bg-ink-950">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Brand />
            <span className="hidden rounded-full bg-gold-400/15 px-3 py-1 text-xs font-semibold tracking-wide text-gold-300 ring-1 ring-gold-400/30 sm:inline">
              Platform Yönetimi
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-300 sm:inline">{admin.email}</span>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-sm text-ink-200 hover:bg-white/10 hover:text-white">
                <LogOut className="size-4" aria-hidden />
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
