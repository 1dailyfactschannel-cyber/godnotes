import session from "express-session";
import fs from "fs";
import path from "path";

const SESSION_FILE = path.join(process.cwd(), ".sessions.json");

interface StoredSession {
  cookie: any;
  content: session.SessionData;
  expires: number;
}

export class FileSessionStore extends session.Store {
  private sessions: Map<string, StoredSession>;

  constructor() {
    super();
    this.sessions = new Map();
    this.loadFromFile();
  }

  private loadFromFile() {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
        const data = JSON.parse(raw);
        const now = Date.now();
        let count = 0;
        
        Object.entries(data).forEach(([sid, sess]: [string, any]) => {
          if (sess.expires > now) {
            this.sessions.set(sid, sess);
            count++;
          }
        });
        console.log(`[FileSessionStore] Loaded ${count} sessions from ${SESSION_FILE}`);
      } else {
        console.log(`[FileSessionStore] No session file found at ${SESSION_FILE}`);
      }
    } catch (e) {
      console.error("[FileSessionStore] Failed to load sessions", e);
    }
  }

  private saveToFile() {
    try {
      const data = Object.fromEntries(this.sessions.entries());
      fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error("[FileSessionStore] Failed to save sessions", e);
    }
  }

  get = (sid: string, callback: (err: any, session?: session.SessionData | null) => void): void => {
    const sess = this.sessions.get(sid);
    if (!sess) {
      // console.log(`[FileSessionStore] Session not found: ${sid}`);
      return callback(null, null);
    }

    const now = Date.now();
    if (sess.expires && sess.expires < now) {
      console.log(`[FileSessionStore] Session expired: ${sid}`);
      this.destroy(sid, (err) => callback(err, null));
      return;
    }

    // Ensure cookie expires is a Date if it exists
    if (sess.content.cookie && sess.content.cookie.expires && typeof sess.content.cookie.expires === 'string') {
       sess.content.cookie.expires = new Date(sess.content.cookie.expires);
    }

    callback(null, sess.content);
  }

  set = (sid: string, sessionData: session.SessionData, callback?: (err?: any) => void): void => {
    try {
      let expires = Date.now() + 86400000; // default 1 day fallback
      if (sessionData.cookie && sessionData.cookie.expires) {
        expires = new Date(sessionData.cookie.expires).getTime();
      } else if (sessionData.cookie && sessionData.cookie.maxAge) {
        expires = Date.now() + sessionData.cookie.maxAge;
      }

      this.sessions.set(sid, {
        cookie: sessionData.cookie,
        content: sessionData,
        expires
      });
      this.saveToFile();
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  destroy = (sid: string, callback?: (err?: any) => void): void => {
    try {
      this.sessions.delete(sid);
      this.saveToFile();
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  touch = (sid: string, sessionData: session.SessionData, callback?: (err?: any) => void): void => {
    const current = this.sessions.get(sid);
    if (current) {
      current.content = sessionData;
      // Update expiry if needed, usually touch updates maxAge
      if (sessionData.cookie && sessionData.cookie.expires) {
        current.expires = new Date(sessionData.cookie.expires).getTime();
      }
      this.saveToFile();
    }
    if (callback) callback(null);
  }
}
