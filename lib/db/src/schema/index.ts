import {
  date,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    accountKey: text("account_key").notNull(),
    recoveryPinHash: text("recovery_pin_hash").notNull(),
    name: text("name").notNull(),
    birthday: date("birthday"),
    pronouns: text("pronouns"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_account_key_idx").on(table.accountKey)],
);

export const couplesTable = pgTable(
  "couples",
  {
    id: text("id").primaryKey(),
    inviteCode: text("invite_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startDate: date("start_date").notNull(),
    currentStreak: integer("current_streak").default(0).notNull(),
    longestStreak: integer("longest_streak").default(0).notNull(),
    memberCount: integer("member_count").default(1).notNull(),
  },
  (table) => [uniqueIndex("couples_invite_code_idx").on(table.inviteCode)],
);

export const coupleMembersTable = pgTable(
  "couple_members",
  {
    coupleId: text("couple_id")
      .notNull()
      .references(() => couplesTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.coupleId, table.userId] }),
    uniqueIndex("couple_members_user_idx").on(table.userId),
  ],
);

export const deviceSessionsTable = pgTable(
  "device_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [],
);

export const coupleEntriesTable = pgTable(
  "couple_entries",
  {
    coupleId: text("couple_id")
      .notNull()
      .references(() => couplesTable.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    userId: text("user_id").notNull(),
    grateful: text("grateful").notNull().default(""),
    cute: text("cute").notNull().default(""),
    grow: text("grow").notNull().default(""),
    submitted: boolean("submitted").notNull().default(false),
    reaction: text("reaction"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.coupleId, table.date, table.userId] }),
    index("couple_entries_date_idx").on(table.coupleId, table.date),
  ],
);

export type Couple = typeof couplesTable.$inferSelect;
export type CoupleMember = typeof coupleMembersTable.$inferSelect;
export type CoupleEntry = typeof coupleEntriesTable.$inferSelect;
export type DeviceSession = typeof deviceSessionsTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;