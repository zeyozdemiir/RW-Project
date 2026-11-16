import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { DealType, ListingType, PortfolioStatus, UserRole } from "@/lib/db/schema";
import { cn } from "@/lib/cn";
import { DEAL_LABELS, LISTING_LABELS, ROLE_LABELS, STATUS_LABELS, initials } from "@/lib/domain/labels";

type Variant = "primary" | "gold" | "secondary" | "ghost" | "danger";

export function buttonClass(variant: Variant = "primary", size: "md" | "sm" = "md", extra?: string): string {
  return cn("btn", `btn-${variant}`, size === "sm" && "btn-sm", extra);
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: "md" | "sm" }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("card", className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
      <div className="min-w-0">
        <h2 className="font-display text-[1.375rem] leading-tight text-ink-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mb-8">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="font-display text-[2rem] leading-[1.1] text-ink-950 sm:text-[2.5rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-[0.9375rem] text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

const STATUS_STYLE: Record<PortfolioStatus, { chip: string; dot: string }> = {
  available: { chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500" },
  deposit: { chip: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  rented: { chip: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-500" },
  sold: { chip: "bg-violet-50 text-violet-800 ring-violet-200", dot: "bg-violet-500" },
  inactive: { chip: "bg-ink-50 text-ink-600 ring-ink-200", dot: "bg-ink-400" },
};

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-inset";

export function StatusBadge({ status }: { status: PortfolioStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cn(chipBase, s.chip)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function statusDotClass(status: PortfolioStatus): string {
  return STATUS_STYLE[status].dot;
}

export function ListingBadge({ type }: { type: ListingType }) {
  return (
    <span
      className={cn(
        chipBase,
        type === "rent" ? "bg-ink-900 text-white ring-ink-900" : "bg-gold-100 text-gold-700 ring-gold-300",
      )}
    >
      {LISTING_LABELS[type]}
    </span>
  );
}

export function DealBadge({ type }: { type: DealType }) {
  return (
    <span
      className={cn(
        chipBase,
        type === "rent" ? "bg-ink-900 text-white ring-ink-900" : "bg-gold-100 text-gold-700 ring-gold-300",
      )}
    >
      {DEAL_LABELS[type]}
    </span>
  );
}

type Tone = "neutral" | "gold" | "green" | "amber" | "red" | "blue";
const TONES: Record<Tone, string> = {
  neutral: "bg-ink-50 text-ink-700 ring-ink-200",
  gold: "bg-gold-50 text-gold-700 ring-gold-300",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn(chipBase, TONES[tone])}>{children}</span>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  const tone: Tone = role === "manager" ? "gold" : role === "leader" ? "blue" : "neutral";
  return <Badge tone={tone}>{ROLE_LABELS[role]}</Badge>;
}

export function Avatar({ name, size = "md", tone = "light" }: { name: string; size?: "sm" | "md" | "lg"; tone?: "light" | "dark" }) {
  const dims = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-12 text-base" : "size-10 text-sm";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide",
        dims,
        tone === "dark" ? "bg-gold-400/15 text-gold-300 ring-1 ring-gold-400/30" : "bg-ink-900 text-gold-200",
      )}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-gold-50 text-gold-600 ring-1 ring-gold-200">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-2xl text-ink-900">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  icon,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3.5 text-sm", styles)}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}

/** Tek bir güncel değeri gösteren özet kutusu. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  accent = false,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[0.8125rem] font-medium", accent ? "text-gold-200/90" : "text-ink-500")}>{label}</p>
        {icon ? (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              accent ? "bg-white/10 text-gold-300" : "bg-gold-50 text-gold-600 ring-1 ring-gold-200",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className={cn("mt-3 text-[1.75rem] leading-none font-semibold tracking-tight", accent ? "text-white" : "text-ink-950")}>
        {value}
      </p>
      {hint ? <p className={cn("mt-2.5 text-[0.8125rem]", accent ? "text-ink-300" : "text-ink-500")}>{hint}</p> : null}
    </>
  );
  const className = cn(
    "block rounded-2xl p-5 transition-shadow",
    accent
      ? "bg-linear-to-br from-ink-900 to-ink-800 shadow-lift ring-1 ring-ink-700"
      : "border border-ivory-300/80 bg-white shadow-card",
    href && "hover:shadow-lift",
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Sayfa üstündeki bölüm sekmeleri / filtre hapları. */
export function PillLink({
  href,
  active,
  children,
  count,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-ink-900 text-white shadow-sm"
          : "border border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900",
      )}
    >
      {children}
      {count !== undefined ? (
        <span
          className={cn(
            "rounded-full px-1.5 text-xs tabular-nums",
            active ? "bg-white/15 text-gold-200" : "bg-ink-50 text-ink-500",
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Sayfalama" className="mt-6 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClass("secondary", "sm")}>
          Önceki
        </Link>
      ) : (
        <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-40")}>Önceki</span>
      )}
      <span className="text-ink-500 tabular-nums">
        Sayfa {page} / {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={buttonClass("secondary", "sm")}>
          Sonraki
        </Link>
      ) : (
        <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-40")}>Sonraki</span>
      )}
    </nav>
  );
}

export function DefinitionList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-ink-500">{item.label}</dt>
          <dd className="mt-1 text-[0.9375rem] font-medium break-words text-ink-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
