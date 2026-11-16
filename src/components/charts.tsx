"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatTL, formatTLCompact } from "@/lib/domain/money";

export type MonthDatum = {
  key: string;
  label: string;
  shortLabel: string;
  /** Kuruş */
  rent: number;
  /** Kuruş */
  sale: number;
  rentCount: number;
  saleCount: number;
};

/** Eksenin üst sınırı için "yuvarlak" bir değer: 1 / 2 / 2,5 / 5 × 10ⁿ. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const fraction = value / exp;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * exp;
}

function Legend() {
  return (
    <ul className="flex items-center gap-5 text-[0.8125rem] text-ink-600">
      <li className="flex items-center gap-2">
        <span className="size-2.5 rounded-[3px] bg-series-rent" aria-hidden />
        Kiralama
      </li>
      <li className="flex items-center gap-2">
        <span className="size-2.5 rounded-[3px] bg-series-sale" aria-hidden />
        Satış
      </li>
    </ul>
  );
}

/**
 * Aylık ciro: kiralama ve satış üst üste yığılmış sütunlar.
 * Üzerine gelince (veya klavyeyle odaklanınca) ayın dökümü görünür;
 * aynı veriler altta tablo olarak da açılabilir.
 */
export function MonthlyRevenueChart({ data, valueLabel = "Ciro" }: { data: MonthDatum[]; valueLabel?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const totals = data.map((d) => d.rent + d.sale);
  const max = niceMax(Math.max(...totals, 0));
  const hasData = totals.some((t) => t > 0);
  const ticks = [0, 0.5, 1];
  const lastIndex = data.length - 1;

  return (
    <figure>
      <div className="mb-5 flex justify-end">
        <Legend />
      </div>

      <div className="relative h-56 select-none">
        {/* Yatay kılavuz çizgileri ve eksen değerleri */}
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-ivory-300/80" style={{ bottom: `${t * 100}%` }} aria-hidden>
            <span className="absolute -top-2 left-0 bg-white pr-2 text-[0.6875rem] leading-4 text-ink-400 tabular-nums">
              {formatTLCompact(max * t)}
            </span>
          </div>
        ))}

        <div className="absolute inset-0 grid pl-14" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((d, i) => {
            const total = d.rent + d.sale;
            const isActive = active === i;
            const align = i <= 1 ? "left-0" : i >= data.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <div key={d.key} className="relative h-full">
                <button
                  type="button"
                  className={cn(
                    "flex h-full w-full cursor-default items-end justify-center rounded-md outline-offset-0 transition-colors",
                    isActive && "bg-ink-50",
                  )}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive((cur) => (cur === i ? null : cur))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                  aria-label={`${d.label}: ${valueLabel.toLocaleLowerCase("tr-TR")} ${formatTL(total)}; kiralama ${formatTL(d.rent)} (${d.rentCount} adet), satış ${formatTL(d.sale)} (${d.saleCount} adet)`}
                >
                  {total > 0 ? (
                    <span
                      className="flex w-full max-w-6 flex-col-reverse gap-[2px]"
                      style={{ height: `${Math.max((total / max) * 100, 1.5)}%` }}
                    >
                      {d.rent > 0 ? (
                        <span
                          className={cn("min-h-[3px] bg-series-rent", d.sale === 0 && "rounded-t-[4px]")}
                          style={{ flex: `${d.rent} 1 0%` }}
                        />
                      ) : null}
                      {d.sale > 0 ? (
                        <span className="min-h-[3px] rounded-t-[4px] bg-series-sale" style={{ flex: `${d.sale} 1 0%` }} />
                      ) : null}
                    </span>
                  ) : (
                    <span className="mb-0 h-px w-full max-w-6 bg-ink-200" />
                  )}
                </button>

                {/* Yalnızca son ayın değeri doğrudan etiketlenir. */}
                {i === lastIndex && total > 0 && !isActive ? (
                  <span
                    className="pointer-events-none absolute right-0 bg-white/85 px-1 text-[0.6875rem] font-semibold whitespace-nowrap text-ink-800 tabular-nums"
                    style={{ bottom: `calc(${(total / max) * 100}% + 4px)` }}
                    aria-hidden
                  >
                    {formatTLCompact(total)}
                  </span>
                ) : null}

                {isActive ? (
                  <div
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-1 w-52 rounded-xl border border-ivory-300 bg-white p-3 text-left shadow-lift",
                      align,
                    )}
                  >
                    <p className="text-xs font-medium text-ink-500">{d.label}</p>
                    <p className="mt-1 text-lg leading-tight font-semibold text-ink-950 tabular-nums">{formatTL(total)}</p>
                    <dl className="mt-2 space-y-1 text-[0.8125rem]">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-2 text-ink-500">
                          <span className="h-0.5 w-3 rounded-full bg-series-rent" aria-hidden />
                          Kiralama · {d.rentCount}
                        </dt>
                        <dd className="font-medium text-ink-900 tabular-nums">{formatTL(d.rent)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-2 text-ink-500">
                          <span className="h-0.5 w-3 rounded-full bg-series-sale" aria-hidden />
                          Satış · {d.saleCount}
                        </dt>
                        <dd className="font-medium text-ink-900 tabular-nums">{formatTL(d.sale)}</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {!hasData ? (
          <p className="absolute inset-0 flex items-center justify-center pl-14 text-sm text-ink-400">
            Bu dönemde henüz kontrat yok.
          </p>
        ) : null}
      </div>

      <div className="mt-2 grid pl-14" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} aria-hidden>
        {data.map((d, i) => (
          <span
            key={d.key}
            className={cn(
              "text-center text-[0.6875rem] text-ink-500",
              // Dar ekranda etiketler üst üste binmesin: iki ayda bir göster.
              (lastIndex - i) % 2 === 1 && "max-sm:invisible",
            )}
          >
            {d.shortLabel}
          </span>
        ))}
      </div>

      <details className="group mt-4">
        <summary className="cursor-pointer text-[0.8125rem] font-medium text-ink-500 hover:text-ink-900">
          Tablo olarak göster
        </summary>
        <div className="table-wrap mt-3 rounded-xl border border-ivory-300">
          <table className="table">
            <thead>
              <tr>
                <th>Ay</th>
                <th className="num">Kiralama</th>
                <th className="num">Satış</th>
                <th className="num">Kiralama cirosu</th>
                <th className="num">Satış cirosu</th>
                <th className="num">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key}>
                  <td>{d.label}</td>
                  <td className="num">{d.rentCount}</td>
                  <td className="num">{d.saleCount}</td>
                  <td className="num">{formatTL(d.rent)}</td>
                  <td className="num">{formatTL(d.sale)}</td>
                  <td className="num font-semibold">{formatTL(d.rent + d.sale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
