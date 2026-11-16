"use client";

import Link from "next/link";
import { useState } from "react";
import type { ActionState } from "@/lib/actions/shared";
import { cn } from "@/lib/cn";
import { PROPERTY_TYPES } from "@/lib/domain/labels";
import { FormMessage, MoneyField, SelectField, SubmitButton, TextAreaField, TextField, useActionForm } from "./forms";

export type PortfolioFormValues = {
  listingType: "rent" | "sale";
  propertyType: string;
  title: string;
  city: string;
  district: string;
  neighborhood: string;
  complexName: string;
  block: string;
  floor: string;
  unitNo: string;
  rooms: string;
  grossM2: string;
  netM2: string;
  buildingAge: string;
  furnished: boolean;
  price: string;
  ownerName: string;
  ownerPhone: string;
  listingUrl: string;
  notes: string;
  agentId: string;
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-7">
      <h2 className="font-display text-[1.375rem] leading-tight text-ink-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
      <div className="mt-5 grid gap-5 sm:grid-cols-6">{children}</div>
    </section>
  );
}

export function PortfolioForm({
  action,
  initial,
  agents,
  complexNames,
  cancelHref,
  submitLabel,
  lockListingType = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial: PortfolioFormValues;
  /** Boşsa danışman seçimi gösterilmez (portföy, formu dolduran kişiye yazılır). */
  agents: Array<{ id: string; name: string; teamName: string | null }>;
  complexNames: string[];
  cancelHref: string;
  submitLabel: string;
  lockListingType?: boolean;
}) {
  const { state, pending, onSubmit, errors } = useActionForm(action);
  const [listingType, setListingType] = useState(initial.listingType);

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <FormMessage state={state} />

      <Section title="İlan bilgileri">
        {/* Kilitli (disabled) alan kümesinin dışında: değer her durumda gönderilsin. */}
        <input type="hidden" name="listingType" value={listingType} />
        <fieldset className="sm:col-span-6" disabled={lockListingType}>
          <legend className="field-label">Portföy türü</legend>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { value: "rent", label: "Kiralık", hint: "Aylık kira bedeli" },
                { value: "sale", label: "Satılık", hint: "Satış bedeli" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setListingType(opt.value)}
                aria-pressed={listingType === opt.value}
                className={cn(
                  "rounded-xl border px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  listingType === opt.value
                    ? "border-ink-900 bg-ink-900 text-white"
                    : "border-ink-200 bg-white text-ink-800 hover:border-ink-400",
                )}
              >
                <span className="block font-semibold">{opt.label}</span>
                <span className={cn("mt-0.5 block text-xs", listingType === opt.value ? "text-gold-200" : "text-ink-500")}>
                  {opt.hint}
                </span>
              </button>
            ))}
          </div>
          {lockListingType ? (
            <p className="field-hint">Kontratı yapılmış portföyün türü değiştirilemez.</p>
          ) : errors.listingType ? (
            <p className="field-error">{errors.listingType}</p>
          ) : null}
        </fieldset>

        <TextField
          className="sm:col-span-6"
          label="Başlık"
          name="title"
          defaultValue={initial.title}
          placeholder="Örn. Deniz manzaralı, yeni binada 3+1"
          error={errors.title}
          maxLength={140}
        />
        <SelectField
          className="sm:col-span-3"
          label="Gayrimenkul türü"
          name="propertyType"
          defaultValue={initial.propertyType}
          error={errors.propertyType}
        >
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>
        <MoneyField
          className="sm:col-span-3"
          label={listingType === "rent" ? "Aylık kira" : "Satış fiyatı"}
          name="price"
          defaultValue={initial.price}
          error={errors.price}
        />
      </Section>

      <Section
        title="Adres"
        description="Site adı, blok ve daire numarası kontratlarla eşleştirmede kullanılır; lütfen eksiksiz yazın."
      >
        <TextField className="sm:col-span-2" label="İl" name="city" defaultValue={initial.city} error={errors.city} />
        <TextField className="sm:col-span-2" label="İlçe" name="district" defaultValue={initial.district} error={errors.district} />
        <TextField
          className="sm:col-span-2"
          label="Mahalle"
          name="neighborhood"
          defaultValue={initial.neighborhood}
          error={errors.neighborhood}
          optional
        />
        <TextField
          className="sm:col-span-6"
          label="Site / bina / sokak adı"
          name="complexName"
          defaultValue={initial.complexName}
          list="complex-names"
          autoComplete="off"
          placeholder="Örn. Nida Park Sitesi"
          error={errors.complexName}
        />
        <datalist id="complex-names">
          {complexNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <TextField
          className="sm:col-span-2"
          label="Blok"
          name="block"
          defaultValue={initial.block}
          placeholder="Örn. B"
          error={errors.block}
          optional
        />
        <TextField className="sm:col-span-2" label="Kat" name="floor" defaultValue={initial.floor} error={errors.floor} optional />
        <TextField
          className="sm:col-span-2"
          label="Daire / kapı no"
          name="unitNo"
          defaultValue={initial.unitNo}
          placeholder="Örn. 12"
          hint={errors.unitNo ? undefined : "Arsa için ada/parsel yazın."}
          error={errors.unitNo}
        />
      </Section>

      <Section title="Özellikler">
        <TextField
          className="sm:col-span-2"
          label="Oda sayısı"
          name="rooms"
          defaultValue={initial.rooms}
          placeholder="Örn. 3+1"
          error={errors.rooms}
          optional
        />
        <TextField
          className="sm:col-span-2"
          label="Brüt m²"
          name="grossM2"
          inputMode="numeric"
          defaultValue={initial.grossM2}
          error={errors.grossM2}
          optional
        />
        <TextField
          className="sm:col-span-2"
          label="Net m²"
          name="netM2"
          inputMode="numeric"
          defaultValue={initial.netM2}
          error={errors.netM2}
          optional
        />
        <TextField
          className="sm:col-span-2"
          label="Bina yaşı"
          name="buildingAge"
          inputMode="numeric"
          defaultValue={initial.buildingAge}
          error={errors.buildingAge}
          optional
        />
        <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-ink-200 bg-white px-4 py-3 sm:col-span-4">
          <input type="checkbox" name="furnished" defaultChecked={initial.furnished} className="size-4.5 accent-ink-900" />
          <span className="text-sm font-medium text-ink-800">Eşyalı</span>
        </label>
      </Section>

      <Section
        title="Sahibinden ilanı"
        description="İlan bağlantısını ekleyin; portföy sayfasından tek tıkla kopyalayıp müşteriye gönderebilirsiniz."
      >
        <TextField
          className="sm:col-span-6"
          label="Sahibinden linki"
          name="listingUrl"
          type="url"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={initial.listingUrl}
          placeholder="https://www.sahibinden.com/ilan/…"
          error={errors.listingUrl}
          optional
        />
      </Section>

      <Section
        title="Mal sahibi"
        description="Bu bilgileri yalnızca portföyün danışmanı, ekip lideri ve üst yönetici görebilir."
      >
        <TextField
          className="sm:col-span-3"
          label="Ad Soyad"
          name="ownerName"
          defaultValue={initial.ownerName}
          error={errors.ownerName}
          optional
        />
        <TextField
          className="sm:col-span-3"
          label="Telefon"
          name="ownerPhone"
          type="tel"
          inputMode="tel"
          defaultValue={initial.ownerPhone}
          error={errors.ownerPhone}
          optional
        />
        <TextAreaField
          className="sm:col-span-6"
          label="Notlar"
          name="notes"
          defaultValue={initial.notes}
          rows={3}
          hint="Özel notlar da yalnızca yukarıdaki kişilere görünür."
          error={errors.notes}
          optional
        />
      </Section>

      {agents.length > 0 ? (
        <Section title="Danışman" description="Portföyün sahibi olan danışman.">
          <SelectField className="sm:col-span-3" label="Portföy danışmanı" name="agentId" defaultValue={initial.agentId} error={errors.agentId}>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.teamName ? ` — ${a.teamName}` : ""}
              </option>
            ))}
          </SelectField>
        </Section>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="btn btn-ghost">
          Vazgeç
        </Link>
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
      </div>
      {state?.error ? <FormMessage state={state} /> : null}
    </form>
  );
}
