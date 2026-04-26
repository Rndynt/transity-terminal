import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { outlets } from "./network";

export const roles = pgTable("roles", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description"),
});

export const insertRoleSchema = createInsertSchema(roles);
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export const featureFlags = pgTable("feature_flags", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description"),
  category:    text("category").notNull(),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags);
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

export const roleFlags = pgTable("role_flags", {
  roleId:  text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  flagId:  text("flag_id").notNull().references(() => featureFlags.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.flagId] })
}));

export type RoleFlag = typeof roleFlags.$inferSelect;

export const staffMembers = pgTable("staff_members", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:    text("user_id").notNull().unique(),
  roleId:    text("role_id").notNull().references(() => roles.id),
  outletId:  uuid("outlet_id").references(() => outlets.id),
  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  // PR α-1: FK index untuk RBAC list-staff-by-role / list-staff-by-outlet.
  // Migration 0015 mendaftarkan index yang sama dengan `IF NOT EXISTS`.
  idxStaffMembersRoleId: sql`CREATE INDEX IF NOT EXISTS idx_staff_members_role_id ON ${table} (role_id)`,
  idxStaffMembersOutletId: sql`CREATE INDEX IF NOT EXISTS idx_staff_members_outlet_id ON ${table} (outlet_id) WHERE outlet_id IS NOT NULL`,
}));

export const insertStaffMemberSchema = createInsertSchema(staffMembers).omit({ id: true, createdAt: true, updatedAt: true });
export type StaffMember = typeof staffMembers.$inferSelect;
export type InsertStaffMember = z.infer<typeof insertStaffMemberSchema>;

export const rolesRelations = relations(roles, ({ many }) => ({
  roleFlags: many(roleFlags),
  staffMembers: many(staffMembers),
}));

export const featureFlagsRelations = relations(featureFlags, ({ many }) => ({
  roleFlags: many(roleFlags),
}));

export const roleFlagsRelations = relations(roleFlags, ({ one }) => ({
  role: one(roles, { fields: [roleFlags.roleId], references: [roles.id] }),
  flag: one(featureFlags, { fields: [roleFlags.flagId], references: [featureFlags.id] }),
}));

export const staffMembersRelations = relations(staffMembers, ({ one }) => ({
  role: one(roles, { fields: [staffMembers.roleId], references: [roles.id] }),
  outlet: one(outlets, { fields: [staffMembers.outletId], references: [outlets.id] }),
}));
