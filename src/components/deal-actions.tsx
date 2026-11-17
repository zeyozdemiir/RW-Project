"use client";

import { useState } from "react";
import { cancelDealAction } from "@/lib/actions/deals";
import { FormMessage, Modal, SubmitButton, TextField, useActionForm } from "./forms";

function CancelDialog({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const { state, pending, onSubmit, errors } = useActionForm(cancelDealAction.bind(null, dealId), onClose);
  return (
    <Modal
      open
      onClose={onClose}
      title="Kontratı iptal et"
      description="Kontrat silinmez; iptal olarak işaretlenir, sayım ve ciroya dahil edilmez. Bağlı portföy yeniden sunulabilir olur."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <FormMessage state={state} />
        <TextField label="İptal nedeni" name="reason" maxLength={500} error={errors.reason} autoFocus />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <SubmitButton pending={pending} className="btn btn-danger" pendingLabel="İptal ediliyor…">
            Kontratı iptal et
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export function CancelDealButton({ dealId }: { dealId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-danger w-full" onClick={() => setOpen(true)}>
        Kontratı iptal et
      </button>
      {open ? <CancelDialog dealId={dealId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
