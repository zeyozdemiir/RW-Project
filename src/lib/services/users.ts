import { and, asc, count, eq, gt, ne, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { loginAttempts, offices, teams, users, type User, type UserRole, type UserStatus } from "@/lib/db/schema";
import {
  burnPasswordCheck,
  checkPasswordStrength,
  generateTempPassword,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import { destroyUserSessions } from "@/lib/auth/session";
import { ServiceError, forbidden, notFound } from "@/lib/errors";
import { normalizeEmail } from "@/lib/domain/normalize";
import { ROLE_LABELS } from "@/lib/domain/labels";
import { isManager, type Viewer } from "@/lib/domain/permissions";
import type { MemberInput } from "@/lib/validation";
import { logActivity } from "./activity";
import { findOfficeByEmail } from "./offices";

const MAX_FAILS_PER_EMAIL = 8;
const MAX_FAILS_PER_IP = 40;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;

export type AuthResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "pending" | "rejected" | "disabled" | "office_inactive" | "throttled" };

/**
 * E-posta ve şifreyle kimlik doğrular. Hesabın durumu (onay bekliyor vb.)
 * yalnızca şifre doğruysa açıklanır; böylece kimlerin kayıtlı olduğu sızmaz.
 */
export async function authenticate(emailRaw: string, password: string, ip: string | null): Promise<AuthResult> {
  const email = normalizeEmail(emailRaw);
  const since = new Date(Date.now() - THROTTLE_WINDOW_MS);

  const [byEmail] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, email), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
  if ((byEmail?.n ?? 0) >= MAX_FAILS_PER_EMAIL) return { ok: false, reason: "throttled" };
  if (ip) {
    const [byIp] = await db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.ip, ip), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
    if ((byIp?.n ?? 0) >= MAX_FAILS_PER_IP) return { ok: false, reason: "throttled" };
  }

  const rows = await db
    .select({ user: users, officeActive: offices.isActive })
    .from(users)
    .leftJoin(offices, eq(offices.id, users.officeId))
    .where(eq(users.email, email))
    .limit(1);
  const row = rows[0];

  let valid = false;
  if (row) {
    valid = await verifyPassword(password, row.user.passwordHash);
  } else {
    await burnPasswordCheck(password);
  }

  if (!row || !valid) {
    await db.insert(loginAttempts).values({ email, ip, success: false });
    return { ok: false, reason: "invalid" };
  }

  const { user, officeActive } = row;
  if (user.status === "pending") return { ok: false, reason: "pending" };
  if (user.status === "rejected") return { ok: false, reason: "rejected" };
  if (user.status === "disabled") return { ok: false, reason: "disabled" };
  if (user.role !== "platform_admin" && officeActive !== true) return { ok: false, reason: "office_inactive" };

  await db.insert(loginAttempts).values({ email, ip, success: true });
  // Başarılı girişten sonra bu e-postanın hatalı deneme sayacı sıfırlanır.
  await db.delete(loginAttempts).where(and(eq(loginAttempts.email, email), eq(loginAttempts.success, false)));
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { ok: true, user };
}

export type RegisterInput = { name: string; email: string; phone: string | null; password: string };

/**
 * Yeni kullanıcı kaydı. E-posta uzantısı kayıtlı bir ofise aitse hesap
 * "onay bekliyor" durumunda açılır; üst yönetici onaylamadan giriş yapılamaz.
 */
export async function registerUser(input: RegisterInput): Promise<{ officeName: string }> {
  const email = normalizeEmail(input.email);
  const strength = checkPasswordStrength(input.password);
  if (!strength.ok) throw new ServiceError(strength.error);

  const office = await findOfficeByEmail(email);
  if (!office || !office.isActive) {
    throw new ServiceError(
      "Bu e-posta uzantısı kayıtlı bir ofise ait değil. Lütfen ofisinizin kurumsal e-posta adresinizle kayıt olun.",
    );
  }
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new ServiceError("Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.");
  }

  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        officeId: office.id,
        email,
        name: input.name,
        phone: input.phone,
        passwordHash,
        role: "agent",
        status: "pending",
      })
      .returning({ id: users.id });
    if (!created) throw new Error("Kullanıcı oluşturulamadı.");
    await logActivity(tx, {
      officeId: office.id,
      actorId: created.id,
      entityType: "user",
      entityId: created.id,
      action: "user.registered",
      summary: `${input.name} kayıt oldu ve onay bekliyor.`,
    });
  });
  return { officeName: office.name };
}

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  teamId: string | null;
  teamName: string | null;
  agentRatePct: number | null;
  createdAt: Date;
  lastLoginAt: Date | null;
};

const memberColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  phone: users.phone,
  role: users.role,
  status: users.status,
  teamId: users.teamId,
  teamName: teams.name,
  agentRatePct: users.agentRatePct,
  createdAt: users.createdAt,
  lastLoginAt: users.lastLoginAt,
};

/**
 * Ofis üyeleri. Üst yönetici herkesi (bekleyen ve pasifler dahil) görür;
 * diğerleri yalnızca aktif üyelerin rehber bilgilerini görür.
 */
export async function listMembers(viewer: Viewer): Promise<MemberRow[]> {
  const rows = await db
    .select(memberColumns)
    .from(users)
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(
      isManager(viewer)
        ? eq(users.officeId, viewer.officeId)
        : and(eq(users.officeId, viewer.officeId), eq(users.status, "active")),
    )
    .orderBy(asc(users.name));
  if (isManager(viewer)) return rows;
  return rows.map((r) => ({ ...r, agentRatePct: null, lastLoginAt: null }));
}

/** Kontrat ve portföy formlarındaki danışman seçimleri için aktif üyeler. */
export async function listActiveAgents(
  officeId: string,
): Promise<Array<{ id: string; name: string; teamId: string | null; teamName: string | null; role: UserRole }>> {
  return db
    .select({ id: users.id, name: users.name, teamId: users.teamId, teamName: teams.name, role: users.role })
    .from(users)
    .leftJoin(teams, eq(teams.id, users.teamId))
    .where(and(eq(users.officeId, officeId), eq(users.status, "active")))
    .orderBy(asc(users.name));
}

export async function countPendingUsers(officeId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.officeId, officeId), eq(users.status, "pending")));
  return row?.n ?? 0;
}

async function loadOfficeUser(tx: DbOrTx, officeId: string, userId: string): Promise<User> {
  const [user] = await tx
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.officeId, officeId)))
    .limit(1);
  if (!user) throw notFound("Kullanıcı bulunamadı.");
  return user;
}

async function assertTeamInOffice(tx: DbOrTx, officeId: string, teamId: string | null): Promise<string | null> {
  if (!teamId) return null;
  const [team] = await tx
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.officeId, officeId)))
    .limit(1);
  if (!team) throw new ServiceError("Seçilen ekip bulunamadı.");
  return team.name;
}

/** Ofiste en az bir aktif üst yönetici kalmalıdır. */
async function assertAnotherManager(tx: DbOrTx, officeId: string, exceptUserId: string): Promise<void> {
  const [row] = await tx
    .select({ n: count() })
    .from(users)
    .where(
      and(
        eq(users.officeId, officeId),
        eq(users.role, "manager"),
        eq(users.status, "active"),
        ne(users.id, exceptUserId),
      ),
    );
  if ((row?.n ?? 0) === 0) {
    throw new ServiceError("Ofiste en az bir aktif üst yönetici kalmalı.");
  }
}

function validateRoleTeam(input: MemberInput): void {
  if (input.role === "leader" && !input.teamId) {
    throw new ServiceError("Ekip lideri için bir ekip seçin.");
  }
}

/** Üst yöneticinin ilk giriş onayı: rol ve ekip atanır, hesap aktifleşir. */
export async function approveUser(viewer: Viewer, userId: string, input: MemberInput): Promise<void> {
  if (!isManager(viewer)) throw forbidden();
  validateRoleTeam(input);
  await db.transaction(async (tx) => {
    const user = await loadOfficeUser(tx, viewer.officeId, userId);
    if (user.status !== "pending" && user.status !== "rejected") {
      throw new ServiceError("Bu kullanıcı zaten onaylanmış.");
    }
    const teamName = await assertTeamInOffice(tx, viewer.officeId, input.teamId);
    await tx
      .update(users)
      .set({
        status: "active",
        role: input.role,
        teamId: input.teamId,
        agentRatePct: input.agentRatePct,
        approvedById: viewer.id,
        approvedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "user",
      entityId: user.id,
      action: "user.approved",
      summary: `${user.name} onaylandı (${ROLE_LABELS[input.role]}${teamName ? `, ${teamName}` : ""}).`,
    });
  });
}

export async function rejectUser(viewer: Viewer, userId: string): Promise<void> {
  if (!isManager(viewer)) throw forbidden();
  await db.transaction(async (tx) => {
    const user = await loadOfficeUser(tx, viewer.officeId, userId);
    if (user.status !== "pending") throw new ServiceError("Yalnızca onay bekleyen başvurular reddedilebilir.");
    await tx.update(users).set({ status: "rejected" }).where(eq(users.id, user.id));
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "user",
      entityId: user.id,
      action: "user.rejected",
      summary: `${user.name} başvurusu reddedildi.`,
    });
  });
}

export async function updateMember(viewer: Viewer, userId: string, input: MemberInput): Promise<void> {
  if (!isManager(viewer)) throw forbidden();
  validateRoleTeam(input);
  await db.transaction(async (tx) => {
    const user = await loadOfficeUser(tx, viewer.officeId, userId);
    if (user.status !== "active" && user.status !== "disabled") {
      throw new ServiceError("Önce kullanıcının başvurusunu onaylayın.");
    }
    if (user.id === viewer.id && input.role !== "manager") {
      throw new ServiceError("Kendi yönetici yetkinizi kaldıramazsınız.");
    }
    if (user.role === "manager" && input.role !== "manager" && user.status === "active") {
      await assertAnotherManager(tx, viewer.officeId, user.id);
    }
    const teamName = await assertTeamInOffice(tx, viewer.officeId, input.teamId);
    await tx
      .update(users)
      .set({ role: input.role, teamId: input.teamId, agentRatePct: input.agentRatePct })
      .where(eq(users.id, user.id));
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "user",
      entityId: user.id,
      action: "user.updated",
      summary: `${user.name} güncellendi (${ROLE_LABELS[input.role]}${teamName ? `, ${teamName}` : ", ekipsiz"}).`,
    });
  });
}

/** Hesabı kapatır (girişi engeller) veya yeniden açar. Kayıtlar silinmez. */
export async function setMemberActive(viewer: Viewer, userId: string, active: boolean): Promise<void> {
  if (!isManager(viewer)) throw forbidden();
  if (userId === viewer.id) throw new ServiceError("Kendi hesabınızı kapatamazsınız.");
  await db.transaction(async (tx) => {
    const user = await loadOfficeUser(tx, viewer.officeId, userId);
    if (user.status !== "active" && user.status !== "disabled") {
      throw new ServiceError("Önce kullanıcının başvurusunu onaylayın.");
    }
    if (!active && user.role === "manager") {
      await assertAnotherManager(tx, viewer.officeId, user.id);
    }
    await tx
      .update(users)
      .set({ status: active ? "active" : "disabled" })
      .where(eq(users.id, user.id));
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "user",
      entityId: user.id,
      action: active ? "user.enabled" : "user.disabled",
      summary: active ? `${user.name} hesabı yeniden açıldı.` : `${user.name} hesabı kapatıldı.`,
    });
  });
  if (!active) await destroyUserSessions(userId);
}

/** Üst yönetici bir kullanıcıya geçici şifre üretir; kullanıcı ilk girişte değiştirir. */
export async function resetMemberPassword(viewer: Viewer, userId: string): Promise<{ tempPassword: string; name: string }> {
  if (!isManager(viewer)) throw forbidden();
  if (userId === viewer.id) {
    throw new ServiceError("Kendi şifrenizi Ayarlar sayfasından değiştirebilirsiniz.");
  }
  const user = await loadOfficeUser(db, viewer.officeId, userId);
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, mustChangePassword: true }).where(eq(users.id, user.id));
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "user",
      entityId: user.id,
      action: "user.password_reset",
      summary: `${user.name} için şifre sıfırlandı.`,
    });
  });
  await destroyUserSessions(user.id);
  return { tempPassword, name: user.name };
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  keepSessionToken: string | null,
): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw notFound("Kullanıcı bulunamadı.");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ServiceError("Mevcut şifreniz hatalı.");
  }
  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) throw new ServiceError(strength.error);
  if (currentPassword === newPassword) {
    throw new ServiceError("Yeni şifreniz mevcut şifrenizden farklı olmalı.");
  }
  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, mustChangePassword: false }).where(eq(users.id, userId));
  // Diğer cihazlardaki oturumlar kapatılır.
  await destroyUserSessions(userId, keepSessionToken);
}

export async function updateProfile(userId: string, input: { name: string; phone: string | null }): Promise<void> {
  await db.update(users).set({ name: input.name, phone: input.phone }).where(eq(users.id, userId));
}

/** Platform yöneticisini ortam değişkenlerinden bir kez oluşturur (varsa dokunmaz). */
export async function ensurePlatformAdmin(input: {
  email: string;
  password: string;
  name: string;
}): Promise<"created" | "exists"> {
  const email = normalizeEmail(input.email);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) return "exists";
  const passwordHash = await hashPassword(input.password);
  await db.insert(users).values({
    officeId: null,
    email,
    name: input.name,
    passwordHash,
    role: "platform_admin",
    status: "active",
    approvedAt: new Date(),
  });
  return "created";
}

export async function countPlatformAdmins(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "platform_admin"));
  return row?.n ?? 0;
}
