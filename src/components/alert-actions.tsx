"use client";

import { useState } from "react";
import { createFromAlertAction, dismissAlertAction, linkAlertAction } from "@/lib/actions/alerts";
import { FormMessage, Modal, SelectField, SubmitButton, TextField, useActionForm } from "./forms";

type Agent = { id: string; name: string; teamName: string | null };

function LinkDialog({
  alertId,
  portfolioId,
  portfolioLabel,
  onClose,
}: {
  alertId: string;
  portfolioId: string;
  portfolioLabel: string;
  onClose: () => void;
}) {
  const { state, pending, onSubmit } = useActionForm(linkAlertAction.bind(null, alertId, portfolioId), onClose);
  return (
    <Modal
      open
      onClose={onClose}
      title="Kontratı bu portföye bağla"
      description={`${portfolioLabel}. Portföy kapatılır; ciro, portföy sahibiyle yeniden paylaşılır.`}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormMessage state={state} />
        <TextField label="Not" name="note" maxLength={500} optional placeholder="Örn. Site adı yanlış yazılmış" autoFocus />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <SubmitButton pending={pending}>Bağla ve uyarıyı kapat</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

/** “Benzer kayıtlar” satırındaki bağlama düğmesi. */
export function LinkCandidateButton({
  alertId,
  portfolioId,
  portfolioLabel,
}: {
  alertId: string;
  portfolioId: string;
  portfolioLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        Bu portföye bağla
      </button>
      {open ? (
        <LinkDialog alertId={alertId} portfolioId={portfolioId} portfolioLabel={portfolioLabel} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function CreateDialog({
  alertId,
  agents,
  defaultAgentId,
  onClose,
}: {
  alertId: string;
  agents: Agent[];
  defaultAgentId: string;
  onClose: () => void;
}) {
  const { state, pending, onSubmit } = useActionForm(createFromAlertAction.bind(null, alertId), onClose);
  return (
    <Modal
      open
      onClose={onClose}
      title="Portföy kaydı oluştur"
      description="Kontrattaki daire için portföy kaydı açılır ve kontrata bağlanır. Portföyün hangi danışmana yazılacağını seçin."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormMessage state={state} />
        <SelectField label="Portföy danışmanı" name="agentId" defaultValue={defaultAgentId}>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.teamName ? ` — ${a.teamName}` : ""}
            </option>
          ))}
        </SelectField>
        <TextField label="Not" name="note" maxLength={500} optional />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <SubmitButton pending={pending}>Oluştur ve uyarıyı kapat</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function DismissDialog({ alertId, onClose }: { alertId: string; onClose: () => void }) {
  const { state, pending, onSubmit, errors } = useActionForm(dismissAlertAction.bind(null, alertId), onClose);
  return (
    <Modal
      open
      onClose={onClose}
      title="Uyarıyı açıklamayla kapat"
      description="Kontrat portföye bağlanmadan kalır. Kapatma nedeniniz kayda geçer."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormMessage state={state} />
        <TextField
          label="Açıklama"
          name="note"
          maxLength={500}
          placeholder="Örn. Danışmanla görüşüldü, mal sahibi kendi tanıdığı"
          error={errors.note}
          autoFocus
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <SubmitButton pending={pending}>Uyarıyı kapat</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export function AlertResolveButtons({
  alertId,
  agents,
  defaultAgentId,
}: {
  alertId: string;
  agents: Agent[];
  defaultAgentId: string;
}) {
  const [dialog, setDialog] = useState<"create" | "dismiss" | null>(null);
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row">
      <button type="button" className="btn btn-primary" onClick={() => setDialog("create")}>
        Portföy kaydı oluştur
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setDialog("dismiss")}>
        Açıklamayla kapat
      </button>
      {dialog === "create" ? (
        <CreateDialog alertId={alertId} agents={agents} defaultAgentId={defaultAgentId} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "dismiss" ? <DismissDialog alertId={alertId} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
