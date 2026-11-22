"use server";

import { requirePlatformAdmin } from "@/lib/auth/guards";
import { generateTempPassword } from "@/lib/auth/password";
import { normalizeDomain } from "@/lib/domain/normalize";
import {
  addOfficeDomains,
  createOffice,
  parseDomainList,
  platformResetManagerPassword,
  removeOfficeDomain,
  setOfficeActive,
} from "@/lib/services/offices";
import { createOfficeSchema, fieldErrors, uuidSchema } from "@/lib/validation";
import { CHECK_FIELDS, fail, formObject, refreshAll, text, type ActionState } from "./shared";

const BAD_REQUEST: ActionState = { error: "Geçersiz istek." };
const TEMP_NOTE =
  "Bu şifre yalnızca bir kez gösterilir. Üst yöneticiye güvenli bir yoldan iletin; ilk girişte kendi şifresini belirleyecek.";

export async function createOfficeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const parsed = createOfficeSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: CHECK_FIELDS, fieldErrors: fieldErrors(parsed.error) };
  try {
    const domains = parseDomainList(parsed.data.domains);
    const tempPassword = generateTempPassword();
    const { office, manager } = await createOffice({
      name: parsed.data.name,
      domains,
      managerName: parsed.data.managerName,
      managerEmail: parsed.data.managerEmail,
      managerPassword: tempPassword,
    });
    refreshAll();
    return {
      ok: true,
      message: `${office.name} oluşturuldu.`,
      secret: { label: `${manager.name} (${manager.email}) için geçici şifre`, value: tempPassword, note: TEMP_NOTE },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function setOfficeActiveAction(officeId: string, active: boolean): Promise<ActionState> {
  await requirePlatformAdmin();
  if (!uuidSchema.safeParse(officeId).success) return BAD_REQUEST;
  try {
    await setOfficeActive(officeId, active);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}

export async function addOfficeDomainAction(officeId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  if (!uuidSchema.safeParse(officeId).success) return BAD_REQUEST;
  try {
    await addOfficeDomains(officeId, parseDomainList(text(formData, "domain")));
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}

export async function removeOfficeDomainAction(officeId: string, domain: string): Promise<ActionState> {
  await requirePlatformAdmin();
  const normalized = normalizeDomain(domain);
  if (!uuidSchema.safeParse(officeId).success || !normalized) return BAD_REQUEST;
  try {
    await removeOfficeDomain(officeId, normalized);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}

export async function resetManagerPasswordAction(userId: string): Promise<ActionState> {
  await requirePlatformAdmin();
  if (!uuidSchema.safeParse(userId).success) return BAD_REQUEST;
  try {
    const tempPassword = generateTempPassword();
    const manager = await platformResetManagerPassword(userId, tempPassword);
    return {
      ok: true,
      secret: { label: `${manager.name} (${manager.email}) için geçici şifre`, value: tempPassword, note: TEMP_NOTE },
    };
  } catch (err) {
    return fail(err);
  }
}
