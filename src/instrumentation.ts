/**
 * Sunucu her açıldığında bir kez çalışır (istek kabul edilmeden önce).
 * Veritabanı şemasını günceller ve gerekiyorsa platform yöneticisini oluşturur.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.AUTO_MIGRATE === "false") return;
  const { runStartupTasks } = await import("@/lib/startup");
  try {
    await runStartupTasks();
  } catch (err) {
    console.error("[kurulum] Açılış kurulumu başarısız oldu:", err);
    // Canlı ortamda yarım kurulumla çalışmaktansa açılışı durdur; hata hemen görülsün.
    if (process.env.NODE_ENV === "production") throw err;
  }
}
