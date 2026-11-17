import "./load-env";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb } from "../src/lib/db";

async function main() {
  const folder = path.resolve(process.cwd(), "drizzle");
  await migrate(getDb(), { migrationsFolder: folder });
  console.log("Veritabanı şeması güncel.");
}

main()
  .catch((err) => {
    console.error("Migrasyon başarısız:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
