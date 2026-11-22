import fs from "node:fs";
import path from "node:path";

/**
 * Komut satırı betikleri için .env dosyasını yükler (Next.js bunu kendisi
 * yapar, betikler yapmaz). Ortamda zaten tanımlı değişkenlerin üzerine yazmaz.
 */
for (const name of [".env.local", ".env"]) {
  const file = path.resolve(process.cwd(), name);
  if (fs.existsSync(file)) {
    process.loadEnvFile(file);
  }
}
