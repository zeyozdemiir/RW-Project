import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/cn";

/** Ürün amblemi: anahtar deliği biçimli bir kapı. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.2" />
      <path
        d="M20 9.5a6.2 6.2 0 0 0-3.1 11.57L15.4 30.5h9.2l-1.5-9.43A6.2 6.2 0 0 0 20 9.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Brand({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandMark className={tone === "dark" ? "text-gold-400" : "text-gold-600"} />
      <span
        className={cn(
          "font-display text-[1.625rem] leading-none tracking-wide",
          tone === "dark" ? "text-white" : "text-ink-950",
        )}
      >
        {APP_NAME}
      </span>
    </span>
  );
}
