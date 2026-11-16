"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ActionState } from "@/lib/actions/shared";
import {
  addOfficeDomainAction,
  createOfficeAction,
  removeOfficeDomainAction,
  resetManagerPasswordAction,
  setOfficeActiveAction,
} from "@/lib/actions/platform";
import { ActionButton, FormMessage, Modal, SecretReveal, SubmitButton, TextField, useActionForm } from "./forms";

type Secret = NonNullable<NonNullable<ActionState>["secret"]>;

function CreateOfficeDialog({ onClose }: { onClose: () => void }) {
  const { state, pending, onSubmit, errors } = useActionForm(createOfficeAction);

  if (state?.ok && state.secret) {
    return (
      <Modal open onClose={onClose} title="Ofis oluşturuldu" description={state.message}>
        <div className="space-y-5">
          <SecretReveal secret={state.secret} />
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-600">
            <li>Üst yönetici bu geçici şifreyle giriş yapar ve kendi şifresini belirler.</li>
            <li>Ekip sayfasından ekiplerini oluşturur.</li>
            <li>Danışmanlar ofis e-postalarıyla kayıt olur; üst yönetici giriş izni verir.</li>
          </ol>
          <div className="flex justify-end">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Tamam
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Yeni ofis"
      description="Ofis, e-posta uzantısıyla tanınır: bu uzantıyla giriş yapan herkes yalnızca bu ofisin verilerini görür."
      wide
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormMessage state={state} />
        <TextField label="Ofis adı" name="name" placeholder="Örn. Realty World Pozitif" error={errors.name} autoFocus />
        <TextField
          label="E-posta uzantıları"
          name="domains"
          placeholder="ofisiniz.com"
          autoCapitalize="none"
          spellCheck={false}
          hint="Birden fazla uzantı varsa virgülle ayırın. Gmail gibi kişisel sağlayıcılar kullanılamaz."
          error={errors.domains}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField label="Üst yöneticinin adı" name="managerName" error={errors.managerName} />
          <TextField
            label="Üst yöneticinin e-postası"
            name="managerEmail"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            error={errors.managerEmail}
          />
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <SubmitButton pending={pending} pendingLabel="Oluşturuluyor…">
            Ofisi oluştur
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export function CreateOfficeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-gold" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Yeni ofis
      </button>
      {open ? <CreateOfficeDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function OfficeActiveToggle({ officeId, officeName, active }: { officeId: string; officeName: string; active: boolean }) {
  return active ? (
    <ActionButton
      action={setOfficeActiveAction.bind(null, officeId, false)}
      className="btn btn-danger btn-sm"
      confirm={`${officeName} ofisinin erişimi durdurulsun mu? Ofisteki kimse giriş yapamaz; veriler silinmez.`}
    >
      Erişimi durdur
    </ActionButton>
  ) : (
    <ActionButton action={setOfficeActiveAction.bind(null, officeId, true)} className="btn btn-primary btn-sm">
      Erişimi aç
    </ActionButton>
  );
}

export function DomainChips({ officeId, domains }: { officeId: string; domains: string[] }) {
  const { state, pending, onSubmit } = useActionForm(addOfficeDomainAction.bind(null, officeId));
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {domains.map((d) => (
          <li
            key={d}
            className="inline-flex items-center gap-1 rounded-full bg-gold-50 py-1 pr-1 pl-3 text-sm font-medium text-gold-700 ring-1 ring-gold-300 ring-inset"
          >
            @{d}
            {domains.length > 1 ? (
              <ActionButton
                action={removeOfficeDomainAction.bind(null, officeId, d)}
                className="flex size-6 items-center justify-center rounded-full text-gold-700 hover:bg-gold-200"
                confirm={`@${d} uzantısı kaldırılsın mı? Bu uzantıyla yeni kayıt yapılamaz.`}
              >
                <X className="size-3.5" aria-hidden />
                <span className="sr-only">{d} uzantısını kaldır</span>
              </ActionButton>
            ) : null}
          </li>
        ))}
      </ul>
      <form onSubmit={onSubmit} className="mt-3 flex max-w-sm gap-2">
        <input
          name="domain"
          placeholder="yeni-uzanti.com"
          aria-label="Yeni e-posta uzantısı"
          autoCapitalize="none"
          spellCheck={false}
          className="input h-9"
        />
        <SubmitButton pending={pending} pendingLabel="…" className="btn btn-secondary btn-sm">
          Ekle
        </SubmitButton>
      </form>
      {state?.error ? (
        <p role="alert" className="mt-2 text-[0.8125rem] font-medium text-rose-700">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

export function ManagerRow({ manager }: { manager: { id: string; name: string; email: string } }) {
  const [secret, setSecret] = useState<Secret | null>(null);
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink-900">{manager.name}</p>
          <p className="truncate text-xs text-ink-500">{manager.email}</p>
        </div>
        <ActionButton
          action={resetManagerPasswordAction.bind(null, manager.id)}
          className="btn btn-ghost btn-sm"
          confirm={`${manager.name} için şifre sıfırlansın mı?`}
          onDone={(result) => setSecret(result.secret ?? null)}
          pendingLabel="Sıfırlanıyor…"
        >
          Şifreyi sıfırla
        </ActionButton>
      </div>
      {secret ? (
        <div className="mt-3">
          <SecretReveal secret={secret} />
        </div>
      ) : null}
    </li>
  );
}
