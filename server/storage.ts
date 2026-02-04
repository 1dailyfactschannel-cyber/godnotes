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
  type Task,
  type InsertTask,
  type UpdateTask,
  tasks,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, gt } from "drizzle-orm";
import fs from 'fs';
import path from 'path';

function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const withoutDoubleQuotes = trimmed.replace(/^"(.*)"$/, "$1");
  const withoutQuotes = withoutDoubleQuotes.replace(/^'(.*)'$/, "$1");
  return withoutQuotes.trim();
}

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getFolder(id: string): Promise<Folder | undefined>;
  listFoldersByUser(userId: string): Promise<Folder[]>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(id: string, folder: UpdateFolder): Promise<Folder | undefined>;
  deleteFolder(id: string): Promise<void>;
  getNote(id: string): Promise<Note | undefined>;
  listNotesByUser(userId: string, updatedAfter?: Date): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, note: UpdateNote & { isPublic?: boolean }): Promise<Note | undefined>;
  deleteNote(id: string): Promise<void>;
  importUser(user: User): Promise<User>;
  listUsers(): Promise<User[]>;
  // Add password update capability
  updateUserPassword(userId: string, hashedPassword: string): Promise<User | undefined>;
  // Additional folder/note utilities
  getTrash(userId: string): Promise<{ folders: Folder[], notes: Note[] }>;
  getFavorites(userId: string): Promise<{ folders: Folder[], notes: Note[] }>;
  restoreFolder(id: string): Promise<void>;
  restoreNote(id: string): Promise<void>;
  permanentDeleteFolder(id: string): Promise<void>;
  permanentDeleteNote(id: string): Promise<void>;
  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  listTasksByUser(userId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: UpdateTask): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
}

export class PostgresStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private pool: Pool;
  private ready: Promise<void>;

  constructor(connectionString: string) {
    const normalized = normalizeDatabaseUrl(connectionString) ?? connectionString;
    this.pool = new Pool({
      connectionString: normalized,
      ssl: process.env.VERCEL ? { rejectUnauthorized: false } : undefined,
    });
    this.db = drizzle(this.pool);
    this.ready = this.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
      console.log('PostgreSQL connected successfully');
    } catch (error) {
      console.error('Failed to connect to PostgreSQL', error);
      throw error;
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    await this.ready;
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    await this.ready;
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
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
    const rows = await this.db
      .insert(users)
      .values({
        id,
        email: insertUser.email,
        username: insertUser.username ?? null,
        password: insertUser.password,
        name: insertUser.name ?? null,
        avatar_url: null,
        is_verified: false,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();
    return rows[0];
  }

  async importUser(user: User): Promise<User> {
    await this.ready;
    const rows = await this.db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({ target: users.id, set: user })
      .returning();
    return rows[0];
  }

  async listUsers(): Promise<User[]> {
    await this.ready;
    return this.db.select().from(users);
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<User | undefined> {
    await this.ready;
    const rows = await this.db
      .update(users)
      .set({ password: hashedPassword, updated_at: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return rows[0];
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    await this.ready;
    const rows = await this.db.select().from(folders).where(eq(folders.id, id)).limit(1);
    return rows[0];
  }

  async listFoldersByUser(userId: string): Promise<Folder[]> {
    await this.ready;
    return this.db.select().from(folders).where(and(eq(folders.userId, userId), eq(folders.isDeleted, false)));
  }

  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    await this.ready;
    const id = randomUUID();
    const now = new Date();
    const rows = await this.db
      .insert(folders)
      .values({
        id,
        userId: insertFolder.userId,
        name: insertFolder.name,
        parentId: insertFolder.parentId ?? null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        isFavorite: insertFolder.isFavorite ?? false,
        tags: [],
      })
      .returning();
    return rows[0];
  }

  async updateFolder(id: string, folder: UpdateFolder): Promise<Folder | undefined> {
    await this.ready;
    const rows = await this.db
      .update(folders)
      .set({
        name: folder.name,
        parentId: folder.parentId ?? null,
        updatedAt: new Date(),
        isDeleted: folder.isDeleted,
        isFavorite: folder.isFavorite,
        tags: folder.tags,
      })
      .where(eq(folders.id, id))
      .returning();
    return rows[0];
  }

  async deleteFolder(id: string): Promise<void> {
    await this.ready;
    await this.db.update(folders).set({ isDeleted: true, updatedAt: new Date() }).where(eq(folders.id, id));
    // Cascade delete children (set isDeleted to true)
    await this.db.update(folders).set({ isDeleted: true, updatedAt: new Date() }).where(eq(folders.parentId, id));
    await this.db.update(notes).set({ isDeleted: true, updatedAt: new Date() }).where(eq(notes.folderId, id));
  }

  async getNote(id: string): Promise<Note | undefined> {
    await this.ready;
    const rows = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);
    return rows[0];
  }

  async listNotesByUser(userId: string, updatedAfter?: Date): Promise<Note[]> {
    await this.ready;
    if (updatedAfter) {
        return this.db.select().from(notes).where(
            and(
                eq(notes.userId, userId),
                gt(notes.updatedAt, updatedAfter)
            )
        );
    }
    return this.db.select().from(notes).where(and(eq(notes.userId, userId), eq(notes.isDeleted, false)));
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    await this.ready;
    const id = randomUUID();
    const now = new Date();
    const rows = await this.db
      .insert(notes)
      .values({
        id,
        userId: insertNote.userId,
        title: insertNote.title,
        content: insertNote.content ?? "",
        folderId: insertNote.folderId ?? null,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        tags: [],
        isFavorite: false,
        isPublic: false,
      })
      .returning();
    return rows[0];
  }

  async updateNote(id: string, note: UpdateNote & { isPublic?: boolean }): Promise<Note | undefined> {
    await this.ready;
    const rows = await this.db
      .update(notes)
      .set({
        title: note.title,
        content: note.content ?? "",
        folderId: note.folderId ?? null,
        updatedAt: new Date(),
        isDeleted: note.isDeleted,
        isFavorite: note.isFavorite,
        isPublic: note.isPublic,
        tags: note.tags,
      })
      .where(eq(notes.id, id))
      .returning();
    return rows[0];
  }

  async deleteNote(id: string): Promise<void> {
    await this.ready;
    await this.db.update(notes).set({ isDeleted: true, updatedAt: new Date() }).where(eq(notes.id, id));
  }

  async getTrash(userId: string): Promise<{ folders: Folder[], notes: Note[] }> {
    await this.ready;
    const deletedFolders = await this.db.select().from(folders).where(and(eq(folders.userId, userId), eq(folders.isDeleted, true)));
    const deletedNotes = await this.db.select().from(notes).where(and(eq(notes.userId, userId), eq(notes.isDeleted, true)));
    return { folders: deletedFolders, notes: deletedNotes };
  }

  async getFavorites(userId: string): Promise<{ folders: Folder[], notes: Note[] }> {
    await this.ready;
    const favoriteFolders = await this.db.select().from(folders).where(and(eq(folders.userId, userId), eq(folders.isDeleted, false), eq(folders.isFavorite, true)));
    const favoriteNotes = await this.db.select().from(notes).where(and(eq(notes.userId, userId), eq(notes.isDeleted, false), eq(notes.isFavorite, true)));
    return { folders: favoriteFolders, notes: favoriteNotes };
  }

  async restoreFolder(id: string): Promise<void> {
    await this.ready;
    await this.db.update(folders).set({ isDeleted: false, updatedAt: new Date() }).where(eq(folders.id, id));
    // Restore children
    await this.db.update(folders).set({ isDeleted: false, updatedAt: new Date() }).where(eq(folders.parentId, id));
    await this.db.update(notes).set({ isDeleted: false, updatedAt: new Date() }).where(eq(notes.folderId, id));
  }

  async restoreNote(id: string): Promise<void> {
    await this.ready;
    await this.db.update(notes).set({ isDeleted: false, updatedAt: new Date() }).where(eq(notes.id, id));
  }

  async permanentDeleteFolder(id: string): Promise<void> {
    await this.ready;
    await this.db.delete(folders).where(eq(folders.id, id));
    await this.db.delete(folders).where(eq(folders.parentId, id)); // Delete child folders
    await this.db.delete(notes).where(eq(notes.folderId, id)); // Delete child notes
  }

  async permanentDeleteNote(id: string): Promise<void> {
    await this.ready;
    await this.db.delete(notes).where(eq(notes.id, id));
  }

  // Tasks CRUD (in-memory)
  async getTask(id: string): Promise<Task | undefined> {
    await this.ready;
    const rows = await this.db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return rows[0];
  }
 
  async listTasksByUser(userId: string): Promise<Task[]> {
    await this.ready;
    const rows = await this.db.select().from(tasks).where(eq(tasks.userId, userId));
    return rows;
  }
 
  async createTask(insertTask: InsertTask): Promise<Task> {
    await this.ready;
    const id = randomUUID();
    // Validate and clean up data before insertion
    const priority = ['low', 'medium', 'high'].includes(insertTask.priority || '') 
      ? insertTask.priority 
      : 'medium';

    const rows = await this.db
      .insert(tasks)
      .values({
        id,
        userId: insertTask.userId,
        content: insertTask.content,
        description: insertTask.description ?? null,
        callLink: insertTask.callLink ?? null,
        isCompleted: false,
        status: insertTask.status ?? null,
        parentId: insertTask.parentId ?? null,
        dueDate: insertTask.dueDate ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        notify: insertTask.notify ?? false,
        isNotified: insertTask.isNotified ?? false,
        priority: priority,
        tags: insertTask.tags ?? [],
        recurring: insertTask.recurring ?? null,
      })
      .returning();
    return rows[0];
  }
 
  async updateTask(id: string, task: UpdateTask): Promise<Task | undefined> {
    await this.ready;
    const rows = await this.db
      .update(tasks)
      .set({
        content: task.content,
        description: task.description ?? null,
        callLink: task.callLink ?? null,
        isCompleted: task.isCompleted,
        status: task.status ?? null,
        parentId: task.parentId ?? null,
        dueDate: task.dueDate ?? null,
        notify: task.notify,
        isNotified: task.isNotified,
        priority: task.priority,
        tags: task.tags,
        recurring: task.recurring ?? null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();
    return rows[0];
  }
 
  async deleteTask(id: string): Promise<void> {
    await this.ready;
    await this.db.delete(tasks).where(eq(tasks.id, id));
  }
}

export class MemStorage implements IStorage {
  protected users: Map<string, User>;
  protected folders: Map<string, Folder>;
  protected notes: Map<string, Note>;
  protected tasksMap: Map<string, Task>;

  constructor() {
    this.users = new Map();
    this.folders = new Map();
    this.notes = new Map();
    this.tasksMap = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      email: insertUser.email,
      username: insertUser.username ?? null,
      password: insertUser.password,
      name: insertUser.name ?? null,
      avatar_url: null,
      is_verified: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async importUser(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated: User = { ...user, password: hashedPassword, updated_at: new Date() };
    this.users.set(userId, updated);
    return updated;
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    return this.folders.get(id);
  }

  async listFoldersByUser(userId: string): Promise<Folder[]> {
    return Array.from(this.folders.values()).filter(
      (folder) => folder.userId === userId && !folder.isDeleted,
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
      isDeleted: false,
      isFavorite: insertFolder.isFavorite ?? false,
      tags: [],
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
    const folder = this.folders.get(id);
    if (folder) {
      folder.isDeleted = true;
      folder.updatedAt = new Date();
      this.folders.set(id, folder);
      
      // Cascade delete children
      const childrenFolders = Array.from(this.folders.values()).filter(f => f.parentId === id);
      for (const child of childrenFolders) {
        await this.deleteFolder(child.id);
      }
      
      const childrenNotes = Array.from(this.notes.values()).filter(n => n.folderId === id);
      for (const child of childrenNotes) {
        await this.deleteNote(child.id);
      }
    }
  }

  async getNote(id: string): Promise<Note | undefined> {
    return this.notes.get(id);
  }

  async listNotesByUser(userId: string, updatedAfter?: Date): Promise<Note[]> {
    return Array.from(this.notes.values()).filter(
      (note) => note.userId === userId && (updatedAfter ? note.updatedAt > updatedAfter : !note.isDeleted),
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
      isDeleted: false,
      tags: [],
      isFavorite: false,
      isPublic: false,
    };
    this.notes.set(id, note);
    return note;
  }

  async updateNote(id: string, note: UpdateNote & { isPublic?: boolean }): Promise<Note | undefined> {
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
    console.log(`[MemStorage] deleteNote ${id}`);
    const note = this.notes.get(id);
    if (note) {
      note.isDeleted = true;
      note.updatedAt = new Date();
      this.notes.set(id, note);
    } else {
      console.log(`[MemStorage] Note ${id} not found`);
    }
  }

  async getTrash(userId: string): Promise<{ folders: Folder[], notes: Note[] }> {
    console.log(`[MemStorage] getTrash user=${userId}`);
    const folders = Array.from(this.folders.values()).filter(f => f.userId === userId && f.isDeleted);
    const notes = Array.from(this.notes.values()).filter(n => n.userId === userId && n.isDeleted);
    console.log(`[MemStorage] Found ${folders.length} deleted folders, ${notes.length} deleted notes`);
    return { folders, notes };
  }

  async getFavorites(userId: string): Promise<{ folders: Folder[], notes: Note[] }> {
    const folders = Array.from(this.folders.values()).filter(f => f.userId === userId && !f.isDeleted && f.isFavorite);
    const notes = Array.from(this.notes.values()).filter(n => n.userId === userId && !n.isDeleted && n.isFavorite);
    return { folders, notes };
  }

  async restoreFolder(id: string): Promise<void> {
    const folder = this.folders.get(id);
    if (folder) {
      folder.isDeleted = false;
      folder.updatedAt = new Date();
      this.folders.set(id, folder);

      // Cascade restore children
      // Note: This restores EVERYTHING that was in the folder. 
      // If some items were deleted BEFORE the folder was deleted, they will be restored too.
      // This is a simplification. For a perfect system, we'd need a 'deletedAt' timestamp 
      // or a transaction ID to only restore items deleted *with* the folder.
      // But for this app, restoring everything is acceptable behavior.
      const childrenFolders = Array.from(this.folders.values()).filter(f => f.parentId === id);
      for (const child of childrenFolders) {
        await this.restoreFolder(child.id);
      }
      
      const childrenNotes = Array.from(this.notes.values()).filter(n => n.folderId === id);
      for (const child of childrenNotes) {
        await this.restoreNote(child.id);
      }
    }
  }

  async restoreNote(id: string): Promise<void> {
    const note = this.notes.get(id);
    if (note) {
      note.isDeleted = false;
      note.updatedAt = new Date();
      this.notes.set(id, note);
    }
  }

  async permanentDeleteFolder(id: string): Promise<void> {
    // Cascade delete children
    const childrenFolders = Array.from(this.folders.values()).filter(f => f.parentId === id);
    for (const child of childrenFolders) {
      await this.permanentDeleteFolder(child.id);
    }
    
    const childrenNotes = Array.from(this.notes.values()).filter(n => n.folderId === id);
    for (const child of childrenNotes) {
      await this.permanentDeleteNote(child.id);
    }

    this.folders.delete(id);
  }

  async permanentDeleteNote(id: string): Promise<void> {
    this.notes.delete(id);
  }

  // Tasks CRUD (Postgres)
  async getTask(id: string): Promise<Task | undefined> {
    return this.tasksMap.get(id);
  }

  async listTasksByUser(userId: string): Promise<Task[]> {
    return Array.from(this.tasksMap.values()).filter(t => t.userId === userId);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const now = new Date();
    const task: Task = {
      id,
      userId: insertTask.userId,
      content: insertTask.content,
      description: insertTask.description ?? null,
      callLink: insertTask.callLink ?? null,
      isCompleted: false,
      status: insertTask.status ?? null,
      parentId: insertTask.parentId ?? null,
      dueDate: insertTask.dueDate ?? null,
      createdAt: now,
      updatedAt: now,
      notify: insertTask.notify ?? false,
      isNotified: insertTask.isNotified ?? false,
      priority: insertTask.priority ?? 'medium',
      tags: insertTask.tags ?? [],
      recurring: insertTask.recurring ?? null,
    };
    this.tasksMap.set(id, task);
    return task;
  }

  async updateTask(id: string, task: UpdateTask): Promise<Task | undefined> {
    const existing = this.tasksMap.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: Task = {
      ...existing,
      ...task,
      updatedAt: new Date(),
      dueDate: task.dueDate ?? existing.dueDate ?? null,
    };
    this.tasksMap.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    this.tasksMap.delete(id);
  }
 }

 export class FileSystemStorage implements IStorage {
  private storagePath: string;

  constructor(basePath: string) {
    this.storagePath = path.join(basePath, 'fs-storage');
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    console.log(`FileSystemStorage initialized at: ${this.storagePath}`);
  }

  private getFilePath(entityType: string, id: string): string {
    return path.join(this.storagePath, `${entityType}-${id}.json`);
  }

  private async readEntity<T>(entityType: string, id: string): Promise<T | undefined> {
    const filePath = this.getFilePath(entityType, id);
    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
    return undefined;
  }

  private async writeEntity<T>(entityType: string, id: string, entity: T): Promise<void> {
    const filePath = this.getFilePath(entityType, id);
    await fs.promises.writeFile(filePath, JSON.stringify(entity, null, 2), 'utf-8');
  }

  private async deleteEntity(entityType: string, id: string): Promise<void> {
    const filePath = this.getFilePath(entityType, id);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  private async listEntities<T>(entityType: string, filterFn: (entity: T) => boolean): Promise<T[]> {
    const files = await fs.promises.readdir(this.storagePath);
    const entities: T[] = [];
    for (const file of files) {
      if (file.startsWith(`${entityType}-`) && file.endsWith('.json')) {
        const filePath = path.join(this.storagePath, file);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const entity = JSON.parse(content) as T;
        if (filterFn(entity)) {
          entities.push(entity);
        }
      }
    }
    return entities;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.readEntity<User>('user', id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const users = await this.listEntities<User>('user', () => true);
    return users.find(user => user.email === email);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = await this.listEntities<User>('user', () => true);
    return users.find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      email: insertUser.email,
      username: insertUser.username ?? null,
      password: insertUser.password,
      name: insertUser.name ?? null,
      avatar_url: null,
      is_verified: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await this.writeEntity('user', id, user);
    return user;
  }

  async importUser(user: User): Promise<User> {
    await this.writeEntity('user', user.id, user);
    return user;
  }

  async listUsers(): Promise<User[]> {
    return this.listEntities<User>('user', () => true);
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<User | undefined> {
    const user = await this.readEntity<User>('user', userId);
    if (!user) return undefined;
    const updated: User = { ...user, password: hashedPassword, updated_at: new Date() };
    await this.writeEntity('user', userId, updated);
    return updated;
  }

  async getFolder(id: string): Promise<Folder | undefined> {
    return this.readEntity<Folder>('folder', id);
  }

  async listFoldersByUser(userId: string): Promise<Folder[]> {
    return this.listEntities<Folder>('folder', (folder) => folder.userId === userId && !folder.isDeleted);
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
      isDeleted: false,
      isFavorite: insertFolder.isFavorite ?? false,
      tags: [],
    };
    await this.writeEntity('folder', id, folder);
    return folder;
  }

  async updateFolder(id: string, folder: UpdateFolder): Promise<Folder | undefined> {
    const existing = await this.readEntity<Folder>('folder', id);
    if (!existing) {
      return undefined;
    }
    const updated: Folder = {
      ...existing,
      ...folder,
      updatedAt: new Date(),
    };
    await this.writeEntity('folder', id, updated);
    return updated;
  }

  async deleteFolder(id: string): Promise<void> {
    const folder = await this.readEntity<Folder>('folder', id);
    if (folder) {
      folder.isDeleted = true;
      folder.updatedAt = new Date();
      await this.writeEntity('folder', id, folder);

      const childrenFolders = await this.listEntities<Folder>('folder', f => f.parentId === id);
      for (const child of childrenFolders) {
        await this.deleteFolder(child.id);
      }

      const childrenNotes = await this.listEntities<Note>('note', n => n.folderId === id);
      for (const child of childrenNotes) {
        await this.deleteNote(child.id);
      }
    }
  }

  async getNote(id: string): Promise<Note | undefined> {
    return this.readEntity<Note>('note', id);
  }

  async listNotesByUser(userId: string): Promise<Note[]> {
    return this.listEntities<Note>('note', (note) => note.userId === userId && !note.isDeleted);
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
      isDeleted: false,
      tags: [],
      isFavorite: false,
      isPublic: false,
    };
    await this.writeEntity('note', id, note);
    return note;
  }

  async updateNote(id: string, note: UpdateNote & { isPublic?: boolean }): Promise<Note | undefined> {
    const existing = await this.readEntity<Note>('note', id);
    if (!existing) {
      return undefined;
    }
    const updated: Note = {
      ...existing,
      ...note,
      updatedAt: new Date(),
    };
    await this.writeEntity('note', id, updated);
    return updated;
  }

  async deleteNote(id: string): Promise<void> {
    const note = await this.readEntity<Note>('note', id);
    if (note) {
      note.isDeleted = true;
      note.updatedAt = new Date();
      await this.writeEntity('note', id, note);
    }
  }

  async getTrash(userId: string): Promise<{ folders: Folder[], notes: Note[] }> {
    const folders = await this.listEntities<Folder>('folder', f => f.userId === userId && f.isDeleted);
    const notes = await this.listEntities<Note>('note', n => n.userId === userId && n.isDeleted);
    return { folders, notes };
  }

  async getFavorites(userId: string): Promise<{ folders: Folder[], notes: Note[] }> {
    const folders = await this.listEntities<Folder>('folder', f => f.userId === userId && !f.isDeleted && f.isFavorite);
    const notes = await this.listEntities<Note>('note', n => n.userId === userId && !n.isDeleted && n.isFavorite);
    return { folders, notes };
  }

  async restoreFolder(id: string): Promise<void> {
    const folder = await this.readEntity<Folder>('folder', id);
    if (folder) {
      folder.isDeleted = false;
      folder.updatedAt = new Date();
      await this.writeEntity('folder', id, folder);

      const childrenFolders = await this.listEntities<Folder>('folder', f => f.parentId === id);
      for (const child of childrenFolders) {
        await this.restoreFolder(child.id);
      }

      const childrenNotes = await this.listEntities<Note>('note', n => n.folderId === id);
      for (const child of childrenNotes) {
        await this.restoreNote(child.id);
      }
    }
  }

  async restoreNote(id: string): Promise<void> {
    const note = await this.readEntity<Note>('note', id);
    if (note) {
      note.isDeleted = false;
      note.updatedAt = new Date();
      await this.writeEntity('note', id, note);
    }
  }

  async permanentDeleteFolder(id: string): Promise<void> {
    const childrenFolders = await this.listEntities<Folder>('folder', f => f.parentId === id);
    for (const child of childrenFolders) {
      await this.permanentDeleteFolder(child.id);
    }

    const childrenNotes = await this.listEntities<Note>('note', n => n.folderId === id);
    for (const child of childrenNotes) {
      await this.permanentDeleteNote(child.id);
    }
    await this.deleteEntity('folder', id);
  }

  async permanentDeleteNote(id: string): Promise<void> {
    await this.deleteEntity('note', id);
  }

  // Tasks CRUD
  async getTask(id: string): Promise<Task | undefined> {
    return this.readEntity<Task>('task', id);
  }

  async listTasksByUser(userId: string): Promise<Task[]> {
    return this.listEntities<Task>('task', (task) => task.userId === userId);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const now = new Date();
    const task: Task = {
      id,
      userId: insertTask.userId,
      content: insertTask.content,
      description: insertTask.description ?? null,
      callLink: insertTask.callLink ?? null,
      isCompleted: false,
      status: insertTask.status ?? null,
      parentId: insertTask.parentId ?? null,
      dueDate: insertTask.dueDate ?? null,
      createdAt: now,
      updatedAt: now,
      notify: insertTask.notify ?? false,
      isNotified: insertTask.isNotified ?? false,
      priority: insertTask.priority ?? 'medium',
      tags: insertTask.tags ?? [],
      recurring: insertTask.recurring ?? null,
    };
    await this.writeEntity('task', id, task);
    return task;
  }

  async updateTask(id: string, task: UpdateTask): Promise<Task | undefined> {
    const existing = await this.readEntity<Task>('task', id);
    if (!existing) {
      return undefined;
    }
    const updated: Task = {
      ...existing,
      ...task,
      updatedAt: new Date(),
    };
    await this.writeEntity('task', id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await this.deleteEntity('task', id);
  }
}

export class ProxyStorage implements IStorage {
   private current: IStorage;

   constructor(initial: IStorage) {
     this.current = initial;
   }

   setStorage(storage: IStorage) {
     this.current = storage;
   }

   getBackendName(): string {
     return this.current.constructor.name;
   }

   async getUser(id: string): Promise<User | undefined> { return this.current.getUser(id); }
   async getUserByEmail(email: string): Promise<User | undefined> { return this.current.getUserByEmail(email); }
   async getUserByUsername(username: string): Promise<User | undefined> { return this.current.getUserByUsername(username); }
   async createUser(user: InsertUser): Promise<User> { return this.current.createUser(user); }
   async importUser(user: User): Promise<User> { return this.current.importUser(user); }
   async listUsers(): Promise<User[]> { return this.current.listUsers(); }
   async getFolder(id: string): Promise<Folder | undefined> { return this.current.getFolder(id); }
   async listFoldersByUser(userId: string): Promise<Folder[]> { return this.current.listFoldersByUser(userId); }
   async createFolder(folder: InsertFolder): Promise<Folder> { return this.current.createFolder(folder); }
   async updateFolder(id: string, folder: UpdateFolder): Promise<Folder | undefined> { return this.current.updateFolder(id, folder); }
   async deleteFolder(id: string): Promise<void> { return this.current.deleteFolder(id); }
   async getNote(id: string): Promise<Note | undefined> { return this.current.getNote(id); }
   async listNotesByUser(userId: string, updatedAfter?: Date): Promise<Note[]> { return this.current.listNotesByUser(userId, updatedAfter); }
   async createNote(note: InsertNote): Promise<Note> { return this.current.createNote(note); }
   async updateNote(id: string, note: UpdateNote): Promise<Note | undefined> { return this.current.updateNote(id, note); }
   async deleteNote(id: string): Promise<void> { return this.current.deleteNote(id); }
   async getTrash(userId: string): Promise<{ folders: Folder[], notes: Note[] }> { return this.current.getTrash(userId); }
   async getFavorites(userId: string): Promise<{ folders: Folder[], notes: Note[] }> { return this.current.getFavorites(userId); }
   async restoreFolder(id: string): Promise<void> { return this.current.restoreFolder(id); }
   async restoreNote(id: string): Promise<void> { return this.current.restoreNote(id); }
   async permanentDeleteFolder(id: string): Promise<void> { return this.current.permanentDeleteFolder(id); }
   async permanentDeleteNote(id: string): Promise<void> { return this.current.permanentDeleteNote(id); }
   async getTask(id: string): Promise<Task | undefined> { return this.current.getTask(id); }
   async listTasksByUser(userId: string): Promise<Task[]> { return this.current.listTasksByUser(userId); }
   async createTask(task: InsertTask): Promise<Task> { return this.current.createTask(task); }
   async updateTask(id: string, task: UpdateTask): Promise<Task | undefined> { return this.current.updateTask(id, task); }
   async deleteTask(id: string): Promise<void> { return this.current.deleteTask(id); }
   // Update user password across storage implementations and interface.
   async updateUserPassword(userId: string, hashedPassword: string): Promise<User | undefined> { return this.current.updateUserPassword(userId, hashedPassword); }
}

const STORAGE_BASE_DIR = process.env.GODNOTES_DATA_DIR || (process.env.VERCEL ? '/tmp' : process.cwd());
const STORAGE_CONFIG_FILE = path.join(STORAGE_BASE_DIR, '.storage-config.json');

function loadStorageConfig(): string | null {
  try {
    if (fs.existsSync(STORAGE_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORAGE_CONFIG_FILE, 'utf-8'));
      return data.storagePath || null;
    }
  } catch (e) {
    console.error("Failed to load storage config", e);
  }
  return null;
}

function saveStorageConfig(storagePath: string) {
  try {
    fs.writeFileSync(STORAGE_CONFIG_FILE, JSON.stringify({ storagePath }, null, 2));
  } catch (e) {
    console.error("Failed to save storage config", e);
  }
}

export const storage = new ProxyStorage(
  (() => {
    const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
    console.log('=== STORAGE INITIALIZATION ===');
    console.log('DATABASE_URL:', databaseUrl ? 'SET' : 'NOT SET');
    
    // Check if we are running in Vercel Serverless environment
    // Vercel only supports Postgres/database storage, not filesystem persistence
    if (process.env.VERCEL) {
      if (databaseUrl) {
        console.log('Using PostgreSQL storage (Vercel)');
        return new PostgresStorage(databaseUrl);
      }
      console.error('DATABASE_URL is required in Vercel environment. Falling back to ephemeral filesystem storage in /tmp.');
      const tmpPath = path.join(STORAGE_BASE_DIR, 'data');
      if (!fs.existsSync(tmpPath)) {
        try {
          fs.mkdirSync(tmpPath, { recursive: true });
        } catch (e) {
          console.error('Failed to create /tmp data directory', e);
        }
      }
      return new FileSystemStorage(tmpPath);
    }

    console.log('Saved storage config:', loadStorageConfig());
    
    const savedPath = loadStorageConfig();
    if (savedPath) {
      console.log(`Restoring storage path: ${savedPath}`);
      return new FileSystemStorage(savedPath);
    }
    
    if (databaseUrl) {
      console.log('Using PostgreSQL storage');
      return new PostgresStorage(databaseUrl);
    }

    // Default to local data folder for persistence
    const defaultPath = path.join(STORAGE_BASE_DIR, 'data');
    if (!fs.existsSync(defaultPath)) {
      fs.mkdirSync(defaultPath, { recursive: true });
    }
    console.log(`Using default local storage: ${defaultPath}`);
    return new FileSystemStorage(defaultPath);
  })()
);

export async function setStoragePath(path: string, migrateUser?: User) {
  console.log(`Switching storage path to: ${path}`);
  const newStorage = new FileSystemStorage(path);
  
  if (migrateUser) {
    console.log(`[Storage] Migrating user ${migrateUser.username} to new storage`);
    await newStorage.importUser(migrateUser);
  }

  storage.setStorage(newStorage);
  saveStorageConfig(path);
}
