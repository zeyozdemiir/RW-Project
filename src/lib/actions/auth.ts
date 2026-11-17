"use server";

import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  currentSessionToken,
  homePathFor,
  requireSession,
  setSessionCookie,
} from "@/lib/auth/guards";
import { createSession, destroySession } from "@/lib/auth/session";
import { authenticate, changeOwnPassword, registerUser, type AuthResult } from "@/lib/services/users";
import { fieldErrors, loginSchema, registerSchema } from "@/lib/validation";
import { CHECK_FIELDS, clientIp, clientUserAgent, fail, formObject, text, type ActionState } from "./shared";

const LOGIN_ERRORS: Record<Exclude<AuthResult, { ok: true }>["reason"], string> = {
  invalid: "E-posta veya şifre hatalı.",
  pending: "Hesabınız üst yönetici onayı bekliyor. Onaylandığında giriş yapabilirsiniz.",
  rejected: "Başvurunuz onaylanmadı. Lütfen ofis yöneticinizle görüşün.",
  disabled: "Hesabınız kapatılmış. Lütfen ofis yöneticinizle görüşün.",
  office_inactive: "Ofisinizin erişimi durdurulmuş. Lütfen platform yöneticisiyle görüşün.",
  throttled: "Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.",
};

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  let result: AuthResult;
  try {
    result = await authenticate(parsed.data.email, parsed.data.password, await clientIp());
  } catch (err) {
    return fail(err);
  }
  if (!result.ok) return { error: LOGIN_ERRORS[result.reason] };

  const session = await createSession(result.user.id, await clientUserAgent());
  await setSessionCookie(session.token, session.expiresAt);
  redirect(homePathFor(result.user));
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: CHECK_FIELDS, fieldErrors: fieldErrors(parsed.error) };
  if (parsed.data.password !== text(formData, "passwordConfirm")) {
    return { error: CHECK_FIELDS, fieldErrors: { passwordConfirm: "Şifreler birbiriyle aynı değil." } };
  }
  try {
    const { officeName } = await registerUser(parsed.data);
    return { ok: true, message: officeName };
  } catch (err) {
    return fail(err);
  }
}

export async function logoutAction(): Promise<void> {
  await destroySession(await currentSessionToken());
  await clearSessionCookie();
  redirect("/giris");
}

async function changePassword(formData: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const current = text(formData, "currentPassword");
  const next = text(formData, "newPassword");
  if (!current) return { fieldErrors: { currentPassword: "Mevcut şifrenizi girin." } };
  if (!next) return { fieldErrors: { newPassword: "Yeni şifrenizi girin." } };
  if (next !== text(formData, "newPasswordConfirm")) {
    return { fieldErrors: { newPasswordConfirm: "Şifreler birbiriyle aynı değil." } };
  }
  try {
    await changeOwnPassword(user.id, current, next, await currentSessionToken());
  } catch (err) {
    return fail(err);
  }
  return { ok: true, message: "Şifreniz güncellendi." };
}

/** Ayarlar sayfasındaki isteğe bağlı şifre değişikliği. */
export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return changePassword(formData);
}

/** Geçici şifreyle girişten sonraki zorunlu şifre değişikliği. */
export async function forcePasswordChangeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await changePassword(formData);
  if (!result?.ok) return result;
  const { user } = await requireSession();
  redirect(homePathFor(user));
}
