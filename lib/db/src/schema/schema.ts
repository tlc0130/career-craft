import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  phone: text("phone"),
  plan: text("plan").notNull().default("starter"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  lifetimeAccess: boolean("lifetime_access").notNull().default(false),
  // Monthly AI-generation usage for metering the free (starter) tier.
  // Reset lazily whenever the current window (aiCreditsResetAt) has elapsed.
  aiCreditsUsed: integer("ai_credits_used").notNull().default(0),
  aiCreditsResetAt: timestamp("ai_credits_reset_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  passwordHash: true,
});

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const resumes = pgTable("resumes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  jobTitle: text("job_title"),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertResumeSchema = createInsertSchema(resumes).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const saveResumeSchema = z.object({
  title: z.string().min(1),
  jobTitle: z.string().optional(),
  content: z.record(z.string(), z.unknown()),
});

export type InsertResume = z.infer<typeof insertResumeSchema>;
export type Resume = typeof resumes.$inferSelect;
