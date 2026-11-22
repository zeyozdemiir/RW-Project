"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">Bir sorun oluştu</p>
      <h1 className="mt-3 font-display text-3xl text-ink-950">Sayfa yüklenemedi</h1>
      <p className="mt-3 max-w-md text-sm text-ink-500">
        Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin; sorun sürerse yöneticinize haber verin.
      </p>
      <button type="button" onClick={reset} className="btn btn-primary mt-7">
        Tekrar dene
      </button>
    </main>
  );
}
