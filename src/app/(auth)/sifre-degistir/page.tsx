import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForcePasswordForm } from "@/components/auth-forms";
import { homePathFor, requireSession } from "@/lib/auth/guards";
import { logoutAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Şifre belirle" };

export default async function ForcePasswordPage() {
  const { user } = await requireSession();
  if (!user.mustChangePassword) redirect(homePathFor(user));

  return (
    <>
      <p className="eyebrow">İlk giriş</p>
      <h1 className="mt-3 font-display text-4xl leading-tight text-ink-950">Kendi şifrenizi belirleyin</h1>
      <p className="mt-3 mb-8 text-[0.9375rem] text-ink-500">
        Merhaba {user.name}. Güvenliğiniz için size verilen geçici şifreyi, yalnızca sizin bildiğiniz bir şifreyle
        değiştirin.
      </p>
      <ForcePasswordForm />
      <form action={logoutAction} className="mt-6 text-center">
        <button type="submit" className="text-sm font-medium text-ink-500 underline underline-offset-4 hover:text-ink-900">
          Çıkış yap
        </button>
      </form>
    </>
  );
}
