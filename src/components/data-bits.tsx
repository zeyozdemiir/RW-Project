import type { PortfolioStatus } from "@/lib/db/schema";
import { cn } from "@/lib/cn";
import { STATUS_LABELS } from "@/lib/domain/labels";
import { statusDotClass } from "./ui";

/** Sıralı yatay çubuklar: tek renk, değer çubuğun ucunda. */
export function RankedBars({
  rows,
  format,
  emptyText = "Henüz veri yok.",
}: {
  rows: Array<{ key: string; label: string; sub?: string; value: number }>;
  format: (value: number) => string;
  emptyText?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-ink-400">{emptyText}</p>;
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium text-ink-900">
              {r.label}
              {r.sub ? <span className="ml-2 font-normal text-ink-500">{r.sub}</span> : null}
            </p>
            <p className="shrink-0 text-sm font-semibold text-ink-950 tabular-nums">{format(r.value)}</p>
          </div>
          <div className="mt-2 h-2.5 rounded-r-[4px] bg-ivory-200" title={`${r.label}: ${format(r.value)}`}>
            <div
              className="h-full rounded-r-[4px] bg-series-rent"
              style={{ width: max > 0 ? `${Math.max((r.value / max) * 100, r.value > 0 ? 1.5 : 0)}%` : "0%" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const SPLIT_ORDER: PortfolioStatus[] = ["available", "deposit", "rented", "sold", "inactive"];

/** Portföylerin duruma göre dağılımı: ince parçalı çubuk + yanında adet listesi. */
export function StatusSplit({ counts }: { counts: Record<PortfolioStatus, number> }) {
  const parts = SPLIT_ORDER.filter((s) => counts[s] > 0);
  const total = parts.reduce((sum, s) => sum + counts[s], 0);
  if (total === 0) return <p className="text-sm text-ink-400">Henüz portföy yok.</p>;
  return (
    <div>
      <div
        className="flex h-2 gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={parts.map((s) => `${STATUS_LABELS[s]}: ${counts[s]}`).join(", ")}
      >
        {parts.map((s) => (
          <span key={s} className={cn("h-full", statusDotClass(s))} style={{ flex: `${counts[s]} 1 0%` }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.8125rem]">
        {parts.map((s) => (
          <li key={s} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-ink-600">
              <span className={cn("size-2 rounded-full", statusDotClass(s))} aria-hidden />
              {STATUS_LABELS[s]}
            </span>
            <span className="font-semibold text-ink-900 tabular-nums">{counts[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
