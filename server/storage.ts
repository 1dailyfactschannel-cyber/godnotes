import {
  type User,
  type InsertUser,
  type Folder,
  type InsertFolder,
  type UpdateFolder,
  type Note,
  type InsertNote,
  type UpdateNote,
  users,
  folders,
  notes,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getFolder(id: string): Promise<Folder | undefined>;
  listFoldersByUser(userId: string): Promise<Folder[]>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(id: string, folder: UpdateFolder): Promise<Folder | undefined>;
  deleteFolder(id: string): Promise<void>;
  getNote(id: string): Promise<Note | undefined>;
  listNotesByUser(userId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, note: UpdateNote): Promise<Note | undefined>;
  deleteNote(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private folders: Map<string, Folder>;
  private notes: Map<string, Note>;

  constructor() {
    this.users = new Map();
    this.folders = new Map();
    this.notes = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      name: insertUser.name ?? null,
    };
    this.users.set(id, user);
    return user;
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    return this.folders.get(id);
  }

  async listFoldersByUser(userId: string): Promise<Folder[]> {
    return Array.from(this.folders.values()).filter(
      (folder) => folder.userId === userId,
    );
  }

  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    const id = randomUUID();
    const now = new Date();
    const folder: Folder = {
      id,
      userId: insertFolder.userId,
      name: insertFolder.name,
      parentId: insertFolder.parentId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.folders.set(id, folder);
    return folder;
  }

  async updateFolder(id: string, folder: UpdateFolder): Promise<Folder | undefined> {
    const existing = this.folders.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: Folder = {
      ...existing,
      ...folder,
      updatedAt: new Date(),
    };
    this.folders.set(id, updated);
    return updated;
  }

  async deleteFolder(id: string): Promise<void> {
    this.folders.delete(id);
  }

  async getNote(id: string): Promise<Note | undefined> {
    return this.notes.get(id);
  }

  async listNotesByUser(userId: string): Promise<Note[]> {
    return Array.from(this.notes.values()).filter(
      (note) => note.userId === userId,
    );
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const id = randomUUID();
    const now = new Date();
    const note: Note = {
      id,
      userId: insertNote.userId,
      title: insertNote.title,
      content: insertNote.content ?? "",
      folderId: insertNote.folderId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.notes.set(id, note);
    return note;
  }

  async updateNote(id: string, note: UpdateNote): Promise<Note | undefined> {
    const existing = this.notes.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: Note = {
      ...existing,
      ...note,
      updatedAt: new Date(),
    };
    this.notes.set(id, updated);
    return updated;
  }

  async deleteNote(id: string): Promise<void> {
    this.notes.delete(id);
  }
}

class PostgresStorage implements IStorage {
  private pool: Pool;
  private db;
  private ready: Promise<void>;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool);
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY,
        username text UNIQUE NOT NULL,
        password text NOT NULL
      );
    `);
    await this.pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        name text NOT NULL,
        parent_id text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        folder_id text,
        title text NOT NULL,
        content text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
  }

  async getUser(id: string): Promise<User | undefined> {
    await this.ready;
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    await this.ready;
    const rows = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return rows[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    await this.ready;
    const id = randomUUID();
    const rows = await this.db.insert(users).values({ id, ...insertUser }).returning();
    return rows[0];
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    await this.ready;
    const rows = await this.db
      .select()
      .from(folders)
      .where(eq(folders.id, id))
      .limit(1);
    return rows[0];
  }

  async listFoldersByUser(userId: string): Promise<Folder[]> {
    await this.ready;
    const rows = await this.db
      .select()
      .from(folders)
      .where(eq(folders.userId, userId));
    return rows;
  }

  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    await this.ready;
    const id = randomUUID();
    const rows = await this.db
      .insert(folders)
      .values({
        id,
        userId: insertFolder.userId,
        name: insertFolder.name,
        parentId: insertFolder.parentId ?? null,
      })
      .returning();
    return rows[0];
  }

  async updateFolder(id: string, folder: UpdateFolder): Promise<Folder | undefined> {
    await this.ready;
    const rows = await this.db
      .update(folders)
      .set({
        ...folder,
        updatedAt: new Date(),
      })
      .where(eq(folders.id, id))
      .returning();
    return rows[0];
  }

  async deleteFolder(id: string): Promise<void> {
    await this.ready;
    await this.db.delete(folders).where(eq(folders.id, id));
  }

  async getNote(id: string): Promise<Note | undefined> {
    await this.ready;
    const rows = await this.db
      .select()
      .from(notes)
      .where(eq(notes.id, id))
      .limit(1);
    return rows[0];
  }

  async listNotesByUser(userId: string): Promise<Note[]> {
    await this.ready;
    const rows = await this.db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId));
    return rows;
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    await this.ready;
    const id = randomUUID();
    const rows = await this.db
      .insert(notes)
      .values({
        id,
        userId: insertNote.userId,
        title: insertNote.title,
        content: insertNote.content ?? "",
        folderId: insertNote.folderId ?? null,
      })
      .returning();
    return rows[0];
  }

  async updateNote(id: string, note: UpdateNote): Promise<Note | undefined> {
    await this.ready;
    const rows = await this.db
      .update(notes)
      .set({
        ...note,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();
    return rows[0];
  }

  async deleteNote(id: string): Promise<void> {
    await this.ready;
    await this.db.delete(notes).where(eq(notes.id, id));
  }
}

export const storage = process.env.DATABASE_URL
  ? new PostgresStorage(process.env.DATABASE_URL)
  : new MemStorage();
