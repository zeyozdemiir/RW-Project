import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { offices, sessions, users, type Office, type User } from "@/lib/db/schema";
import { SESSION_DAYS } from "@/lib/config";

function tokenId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = { user: User; office: Office | null };

/** Yeni oturum açar; çereze yazılacak gizli anahtarı döndürür. */
export async function createSession(
  userId: string,
  userAgent: string | null,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: tokenId(token),
    userId,
    expiresAt,
    userAgent: userAgent?.slice(0, 300) ?? null,
  });
  // Süresi dolmuş eski oturumları temizle.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

export async function readSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const rows = await db
    .select({ user: users, office: offices })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(offices, eq(offices.id, users.officeId))
    .where(and(eq(sessions.id, tokenId(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Onayı kaldırılmış kullanıcı veya kapatılmış ofis: oturum geçersizdir.
  if (row.user.status !== "active") return null;
  if (row.user.role !== "platform_admin" && (!row.office || !row.office.isActive)) return null;
  return row;
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, tokenId(token)));
}

/** Kullanıcının tüm oturumlarını kapatır (şifre sıfırlama, hesabı kapatma). */
export async function destroyUserSessions(userId: string, exceptToken?: string | null): Promise<void> {
  if (exceptToken) {
    await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, tokenId(exceptToken))));
  } else {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
}
