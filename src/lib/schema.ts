import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

// IMPORTANT! ID fields should ALWAYS use UUID types, EXCEPT the BetterAuth tables.

// ---------------------------------------------------------------------------
// BetterAuth tables (keep structure intact; extra columns on `user` are fine)
// ---------------------------------------------------------------------------

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),

    // MedBuddy-specific columns (BetterAuth ignores these)
    locale: text("locale").default("zh-TW"),
    phone: text("phone"),
    telegramChatId: text("telegram_chat_id"),
    // TODO: Consider migrating role to pgEnum for type safety
    role: text("role").default("patient"), // 'patient' | 'caretaker'
    onboardingComplete: boolean("onboarding_complete").default(false),
  },
  (table) => [index("user_email_idx").on(table.email)]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_token_idx").on(table.token),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    index("account_provider_account_idx").on(table.providerId, table.accountId),
  ]
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// ---------------------------------------------------------------------------
// MedBuddy domain tables
// ---------------------------------------------------------------------------

export const caretakerLink = pgTable(
  "caretaker_link",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    caretakerId: text("caretaker_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    patientId: text("patient_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    inviteCode: text("invite_code").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("caretaker_link_caretaker_id_idx").on(table.caretakerId),
    index("caretaker_link_patient_id_idx").on(table.patientId),
    index("caretaker_link_invite_code_idx").on(table.inviteCode),
  ]
);

export const medication = pgTable(
  "medication",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameLocal: text("name_local"), // Chinese name
    dosage: text("dosage"),
    purpose: text("purpose"), // AI-generated explanation
    timing: text("timing").array(), // e.g. ['morning', 'evening']
    active: boolean("active").default(true),
    scanData: jsonb("scan_data"), // raw scan results
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("medication_user_id_idx").on(table.userId),
    index("medication_active_idx").on(table.active),
  ]
);

export const interaction = pgTable(
  "interaction",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    medAId: text("med_a_id")
      .notNull()
      .references(() => medication.id, { onDelete: "cascade" }),
    medBId: text("med_b_id")
      .notNull()
      .references(() => medication.id, { onDelete: "cascade" }),
    // TODO: Consider migrating type/severity to pgEnum for type safety
    type: text("type").notNull(), // 'interaction' | 'duplication'
    severity: text("severity").notNull(), // 'low' | 'medium' | 'high'
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("interaction_user_id_idx").on(table.userId)]
);

export const reminder = pgTable(
  "reminder",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // TODO: Consider migrating timeSlot to pgEnum for type safety
    timeSlot: text("time_slot").notNull(), // 'morning' | 'afternoon' | 'evening' | 'bedtime'
    scheduledTime: text("scheduled_time").notNull(), // HH:MM format
    active: boolean("active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("reminder_user_id_idx").on(table.userId)]
);

export const adherenceLog = pgTable(
  "adherence_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    medicationId: text("medication_id")
      .notNull()
      .references(() => medication.id, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }), // nullable - set when taken
    // TODO: Consider migrating status/source to pgEnum for type safety
    status: text("status").notNull().default("pending"), // 'pending' | 'taken' | 'missed' | 'skipped'
    source: text("source").default("web"), // 'web' | 'telegram'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("adherence_log_user_id_idx").on(table.userId),
    index("adherence_log_medication_id_idx").on(table.medicationId),
    index("adherence_log_scheduled_at_idx").on(table.scheduledAt),
  ]
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // TODO: Consider migrating role/source to pgEnum for type safety
    role: text("role").notNull(), // 'user' | 'assistant' | 'system'
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    source: text("source").default("web"), // 'web' | 'telegram' | 'voice'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("chat_message_user_id_idx").on(table.userId),
    index("chat_message_created_at_idx").on(table.createdAt),
  ]
);
