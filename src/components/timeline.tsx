import { formatDateTime } from "@/lib/domain/dates";
import type { ActivityRow } from "@/lib/services/activity";

/** Kim, ne zaman, ne yaptı: değiştirilemeyen işlem geçmişi. */
export function Timeline({ entries }: { entries: ActivityRow[] }) {
  if (entries.length === 0) return <p className="text-sm text-ink-400">Henüz kayıt yok.</p>;
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-ivory-300">
      {entries.map((e) => (
        <li key={e.id} className="relative pl-6">
          <span className="absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-white bg-gold-400 ring-1 ring-gold-500/40" aria-hidden />
          <p className="text-sm leading-snug text-ink-800">{e.summary}</p>
          <p className="mt-1 text-xs text-ink-500">
            {e.actorName ?? "Sistem"} · {formatDateTime(e.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}
