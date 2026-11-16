"use client";

import { useRef } from "react";
import { changePasswordAction } from "@/lib/actions/auth";
import { updateOfficeAction, updateProfileAction } from "@/lib/actions/settings";
import { FormMessage, SubmitButton, TextField, useActionForm } from "./forms";

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const { state, pending, onSubmit, errors } = useActionForm(updateProfileAction);
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Ad Soyad" name="name" defaultValue={name} autoComplete="name" error={errors.name} />
        <TextField
          label="Telefon"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={phone}
          autoComplete="tel"
          error={errors.phone}
          optional
        />
      </div>
      <TextField
        label="E-posta"
        name="email-readonly"
        defaultValue={email}
        readOnly
        disabled
        hint="E-posta adresiniz ofisinizi belirler ve değiştirilemez."
      />
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Bilgilerimi kaydet</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit, errors } = useActionForm(changePasswordAction, () => formRef.current?.reset());
  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
      <FormMessage state={state} />
      <TextField
        label="Mevcut şifre"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Yeni şifre"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          hint="En az 8 karakter; en az bir harf ve bir rakam."
          error={errors.newPassword}
        />
        <TextField
          label="Yeni şifre (tekrar)"
          name="newPasswordConfirm"
          type="password"
          autoComplete="new-password"
          error={errors.newPasswordConfirm}
        />
      </div>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Şifremi değiştir</SubmitButton>
      </div>
    </form>
  );
}

export function OfficeSettingsForm({
  name,
  agentRatePct,
  listingSharePct,
}: {
  name: string;
  agentRatePct: number;
  listingSharePct: number;
}) {
  const { state, pending, onSubmit, errors } = useActionForm(updateOfficeAction);
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormMessage state={state} />
      <TextField label="Ofis adı" name="name" defaultValue={name} error={errors.name} maxLength={120} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Danışman payı (%)"
          name="agentRatePct"
          inputMode="numeric"
          defaultValue={String(agentRatePct)}
          hint="Danışmanın kendi ciro payından aldığı kazanç oranı. Kişiye özel oran Ekip sayfasından verilebilir."
          error={errors.agentRatePct}
        />
        <TextField
          label="Çapraz işlemde portföy payı (%)"
          name="listingSharePct"
          inputMode="numeric"
          defaultValue={String(listingSharePct)}
          hint="Bir danışmanın portföyünü başkası kapattığında, cironun portföy sahibine yazılan bölümü."
          error={errors.listingSharePct}
        />
      </div>
      <p className="rounded-xl bg-ivory-100 px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-600">
        Oran değişiklikleri yalnızca bundan sonra girilecek kontratlara uygulanır; geçmiş kontratların hesabı değişmez.
      </p>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>Ofis ayarlarını kaydet</SubmitButton>
      </div>
    </form>
  );
}
