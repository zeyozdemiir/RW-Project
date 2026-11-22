import { and, desc, eq } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { activityLog, users } from "@/lib/db/schema";

export type ActivityInput = {
  officeId: string;
  actorId: string | null;
  entityType: "portfolio" | "deal" | "user" | "team" | "alert" | "office";
  entityId: string;
  action: string;
  summary: string;
  meta?: Record<string, unknown>;
};

/** Kim, neyi, ne zaman değiştirdi: silinmeyen işlem kaydı. */
export async function logActivity(tx: DbOrTx, entry: ActivityInput): Promise<void> {
  await tx.insert(activityLog).values({
    officeId: entry.officeId,
    actorId: entry.actorId,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    summary: entry.summary,
    meta: entry.meta ?? null,
  });
}

export type ActivityRow = {
  id: number;
  action: string;
  summary: string;
  actorName: string | null;
  createdAt: Date;
};

export async function listActivity(
  officeId: string,
  entityType: ActivityInput["entityType"],
  entityId: string,
  limit = 30,
): Promise<ActivityRow[]> {
  return db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      summary: activityLog.summary,
      actorName: users.name,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorId))
    .where(
      and(
        eq(activityLog.officeId, officeId),
        eq(activityLog.entityType, entityType),
        eq(activityLog.entityId, entityId),
      ),
    )
    .orderBy(desc(activityLog.createdAt), desc(activityLog.id))
    .limit(limit);
}
