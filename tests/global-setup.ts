import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { TEST_DATABASE_URL } from "./test-db-url";

/** Her test çalıştırmasında test veritabanını sıfırlar ve şemayı yeniden kurar. */
export default async function setup() {
  if (!/test/i.test(new URL(TEST_DATABASE_URL).pathname)) {
    throw new Error("Güvenlik: test veritabanının adı 'test' içermeli; aksi hâlde sıfırlanmaz.");
  }
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await pool.query("drop schema if exists public cascade");
    await pool.query("drop schema if exists drizzle cascade");
    await pool.query("create schema public");
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(__dirname, "../drizzle") });
  } finally {
    await pool.end();
  }
}
