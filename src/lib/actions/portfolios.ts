"use server";

import { redirect } from "next/navigation";
import type { PortfolioStatus } from "@/lib/db/schema";
import { requireOffice } from "@/lib/auth/guards";
import { PORTFOLIO_STATUSES } from "@/lib/domain/labels";
import { createPortfolio, setPortfolioStatus, updatePortfolio } from "@/lib/services/portfolios";
import { fieldErrors, noteSchema, portfolioSchema, uuidSchema } from "@/lib/validation";
import { CHECK_FIELDS, fail, formObject, refreshAll, text, type ActionState } from "./shared";

const FIELD_BY_CODE = { listing_url: "listingUrl", duplicate: "unitNo" };

export async function savePortfolioAction(
  id: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { viewer } = await requireOffice();
  const parsed = portfolioSchema.safeParse(formObject(formData));
  if (!parsed.success) return { error: CHECK_FIELDS, fieldErrors: fieldErrors(parsed.error) };

  let savedId: string;
  try {
    if (id) {
      if (!uuidSchema.safeParse(id).success) return { error: "Portföy bulunamadı." };
      savedId = (await updatePortfolio(viewer, id, parsed.data)).id;
    } else {
      savedId = (await createPortfolio(viewer, parsed.data)).id;
    }
  } catch (err) {
    return fail(err, FIELD_BY_CODE);
  }
  refreshAll();
  redirect(`/portfoyler/${savedId}?${id ? "guncellendi" : "yeni"}=1`);
}

export async function setPortfolioStatusAction(
  id: string,
  status: PortfolioStatus,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { viewer } = await requireOffice();
  if (!uuidSchema.safeParse(id).success || !PORTFOLIO_STATUSES.includes(status)) {
    return { error: "Geçersiz istek." };
  }
  const note = noteSchema.safeParse(text(formData, "note"));
  if (!note.success) return { fieldErrors: { note: "Not çok uzun." } };
  try {
    await setPortfolioStatus(viewer, id, status, note.data);
  } catch (err) {
    return fail(err);
  }
  refreshAll();
  return { ok: true };
}
