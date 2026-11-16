import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-ink-950 px-6 text-center">
      <Brand />
      <p className="eyebrow mt-12 text-gold-400">404</p>
      <h1 className="mt-3 font-display text-4xl text-white">Aradığınız sayfa bulunamadı</h1>
      <p className="mt-3 max-w-md text-ink-300">Kayıt silinmiş, taşınmış ya da bu sayfayı görme yetkiniz olmayabilir.</p>
      <Link href="/" className="btn btn-gold mt-8">
        Ana sayfaya dön
      </Link>
    </main>
  );
}
