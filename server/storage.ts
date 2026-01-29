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
import { eq, and } from "drizzle-orm";
import fs from 'fs';
import path from 'path';

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
  listNotesByUser(userId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, note: UpdateNote & { isPublic?: boolean }): Promise<Note | undefined>;
  deleteNote(id: string): Promise<void>;
  importUser(user: User): Promise<User>;
  listUsers(): Promise<User[]>;
  getTrash(userId: string): Promise<{ folders: Folder[], notes: Note[] }>;
  restoreFolder(id: string): Promise<void>;
  restoreNote(id: string): Promise<void>;
  permanentDeleteFolder(id: string): Promise<void>;
  permanentDeleteNote(id: string): Promise<void>;
  getFavorites(userId: string): Promise<{ folders: Folder[], notes: Note[] }>;
  // Tasks CRUD
  getTask(id: string): Promise<Task | undefined>;
  listTasksByUser(userId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: UpdateTask): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
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

  async listNotesByUser(userId: string): Promise<Note[]> {
    return Array.from(this.notes.values()).filter(
      (note) => note.userId === userId && !note.isDeleted,
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
        priority: insertTask.priority ?? 'medium',
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
   async listNotesByUser(userId: string): Promise<Note[]> { return this.current.listNotesByUser(userId); }
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
 }

const STORAGE_CONFIG_FILE = path.join(process.cwd(), '.storage-config.json');

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
    console.log('=== STORAGE INITIALIZATION ===');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    console.log('Saved storage config:', loadStorageConfig());
    
    const savedPath = loadStorageConfig();
    if (savedPath) {
      console.log(`Restoring storage path: ${savedPath}`);
      return new FileSystemStorage(savedPath);
    }
    
    if (process.env.DATABASE_URL) {
      console.log('Using PostgreSQL storage');
      return new PostgresStorage(process.env.DATABASE_URL);
    }

    // Default to local data folder for persistence
    const defaultPath = path.join(process.cwd(), 'data');
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
