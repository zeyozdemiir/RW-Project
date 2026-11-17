import {
  bigint,
  bigserial,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Çok ofisli (multi-tenant) yapı:
 * Her iş kaydı bir `office_id` taşır. Ofisler arası referanslar veritabanı
 * seviyesinde bileşik yabancı anahtarlarla (office_id, id) engellenir; yani bir
 * ofisin kontratı başka bir ofisin portföyüne veya danışmanına bağlanamaz.
 */

export const userRole = pgEnum("user_role", ["platform_admin", "manager", "leader", "agent"]);
export const userStatus = pgEnum("user_status", ["pending", "active", "disabled", "rejected"]);
export const listingType = pgEnum("listing_type", ["rent", "sale"]);
export const portfolioStatus = pgEnum("portfolio_status", [
  "available",
  "deposit",
  "rented",
  "sold",
  "inactive",
]);
export const dealType = pgEnum("deal_type", ["rent", "sale"]);
export const dealStatus = pgEnum("deal_status", ["active", "cancelled"]);
export const alertType = pgEnum("alert_type", ["unregistered_portfolio"]);
export const alertStatus = pgEnum("alert_status", ["open", "resolved"]);
export const alertResolution = pgEnum("alert_resolution", ["linked", "created", "dismissed"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const offices = pgTable("offices", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  /** Danışmanın kendi cirosundan aldığı varsayılan pay (%). */
  agentRatePct: integer("agent_rate_pct").notNull().default(50),
  /** Çapraz işlemde portföy sahibi danışmana düşen ciro payı (%). */
  listingSharePct: integer("listing_share_pct").notNull().default(50),
  portfolioSeq: integer("portfolio_seq").notNull().default(0),
  dealSeq: integer("deal_seq").notNull().default(0),
  createdAt: createdAt(),
});

/** Bir e-posta uzantısı (ör. rwpozitif.com) yalnızca tek bir ofise ait olabilir. */
export const officeDomains = pgTable(
  "office_domains",
  {
    domain: text("domain").primaryKey(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("office_domains_office_idx").on(t.officeId)],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("teams_office_id_id_uq").on(t.officeId, t.id),
    unique("teams_office_name_uq").on(t.officeId, t.name),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Platform yöneticilerinde boştur. */
    officeId: uuid("office_id").references(() => offices.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("agent"),
    status: userStatus("status").notNull().default("pending"),
    teamId: uuid("team_id"),
    /** Boşsa ofisin varsayılan danışman payı geçerlidir. */
    agentRatePct: integer("agent_rate_pct"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    approvedById: uuid("approved_by_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("users_office_id_id_uq").on(t.officeId, t.id),
    foreignKey({
      name: "users_team_fk",
      columns: [t.officeId, t.teamId],
      foreignColumns: [teams.officeId, teams.id],
    }),
    index("users_office_status_idx").on(t.officeId, t.status),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** Çerezdeki gizli anahtarın SHA-256 özeti; anahtarın kendisi saklanmaz. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    email: text("email").notNull(),
    ip: text("ip"),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_email_idx").on(t.email, t.createdAt)],
);

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id, { onDelete: "cascade" }),
    /** Ofis içinde sıralı, okunabilir portföy numarası. */
    refNo: integer("ref_no").notNull(),
    /** Portföyün sahibi danışman. */
    agentId: uuid("agent_id").notNull(),
    listingType: listingType("listing_type").notNull(),
    status: portfolioStatus("status").notNull().default("available"),
    propertyType: text("property_type").notNull().default("daire"),
    title: text("title").notNull(),
    city: text("city").notNull(),
    district: text("district").notNull(),
    neighborhood: text("neighborhood"),
    /** Site / bina / sokak adı. */
    complexName: text("complex_name").notNull(),
    block: text("block"),
    floor: text("floor"),
    /** Daire / kapı numarası. */
    unitNo: text("unit_no").notNull(),
    rooms: text("rooms"),
    grossM2: integer("gross_m2"),
    netM2: integer("net_m2"),
    buildingAge: integer("building_age"),
    furnished: boolean("furnished").notNull().default(false),
    /** Kuruş cinsinden: kiralıkta aylık kira, satılıkta satış bedeli. */
    price: bigint("price", { mode: "number" }).notNull(),
    ownerName: text("owner_name"),
    ownerPhone: text("owner_phone"),
    listingUrl: text("listing_url"),
    notes: text("notes"),
    /** Kontrat eşleştirmesi için normalize edilmiş daire anahtarı. */
    matchKey: text("match_key").notNull(),
    /** Türkçe karakterlerden arındırılmış arama metni. */
    searchText: text("search_text").notNull().default(""),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    statusChangedById: uuid("status_changed_by_id"),
    statusNote: text("status_note"),
    createdById: uuid("created_by_id").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("portfolios_office_id_id_uq").on(t.officeId, t.id),
    unique("portfolios_office_ref_uq").on(t.officeId, t.refNo),
    foreignKey({
      name: "portfolios_agent_fk",
      columns: [t.officeId, t.agentId],
      foreignColumns: [users.officeId, users.id],
    }),
    index("portfolios_office_type_status_idx").on(t.officeId, t.listingType, t.status),
    index("portfolios_office_match_idx").on(t.officeId, t.matchKey),
    index("portfolios_office_agent_idx").on(t.officeId, t.agentId),
  ],
);

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id, { onDelete: "cascade" }),
    refNo: integer("ref_no").notNull(),
    type: dealType("type").notNull(),
    status: dealStatus("status").notNull().default("active"),
    /** Kontrat sistemdeki bir portföye bağlı değilse boştur (kayıtsız portföy). */
    portfolioId: uuid("portfolio_id"),
    city: text("city"),
    district: text("district").notNull(),
    neighborhood: text("neighborhood"),
    complexName: text("complex_name").notNull(),
    block: text("block"),
    unitNo: text("unit_no").notNull(),
    matchKey: text("match_key").notNull(),
    contractDate: date("contract_date", { mode: "string" }).notNull(),
    /** Kuruş: kira bedeli (aylık) veya satış bedeli. */
    price: bigint("price", { mode: "number" }).notNull(),
    /** Kuruş: ofisin bu işlemden aldığı toplam hizmet bedeli (ciro). */
    commission: bigint("commission", { mode: "number" }).notNull(),
    /** İşlemi yapan (müşteriyi getiren) danışman. */
    closingAgentId: uuid("closing_agent_id").notNull(),
    closingTeamId: uuid("closing_team_id"),
    /** Portföyün sahibi danışman (kontrat anındaki). */
    listingAgentId: uuid("listing_agent_id"),
    listingTeamId: uuid("listing_team_id"),
    listingSharePct: integer("listing_share_pct").notNull().default(0),
    closingAgentRevenue: bigint("closing_agent_revenue", { mode: "number" }).notNull(),
    listingAgentRevenue: bigint("listing_agent_revenue", { mode: "number" }).notNull().default(0),
    closingAgentRatePct: integer("closing_agent_rate_pct").notNull(),
    listingAgentRatePct: integer("listing_agent_rate_pct").notNull().default(0),
    closingAgentEarning: bigint("closing_agent_earning", { mode: "number" }).notNull(),
    listingAgentEarning: bigint("listing_agent_earning", { mode: "number" }).notNull().default(0),
    officeEarning: bigint("office_earning", { mode: "number" }).notNull(),
    customerName: text("customer_name"),
    notes: text("notes"),
    /** Kontrat girildiği anda sistemde eşleşen portföy yoktu. */
    wasUnregistered: boolean("was_unregistered").notNull().default(false),
    createdById: uuid("created_by_id").notNull(),
    createdAt: createdAt(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledById: uuid("cancelled_by_id"),
    cancelReason: text("cancel_reason"),
  },
  (t) => [
    unique("deals_office_id_id_uq").on(t.officeId, t.id),
    unique("deals_office_ref_uq").on(t.officeId, t.refNo),
    foreignKey({
      name: "deals_portfolio_fk",
      columns: [t.officeId, t.portfolioId],
      foreignColumns: [portfolios.officeId, portfolios.id],
    }),
    foreignKey({
      name: "deals_closing_agent_fk",
      columns: [t.officeId, t.closingAgentId],
      foreignColumns: [users.officeId, users.id],
    }),
    foreignKey({
      name: "deals_listing_agent_fk",
      columns: [t.officeId, t.listingAgentId],
      foreignColumns: [users.officeId, users.id],
    }),
    index("deals_office_date_idx").on(t.officeId, t.contractDate),
    index("deals_office_portfolio_idx").on(t.officeId, t.portfolioId),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id, { onDelete: "cascade" }),
    type: alertType("type").notNull(),
    dealId: uuid("deal_id").notNull(),
    status: alertStatus("status").notNull().default("open"),
    resolution: alertResolution("resolution"),
    resolutionNote: text("resolution_note"),
    resolvedById: uuid("resolved_by_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "alerts_deal_fk",
      columns: [t.officeId, t.dealId],
      foreignColumns: [deals.officeId, deals.id],
    }),
    index("alerts_office_status_idx").on(t.officeId, t.status),
  ],
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id"),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    summary: text("summary").notNull(),
    meta: jsonb("meta"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_entity_idx").on(t.officeId, t.entityType, t.entityId, t.createdAt)],
);

export type Office = typeof offices.$inferSelect;
export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Portfolio = typeof portfolios.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type ActivityEntry = typeof activityLog.$inferSelect;

export type UserRole = (typeof userRole.enumValues)[number];
export type UserStatus = (typeof userStatus.enumValues)[number];
export type ListingType = (typeof listingType.enumValues)[number];
export type PortfolioStatus = (typeof portfolioStatus.enumValues)[number];
export type DealType = (typeof dealType.enumValues)[number];
export type DealStatus = (typeof dealStatus.enumValues)[number];
