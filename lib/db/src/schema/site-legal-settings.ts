import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const siteLegalSettings = pgTable("site_legal_settings", {
  id: text("id").primaryKey(),
  termsContent: text("terms_content").notNull(),
  privacyContent: text("privacy_content").notNull(),
  legalName: text("legal_name").notNull().default(""),
  businessAddress: text("business_address").notNull().default(""),
  supportEmail: text("support_email").notNull().default(""),
  privacyEmail: text("privacy_email").notNull().default(""),
  supportPhone: text("support_phone").notNull().default(""),
  termsUpdatedAt: timestamp("terms_updated_at", { withTimezone: true }).notNull().defaultNow(),
  privacyUpdatedAt: timestamp("privacy_updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSiteLegalSettingsSchema = createInsertSchema(siteLegalSettings).omit({
  termsUpdatedAt: true,
  privacyUpdatedAt: true,
  updatedAt: true,
});
export type InsertSiteLegalSettings = z.infer<typeof insertSiteLegalSettingsSchema>;
export type SiteLegalSettings = typeof siteLegalSettings.$inferSelect;