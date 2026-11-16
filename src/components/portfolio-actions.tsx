"use client";

import { useState } from "react";
import { ExternalLink, MessageCircle } from "lucide-react";
import type { PortfolioStatus } from "@/lib/db/schema";
import { setPortfolioStatusAction } from "@/lib/actions/portfolios";
import { CopyButton, FormMessage, Modal, SubmitButton, TextField, useActionForm } from "./forms";

const CHANGE_COPY: Record<
  PortfolioStatus,
  { button: string; title: string; description: string; noteLabel: string; className: string }
> = {
  deposit: {
    button: "Kapora alındı",
    title: "Kapora alındı olarak işaretle",
    description: "Portföy listede “Kapora Alındı” olarak görünür; kimin işaretlediği kaydedilir.",
    noteLabel: "Not (müşteri adı, kapora tutarı vb.)",
    className: "btn btn-gold w-full",
  },
  available: {
    button: "Sunulabilir yap",
    title: "Yeniden sunulabilir yap",
    description: "Portföy yeniden müşterilere sunulabilir olarak görünür.",
    noteLabel: "Not",
    className: "btn btn-secondary w-full",
  },
  inactive: {
    button: "Pasife al",
    title: "Portföyü pasife al",
    description: "Portföy yayından kalkar. Kayıt silinmez; dilediğinizde yeniden sunulabilir yapabilirsiniz.",
    noteLabel: "Neden (mal sahibi vazgeçti, ofis dışında kiralandı vb.)",
    className: "btn btn-ghost w-full",
  },
  rented: { button: "", title: "", description: "", noteLabel: "", className: "" },
  sold: { button: "", title: "", description: "", noteLabel: "", className: "" },
};

function StatusDialog({
  portfolioId,
  status,
  onClose,
}: {
  portfolioId: string;
  status: PortfolioStatus;
  onClose: () => void;
}) {
  const copy = CHANGE_COPY[status];
  const { state, pending, onSubmit, errors } = useActionForm(
    setPortfolioStatusAction.bind(null, portfolioId, status),
    onClose,
  );
  return (
    <Modal open onClose={onClose} title={copy.title} description={copy.description}>
      <form onSubmit={onSubmit} className="space-y-5">
        <FormMessage state={state} />
        <TextField label={copy.noteLabel} name="note" maxLength={500} optional error={errors.note} autoFocus />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Vazgeç
          </button>
          <SubmitButton pending={pending}>Onayla</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

/** Portföy durumunu elle değiştirme düğmeleri (kapora alındı / sunulabilir / pasif). */
export function StatusActions({ portfolioId, options }: { portfolioId: string; options: PortfolioStatus[] }) {
  const [target, setTarget] = useState<PortfolioStatus | null>(null);
  if (options.length === 0) return null;
  return (
    <div className="space-y-2.5">
      {options.map((status) => (
        <button key={status} type="button" className={CHANGE_COPY[status].className} onClick={() => setTarget(status)}>
          {CHANGE_COPY[status].button}
        </button>
      ))}
      {target ? <StatusDialog portfolioId={portfolioId} status={target} onClose={() => setTarget(null)} /> : null}
    </div>
  );
}

/** Sahibinden ilanını açma, kopyalama ve WhatsApp ile müşteriye gönderme. */
export function ListingShare({ url, shareText }: { url: string; shareText: string }) {
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  return (
    <div className="grid gap-2.5">
      <CopyButton value={url} label="Linki kopyala" copiedLabel="Link kopyalandı" className="btn btn-primary w-full" />
      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full">
        <MessageCircle className="size-4" aria-hidden />
        WhatsApp ile gönder
      </a>
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full">
        <ExternalLink className="size-4" aria-hidden />
        İlanı aç
      </a>
    </div>
  );
}

/** Portföy kartındaki küçük “linki kopyala” düğmesi. */
export function CardCopyLink({ url }: { url: string }) {
  return <CopyButton value={url} label="Linki kopyala" copiedLabel="Kopyalandı" className="btn btn-secondary btn-sm" />;
}
