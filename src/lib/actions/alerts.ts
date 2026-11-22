"use server";

import { requireOffice } from "@/lib/auth/guards";
import { dismissAlert, resolveAlertByCreating, resolveAlertByLinking } from "@/lib/services/alerts";
import { noteSchema, uuidSchema } from "@/lib/validation";
import { fail, refreshAll, text, type ActionState } from "./shared";

function parseNote(formData: FormData): { ok: true; note: string | null } | { ok: false } {
  const note = noteSchema.safeParse(text(formData, "note"));
  return note.success ? { ok: true, note: note.data } : { ok: false };
}

export async function linkAlertAction(
  alertId: string,
  portfolioId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(alertId).success || !uuidSchema.safeParse(portfolioId).success) {
    return { error: "Geçersiz istek." };
  }
  const note = parseNote(formData);
  if (!note.ok) return { error: "Not çok uzun." };
  try {
    await resolveAlertByLinking(viewer, alertId, portfolioId, note.note);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}

export async function createFromAlertAction(alertId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(alertId).success) return { error: "Geçersiz istek." };
  const agentRaw = text(formData, "agentId");
  const agentId = agentRaw === "" ? null : agentRaw;
  if (agentId && !uuidSchema.safeParse(agentId).success) return { error: "Geçersiz danışman." };
  const note = parseNote(formData);
  if (!note.ok) return { error: "Not çok uzun." };
  try {
    await resolveAlertByCreating(viewer, alertId, agentId, note.note);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}

export async function dismissAlertAction(alertId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(alertId).success) return { error: "Geçersiz istek." };
  const note = parseNote(formData);
  if (!note.ok) return { fieldErrors: { note: "Açıklama çok uzun." } };
  if (!note.note) return { fieldErrors: { note: "Kapatma nedenini kısaca yazın." } };
  try {
    await dismissAlert(viewer, alertId, note.note);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}
