"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Search, ShieldExclamationPoint, X } from "lucide-react";
import { createDealAction } from "@/lib/actions/deals";
import { cn } from "@/lib/cn";
import { STATUS_LABELS, unitLabel } from "@/lib/domain/labels";
import { formatTL, toMoneyInput } from "@/lib/domain/money";
import type { PortfolioOption } from "@/lib/services/portfolios";
import { FormMessage, MoneyField, SelectField, SubmitButton, TextAreaField, TextField, useActionForm } from "./forms";
import { Notice } from "./ui";

type AgentOption = { id: string; name: string; teamName: string | null };

function PortfolioPicker({
  type,
  selected,
  onSelect,
  error,
}: {
  type: "rent" | "sale";
  selected: PortfolioOption | null;
  onSelect: (option: PortfolioOption | null) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PortfolioOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (selected) return;
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/portfoy-ara?tur=${type}&q=${encodeURIComponent(query)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: PortfolioOption[] };
        if (id === requestId.current) {
          setResults(data.results);
          setFailed(false);
        }
      } catch {
        if (id === requestId.current) setFailed(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, type, selected]);

  if (selected) {
    return (
      <div className="rounded-xl border border-ink-900 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-400 tabular-nums">Portföy #{selected.refNo}</p>
            <p className="mt-0.5 font-semibold text-ink-950">{selected.title}</p>
            <p className="mt-1 text-sm text-ink-600">
              {unitLabel(selected)} · {selected.district}
            </p>
            <p className="mt-1 text-sm text-ink-500">
              {selected.agentName}
              {selected.teamName ? ` (${selected.teamName})` : ""} · {formatTL(selected.price)}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => onSelect(null)}>
            <X className="size-3.5" aria-hidden />
            Değiştir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Site adı, daire no, mahalle veya portföy no yazın"
          aria-label="Portföy ara"
          aria-invalid={error ? true : undefined}
          className="input pl-10"
          autoComplete="off"
        />
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-ivory-300 bg-white" aria-live="polite">
        {failed ? (
          <p className="px-4 py-6 text-center text-sm text-rose-700">Portföyler yüklenemedi. Lütfen tekrar deneyin.</p>
        ) : loading && results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-400">Aranıyor…</p>
        ) : results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-500">
            {query
              ? "Bu aramaya uyan aktif portföy yok. Daire sistemde kayıtlı değilse “Portföy listede yok” seçeneğini kullanın."
              : `Kontrata uygun aktif ${type === "rent" ? "kiralık" : "satılık"} portföy bulunmuyor.`}
          </p>
        ) : (
          <ul className={cn("divide-y divide-ivory-200", loading && "opacity-60")}>
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ivory-100"
                >
                  <span className="mt-0.5 w-10 shrink-0 text-xs font-medium text-ink-400 tabular-nums">#{r.refNo}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-950">{unitLabel(r)}</span>
                    <span className="block truncate text-[0.8125rem] text-ink-500">
                      {r.title} · {r.district}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-500">
                      {r.agentName}
                      {r.teamName ? ` (${r.teamName})` : ""}
                      {r.status === "deposit" ? ` · ${STATUS_LABELS.deposit}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ink-900 tabular-nums">{formatTL(r.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function DealForm({
  viewerId,
  viewerRole,
  agents,
  initialPortfolio,
  complexNames,
  today,
  defaultSharePct,
}: {
  viewerId: string;
  viewerRole: "manager" | "leader" | "agent";
  /** Adına kontrat girilebilecek danışmanlar; tek kişiyse seçim gösterilmez. */
  agents: AgentOption[];
  initialPortfolio: PortfolioOption | null;
  complexNames: string[];
  today: string;
  defaultSharePct: number;
}) {
  const { state, pending, onSubmit, errors } = useActionForm(createDealAction);
  const [type, setType] = useState<"rent" | "sale">(initialPortfolio?.listingType ?? "rent");
  const [mode, setMode] = useState<"portfolio" | "manual">("portfolio");
  const [selected, setSelected] = useState<PortfolioOption | null>(initialPortfolio);
  const [closingAgentId, setClosingAgentId] = useState(viewerId);
  // Fiyat alanı, seçilen portföye göre yeniden kurulsun diye anahtar olarak kullanılır.
  const priceKey = selected?.id ?? "none";

  const closingAgentName = agents.find((a) => a.id === closingAgentId)?.name;
  const isCross = mode === "portfolio" && selected !== null && selected.agentId !== closingAgentId;

  function changeType(next: "rent" | "sale") {
    if (next === type) return;
    setType(next);
    setSelected(null);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="portfolioId" value={mode === "portfolio" ? (selected?.id ?? "") : ""} />

      <section className="card p-5 sm:p-7">
        <h2 className="font-display text-[1.375rem] leading-tight text-ink-900">1. İşlem türü</h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {(
            [
              { value: "rent", label: "Kiralama", hint: "Kira kontratı" },
              { value: "sale", label: "Satış", hint: "Satış sözleşmesi" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => changeType(opt.value)}
              aria-pressed={type === opt.value}
              className={cn(
                "rounded-xl border px-4 py-3.5 text-left transition-colors",
                type === opt.value
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-200 bg-white text-ink-800 hover:border-ink-400",
              )}
            >
              <span className="block font-semibold">{opt.label}</span>
              <span className={cn("mt-0.5 block text-xs", type === opt.value ? "text-gold-200" : "text-ink-500")}>{opt.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card p-5 sm:p-7">
        <h2 className="font-display text-[1.375rem] leading-tight text-ink-900">2. Kontrattaki daire</h2>
        <p className="mt-1 text-sm text-ink-500">Kontratı yapılan daireyi ofis portföyünden seçin.</p>

        <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl bg-ivory-200/70 p-1.5">
          {(
            [
              { value: "portfolio", label: "Portföyden seç" },
              { value: "manual", label: "Portföy listede yok" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              aria-pressed={mode === opt.value}
              className={cn(
                "h-10 rounded-lg text-sm font-medium transition-colors",
                mode === opt.value ? "bg-white text-ink-950 shadow-sm" : "text-ink-600 hover:text-ink-950",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {mode === "portfolio" ? (
            <>
              <PortfolioPicker type={type} selected={selected} onSelect={setSelected} error={errors.portfolioId} />
              {isCross && selected ? (
                <div className="mt-4">
                  <Notice tone="info" icon={<ArrowLeftRight className="size-5" aria-hidden />} title="Çapraz işlem">
                    Bu portföy <strong className="font-semibold">{selected.agentName}</strong>
                    {selected.teamName ? ` (${selected.teamName})` : ""} adına kayıtlı. Kontrat çapraz işlem olarak
                    kaydedilir ve ciro, portföy sahibiyle paylaşılır (portföy payı %{defaultSharePct}).
                  </Notice>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <Notice
                tone="warning"
                icon={<ShieldExclamationPoint className="size-5" aria-hidden />}
                title="Kontrattaki daire bilgilerini aynen yazın"
              >
                Bu daire sistemde kayıtlı bir portföyle eşleşirse kontrat o portföye bağlanır. Eşleşmezse kontrat yine
                kaydedilir ve üst yönetime “kayıtsız portföy” uyarısı gönderilir.
              </Notice>
              <div className="mt-5 grid gap-5 sm:grid-cols-6">
                <TextField
                  className="sm:col-span-6"
                  label="Site / bina / sokak adı"
                  name="complexName"
                  list="deal-complex-names"
                  autoComplete="off"
                  placeholder="Örn. Nida Park Sitesi"
                  error={errors.complexName}
                />
                <datalist id="deal-complex-names">
                  {complexNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <TextField className="sm:col-span-3" label="Blok" name="block" placeholder="Örn. B" error={errors.block} optional />
                <TextField className="sm:col-span-3" label="Daire / kapı no" name="unitNo" placeholder="Örn. 12" error={errors.unitNo} />
                <TextField className="sm:col-span-2" label="İl" name="city" error={errors.city} optional />
                <TextField className="sm:col-span-2" label="İlçe" name="district" error={errors.district} />
                <TextField className="sm:col-span-2" label="Mahalle" name="neighborhood" error={errors.neighborhood} optional />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="card p-5 sm:p-7">
        <h2 className="font-display text-[1.375rem] leading-tight text-ink-900">3. Kontrat bilgileri</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-6">
          <TextField
            className="sm:col-span-2"
            label="Kontrat tarihi"
            name="contractDate"
            type="date"
            defaultValue={today}
            max={today}
            error={errors.contractDate}
          />
          <MoneyField
            key={`price-${priceKey}`}
            className="sm:col-span-2"
            label={type === "rent" ? "Aylık kira bedeli" : "Satış bedeli"}
            name="price"
            defaultValue={mode === "portfolio" && selected ? toMoneyInput(selected.price) : ""}
            error={errors.price}
          />
          <MoneyField
            className="sm:col-span-2"
            label="Hizmet bedeli (ciro)"
            name="commission"
            hint="Ofisin bu işlemden aldığı toplam komisyon."
            error={errors.commission}
          />
          <TextField
            className="sm:col-span-3"
            label={type === "rent" ? "Kiracı" : "Alıcı"}
            name="customerName"
            placeholder="Ad Soyad"
            error={errors.customerName}
            optional
          />
          {agents.length > 1 ? (
            <SelectField
              className="sm:col-span-3"
              label="İşlemi yapan danışman"
              name="closingAgentId"
              value={closingAgentId}
              onChange={(e) => setClosingAgentId(e.target.value)}
              error={errors.closingAgentId}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.id === viewerId ? " (siz)" : a.teamName ? ` — ${a.teamName}` : ""}
                </option>
              ))}
            </SelectField>
          ) : null}
          {viewerRole === "manager" && isCross ? (
            <TextField
              className="sm:col-span-3"
              label="Portföy sahibinin ciro payı (%)"
              name="listingSharePct"
              inputMode="numeric"
              placeholder={String(defaultSharePct)}
              hint={`Boş bırakılırsa ofis varsayılanı (%${defaultSharePct}) uygulanır.`}
              error={errors.listingSharePct}
              optional
            />
          ) : null}
          <TextAreaField className="sm:col-span-6" label="Not" name="notes" rows={3} error={errors.notes} optional />
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {closingAgentName && agents.length > 1 && closingAgentId !== viewerId ? (
          <p className="text-sm text-ink-500 sm:mr-auto">Kontrat {closingAgentName} adına kaydedilecek.</p>
        ) : null}
        <Link href="/kontratlar" className="btn btn-ghost">
          Vazgeç
        </Link>
        <SubmitButton pending={pending}>Kontratı kaydet</SubmitButton>
      </div>
      {state?.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
