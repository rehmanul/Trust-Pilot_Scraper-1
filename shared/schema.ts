import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scrapingUrls = pgTable("scraping_urls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, complete, error
  createdAt: timestamp("created_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type"),
  domain: text("domain"),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  rating: real("rating"),
  reviewCount: integer("review_count"),
  trustpilotUrl: text("trustpilot_url"),
  description: text("description"),
  address: text("address"),
  website: text("website"),
  status: text("status").notNull().default("pending"), // pending, processing, complete, error
  scrapingUrlId: varchar("scraping_url_id").references(() => scrapingUrls.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scrapingJobs = pgTable("scraping_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull().default("pending"), // pending, running, paused, completed, error
  totalUrls: integer("total_urls").notNull().default(0),
  processedUrls: integer("processed_urls").notNull().default(0),
  totalCompanies: integer("total_companies").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  settings: jsonb("settings"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const logs = pgTable("logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: text("level").notNull(), // info, success, warning, error
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  jobId: varchar("job_id").references(() => scrapingJobs.id),
});

export const insertScrapingUrlSchema = createInsertSchema(scrapingUrls).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertScrapingJobSchema = createInsertSchema(scrapingJobs).omit({
  id: true,
  createdAt: true,
});

export const insertLogSchema = createInsertSchema(logs).omit({
  id: true,
  timestamp: true,
});

export type InsertScrapingUrl = z.infer<typeof insertScrapingUrlSchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertScrapingJob = z.infer<typeof insertScrapingJobSchema>;
export type InsertLog = z.infer<typeof insertLogSchema>;

export type ScrapingUrl = typeof scrapingUrls.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type Log = typeof logs.$inferSelect;
