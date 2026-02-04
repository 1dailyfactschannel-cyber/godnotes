import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage, setStoragePath } from "./storage";
import {
  insertUserSchema,
  insertFolderSchema,
  updateFolderSchema,
  insertNoteSchema,
  updateNoteSchema,
  insertTaskSchema,
  updateTaskSchema,
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer, { type FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";

const JWT_SECRET = process.env.JWT_SECRET || "your_very_secure_session_secret_change_this_immediately";
const JWT_EXPIRES_IN = "24h";

// In-memory reset tokens (development only)
const resetTokens = new Map<string, { token: string; expiresAt: number }>();

// console.log('JWT_SECRET:', JWT_SECRET); // Do not log secrets in production

// Middleware для проверки JWT
const authenticateToken = (req: Request, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    (req as any).userId = decoded.userId;
    next();
  } catch (error: any) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  const serializeTask = (t: any) => ({
    ...t,
    description: t.description ?? undefined,
    callLink: t.callLink ?? undefined,
    status: t.status ?? undefined,
    parentId: t.parentId ?? undefined,
    recurring: t.recurring ?? undefined,
    createdAt: t.createdAt ? new Date(t.createdAt).getTime() : undefined,
    updatedAt: t.updatedAt ? new Date(t.updatedAt).getTime() : undefined,
    dueDate: t.dueDate ? new Date(t.dueDate).getTime() : undefined,
  });

  const uploadDir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req: Request, _file: Express.Multer.File, cb) => {
        cb(null, uploadDir);
      },
      filename: (_req: Request, file: Express.Multer.File, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname) || "";
        cb(null, `${uniqueSuffix}${ext}`);
      },
    }),
    fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
      // Allow all files
      cb(null, true);
    },
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  });

  app.use("/uploads", (await import("express")).default.static(uploadDir, { maxAge: "30d", immutable: true }));

  app.post("/api/uploads", authenticateToken, async (req, res) => {
    upload.single("file")(req as Request, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res
            .status(413)
            .json({ message: "Файл слишком большой. Максимальный размер 50 МБ" });
          return;
        }
        res
          .status(400)
          .json({ message: "Ошибка загрузки файла", code: err.code });
        return;
      }

      if (err) {
        res
          .status(500)
          .json({ message: "Ошибка сервера при загрузке файла" });
        return;
      }

      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) {
        res.status(400).json({ message: "Не удалось получить файл" });
        return;
      }

      try {
        const originalPath = file.path;
        const mime = file.mimetype || "application/octet-stream";
        const isImage = mime.startsWith("image/");
        const isGif = mime === "image/gif";
        const isSvg = mime === "image/svg+xml";

        let finalBuffer: Buffer;
        let finalExt: string;

        if (isImage && !isGif && !isSvg) {
          // Optimize to WebP, limit size, strip metadata
          finalBuffer = await sharp(originalPath)
            .rotate()
            .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
          finalExt = "webp";
        } else {
          // Keep original for GIF/SVG/other types
          finalBuffer = await fs.promises.readFile(originalPath);
          const ext = path.extname(file.originalname).toLowerCase();
          finalExt = ext ? ext.slice(1) : "bin";
        }

        // Content-addressable name by SHA-256
        const hash = crypto.createHash("sha256").update(finalBuffer).digest("hex");
        const finalFilename = `${hash}.${finalExt}`;
        const finalPath = path.join(uploadDir, finalFilename);

        // Deduplicate: if exists, reuse
        if (fs.existsSync(finalPath)) {
          // Remove temp upload
          try { await fs.promises.unlink(originalPath); } catch {}
        } else {
          // Write optimized/deduped file
          await fs.promises.writeFile(finalPath, finalBuffer);
          // Remove temp upload
          try { await fs.promises.unlink(originalPath); } catch {}
        }

        const url = `/uploads/${finalFilename}`;
        res.status(201).json({ url });
      } catch (e) {
        console.error("Upload processing failed", e);
        res.status(500).json({ message: "Ошибка обработки файла" });
      }
    });
  });

  app.get("/api/db/health", async (_req, res) => {
    const backend = storage.getBackendName();
    res.json({ ok: true, backend });
  });

  app.post("/api/config/storage-path", async (req, res) => {
    const { path } = req.body;
    if (path && typeof path === 'string') {
      try {
        // 1. Get current user before switching storage
        let userId = req.session.userId;
        let currentUser;
        if (userId) {
           console.log(`[SwitchStorage] Current session userId: ${userId}`);
           currentUser = await storage.getUser(userId);
           
           // Auto-adopt if missing
           if (!currentUser) {
               console.log(`[SwitchStorage] User ${userId} not found. Attempting auto-adopt before switch...`);
               const allUsers = await storage.listUsers();
               if (allUsers.length === 1) {
                   currentUser = allUsers[0];
                   console.log(`[SwitchStorage] Auto-adopted single user: ${currentUser.username} (${currentUser.id})`);
                   // Update session for future
                   req.session.userId = currentUser.id;
               }
           }

           if (currentUser) {
             console.log(`[SwitchStorage] Found current user: ${currentUser.username} (${currentUser.id})`);
           } else {
             console.log(`[SwitchStorage] User not found in current storage!`);
           }
        } else {
           console.log(`[SwitchStorage] No userId in session`);
        }

        console.log(`Setting storage path to: ${path}`);
        await setStoragePath(path, currentUser);

        // Verify migration
        if (currentUser) {
           const userInNewStorage = await storage.getUser(currentUser.id);
           if (userInNewStorage) {
               console.log(`[SwitchStorage] Migration verified. User exists in new storage.`);
           } else {
               console.error(`[SwitchStorage] Migration FAILED. User not found after switch!`);
           }
        }

        res.json({ ok: true, path });
      } catch (err) {
        console.error("Failed to set storage path:", err);
        res.status(500).json({ message: "Failed to set storage path" });
      }
    } else {
      res.status(400).json({ message: "Invalid path" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId;
      
      let user = await storage.getUser(userId);
      
      if (!user) {
        res.status(401).json({ message: "Unauthorized: User not found" });
        return;
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        avatar_url: user.avatar_url,
        is_verified: user.is_verified,
        is_active: user.is_active,
        created_at: user.created_at
      });
    } catch (error: any) {
      res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      console.log("Register body:", req.body);
      const parsed = insertUserSchema.parse(req.body);
      console.log("Parsed:", parsed);
      
      // Check if user with this email already exists
      const existingByEmail = await storage.getUserByEmail(parsed.email);
      if (existingByEmail) {
        res.status(409).json({ message: "User with this email already exists" });
        return;
      }
      
      // Check if user with this username already exists (if provided)
      if (parsed.username) {
        const existingByUsername = await storage.getUserByUsername(parsed.username);
        if (existingByUsername) {
          res.status(409).json({ message: "Username already taken" });
          return;
        }
      }
      
      const hashedPassword = await bcrypt.hash(parsed.password, 10);
      const user = await storage.createUser({
        email: parsed.email,
        username: parsed.username || null,
        password: hashedPassword,
        name: parsed.name,
      });
      console.log("Created user:", user);
      
      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      
      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatar_url: user.avatar_url,
          is_verified: user.is_verified,
          is_active: user.is_active,
          created_at: user.created_at
        },
        token
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const parsed = insertUserSchema.parse(req.body);
      
      // Try to find user by email first, then by username
      let user = await storage.getUserByEmail(parsed.email);
      if (!user) {
        user = await storage.getUserByUsername(parsed.email); // For backward compatibility
      }
      
      if (!user) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }
      
      const isPasswordValid = await bcrypt.compare(parsed.password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }
      
      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          avatar_url: user.avatar_url,
          is_verified: user.is_verified,
          is_active: user.is_active,
          created_at: user.created_at
        },
        token
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    // For JWT, logout is handled client-side by removing the token
    // Server-side we just return success
    res.status(204).end();
  });

  app.post("/api/auth/reset-password", async (req, res, next) => {
    try {
      const parsed = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(parsed.email);
      // Always respond success to avoid leaking which emails exist
      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
        resetTokens.set(user.id, { token, expiresAt });
        // Log deep link for development purposes
        console.log(`[Auth] Password reset link (dev): godnotes://reset-password?userId=${user.id}&secret=${token}`);
      }
      res.status(204).end();
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  // Confirm password recovery with secret (unauthenticated)
  app.post("/api/auth/recover-password", async (req, res, next) => {
    try {
      const parsed = z.object({
        userId: z.string(),
        secret: z.string(),
        new_password: z.string().min(6),
      }).parse(req.body);

      const entry = resetTokens.get(parsed.userId);
      if (!entry || entry.token !== parsed.secret || entry.expiresAt < Date.now()) {
        res.status(400).json({ message: "Invalid or expired recovery link" });
        return;
      }

      const user = await storage.getUser(parsed.userId);
      if (!user) {
        res.status(400).json({ message: "Invalid user" });
        return;
      }

      const hashed = await bcrypt.hash(parsed.new_password, 10);
      await storage.updateUserPassword(parsed.userId, hashed);
      resetTokens.delete(parsed.userId);
      res.status(204).end();
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.put("/api/auth/password", authenticateToken, async (req, res, next) => {
    try {
      const parsed = z.object({ old_password: z.string(), new_password: z.string().min(6) }).parse(req.body);
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(401).json({ message: "Unauthorized: User not found" });
        return;
      }
      const isPasswordValid = await bcrypt.compare(parsed.old_password, user.password);
      if (!isPasswordValid) {
        res.status(400).json({ message: "Invalid old password" });
        return;
      }
      const hashed = await bcrypt.hash(parsed.new_password, 10);
      await storage.updateUserPassword(userId, hashed);
      res.status(204).end();
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.get("/api/folders", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const folders = await storage.listFoldersByUser(userId);
    res.json(folders);
  });

  app.post("/api/folders", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const parsed = insertFolderSchema.parse(req.body);
      const folder = await storage.createFolder({
        userId,
        name: parsed.name,
        parentId: parsed.parentId ?? null,
      });
      res.status(201).json(folder);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.get("/api/folders/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const folder = await storage.getFolder(req.params.id);
    if (!folder || folder.userId !== userId) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(folder);
  });

  app.patch("/api/folders/:id", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const existing = await storage.getFolder(req.params.id);
      if (!existing || existing.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      const parsed = updateFolderSchema.parse(req.body);
      const updated = await storage.updateFolder(req.params.id, parsed);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.delete("/api/folders/:id", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const existing = await storage.getFolder(req.params.id);
      if (!existing || existing.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      await storage.deleteFolder(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/notes", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const updatedAfterQuery = req.query.updatedAfter;
    let updatedAfter: Date | undefined;
    
    if (typeof updatedAfterQuery === 'string') {
        const parsed = new Date(updatedAfterQuery);
        if (!isNaN(parsed.getTime())) {
            updatedAfter = parsed;
        }
    }

    const notes = await storage.listNotesByUser(userId, updatedAfter);
    res.json(notes);
  });

  app.post("/api/notes", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const parsed = insertNoteSchema.parse(req.body);
      const note = await storage.createNote({
        userId,
        title: parsed.title,
        content: parsed.content ?? "",
        folderId: parsed.folderId ?? null,
        isFavorite: parsed.isFavorite ?? false,
      });
      res.status(201).json(note);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.get("/api/notes/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const note = await storage.getNote(req.params.id);
    if (!note || note.userId !== userId) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(note);
  });

  app.patch("/api/notes/:id", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const existing = await storage.getNote(req.params.id);
      if (!existing || existing.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      console.log('PATCH /api/notes/:id req.body:', req.body); // Добавлено логирование
      const parsed = updateNoteSchema.parse(req.body);
      const updated = await storage.updateNote(req.params.id, parsed);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error('ZodError issues:', err.issues); // Добавлено логирование
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.delete("/api/notes/:id", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const existing = await storage.getNote(req.params.id);
      if (!existing || existing.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      await storage.deleteNote(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/users", async (req, res, next) => {
    try {
      const parsed = insertUserSchema.parse(req.body);
      const user = await storage.createUser(parsed);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(user);
  });

  app.get("/api/users/by-username/:username", async (req, res) => {
    const user = await storage.getUserByUsername(req.params.username);
    if (!user) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(user);
  });

  app.get("/api/trash", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    console.log(`[API] GET /api/trash for user ${userId}`);
    const trash = await storage.getTrash(userId);
    console.log(`[API] Found trash: ${trash.folders.length} folders, ${trash.notes.length} notes`);
    res.json(trash);
  });

  app.get("/api/favorites", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const favorites = await storage.getFavorites(userId);
    res.json(favorites);
  });

  app.post("/api/trash/restore/folder/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const folder = await storage.getFolder(req.params.id);
    if (!folder || folder.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    await storage.restoreFolder(req.params.id);
    res.status(200).json({ message: "Restored" });
  });

  app.post("/api/trash/restore/note/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const note = await storage.getNote(req.params.id);
    if (!note || note.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    await storage.restoreNote(req.params.id);
    res.status(200).json({ message: "Restored" });
  });

  app.delete("/api/trash/folder/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const folder = await storage.getFolder(req.params.id);
    if (!folder || folder.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    await storage.permanentDeleteFolder(req.params.id);
    res.status(204).end();
  });

  // Tasks CRUD
  
  app.get("/api/tasks", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const tasks = await storage.listTasksByUser(userId);
    res.json(tasks.map(serializeTask));
  });

  app.post("/api/tasks", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const parsed = insertTaskSchema.parse(req.body);
      const created = await storage.createTask({
        userId,
        content: parsed.content,
        description: parsed.description,
        callLink: parsed.callLink,
        status: parsed.status,
        parentId: parsed.parentId ?? null,
        dueDate: parsed.dueDate ?? null,
        notify: parsed.notify,
        isNotified: parsed.isNotified,
        priority: parsed.priority,
        tags: parsed.tags,
        recurring: parsed.recurring,
      });
      res.status(201).json(serializeTask(created));
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.get("/api/tasks/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const task = await storage.getTask(req.params.id);
    if (!task || task.userId !== userId) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(serializeTask(task));
  });

  app.patch("/api/tasks/:id", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const existing = await storage.getTask(req.params.id);
      if (!existing || existing.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      const parsed = updateTaskSchema.parse(req.body);
      const updated = await storage.updateTask(req.params.id, {
        ...parsed,
        dueDate: parsed.dueDate,
      });
      res.json(updated ? serializeTask(updated) : undefined);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.delete("/api/tasks/:id", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const existing = await storage.getTask(req.params.id);
      if (!existing || existing.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      await storage.deleteTask(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Duplicate /api/tasks routes removed (handled earlier in file)

  app.patch("/api/notes/:id/public", authenticateToken, async (req, res, next) => {
    try {
      console.log('=== PATCH /api/notes/:id/public DEBUG START ===');
      console.log('Request params:', req.params);
      console.log('Request body:', req.body);
      console.log('User ID from token:', (req as any).userId);
      
      const userId = (req as any).userId;
      const existing = await storage.getNote(req.params.id);
      console.log('Existing note:', existing ? 'found' : 'not found');
      
      if (!existing || existing.userId !== userId) {
        console.log('Note not found or access denied');
        res.status(404).json({ message: "Not found" });
        console.log('=== PATCH /api/notes/:id/public DEBUG END (not found) ===');
        return;
      }
      
      const { isPublic } = req.body;
      console.log('isPublic value:', isPublic);
      
      if (typeof isPublic !== 'boolean') {
        console.log('Invalid isPublic type');
        res.status(400).json({ message: "isPublic must be a boolean" });
        console.log('=== PATCH /api/notes/:id/public DEBUG END (invalid type) ===');
        return;
      }
      
      // Update the note with isPublic field
      console.log('Calling storage.updateNote...');
      const updated = await storage.updateNote(req.params.id, { isPublic });
      console.log('Update result:', updated ? 'success' : 'failed');
      
      const response = { 
        message: "Public access updated",
        isPublic: updated?.isPublic ?? isPublic
      };
      
      console.log('Sending response:', response);
      res.json(response);
      console.log('=== PATCH /api/notes/:id/public DEBUG END (success) ===');
    } catch (err) {
      console.error('API endpoint error:', err);
      console.log('=== PATCH /api/notes/:id/public DEBUG END (error) ===');
      next(err);
    }
  });

  return httpServer;

  // Helper: extract upload filenames from text
  const extractUploadFilenames = (text: string | null | undefined): Set<string> => {
    const result = new Set<string>();
    if (!text) return result;
    const regex = /\/(?:uploads)\/([A-Za-z0-9_-]+\.[A-Za-z0-9]+)/g; // matches /uploads/<hash>.<ext>
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      result.add(m[1]);
    }
    return result;
  };

  // Helper: collect referenced filenames across all users
  const collectAllReferenced = async (): Promise<Set<string>> => {
    const referenced = new Set<string>();
    try {
      const users = await storage.listUsers();
      for (const user of users) {
        const notes = await storage.listNotesByUser(user.id);
        for (const n of notes) {
          for (const f of extractUploadFilenames(n.content)) referenced.add(f);
        }
        const tasks = await storage.listTasksByUser(user.id);
        for (const t of tasks) {
          for (const f of extractUploadFilenames(t.content)) referenced.add(f);
        }
      }
    } catch (e) {
      console.warn('[Uploads] Failed to collect references from storage:', e);
    }
    return referenced;
  };

  app.get('/api/uploads/stats', authenticateToken, async (_req, res) => {
    try {
      const allFiles = await fs.promises.readdir(uploadDir);
      const referenced = await collectAllReferenced();

      let totalSize = 0;
      let orphanSize = 0;
      const orphaned: string[] = [];

      for (const filename of allFiles) {
        const p = path.join(uploadDir, filename);
        const stat = await fs.promises.stat(p);
        totalSize += stat.size;
        if (!referenced.has(filename)) {
          orphanSize += stat.size;
          orphaned.push(filename);
        }
      }

      res.json({
        files: allFiles.length,
        totalSize,
        referenced: referenced.size,
        orphaned: orphaned.length,
        orphanSize,
        orphanedList: orphaned.slice(0, 200)
      });
    } catch (e) {
      console.error('[Uploads] stats error', e);
      res.status(500).json({ message: 'Ошибка получения статистики загрузок' });
    }
  });

  app.post('/api/uploads/cleanup', authenticateToken, async (req, res) => {
    const { dryRun = true } = req.body || {};
    try {
      const allFiles = await fs.promises.readdir(uploadDir);
      const referenced = await collectAllReferenced();
      const orphaned = allFiles.filter((f) => !referenced.has(f));

      if (dryRun) {
        return res.json({ deleted: 0, candidates: orphaned });
      }

      let deleted = 0;
      for (const filename of orphaned) {
        const p = path.join(uploadDir, filename);
        try {
          await fs.promises.unlink(p);
          deleted++;
        } catch (e) {
          console.warn('[Uploads] Failed to delete', filename, e);
        }
      }
      res.json({ deleted });
    } catch (e) {
      console.error('[Uploads] cleanup error', e);
      res.status(500).json({ message: 'Ошибка очистки загрузок' });
    }
  });

  app.post("/api/trash/restore/folder/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const folder = await storage.getFolder(req.params.id);
    if (!folder || folder.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    await storage.restoreFolder(req.params.id);
    res.status(200).json({ message: "Restored" });
  });

  app.post("/api/trash/restore/note/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const note = await storage.getNote(req.params.id);
    if (!note || note.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    await storage.restoreNote(req.params.id);
    res.status(200).json({ message: "Restored" });
  });

  app.delete("/api/trash/folder/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const folder = await storage.getFolder(req.params.id);
    if (!folder || folder.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    await storage.permanentDeleteFolder(req.params.id);
    res.status(204).end();
  });

  // serializeTask definition moved to top of function


  app.get("/api/tasks", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const tasks = await storage.listTasksByUser(userId);
    res.json(tasks.map(serializeTask));
  });

  app.post("/api/tasks", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const parsed = insertTaskSchema.parse(req.body);
      const created = await storage.createTask({
        userId,
        content: parsed.content,
        description: parsed.description,
        callLink: parsed.callLink,
        status: parsed.status,
        parentId: parsed.parentId ?? null,
        dueDate: typeof parsed.dueDate === 'number' ? new Date(parsed.dueDate) : undefined,
        notify: parsed.notify,
        isNotified: parsed.isNotified,
        priority: parsed.priority,
        tags: parsed.tags,
        recurring: parsed.recurring,
      });
      res.status(201).json(serializeTask(created));
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.get("/api/tasks/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const task = await storage.getTask(req.params.id);
    if (!task || task.userId !== userId) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(serializeTask(task));
  });

  app.patch("/api/tasks/:id", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const existing = await storage.getTask(req.params.id);
      if (!existing || existing.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      const parsed = updateTaskSchema.parse(req.body);
      const updated = await storage.updateTask(req.params.id, {
        ...parsed,
        dueDate: typeof parsed.dueDate === 'number' ? new Date(parsed.dueDate) : parsed.dueDate,
      });
      res.json(updated ? serializeTask(updated) : undefined);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.delete("/api/tasks/:id", authenticateToken, async (req, res, next) => {
    try {
      const userId = (req as any).userId;
      const existing = await storage.getTask(req.params.id);
      if (!existing || existing.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      await storage.deleteTask(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return httpServer;
}
