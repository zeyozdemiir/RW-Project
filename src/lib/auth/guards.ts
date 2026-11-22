import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/config";
import type { Office, User } from "@/lib/db/schema";
import type { Viewer } from "@/lib/domain/permissions";
import { readSession, type SessionUser } from "./session";

export function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function currentSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** İstek başına bir kez çalışır; geçerli oturumun kullanıcısını döndürür. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  return readSession(await currentSessionToken());
});

export type OfficeSession = { viewer: Viewer; user: User; office: Office };

function toViewer(user: User, office: Office): Viewer {
  return {
    id: user.id,
    officeId: office.id,
    role: user.role === "manager" ? "manager" : user.role === "leader" ? "leader" : "agent",
    teamId: user.teamId,
    name: user.name,
    email: user.email,
  };
}

/** Oturum yoksa giriş sayfasına yönlendirir. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/giris");
  return session;
}

/**
 * Ofis sayfaları için: onaylı bir ofis kullanıcısı gerekir.
 * Geçici şifreyle giren kullanıcı önce şifresini değiştirmek zorundadır.
 */
export async function requireOffice(): Promise<OfficeSession> {
  const session = await requireSession();
  if (session.user.mustChangePassword) redirect("/sifre-degistir");
  if (session.user.role === "platform_admin") redirect("/platform");
  if (!session.office) redirect("/giris");
  return { viewer: toViewer(session.user, session.office), user: session.user, office: session.office };
}

export async function requireManager(): Promise<OfficeSession> {
  const session = await requireOffice();
  if (session.viewer.role !== "manager") redirect("/panel");
  return session;
}

export async function requirePlatformAdmin(): Promise<User> {
  const session = await requireSession();
  if (session.user.mustChangePassword) redirect("/sifre-degistir");
  if (session.user.role !== "platform_admin") redirect("/panel");
  return session.user;
}

/** Giriş yaptıktan sonra kullanıcının gideceği ilk sayfa. */
export function homePathFor(user: User): string {
  if (user.mustChangePassword) return "/sifre-degistir";
  return user.role === "platform_admin" ? "/platform" : "/panel";
}
