import "./load-env";
import { checkPasswordStrength } from "../src/lib/auth/password";
import { closeDb } from "../src/lib/db";
import { ensurePlatformAdmin } from "../src/lib/services/users";

/**
 * Platform sahibinin hesabını ortam değişkenlerinden bir kez oluşturur.
 * Hesap zaten varsa hiçbir şeyi değiştirmez (şifreyi de sıfırlamaz).
 */
async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Yöneticisi";

  if (!email || !password) {
    console.log("PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD tanımlı değil; platform yöneticisi oluşturulmadı.");
    return;
  }
  if (password.length < 12 || !checkPasswordStrength(password).ok) {
    throw new Error("PLATFORM_ADMIN_PASSWORD en az 12 karakter olmalı ve harf ile rakam içermeli.");
  }
  const result = await ensurePlatformAdmin({ email, password, name });
  console.log(
    result === "created"
      ? `Platform yöneticisi oluşturuldu: ${email}`
      : `Platform yöneticisi zaten var: ${email} (değişiklik yapılmadı)`,
  );
}

main()
  .catch((err) => {
    console.error("Kurulum başarısız:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
