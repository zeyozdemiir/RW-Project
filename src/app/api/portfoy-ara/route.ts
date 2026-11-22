import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/guards";
import type { Viewer } from "@/lib/domain/permissions";
import { searchPortfoliosForDeal } from "@/lib/services/portfolios";

/** Kontrat formundaki portföy araması. Yalnızca oturum sahibinin ofisinde arar. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !session.office || session.user.role === "platform_admin" || session.user.mustChangePassword) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }
  const { user, office } = session;
  const viewer: Viewer = {
    id: user.id,
    officeId: office.id,
    role: user.role === "manager" ? "manager" : user.role === "leader" ? "leader" : "agent",
    teamId: user.teamId,
    name: user.name,
    email: user.email,
  };

  const params = request.nextUrl.searchParams;
  const type = params.get("tur") === "sale" ? "sale" : "rent";
  const q = (params.get("q") ?? "").slice(0, 100);
  const results = await searchPortfoliosForDeal(viewer, type, q);
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
