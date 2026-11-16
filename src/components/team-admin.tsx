"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { ActionState } from "@/lib/actions/shared";
import {
  approveUserAction,
  createTeamAction,
  deleteTeamAction,
  rejectUserAction,
  renameTeamAction,
  resetMemberPasswordAction,
  setMemberActiveAction,
  updateMemberAction,
} from "@/lib/actions/team";
import { ActionButton, FormMessage, Modal, SecretReveal, SelectField, SubmitButton, TextField, useActionForm } from "./forms";

type TeamOption = { id: string; name: string };
type Secret = NonNullable<NonNullable<ActionState>["secret"]>;

export type EditableMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId: string | null;
  agentRatePct: number | null;
  status: string;
};

function RoleTeamFields({
  teams,
  defaults,
  errors,
  officeRate,
}: {
  teams: TeamOption[];
  defaults: { role: string; teamId: string; agentRatePct: string };
  errors: Record<string, string>;
  officeRate: number;
}) {
  return (
    <>
      <SelectField label="Rol" name="role" defaultValue={defaults.role} error={errors.role}>
        <option value="agent">Danışman</option>
        <option value="leader">Ekip Lideri</option>
        <option value="manager">Üst Yönetici</option>
      </SelectField>
      <SelectField label="Ekip" name="teamId" defaultValue={defaults.teamId} error={errors.teamId}>
        <option value="">Ekipsiz</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Danışman payı (%)"
        name="agentRatePct"
        inputMode="numeric"
        defaultValue={defaults.agentRatePct}
        placeholder={String(officeRate)}
        hint={`Boşsa ofis varsayılanı: %${officeRate}`}
        error={errors.agentRatePct}
        optional
      />
    </>
  );
}

/** Giriş onayı bekleyen kullanıcı: rol ve ekip seçilip onaylanır ya da reddedilir. */
export function ApprovalForm({
  userId,
  teams,
  officeRate,
  allowReject = true,
}: {
  userId: string;
  teams: TeamOption[];
  officeRate: number;
  allowReject?: boolean;
}) {
  const { state, pending, onSubmit, errors } = useActionForm(approveUserAction.bind(null, userId));
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RoleTeamFields
          teams={teams}
          defaults={{ role: "agent", teamId: "", agentRatePct: "" }}
          errors={errors}
          officeRate={officeRate}
        />
      </div>
      <div className="flex flex-wrap items-start gap-2.5">
        <SubmitButton pending={pending} pendingLabel="Onaylanıyor…" className="btn btn-primary btn-sm">
          Giriş izni ver
        </SubmitButton>
        {allowReject ? (
          <ActionButton
            action={rejectUserAction.bind(null, userId)}
            className="btn btn-danger btn-sm"
            confirm="Bu başvuru reddedilsin mi? Kişi giriş yapamaz."
          >
            Reddet
          </ActionButton>
        ) : null}
      </div>
    </form>
  );
}

function MemberDialog({
  member,
  teams,
  officeRate,
  isSelf,
  onClose,
}: {
  member: EditableMember;
  teams: TeamOption[];
  officeRate: number;
  isSelf: boolean;
  onClose: () => void;
}) {
  const { state, pending, onSubmit, errors } = useActionForm(updateMemberAction.bind(null, member.id));
  const [secret, setSecret] = useState<Secret | null>(null);
  const disabled = member.status === "disabled";

  return (
    <Modal open onClose={onClose} title={member.name} description={member.email}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormMessage state={state} />
        <RoleTeamFields
          teams={teams}
          defaults={{
            role: member.role,
            teamId: member.teamId ?? "",
            agentRatePct: member.agentRatePct?.toString() ?? "",
          }}
          errors={errors}
          officeRate={officeRate}
        />
        <div className="flex justify-end">
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </div>
      </form>

      {!isSelf ? (
        <div className="mt-6 space-y-4 border-t border-ivory-300 pt-5">
          <p className="eyebrow">Hesap</p>
          {secret ? <SecretReveal secret={secret} /> : null}
          <div className="flex flex-wrap items-start gap-2.5">
            <ActionButton
              action={resetMemberPasswordAction.bind(null, member.id)}
              confirm={`${member.name} için şifre sıfırlansın mı? Açık oturumları kapatılır.`}
              onDone={(result) => setSecret(result.secret ?? null)}
              pendingLabel="Sıfırlanıyor…"
            >
              Şifreyi sıfırla
            </ActionButton>
            {disabled ? (
              <ActionButton action={setMemberActiveAction.bind(null, member.id, true)} onDone={onClose}>
                Hesabı yeniden aç
              </ActionButton>
            ) : (
              <ActionButton
                action={setMemberActiveAction.bind(null, member.id, false)}
                className="btn btn-danger btn-sm"
                confirm={`${member.name} hesabı kapatılsın mı? Giriş yapamaz; portföy ve kontrat kayıtları korunur.`}
                onDone={onClose}
              >
                Hesabı kapat
              </ActionButton>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function MemberEditButton(props: {
  member: EditableMember;
  teams: TeamOption[];
  officeRate: number;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-ink-50 hover:text-ink-950"
        onClick={() => setOpen(true)}
        aria-label={`${props.member.name} — düzenle`}
        title="Düzenle"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      {open ? <MemberDialog {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function TeamNameDialog({
  title,
  action,
  defaultName,
  submitLabel,
  onClose,
}: {
  title: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaultName: string;
  submitLabel: string;
  onClose: () => void;
}) {
  const { state, pending, onSubmit, errors } = useActionForm(action, onClose);
  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={onSubmit} className="space-y-5">
        <FormMessage state={state} />
        <TextField label="Ekip adı" name="name" defaultValue={defaultName} maxLength={60} error={errors.name} autoFocus />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export function CreateTeamButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Ekip oluştur
      </button>
      {open ? (
        <TeamNameDialog
          title="Yeni ekip"
          action={createTeamAction}
          defaultName=""
          submitLabel="Ekibi oluştur"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function TeamAdminButtons({ team, empty }: { team: TeamOption; empty: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="flex items-center gap-2">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        Yeniden adlandır
      </button>
      {empty ? (
        <ActionButton
          action={deleteTeamAction.bind(null, team.id)}
          className="btn btn-danger btn-sm"
          confirm={`"${team.name}" ekibi silinsin mi?`}
        >
          Sil
        </ActionButton>
      ) : null}
      {open ? (
        <TeamNameDialog
          title="Ekibi yeniden adlandır"
          action={renameTeamAction.bind(null, team.id)}
          defaultName={team.name}
          submitLabel="Kaydet"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </span>
  );
}
