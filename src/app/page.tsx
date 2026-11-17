import { redirect } from "next/navigation";
import { getSession, homePathFor } from "@/lib/auth/guards";

export default async function RootPage() {
  const session = await getSession();
  redirect(session ? homePathFor(session.user) : "/giris");
}
