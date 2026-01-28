import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage, setStoragePath } from "./storage";
import {
  insertUserSchema,
  insertFolderSchema,
  updateFolderSchema,
  insertNoteSchema,
  updateNoteSchema,
} from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer, { type FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";

const JWT_SECRET = "your_very_secure_session_secret_change_this_immediately";
const JWT_EXPIRES_IN = "24h";

console.log('JWT_SECRET:', JWT_SECRET);

// Middleware для проверки JWT
const authenticateToken = (req: Request, res: any, next: any) => {
  console.log('authenticateToken called');
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No valid authorization header');
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  const token = authHeader.substring(7);
  
  try {
    console.log('Verifying token with secret:', JWT_SECRET);
    console.log('Token to verify:', token);
    const decoded: any = jwt.verify(token, JWT_SECRET);
    console.log('Decoded token:', decoded);
    (req as any).userId = decoded.userId;
    next();
  } catch (error: any) {
    console.log('Token verification failed:', error.message);
    console.log('Error name:', error.name);
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

  app.use("/uploads", (await import("express")).default.static(uploadDir));

  app.post("/api/uploads", (req, res) => {
    upload.single("file")(req as Request, res, (err) => {
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

      const url = `/uploads/${file.filename}`;
      res.status(201).json({ url });
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
    console.log('GET /api/auth/me called');
    const authHeader = req.headers.authorization;
    console.log('Authorization header:', authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid authorization header');
      res.status(401).json({ message: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.substring(7);
    console.log('Token extracted:', token);
    
    try {
      console.log('Verifying token with secret:', JWT_SECRET);
      const decoded: any = jwt.verify(token, JWT_SECRET);
      console.log('Decoded token:', decoded);
      const userId = decoded.userId;
      
      let user = await storage.getUser(userId);
      console.log('User found:', user);
      
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
      console.log('Token verification failed:', error.message);
      console.log('Error name:', error.name);
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
    const notes = await storage.listNotesByUser(userId);
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
      const parsed = updateNoteSchema.parse(req.body);
      const updated = await storage.updateNote(req.params.id, parsed);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
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

  app.delete("/api/trash/note/:id", authenticateToken, async (req, res) => {
    const userId = (req as any).userId;
    const note = await storage.getNote(req.params.id);
    if (!note || note.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    await storage.permanentDeleteNote(req.params.id);
    res.status(204).end();
  });

  return httpServer;
}
