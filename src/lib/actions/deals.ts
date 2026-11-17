"use server";

import { redirect } from "next/navigation";
import { requireOffice } from "@/lib/auth/guards";
import { cancelDeal, createDeal } from "@/lib/services/deals";
import { dealSchema, fieldErrors, manualAddressSchema, noteSchema, uuidSchema, type DealInput } from "@/lib/validation";
import { CHECK_FIELDS, fail, formObject, refreshAll, text, type ActionState } from "./shared";

export async function createDealAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireOffice();
  const raw = formObject(formData);
  const manualMode = text(formData, "mode") === "manual";

  const parsed = dealSchema.safeParse({ ...raw, portfolioId: manualMode ? null : raw.portfolioId });
  const manual = manualMode ? manualAddressSchema.safeParse(raw) : null;

  const errors = {
    ...(parsed.success ? {} : fieldErrors(parsed.error)),
    ...(manual && !manual.success ? fieldErrors(manual.error) : {}),
  };
  if (!manualMode && parsed.success && !parsed.data.portfolioId) {
    errors.portfolioId = "Listeden bir portföy seçin ya da “Portföy listede yok” seçeneğini kullanın.";
  }
  if (Object.keys(errors).length > 0 || !parsed.success) return { error: CHECK_FIELDS, fieldErrors: errors };

  const input: DealInput = { ...parsed.data, manual: manual?.success ? manual.data : null };
  let dealId: string;
  try {
    dealId = (await createDeal(viewer, input)).deal.id;
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  redirect(`/kontratlar/${dealId}?yeni=1`);
}

export async function cancelDealAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(id).success) return { error: "Kontrat bulunamadı." };
  const reason = noteSchema.safeParse(text(formData, "reason"));
  if (!reason.success) return { fieldErrors: { reason: "Açıklama çok uzun." } };
  if (!reason.data) return { fieldErrors: { reason: "İptal nedenini kısaca yazın." } };
  try {
    await cancelDeal(viewer, id, reason.data);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}
