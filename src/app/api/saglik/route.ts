import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Barındırma platformlarının sağlık denetimi için: uygulama ve veritabanı ayakta mı? */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ durum: "tamam" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ durum: "veritabanina-ulasilamiyor" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
