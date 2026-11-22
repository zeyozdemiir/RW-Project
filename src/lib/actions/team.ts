"use server";

import { requireOffice } from "@/lib/auth/guards";
import { createTeam, deleteTeam, renameTeam } from "@/lib/services/teams";
import {
  approveUser,
  rejectUser,
  resetMemberPassword,
  setMemberActive,
  updateMember,
} from "@/lib/services/users";
import { fieldErrors, memberSchema, teamNameSchema, uuidSchema } from "@/lib/validation";
import { fail, formObject, refreshAll, text, type ActionState } from "./shared";

const BAD_REQUEST: ActionState = { error: "Geçersiz istek." };

export async function approveUserAction(userId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(userId).success) return BAD_REQUEST;
  const parsed = memberSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  try {
    await approveUser(viewer, userId, parsed.data);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}

export async function rejectUserAction(userId: string): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(userId).success) return BAD_REQUEST;
  try {
    await rejectUser(viewer, userId);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}

export async function updateMemberAction(userId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(userId).success) return BAD_REQUEST;
  const parsed = memberSchema.safeParse(formObject(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  try {
    await updateMember(viewer, userId, parsed.data);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true, message: "Kaydedildi." };
}

export async function setMemberActiveAction(userId: string, active: boolean): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(userId).success) return BAD_REQUEST;
  try {
    await setMemberActive(viewer, userId, active);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}

export async function resetMemberPasswordAction(userId: string): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(userId).success) return BAD_REQUEST;
  try {
    const { tempPassword, name } = await resetMemberPassword(viewer, userId);
    return {
      ok: true,
      secret: {
        label: `${name} için geçici şifre`,
        value: tempPassword,
        note: "Bu şifre yalnızca bir kez gösterilir. Kullanıcı ilk girişte kendi şifresini belirler.",
      },
    };
  } catch (err) {
    return fail(err);
  }
}

export async function createTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireOffice();
  const name = teamNameSchema.safeParse(text(formData, "name"));
  if (!name.success) return { fieldErrors: { name: name.error.issues[0]?.message ?? "Ekip adını yazın." } };
  try {
    await createTeam(viewer, name.data);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}

export async function renameTeamAction(teamId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(teamId).success) return BAD_REQUEST;
  const name = teamNameSchema.safeParse(text(formData, "name"));
  if (!name.success) return { fieldErrors: { name: name.error.issues[0]?.message ?? "Ekip adını yazın." } };
  try {
    await renameTeam(viewer, teamId, name.data);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}

export async function deleteTeamAction(teamId: string): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(teamId).success) return BAD_REQUEST;
  try {
    await deleteTeam(viewer, teamId);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}
