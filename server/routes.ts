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
import multer, { type FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";

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
    let userId = req.session.userId;
    if (!userId) {
      // Try auto-adopt logic if no session (optional, but mainly for when session exists but user is wrong)
      // Actually, if no session, we just return 401 usually.
      // But let's check if there is exactly one user in the DB and we are in "local" mode.
      // For now, adhere to standard flow: no session -> 401.
      // console.log("[Auth] No userId in session");
      res.status(401).json({ message: "Unauthorized: No session" });
      return;
    }

    let user = await storage.getUser(userId);
    
    // Auto-adopt logic: If session user is invalid, but there is exactly one user in storage, use that one.
    if (!user) {
        console.log(`[Auth] User ${userId} not found. Attempting auto-adopt...`);
        const allUsers = await storage.listUsers();
        if (allUsers.length === 1) {
            user = allUsers[0];
            console.log(`[Auth] Auto-adopted single user: ${user.username} (${user.id})`);
            req.session.userId = user.id; // Update session
            userId = user.id;
        }
    }

    if (!user) {
      console.log(`[Auth] User ${userId} not found in current storage. Storage type: ${storage.getBackendName()}`);
      // Debug: Check if any users exist
      const allUsers = await storage.listUsers();
      const availableUsers = allUsers.map(u => u.id);
      
      console.log(`[Auth] Available users in storage: ${availableUsers.join(', ')}`);
      
      res.status(401).json({ 
          message: "Unauthorized: User not found", 
          details: {
              userId,
              storageType: storage.getBackendName(),
              availableUsersCount: availableUsers.length,
              // Only include IDs for debug, avoiding personal info leakage if possible, but here IDs are UUIDs
              availableUsers
          }
      });
      return;
    }

    res.json({ id: user.id, username: user.username, name: user.name });
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      console.log("Register body:", req.body);
      const parsed = insertUserSchema.parse(req.body);
      console.log("Parsed:", parsed);
      const existing = await storage.getUserByUsername(parsed.username);
      if (existing) {
        res.status(409).json({ message: "User already exists" });
        return;
      }
      const hashedPassword = await bcrypt.hash(parsed.password, 10);
      const user = await storage.createUser({
        username: parsed.username,
        password: hashedPassword,
        name: parsed.name,
      });
      console.log("Created user:", user);
      req.session.userId = user.id;
      res.status(201).json({ id: user.id, username: user.username, name: user.name });
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
      const user = await storage.getUserByUsername(parsed.username);
      if (!user) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }
      const isPasswordValid = await bcrypt.compare(parsed.password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }
      req.session.userId = user.id;
      res.json({ id: user.id, username: user.username, name: user.name });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid payload", issues: err.issues });
        return;
      }
      next(err);
    }
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.session.destroy((err) => {
      if (err) {
        next(err);
        return;
      }
      res.status(204).end();
    });
  });

  app.get("/api/folders", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const folders = await storage.listFoldersByUser(userId);
    res.json(folders);
  });

  app.post("/api/folders", async (req, res, next) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
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

  app.get("/api/folders/:id", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const folder = await storage.getFolder(req.params.id);
    if (!folder || folder.userId !== userId) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(folder);
  });

  app.patch("/api/folders/:id", async (req, res, next) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
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

  app.delete("/api/folders/:id", async (req, res, next) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
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

  app.get("/api/notes", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const notes = await storage.listNotesByUser(userId);
    res.json(notes);
  });

  app.post("/api/notes", async (req, res, next) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
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

  app.get("/api/notes/:id", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const note = await storage.getNote(req.params.id);
    if (!note || note.userId !== userId) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(note);
  });

  app.patch("/api/notes/:id", async (req, res, next) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
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

  app.delete("/api/notes/:id", async (req, res, next) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
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

  app.get("/api/trash", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    console.log(`[API] GET /api/trash for user ${userId}`);
    const trash = await storage.getTrash(userId);
    console.log(`[API] Found trash: ${trash.folders.length} folders, ${trash.notes.length} notes`);
    res.json(trash);
  });

  app.get("/api/favorites", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const favorites = await storage.getFavorites(userId);
    res.json(favorites);
  });

  app.post("/api/trash/restore/folder/:id", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const folder = await storage.getFolder(req.params.id);
    if (!folder || folder.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    await storage.restoreFolder(req.params.id);
    res.status(200).json({ message: "Restored" });
  });

  app.post("/api/trash/restore/note/:id", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const note = await storage.getNote(req.params.id);
    if (!note || note.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    await storage.restoreNote(req.params.id);
    res.status(200).json({ message: "Restored" });
  });

  app.delete("/api/trash/folder/:id", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const folder = await storage.getFolder(req.params.id);
    if (!folder || folder.userId !== userId) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    await storage.permanentDeleteFolder(req.params.id);
    res.status(204).end();
  });

  app.delete("/api/trash/note/:id", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
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
