import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/config";

const PUBLIC_PATHS = ["/giris", "/kayit", "/api/saglik"];

/**
 * Hızlı ön kontrol: oturum çerezi olmayan istekleri giriş sayfasına yollar.
 * Asıl yetki denetimi her sayfada ve her sunucu işleminde veritabanı
 * üzerinden yapılır (bkz. lib/auth/guards.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/giris", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
