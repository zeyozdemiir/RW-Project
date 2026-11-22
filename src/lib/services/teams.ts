import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, users, type Team } from "@/lib/db/schema";
import { ServiceError, forbidden, notFound } from "@/lib/errors";
import { isManager, type Viewer } from "@/lib/domain/permissions";
import { logActivity } from "./activity";

export async function listTeams(officeId: string): Promise<Team[]> {
  return db.select().from(teams).where(eq(teams.officeId, officeId)).orderBy(asc(teams.name));
}

async function assertNameFree(officeId: string, name: string, exceptId?: string): Promise<void> {
  const rows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.officeId, officeId), eq(teams.name, name)));
  if (rows.some((r) => r.id !== exceptId)) throw new ServiceError("Bu isimde bir ekip zaten var.");
}

export async function createTeam(viewer: Viewer, name: string): Promise<Team> {
  if (!isManager(viewer)) throw forbidden();
  await assertNameFree(viewer.officeId, name);
  return db.transaction(async (tx) => {
    const [team] = await tx.insert(teams).values({ officeId: viewer.officeId, name }).returning();
    if (!team) throw new Error("Ekip oluşturulamadı.");
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "team",
      entityId: team.id,
      action: "team.created",
      summary: `"${name}" ekibi oluşturuldu.`,
    });
    return team;
  });
}

export async function renameTeam(viewer: Viewer, teamId: string, name: string): Promise<void> {
  if (!isManager(viewer)) throw forbidden();
  await assertNameFree(viewer.officeId, name, teamId);
  const updated = await db
    .update(teams)
    .set({ name })
    .where(and(eq(teams.id, teamId), eq(teams.officeId, viewer.officeId)))
    .returning({ id: teams.id });
  if (updated.length === 0) throw notFound("Ekip bulunamadı.");
}

/** Yalnızca üyesi kalmamış ekipler silinebilir. */
export async function deleteTeam(viewer: Viewer, teamId: string): Promise<void> {
  if (!isManager(viewer)) throw forbidden();
  await db.transaction(async (tx) => {
    const [team] = await tx
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.officeId, viewer.officeId)))
      .limit(1);
    if (!team) throw notFound("Ekip bulunamadı.");
    const [members] = await tx
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.officeId, viewer.officeId), eq(users.teamId, teamId)));
    if ((members?.n ?? 0) > 0) {
      throw new ServiceError("Bu ekipte üyeler var. Önce üyeleri başka bir ekibe taşıyın.");
    }
    await tx.delete(teams).where(eq(teams.id, teamId));
    await logActivity(tx, {
      officeId: viewer.officeId,
      actorId: viewer.id,
      entityType: "team",
      entityId: teamId,
      action: "team.deleted",
      summary: `"${team.name}" ekibi silindi.`,
    });
  });
}
