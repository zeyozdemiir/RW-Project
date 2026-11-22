import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getSession, homePathFor } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.user));

  return (
    <>
      <p className="eyebrow">Hoş geldiniz</p>
      <h1 className="mt-3 font-display text-4xl leading-tight text-ink-950">Hesabınıza giriş yapın</h1>
      <p className="mt-3 mb-8 text-[0.9375rem] text-ink-500">
        Ofisinizin kurumsal e-posta adresiyle giriş yapın; doğrudan kendi ofisinizin paneline ulaşırsınız.
      </p>
      <LoginForm />
      <p className="mt-8 text-center text-sm text-ink-500">
        Hesabınız yok mu?{" "}
        <Link href="/kayit" className="font-semibold text-ink-900 underline decoration-gold-400 decoration-2 underline-offset-4 hover:text-gold-700">
          Kayıt olun
        </Link>
      </p>
      <p className="mt-3 text-center text-[0.8125rem] text-ink-400">
        Şifrenizi mi unuttunuz? Ofis yöneticiniz size yeni bir geçici şifre verebilir.
      </p>
    </>
  );
}
