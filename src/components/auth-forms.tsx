"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleCheck, Eye, EyeOff } from "lucide-react";
import { forcePasswordChangeAction, loginAction, registerAction } from "@/lib/actions/auth";
import { Field, FormMessage, SubmitButton, TextField, useActionForm } from "./forms";

function PasswordField({
  label,
  name,
  error,
  hint,
  autoComplete,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = `pw-${name}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          className="input pr-11"
          aria-invalid={error ? true : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-ink-400 hover:text-ink-700"
          aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-[1.1rem]" aria-hidden /> : <Eye className="size-[1.1rem]" aria-hidden />}
        </button>
      </div>
    </Field>
  );
}

export function LoginForm() {
  const { state, pending, onSubmit, errors } = useActionForm(loginAction);
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <TextField
        label="E-posta"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="ad.soyad@ofisiniz.com"
        error={errors.email}
        autoFocus
      />
      <PasswordField label="Şifre" name="password" autoComplete="current-password" error={errors.password} />
      <SubmitButton pending={pending} pendingLabel="Giriş yapılıyor…" className="btn btn-primary w-full">
        Giriş yap
      </SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const { state, pending, onSubmit, errors } = useActionForm(registerAction);

  if (state?.ok) {
    return (
      <div className="card p-7 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
          <CircleCheck className="size-7" aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-2xl text-ink-950">Başvurunuz alındı</h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-600">
          <strong className="font-semibold text-ink-900">{state.message}</strong> üst yöneticisi hesabınızı onayladığında giriş
          yapabilirsiniz. Onay için yöneticinize haber vermeniz yeterli.
        </p>
        <Link href="/giris" className="btn btn-secondary mt-7 w-full">
          Giriş sayfasına dön
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <TextField label="Ad Soyad" name="name" autoComplete="name" error={errors.name} autoFocus />
      <TextField
        label="Kurumsal e-posta"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="ad.soyad@ofisiniz.com"
        hint="Ofisinizin size verdiği e-posta adresini kullanın. Ofisiniz bu adresin uzantısından tanınır."
        error={errors.email}
      />
      <TextField label="Telefon" name="phone" type="tel" inputMode="tel" autoComplete="tel" optional error={errors.phone} />
      <PasswordField
        label="Şifre"
        name="password"
        autoComplete="new-password"
        hint="En az 8 karakter; en az bir harf ve bir rakam."
        error={errors.password}
      />
      <PasswordField label="Şifre (tekrar)" name="passwordConfirm" autoComplete="new-password" error={errors.passwordConfirm} />
      <SubmitButton pending={pending} pendingLabel="Gönderiliyor…" className="btn btn-primary w-full">
        Kayıt ol
      </SubmitButton>
    </form>
  );
}

export function ForcePasswordForm() {
  const { state, pending, onSubmit, errors } = useActionForm(forcePasswordChangeAction);
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <PasswordField
        label="Size verilen geçici şifre"
        name="currentPassword"
        autoComplete="current-password"
        error={errors.currentPassword}
      />
      <PasswordField
        label="Yeni şifreniz"
        name="newPassword"
        autoComplete="new-password"
        hint="En az 8 karakter; en az bir harf ve bir rakam."
        error={errors.newPassword}
      />
      <PasswordField
        label="Yeni şifreniz (tekrar)"
        name="newPasswordConfirm"
        autoComplete="new-password"
        error={errors.newPasswordConfirm}
      />
      <SubmitButton pending={pending} className="btn btn-primary w-full">
        Şifremi belirle ve devam et
      </SubmitButton>
    </form>
  );
}
