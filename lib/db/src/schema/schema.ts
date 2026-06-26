import { sql } from "drizzle-orm";
import { boolean, date, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
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
  googleId: true,
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

export const jobApplications = pgTable("job_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  company: text("company").notNull(),
  jobTitle: text("job_title").notNull(),
  jobUrl: text("job_url"),
  status: text("status").notNull().default("saved"),
  // status values: 'saved' | 'applied' | 'phone_screen' | 'interview' | 'offer' | 'rejected' | 'withdrawn'
  notes: text("notes"),
  appliedAt: timestamp("applied_at"),
  salary: integer("salary"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  followUpDate: date("follow_up_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertJobApplicationSchema = createInsertSchema(jobApplications).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateJobApplicationSchema = insertJobApplicationSchema.partial();

export type JobApplication = typeof jobApplications.$inferSelect;
export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  event: text("event").notNull(),
  meta: jsonb("meta"),
  ip: text("ip"),
  statusCode: integer("status_code"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;

export const atsScoreHistory = pgTable("ats_score_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  label: text("label").notNull(),
  jobSnippet: text("job_snippet"),
  foundKeywords: jsonb("found_keywords").$type<string[]>().notNull(),
  missingKeywords: jsonb("missing_keywords").$type<string[]>().notNull(),
  suggestions: jsonb("suggestions").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AtsScoreHistoryEntry = typeof atsScoreHistory.$inferSelect;

// Managed by connect-pg-simple — included here so drizzle-kit push never drops it
export const userSessions = pgTable("user_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

// Every AI-tailored resume is saved here for logged-in users. Separate from the
// builder `resumes` table (which is structured + plan-limited) — this is a
// history of AI text outputs, kept for all users so they can revisit, diff,
// re-download, and spin a cover letter off any past run.
export const tailoredResumes = pgTable("tailored_resumes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  company: text("company"),
  jobTitle: text("job_title"),
  originalText: text("original_text").notNull(),
  tailoredText: text("tailored_text").notNull(),
  jobDescription: text("job_description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const saveTailoredResumeSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().max(200).optional().nullable(),
  jobTitle: z.string().max(200).optional().nullable(),
  originalText: z.string().min(1),
  tailoredText: z.string().min(1),
  jobDescription: z.string().min(1),
});

export type TailoredResume = typeof tailoredResumes.$inferSelect;
export type SaveTailoredResume = z.infer<typeof saveTailoredResumeSchema>;
