import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
/** Bir veritabanı bağlantısı veya açık bir işlem (transaction). */
export type DbOrTx = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

type GlobalDb = { __anahtarPool?: Pool; __anahtarDb?: Database };
const globalForDb = globalThis as unknown as GlobalDb;

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL tanımlı değil. .env dosyasını kontrol edin.");
  }
  const useSsl = process.env.DATABASE_SSL === "true";
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: useSsl ? { rejectUnauthorized: true } : undefined,
  });
  // Boşta bekleyen bir bağlantı koparsa (veritabanı yeniden başlatıldı, ağ kesildi)
  // sunucu çökmesin; havuz bir sonraki sorguda yeni bağlantı açar.
  pool.on("error", (err) => {
    console.error("[veritabanı] Boştaki bağlantı koptu:", err.message);
  });
  return pool;
}

export function getPool(): Pool {
  if (!globalForDb.__anahtarPool) {
    globalForDb.__anahtarPool = createPool();
  }
  return globalForDb.__anahtarPool;
}

export function getDb(): Database {
  if (!globalForDb.__anahtarDb) {
    globalForDb.__anahtarDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__anahtarDb;
}

/** Tembel (lazy) erişim: bağlantı ilk sorguda açılır, derleme sırasında değil. */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export async function closeDb(): Promise<void> {
  if (globalForDb.__anahtarPool) {
    await globalForDb.__anahtarPool.end();
    globalForDb.__anahtarPool = undefined;
    globalForDb.__anahtarDb = undefined;
  }
}

export { schema };
