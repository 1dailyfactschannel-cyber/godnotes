import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
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
});

export const insertNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(""),
  folderId: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateNoteSchema = insertNoteSchema.partial();

export type Note = typeof notes.$inferSelect;
export type InsertNote = {
  userId: string;
  title: string;
  content?: string;
  folderId?: string | null;
  isFavorite?: boolean;
  tags?: string[];
};
export type UpdateNote = z.infer<typeof updateNoteSchema>;
