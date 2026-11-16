import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ServiceError } from "@/lib/errors";
import type { FieldErrors } from "@/lib/validation";

/** Sunucu işlemlerinin (server action) forma döndürdüğü sonuç. */
export type ActionState =
  | {
      ok?: boolean;
      message?: string;
      error?: string;
      fieldErrors?: FieldErrors;
      /** Yalnızca bir kez gösterilen değer (ör. geçici şifre). */
      secret?: { label: string; value: string; note?: string };
    }
  | undefined;

export const CHECK_FIELDS = "Lütfen işaretli alanları kontrol edin.";

/**
 * Hata → form mesajı. İş kuralı hataları kullanıcıya aynen gösterilir;
 * beklenmeyen hatalar günlüğe yazılır ve genel bir mesaj döner.
 */
export function fail(err: unknown, fieldByCode: Record<string, string> = {}): ActionState {
  if (err instanceof ServiceError) {
    const field = fieldByCode[err.code];
    return field ? { error: CHECK_FIELDS, fieldErrors: { [field]: err.message } } : { error: err.message };
  }
  // Next.js'in yönlendirme / bulunamadı sinyalleri hata değildir; aynen iletilir.
  unstable_rethrow(err);
  console.error("[action]", err);
  return { error: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin." };
}

/** Değişiklikten sonra tüm sayfaların güncel veriyle yeniden çizilmesini sağlar. */
export function refreshAll(): void {
  revalidatePath("/", "layout");
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim().slice(0, 64) || null;
  return h.get("x-real-ip")?.slice(0, 64) ?? null;
}

export async function clientUserAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}

export function formObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

export function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}
