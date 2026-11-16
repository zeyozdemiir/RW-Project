import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { getSession, homePathFor } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Kayıt" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect(homePathFor(session.user));

  return (
    <>
      <p className="eyebrow">Yeni hesap</p>
      <h1 className="mt-3 font-display text-4xl leading-tight text-ink-950">Ofisinize katılın</h1>
      <p className="mt-3 mb-8 text-[0.9375rem] text-ink-500">
        Kaydınız ofisinizin üst yöneticisine onay için iletilir. Onaydan sonra giriş yapabilirsiniz.
      </p>
      <RegisterForm />
      <p className="mt-8 text-center text-sm text-ink-500">
        Zaten hesabınız var mı?{" "}
        <Link href="/giris" className="font-semibold text-ink-900 underline decoration-gold-400 decoration-2 underline-offset-4 hover:text-gold-700">
          Giriş yapın
        </Link>
      </p>
    </>
  );
}
