"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { Check, Copy, KeyRound, X } from "lucide-react";
import type { ActionState } from "@/lib/actions/shared";
import { cn } from "@/lib/cn";

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Sunucu işlemine bağlı form. Gönderim elle yapılır; böylece doğrulama hatası
 * döndüğünde kullanıcının yazdıkları silinmez.
 */
export function useActionForm(action: FormAction, onSuccess?: (state: NonNullable<ActionState>) => void) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const handled = useRef<ActionState>(undefined);

  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      onSuccess?.(state);
    }
  }, [state, onSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return { state, pending, onSubmit, errors: state?.fieldErrors ?? {} };
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="field-label">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-ink-400">isteğe bağlı</span> : null}
      </label>
      {children}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

type TextFieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "className">;

export function TextField({ label, name, error, hint, optional, className, ...input }: TextFieldProps) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} optional={optional} className={className}>
      <input id={id} name={name} className="input" aria-invalid={error ? true : undefined} {...input} />
    </Field>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  optional,
  className,
  children,
  ...select
}: {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name" | "className">) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} optional={optional} className={className}>
      <select id={id} name={name} className="input" aria-invalid={error ? true : undefined} {...select}>
        {children}
      </select>
    </Field>
  );
}

export function TextAreaField({
  label,
  name,
  error,
  hint,
  optional,
  className,
  ...area
}: {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "className">) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} optional={optional} className={className}>
      <textarea id={id} name={name} className="input" aria-invalid={error ? true : undefined} {...area} />
    </Field>
  );
}

/** Yazarken binlik ayırıcı ekler: 1250000 → 1.250.000 */
export function formatMoneyTyping(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, "");
  const [intPart = "", ...rest] = cleaned.split(",");
  const int = intPart.replace(/^0+(?=\d)/, "");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (rest.length === 0) return grouped;
  return `${grouped},${rest.join("").slice(0, 2)}`;
}

export function MoneyField({
  label,
  name,
  defaultValue = "",
  error,
  hint,
  optional,
  className,
  onValueChange,
  placeholder = "0",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} optional={optional} className={className}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-400" aria-hidden>
          ₺
        </span>
        <input
          id={id}
          name={name}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          className="input pl-8 tabular-nums"
          aria-invalid={error ? true : undefined}
          value={value}
          onChange={(e) => {
            const next = formatMoneyTyping(e.target.value);
            setValue(next);
            onValueChange?.(next);
          }}
        />
      </div>
    </Field>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel = "Kaydediliyor…",
  className = "btn btn-primary",
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        {state.message}
      </p>
    );
  }
  return null;
}

export function CopyButton({
  value,
  label = "Kopyala",
  copiedLabel = "Kopyalandı",
  className = "btn btn-secondary btn-sm",
  icon = true,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  icon?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Pano API'si yoksa (eski tarayıcı / güvenli olmayan bağlam) eski yöntemi dene.
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={copy} className={className} aria-live="polite">
      {icon ? copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden /> : null}
      {copied ? copiedLabel : label}
    </button>
  );
}

/** Bir kez gösterilen değer (geçici şifre). */
export function SecretReveal({ secret }: { secret: NonNullable<NonNullable<ActionState>["secret"]> }) {
  return (
    <div className="rounded-xl border border-gold-300 bg-gold-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <KeyRound className="size-4 text-gold-600" aria-hidden />
        {secret.label}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="rounded-lg bg-white px-3.5 py-2 font-mono text-lg tracking-wider text-ink-950 ring-1 ring-gold-300 select-all">
          {secret.value}
        </code>
        <CopyButton value={secret.value} />
      </div>
      {secret.note ? <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-600">{secret.note}</p> : null}
    </div>
  );
}

/**
 * Tek tıkla çalışan sunucu işlemi (onay, kapatma vb.). Hata dönerse düğmenin
 * altında gösterir; `confirm` verilirse önce onay ister.
 */
export function ActionButton({
  action,
  children,
  className = "btn btn-secondary btn-sm",
  confirm,
  pendingLabel,
  onDone,
}: {
  action: () => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  pendingLabel?: string;
  onDone?: (state: NonNullable<ActionState>) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    setError(null);
    start(async () => {
      const result = await action();
      if (result?.error) setError(result.error);
      else if (result) onDone?.(result);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={className} onClick={run} disabled={pending} aria-busy={pending}>
        {pending && pendingLabel ? pendingLabel : children}
      </button>
      {error ? (
        <span role="alert" className="max-w-xs text-xs font-medium text-rose-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/** Yerleşik <dialog> üzerine kurulu pencere. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] rounded-2xl border border-ivory-300 bg-white p-0 text-ink-900 shadow-lift backdrop:bg-ink-950/55 backdrop:backdrop-blur-[2px]",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open ? (
        <div className="max-h-[88vh] overflow-y-auto p-6 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="font-display text-2xl leading-tight text-ink-950">
                {title}
              </h2>
              {description ? <p className="mt-1.5 text-sm text-ink-500">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-ink-50 hover:text-ink-900"
              aria-label="Kapat"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
