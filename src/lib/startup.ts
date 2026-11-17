import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { checkPasswordStrength } from "@/lib/auth/password";
import { getPool } from "@/lib/db";
import { ensurePlatformAdmin } from "@/lib/services/users";

/** Aynı anda başlayan birden çok sunucu kopyası kurulumu sırayla yapsın diye kullanılan kilit numarası. */
const STARTUP_LOCK_ID = 7_260_411;

/**
 * Sunucu açılırken bir kez çalışır:
 *  1. Veritabanı şemasını günceller (bekleyen migrasyonları uygular).
 *  2. Ortam değişkenlerinde tanımlıysa platform yöneticisini oluşturur.
 *
 * Böylece yayına alırken ayrıca komut çalıştırmaya gerek kalmaz.
 * Kapatmak için AUTO_MIGRATE=false verin ve `npm run setup` kullanın.
 */
export async function runStartupTasks(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.warn("[kurulum] DATABASE_URL tanımlı değil; veritabanı kurulumu atlandı.");
    return;
  }

  const client = await getPool().connect();
  try {
    await client.query("select pg_advisory_lock($1)", [STARTUP_LOCK_ID]);
    try {
      await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    } finally {
      await client.query("select pg_advisory_unlock($1)", [STARTUP_LOCK_ID]);
    }
  } finally {
    client.release();
  }

  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12 || !checkPasswordStrength(password).ok) {
    console.error(
      "[kurulum] PLATFORM_ADMIN_PASSWORD en az 12 karakter olmalı ve harf ile rakam içermeli; platform yöneticisi oluşturulmadı.",
    );
    return;
  }
  const result = await ensurePlatformAdmin({
    email,
    password,
    name: process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Yöneticisi",
  });
  if (result === "created") console.log(`[kurulum] Platform yöneticisi oluşturuldu: ${email}`);
}
