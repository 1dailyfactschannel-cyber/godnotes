import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  password: text("password").notNull(),
  name: text("name"),
  avatar_url: text("avatar_url"),
  is_verified: boolean("is_verified").default(false),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).partial().required({
  email: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const folders = pgTable("folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  parentId: varchar("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`).notNull(),
});

export const insertFolderSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateFolderSchema = insertFolderSchema.partial();

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = {
  userId: string;
  name: string;
  parentId?: string | null;
  isFavorite?: boolean;
  tags?: string[];
};
export type UpdateFolder = z.infer<typeof updateFolderSchema>;

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  folderId: varchar("folder_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`).notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
});

export const insertNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(""),
  folderId: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateNoteSchema = insertNoteSchema.partial().extend({
  isPublic: z.boolean().optional()
});

export type Note = typeof notes.$inferSelect & {
  isPublic?: boolean;
};
export type InsertNote = {
  userId: string;
  title: string;
  content?: string;
  folderId?: string | null;
  isFavorite?: boolean;
  tags?: string[];
};
export type UpdateNote = z.infer<typeof updateNoteSchema>;

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  callLink: text("call_link"),
  isCompleted: boolean("is_completed").default(false).notNull(),
  status: text("status"),
  parentId: varchar("parent_id"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  notify: boolean("notify").default(false).notNull(),
  isNotified: boolean("is_notified").default(false).notNull(),
  priority: text("priority").default("medium").notNull(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`).notNull(),
  recurring: text("recurring"),
});

export const insertTaskSchema = z.object({
  content: z.string().min(1),
  description: z.string().optional(),
  callLink: z.string().optional(),
  status: z.string().optional(),
  parentId: z.string().nullable().optional(),
  dueDate: z.number().optional(),
  notify: z.boolean().optional(),
  isNotified: z.boolean().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  tags: z.array(z.string()).optional(),
  recurring: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
});

export const updateTaskSchema = insertTaskSchema.partial().extend({
  isCompleted: z.boolean().optional(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = {
  userId: string;
  content: string;
  description?: string;
  callLink?: string;
  status?: string;
  parentId?: string | null;
  dueDate?: Date | null;
  notify?: boolean;
  isNotified?: boolean;
  priority?: "high" | "medium" | "low";
  tags?: string[];
  recurring?: "daily" | "weekly" | "monthly" | "yearly";
};
export type UpdateTask = z.infer<typeof updateTaskSchema>;
