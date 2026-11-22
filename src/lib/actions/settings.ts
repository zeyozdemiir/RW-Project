"use server";

import { requireOffice, requireSession } from "@/lib/auth/guards";
import { updateOfficeSettings } from "@/lib/services/offices";
import { updateProfile } from "@/lib/services/users";
import { fieldErrors, officeSettingsSchema, profileSchema } from "@/lib/validation";
import { CHECK_FIELDS, fail, formObject, refreshAll, type ActionState } from "./shared";

export async function updateOfficeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireOffice();
  const parsed = officeSettingsSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: CHECK_FIELDS, fieldErrors: fieldErrors(parsed.error) };
  try {
    await updateOfficeSettings(viewer, parsed.data);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true, message: "Ofis ayarları kaydedildi." };
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const parsed = profileSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: CHECK_FIELDS, fieldErrors: fieldErrors(parsed.error) };
  try {
    await updateProfile(user.id, parsed.data);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true, message: "Bilgileriniz kaydedildi." };
}
