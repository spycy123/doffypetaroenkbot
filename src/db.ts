import path from 'path';
import fs from 'fs';
import { ChatMessage } from './llm/types';

// Load better-sqlite3 secara dinamis agar aman di serverless Vercel
let DatabaseConstructor: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DatabaseConstructor = require('better-sqlite3');
} catch (e) {
  // Module native SQLite tidak tersedia pada environment serverless (AWS Lambda Vercel)
}

let dbInstance: any = null;
let useMemoryFallback = false;
const inMemoryStore = new Map<number, ChatMessage[]>();

export function getDatabase(customPath?: string): any {
  if (useMemoryFallback || !DatabaseConstructor) return null;
  if (dbInstance) return dbInstance;

  try {
    // Pada lingkungan serverless Vercel, hanya folder /tmp yang bisa ditulis
    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const dbDir = isVercel ? '/tmp/data' : path.join(process.cwd(), 'data');

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbFilePath = customPath || path.join(dbDir, 'bot.db');
    const db = new DatabaseConstructor(dbFilePath);

    // Optimasi performa SQLite (WAL mode)
    try {
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
    } catch {
      // Abaikan jika filesystem tidak mendukung WAL (misal di /tmp)
    }

    // Buat tabel pesan jika belum ada
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
    `);

    dbInstance = db;
    return db;
  } catch (err) {
    console.warn('[DB WARNING] Gagal menginisialisasi SQLite, beralih ke in-memory store:', err);
    useMemoryFallback = true;
    return null;
  }
}

/**
 * Menyimpan satu pesan ke dalam SQLite atau Memory
 */
export function saveMessage(userId: number, role: 'user' | 'assistant', content: string): void {
  const db = getDatabase();
  if (db) {
    try {
      const stmt = db.prepare('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)');
      stmt.run(userId, role, content);
      return;
    } catch (err) {
      console.warn('[DB WARNING] Error saat simpan ke SQLite, simpan ke memory:', err);
    }
  }

  // Fallback memory
  const userList = inMemoryStore.get(userId) || [];
  userList.push({ role, content });
  inMemoryStore.set(userId, userList);
}

/**
 * Mengambil riwayat percakapan terbaru milik user secara kronologis
 */
export function getHistory(userId: number, limit: number): ChatMessage[] {
  const db = getDatabase();
  if (db) {
    try {
      const stmt = db.prepare(`
        SELECT role, content
        FROM (
          SELECT id, role, content
          FROM messages
          WHERE user_id = ?
          ORDER BY id DESC
          LIMIT ?
        ) sub
        ORDER BY id ASC
      `);

      const rows = stmt.all(userId, limit) as { role: 'user' | 'assistant'; content: string }[];
      return rows.map((r) => ({
        role: r.role,
        content: r.content,
      }));
    } catch (err) {
      console.warn('[DB WARNING] Error saat baca SQLite, baca dari memory:', err);
    }
  }

  // Fallback memory
  const userList = inMemoryStore.get(userId) || [];
  return userList.slice(-limit);
}

/**
 * Menghapus seluruh riwayat percakapan milik user (/reset)
 */
export function clearHistory(userId: number): number {
  const db = getDatabase();
  let count = 0;
  if (db) {
    try {
      const stmt = db.prepare('DELETE FROM messages WHERE user_id = ?');
      const info = stmt.run(userId);
      count = info.changes;
    } catch (err) {
      console.warn('[DB WARNING] Error saat reset SQLite:', err);
    }
  }

  const memCount = (inMemoryStore.get(userId) || []).length;
  inMemoryStore.delete(userId);
  return count || memCount;
}

/**
 * Menghapus pesan-pesan lama yang sudah melebihi batas riwayat
 */
export function pruneOldMessages(userId: number, keepCount: number): number {
  const db = getDatabase();
  if (db) {
    try {
      const stmt = db.prepare(`
        DELETE FROM messages
        WHERE user_id = ?
          AND id NOT IN (
            SELECT id FROM messages
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
          )
      `);
      const info = stmt.run(userId, userId, keepCount);
      return info.changes;
    } catch {
      // Abaikan jika gagal
    }
  }

  const list = inMemoryStore.get(userId) || [];
  if (list.length > keepCount) {
    inMemoryStore.set(userId, list.slice(-keepCount));
  }
  return 0;
}

/**
 * Menutup koneksi database dengan rapi
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
      console.log('📦 Database SQLite berhasil ditutup.');
    } catch (err) {
      console.error('Error saat menutup database SQLite:', err);
    } finally {
      dbInstance = null;
    }
  }
}
