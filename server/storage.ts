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
  updateNote(id: string, note: UpdateNote): Promise<Note | undefined>;
  deleteNote(id: string): Promise<void>;
  importUser(user: User): Promise<User>;
  listUsers(): Promise<User[]>;
  getTrash(userId: string): Promise<{ folders: Folder[], notes: Note[] }>;
  restoreFolder(id: string): Promise<void>;
  restoreNote(id: string): Promise<void>;
  permanentDeleteFolder(id: string): Promise<void>;
  permanentDeleteNote(id: string): Promise<void>;
  getFavorites(userId: string): Promise<{ folders: Folder[], notes: Note[] }>;
}

export class MemStorage implements IStorage {
  protected users: Map<string, User>;
  protected folders: Map<string, Folder>;
  protected notes: Map<string, Note>;

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
}

export class FileSystemStorage extends MemStorage {
  private rootPath: string;
  private metadataPath: string;

  constructor(rootPath: string) {
    super();
    this.rootPath = rootPath;
    this.metadataPath = path.join(rootPath, '.godnotes-metadata.json');
    this.loadData();
  }

  private loadData() {
    try {
      if (fs.existsSync(this.metadataPath)) {
        console.log(`[FileSystemStorage] Loading metadata from ${this.metadataPath}`);
        const data = JSON.parse(fs.readFileSync(this.metadataPath, 'utf-8'));
        
        // Restore users
        if (data.users) {
          data.users.forEach((u: User) => this.users.set(u.id, u));
          console.log(`[FileSystemStorage] Loaded ${this.users.size} users`);
        }

        // Restore folders
        if (data.folders) {
          data.folders.forEach((f: Folder) => {
            f.createdAt = new Date(f.createdAt);
            f.updatedAt = new Date(f.updatedAt);
            this.folders.set(f.id, f);
          });
        }

        // Restore notes metadata, content is read from files on demand
        if (data.notes) {
          data.notes.forEach((n: Note) => {
            n.createdAt = new Date(n.createdAt);
            n.updatedAt = new Date(n.updatedAt);
            // We don't load content here to save memory and startup time
            // Content will be loaded lazily in getNote
            this.notes.set(n.id, n);
          });
        }
      }
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  }

  private saveData() {
    try {
      if (!fs.existsSync(this.rootPath)) {
        fs.mkdirSync(this.rootPath, { recursive: true });
      }
      
      // Save lightweight metadata (exclude content)
      const notesMetadata = Array.from(this.notes.values()).map(note => {
        const { content, ...metadata } = note;
        return { ...metadata, content: "" }; // Clear content in metadata file
      });

      const data = {
        users: Array.from(this.users.values()),
        folders: Array.from(this.folders.values()),
        notes: notesMetadata
      };
      
      // Debug: check if deleted items are being saved
      const deletedNotes = data.notes.filter(n => n.isDeleted).length;
      const deletedFolders = data.folders.filter(f => f.isDeleted).length;
      console.log(`[FileSystemStorage] Saving metadata. Deleted: ${deletedFolders} folders, ${deletedNotes} notes`);

      fs.writeFileSync(this.metadataPath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('[FileSystemStorage] Failed to save metadata', err);
    }
  }

  private getFolderPath(folderId: string | null): string {
    if (!folderId) return this.rootPath;
    const folder = this.folders.get(folderId);
    if (!folder) return this.rootPath;
    return path.join(this.getFolderPath(folder.parentId), folder.name);
  }

  private getNotePath(note: Note): string {
    const folderPath = this.getFolderPath(note.folderId);
    // Sanitize filename
    const safeTitle = note.title.replace(/[^a-z0-9а-яё \-_]/gi, '_');
    return path.join(folderPath, `${safeTitle}.md`);
  }

  async getNote(id: string): Promise<Note | undefined> {
    const note = await super.getNote(id);
    if (note) {
      // Lazy load content if missing
      if (!note.content) {
        try {
          const filePath = this.getNotePath(note);
          if (fs.existsSync(filePath)) {
            console.log(`[FileSystemStorage] Lazy loading content for note ${id}`);
            note.content = fs.readFileSync(filePath, 'utf-8');
            // Cache it back in memory for this session
            this.notes.set(id, note);
          } else {
            console.warn(`[FileSystemStorage] File for note ${id} not found at ${filePath}`);
            // If file is missing but metadata exists, we might want to return a placeholder
            // or keep it undefined to signal "not loaded"
            // For now, let's keep it as is, but log it.
          }
        } catch (e) {
          console.error(`[FileSystemStorage] Failed to lazy load note ${id}`, e);
        }
      }
    }
    return note;
  }

  async getUser(id: string): Promise<User | undefined> {
    let user = await super.getUser(id);
    if (user) return user;

    // Fallback: try to reload from disk just in case
    console.log(`[FileSystemStorage] User ${id} not found in memory, reloading data...`);
    this.loadData();
    user = await super.getUser(id);
    if (user) {
        console.log(`[FileSystemStorage] User ${id} found after reload.`);
    } else {
        console.log(`[FileSystemStorage] User ${id} still not found after reload.`);
        // Debug: list all users
        console.log(`[FileSystemStorage] Available users: ${Array.from(this.users.keys()).join(', ')}`);
    }
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user = await super.createUser(insertUser);
    this.saveData();
    return user;
  }

  async importUser(user: User): Promise<User> {
    console.log(`[FileSystemStorage] Importing user ${user.id} (${user.username})`);
    const imported = await super.importUser(user);
    this.saveData();
    // Verify
    if (this.users.has(user.id)) {
        console.log(`[FileSystemStorage] User imported and verified in memory.`);
    } else {
        console.error(`[FileSystemStorage] CRITICAL: User NOT found in memory after import!`);
    }
    return imported;
  }

  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    const folder = await super.createFolder(insertFolder);
    const folderPath = this.getFolderPath(folder.id);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    this.saveData();
    return folder;
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const note = await super.createNote(insertNote);
    const filePath = this.getNotePath(note);
    const folderPath = path.dirname(filePath);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    fs.writeFileSync(filePath, note.content);
    this.saveData();
    return note;
  }

  async updateNote(id: string, note: UpdateNote): Promise<Note | undefined> {
    const oldNote = await this.getNote(id);
    if (!oldNote) return undefined;
    
    // Check if we need to move/rename
    const oldPath = this.getNotePath(oldNote);
    
    const updated = await super.updateNote(id, note);
    if (!updated) return undefined;

    const newPath = this.getNotePath(updated);

    if (oldPath !== newPath) {
        if (fs.existsSync(oldPath)) {
            // Ensure new folder exists
            const newFolder = path.dirname(newPath);
            if (!fs.existsSync(newFolder)) fs.mkdirSync(newFolder, { recursive: true });
            fs.renameSync(oldPath, newPath);
        }
    }

    // Write content
    fs.writeFileSync(newPath, updated.content);
    this.saveData();
    return updated;
  }

  async deleteNote(id: string): Promise<void> {
    await super.deleteNote(id);
    this.saveData();
  }

  async deleteFolder(id: string): Promise<void> {
    await super.deleteFolder(id);
    this.saveData();
  }

  async restoreNote(id: string): Promise<void> {
    await super.restoreNote(id);
    this.saveData();
  }

  async restoreFolder(id: string): Promise<void> {
    await super.restoreFolder(id);
    this.saveData();
  }

  async permanentDeleteNote(id: string): Promise<void> {
    const note = await this.getNote(id);
    if (note) {
        const filePath = this.getNotePath(note);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                console.error(`[FileSystemStorage] Failed to delete file ${filePath}`, e);
            }
        }
    }
    await super.permanentDeleteNote(id);
    this.saveData();
  }

  async permanentDeleteFolder(id: string): Promise<void> {
    const folder = await this.getFolder(id);
    if (folder) {
         const folderPath = this.getFolderPath(folder.id);
         if (fs.existsSync(folderPath)) {
             try {
                 fs.rmSync(folderPath, { recursive: true, force: true });
             } catch (e) {
                 console.error(`[FileSystemStorage] Failed to remove directory ${folderPath}`, e);
             }
         }
    }
    await super.permanentDeleteFolder(id);
    this.saveData();
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
        updated_at timestamp NOT NULL DEFAULT now(),
        is_deleted boolean NOT NULL DEFAULT false,
        is_favorite boolean NOT NULL DEFAULT false
      );
    `);
    await this.pool.query(`
        ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
    `);
    await this.pool.query(`
        ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        folder_id text,
        title text NOT NULL,
        content text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        is_deleted boolean NOT NULL DEFAULT false,
        is_favorite boolean NOT NULL DEFAULT false
      );
    `);
    await this.pool.query(`
        ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
    `);
    await this.pool.query(`
        ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    await this.ready;
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return rows[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    await this.ready;
    const id = randomUUID();
    const rows = await this.db.insert(users).values({ id, ...insertUser }).returning();
    return rows[0];
  }

  async importUser(user: User): Promise<User> {
    await this.ready;
    const rows = await this.db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: user,
      })
      .returning();
    return rows[0];
  }

  async listUsers(): Promise<User[]> {
    await this.ready;
    const rows = await this.db.select().from(users);
    return rows;
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
      .where(and(eq(folders.userId, userId), eq(folders.isDeleted, false)));
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
        isFavorite: insertFolder.isFavorite ?? false,
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
    await this.db.update(folders).set({ isDeleted: true, updatedAt: new Date() }).where(eq(folders.id, id));
    
    // Cascade soft delete children
    const childrenFolders = await this.db.select().from(folders).where(eq(folders.parentId, id));
    for (const child of childrenFolders) {
      await this.deleteFolder(child.id);
    }
    
    const childrenNotes = await this.db.select().from(notes).where(eq(notes.folderId, id));
    for (const child of childrenNotes) {
      await this.deleteNote(child.id);
    }
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
      .where(and(eq(notes.userId, userId), eq(notes.isDeleted, false)));
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
    await this.db.update(notes).set({ isDeleted: true, updatedAt: new Date() }).where(eq(notes.id, id));
  }

  async getTrash(userId: string): Promise<{ folders: Folder[], notes: Note[] }> {
    await this.ready;
    const f = await this.db.select().from(folders).where(and(eq(folders.userId, userId), eq(folders.isDeleted, true)));
    const n = await this.db.select().from(notes).where(and(eq(notes.userId, userId), eq(notes.isDeleted, true)));
    return { folders: f, notes: n };
  }

  async getFavorites(userId: string): Promise<{ folders: Folder[], notes: Note[] }> {
    await this.ready;
    const f = await this.db.select().from(folders).where(and(eq(folders.userId, userId), eq(folders.isDeleted, false), eq(folders.isFavorite, true)));
    const n = await this.db.select().from(notes).where(and(eq(notes.userId, userId), eq(notes.isDeleted, false), eq(notes.isFavorite, true)));
    return { folders: f, notes: n };
  }

  async restoreFolder(id: string): Promise<void> {
    await this.ready;
    await this.db.update(folders).set({ isDeleted: false, updatedAt: new Date() }).where(eq(folders.id, id));

    // Cascade restore children
    const childrenFolders = await this.db.select().from(folders).where(eq(folders.parentId, id));
    for (const child of childrenFolders) {
      await this.restoreFolder(child.id);
    }
    
    const childrenNotes = await this.db.select().from(notes).where(eq(notes.folderId, id));
    for (const child of childrenNotes) {
      await this.restoreNote(child.id);
    }
  }

  async restoreNote(id: string): Promise<void> {
    await this.ready;
    await this.db.update(notes).set({ isDeleted: false, updatedAt: new Date() }).where(eq(notes.id, id));
  }

  async permanentDeleteFolder(id: string): Promise<void> {
    await this.ready;
    
    // Cascade delete children
    const childrenFolders = await this.db.select().from(folders).where(eq(folders.parentId, id));
    for (const child of childrenFolders) {
      await this.permanentDeleteFolder(child.id);
    }
    
    const childrenNotes = await this.db.select().from(notes).where(eq(notes.folderId, id));
    for (const child of childrenNotes) {
      await this.permanentDeleteNote(child.id);
    }

    await this.db.delete(folders).where(eq(folders.id, id));
  }

  async permanentDeleteNote(id: string): Promise<void> {
    await this.ready;
    await this.db.delete(notes).where(eq(notes.id, id));
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
