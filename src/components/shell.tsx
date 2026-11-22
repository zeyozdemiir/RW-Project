"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BuildingComplex,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldExclamationPoint,
  Signature,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Brand } from "./brand";
import { Avatar } from "./ui";

export type NavKey = "panel" | "portfoyler" | "kontratlar" | "uyarilar" | "ekip" | "kazanc" | "ayarlar";
export type NavItem = { key: NavKey; href: string; label: string; badge?: number };

const ICONS: Record<NavKey, LucideIcon> = {
  panel: LayoutDashboard,
  portfoyler: BuildingComplex,
  kontratlar: Signature,
  uyarilar: ShieldExclamationPoint,
  ekip: Users,
  kazanc: TrendingUp,
  ayarlar: Settings,
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active = isActive(pathname, item.href);
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-11 items-center gap-3 rounded-xl px-3.5 text-[0.9375rem] transition-colors",
                active ? "bg-white/[0.08] font-medium text-white" : "text-ink-300 hover:bg-white/[0.05] hover:text-white",
              )}
            >
              {active ? <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-gold-400" aria-hidden /> : null}
              <Icon className={cn("size-[1.15rem] shrink-0", active ? "text-gold-400" : "text-ink-400 group-hover:text-gold-300")} aria-hidden />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span className="min-w-6 rounded-full bg-gold-400 px-1.5 py-0.5 text-center text-xs font-semibold text-ink-950 tabular-nums">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarBody({
  officeName,
  userName,
  roleLabel,
  teamName,
  items,
  pathname,
  logout,
  onNavigate,
}: {
  officeName: string;
  userName: string;
  roleLabel: string;
  teamName: string | null;
  items: NavItem[];
  pathname: string;
  logout: () => Promise<void>;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-7 pb-6">
        <Brand />
        <div className="gold-rule mt-6 opacity-70" />
        <p className="eyebrow mt-5 text-gold-400/80">Ofis</p>
        <p className="mt-1.5 font-display text-xl leading-snug text-white">{officeName}</p>
      </div>

      <nav aria-label="Ana menü" className="flex-1 overflow-y-auto px-3 pb-4">
        <NavList items={items} pathname={pathname} onNavigate={onNavigate} />
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={userName} tone="dark" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="truncate text-xs text-ink-300">
              {roleLabel}
              {teamName ? ` · ${teamName}` : ""}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex size-9 items-center justify-center rounded-full text-ink-300 hover:bg-white/10 hover:text-white"
              aria-label="Çıkış yap"
              title="Çıkış yap"
            >
              <LogOut className="size-[1.1rem]" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  officeName,
  userName,
  roleLabel,
  teamName,
  items,
  logout,
  children,
}: {
  officeName: string;
  userName: string;
  roleLabel: string;
  teamName: string | null;
  items: NavItem[];
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const sidebarProps = { officeName, userName, roleLabel, teamName, items, pathname, logout };
  const bottom = items.filter((i) => i.key === "panel" || i.key === "portfoyler" || i.key === "kontratlar");
  const alertBadge = items.reduce((sum, i) => (i.key === "uyarilar" || i.key === "ekip" ? sum + (i.badge ?? 0) : sum), 0);

  return (
    <div className="min-h-dvh lg:pl-72">
      {/* Masaüstü yan menü */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 bg-ink-950 bg-[radial-gradient(120%_60%_at_0%_0%,rgb(205_170_87/0.10),transparent_60%)] lg:block">
        <SidebarBody {...sidebarProps} />
      </aside>

      {/* Mobil üst çubuk */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-ink-950 px-4 lg:hidden">
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-none text-white">{officeName}</p>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="relative flex size-10 items-center justify-center rounded-full text-white hover:bg-white/10"
          aria-label="Menüyü aç"
          aria-expanded={drawerOpen}
        >
          <Menu className="size-5" aria-hidden />
          {alertBadge > 0 ? <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-gold-400 ring-2 ring-ink-950" aria-hidden /> : null}
        </button>
      </header>

      {/* Mobil çekmece */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menü">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-[2px]"
            aria-label="Menüyü kapat"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[19rem] max-w-[86vw] bg-ink-950 shadow-lift">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute top-5 right-4 flex size-9 items-center justify-center rounded-full text-ink-300 hover:bg-white/10 hover:text-white"
              aria-label="Menüyü kapat"
            >
              <X className="size-5" aria-hidden />
            </button>
            <SidebarBody {...sidebarProps} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[84rem] px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10 lg:pb-16">{children}</main>

      {/* Mobil alt menü */}
      <nav
        aria-label="Hızlı menü"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-ivory-300 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
          {bottom.slice(0, 2).map((item) => (
            <BottomLink key={item.key} item={item} pathname={pathname} />
          ))}
          <li className="flex justify-center">
            <Link
              href="/kontratlar/yeni"
              className="-mt-5 flex size-14 flex-col items-center justify-center rounded-full bg-ink-900 text-gold-300 shadow-lift ring-4 ring-white"
              aria-label="Yeni kontrat gir"
            >
              <Plus className="size-6" aria-hidden />
            </Link>
          </li>
          {bottom.slice(2, 3).map((item) => (
            <BottomLink key={item.key} item={item} pathname={pathname} />
          ))}
          <li>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-ink-500"
            >
              <Menu className="size-5" aria-hidden />
              Menü
              {alertBadge > 0 ? <span className="absolute top-2.5 right-[calc(50%-1rem)] size-2 rounded-full bg-gold-500" aria-hidden /> : null}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function BottomLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = ICONS[item.key];
  const active = isActive(pathname, item.href);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
          active ? "text-ink-950" : "text-ink-500",
        )}
      >
        <Icon className={cn("size-5", active && "text-gold-600")} aria-hidden />
        {item.label}
      </Link>
    </li>
  );
}
