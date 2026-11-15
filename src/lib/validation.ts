import { z } from "zod";
import { PROPERTY_TYPE_VALUES } from "@/lib/domain/labels";
import { isValidISODate } from "@/lib/domain/dates";
import { parseMoney } from "@/lib/domain/money";

/** Boş bırakılabilen metin alanı: boşsa `null`. */
const optText = (max: number) =>
  z
    .preprocess((v) => (v === null || v === undefined ? "" : v), z.string().trim().max(max, `En fazla ${max} karakter.`))
    .transform((v) => (v === "" ? null : v));

const reqText = (max: number, message = "Bu alan zorunlu.") =>
  z.preprocess(
    (v) => (v === null || v === undefined ? "" : v),
    z.string().trim().min(1, message).max(max, `En fazla ${max} karakter.`),
  );

const optInt = (min: number, max: number) =>
  z.preprocess(
    (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === "string") {
        const s = v.trim();
        return s === "" ? null : Number(s);
      }
      return v;
    },
    z
      .number({ error: "Geçerli bir sayı girin." })
      .int("Tam sayı girin.")
      .min(min, `En az ${min} olabilir.`)
      .max(max, `En fazla ${max} olabilir.`)
      .nullable(),
  );

const money = (message = "Geçerli bir tutar girin.") =>
  z.preprocess(
    (v) => (typeof v === "string" ? parseMoney(v) : v),
    z
      .number({ error: message })
      .int(message)
      .positive("Tutar sıfırdan büyük olmalı.")
      .max(100_000_000_000_00, "Tutar çok büyük."),
  );

const optUuid = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.uuid("Geçersiz seçim.").nullable());

const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean());

const pctField = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? NaN : Number(v)) : v),
  z.number({ error: "0 ile 100 arasında bir oran girin." }).int("Tam sayı girin.").min(0, "En az 0.").max(100, "En fazla 100."),
);

const optPct = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") return v.trim() === "" ? null : Number(v);
    return v;
  },
  z.number({ error: "0 ile 100 arasında bir oran girin." }).int("Tam sayı girin.").min(0, "En az 0.").max(100, "En fazla 100.").nullable(),
);

export const emailField = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z.email("Geçerli bir e-posta adresi girin.").max(200),
);

export const loginSchema = z.object({
  email: emailField,
  password: z.string({ error: "Şifrenizi girin." }).min(1, "Şifrenizi girin.").max(200),
});

export const registerSchema = z.object({
  name: reqText(80, "Adınızı ve soyadınızı yazın."),
  email: emailField,
  phone: optText(30),
  password: z.string({ error: "Bir şifre belirleyin." }).min(1, "Bir şifre belirleyin.").max(200),
});

export const portfolioSchema = z.object({
  listingType: z.enum(["rent", "sale"], { error: "Kiralık mı satılık mı seçin." }),
  propertyType: z.enum(PROPERTY_TYPE_VALUES, { error: "Gayrimenkul türünü seçin." }),
  title: reqText(140, "Portföye kısa bir başlık verin."),
  city: reqText(60, "İl yazın."),
  district: reqText(60, "İlçe yazın."),
  neighborhood: optText(80),
  complexName: reqText(120, "Site, bina veya sokak adını yazın."),
  block: optText(30),
  floor: optText(20),
  unitNo: reqText(30, "Daire / kapı numarasını yazın."),
  rooms: optText(20),
  grossM2: optInt(1, 1_000_000),
  netM2: optInt(1, 1_000_000),
  buildingAge: optInt(0, 300),
  furnished: checkbox,
  price: money("Geçerli bir fiyat girin."),
  ownerName: optText(80),
  ownerPhone: optText(30),
  listingUrl: optText(500),
  notes: optText(2000),
  agentId: optUuid,
});
export type PortfolioInput = z.infer<typeof portfolioSchema>;

export const manualAddressSchema = z.object({
  city: optText(60),
  district: reqText(60, "İlçe yazın."),
  neighborhood: optText(80),
  complexName: reqText(120, "Site, bina veya sokak adını yazın."),
  block: optText(30),
  unitNo: reqText(30, "Kontratta yazan daire / kapı numarasını yazın."),
});
export type ManualAddress = z.infer<typeof manualAddressSchema>;

export const dealSchema = z.object({
  type: z.enum(["rent", "sale"], { error: "İşlem türünü seçin." }),
  portfolioId: optUuid,
  contractDate: z
    .string({ error: "Kontrat tarihini seçin." })
    .refine((v) => isValidISODate(v), "Geçerli bir tarih seçin."),
  price: money("Geçerli bir bedel girin."),
  commission: money("Geçerli bir hizmet bedeli girin."),
  closingAgentId: optUuid,
  customerName: optText(120),
  notes: optText(2000),
  listingSharePct: optPct,
});
export type DealInput = z.infer<typeof dealSchema> & { manual?: ManualAddress | null };

export const memberSchema = z.object({
  role: z.enum(["manager", "leader", "agent"], { error: "Rol seçin." }),
  teamId: optUuid,
  agentRatePct: optPct,
});
export type MemberInput = z.infer<typeof memberSchema>;

export const officeSettingsSchema = z.object({
  name: reqText(120, "Ofis adını yazın."),
  agentRatePct: pctField,
  listingSharePct: pctField,
});
export type OfficeSettingsInput = z.infer<typeof officeSettingsSchema>;

export const createOfficeSchema = z.object({
  name: reqText(120, "Ofis adını yazın."),
  domains: reqText(500, "En az bir e-posta uzantısı yazın."),
  managerName: reqText(80, "Üst yöneticinin adını yazın."),
  managerEmail: emailField,
});

export const profileSchema = z.object({
  name: reqText(80, "Adınızı ve soyadınızı yazın."),
  phone: optText(30),
});

export const teamNameSchema = reqText(60, "Ekip adını yazın.");
export const noteSchema = optText(500);
export const uuidSchema = z.uuid("Geçersiz kayıt.");

export type FieldErrors = Record<string, string>;

/** Zod hatalarını alan adı → ilk hata mesajı biçimine çevirir. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
