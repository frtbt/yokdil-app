import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';

export interface Stroke {
  id: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export interface TextAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
}

let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openDB(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('yokdil.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS downloads (
       doc_id        INTEGER PRIMARY KEY,
       local_uri     TEXT NOT NULL,
       file_size     TEXT,
       downloaded_at TEXT DEFAULT (datetime('now'))
     );`,
  );
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS annotations (
       doc_id     INTEGER NOT NULL,
       page       INTEGER NOT NULL,
       data       TEXT    NOT NULL DEFAULT '[]',
       updated_at TEXT DEFAULT (datetime('now')),
       PRIMARY KEY (doc_id, page)
     );`,
  );
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS text_annotations (
       doc_id     INTEGER NOT NULL,
       page       INTEGER NOT NULL,
       data       TEXT    NOT NULL DEFAULT '[]',
       updated_at TEXT DEFAULT (datetime('now')),
       PRIMARY KEY (doc_id, page)
     );`,
  );
  _db = db;
  return db;
}

export function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return Promise.resolve(_db);
  if (!_initPromise) {
    _initPromise = openDB().catch((e) => {
      _initPromise = null;
      throw e;
    });
  }
  return _initPromise;
}

export async function initDatabaseSilently(): Promise<void> {
  try {
    await getDB();
  } catch {}
}

// ── Downloads ─────────────────────────────────────────────────────────────────

export async function saveDownload(docId: number, localUri: string, fileSize: string): Promise<void> {
  try {
    const db = await getDB();
    await db.runAsync(
      `INSERT INTO downloads (doc_id, local_uri, file_size)
       VALUES (?, ?, ?)
       ON CONFLICT(doc_id) DO UPDATE SET
         local_uri = excluded.local_uri,
         file_size = excluded.file_size,
         downloaded_at = datetime('now')`,
      [docId, localUri, fileSize],
    );
  } catch {}
}

export async function getDownloadUri(docId: number): Promise<string | null> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync<{ local_uri: string }>(
      'SELECT local_uri FROM downloads WHERE doc_id = ?',
      [docId],
    );
    if (!row || !row.local_uri) return null;
    const info = await FileSystem.getInfoAsync(row.local_uri);
    if (!info.exists) {
      try { await db.runAsync('DELETE FROM downloads WHERE doc_id = ?', [docId]); } catch {}
      return null;
    }
    return row.local_uri;
  } catch {
    return null;
  }
}

export async function removeDownload(docId: number): Promise<void> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync<{ local_uri: string }>(
      'SELECT local_uri FROM downloads WHERE doc_id = ?',
      [docId],
    );
    if (row) {
      await FileSystem.deleteAsync(row.local_uri, { idempotent: true });
      await db.runAsync('DELETE FROM downloads WHERE doc_id = ?', [docId]);
    }
  } catch {}
}

// ── Annotations ───────────────────────────────────────────────────────────────

export async function loadAnnotations(docId: number, page: number): Promise<Stroke[]> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync<{ data: string }>(
      'SELECT data FROM annotations WHERE doc_id = ? AND page = ?',
      [docId, page],
    );
    return row ? (JSON.parse(row.data) as Stroke[]) : [];
  } catch {
    return [];
  }
}

export async function saveAnnotations(
  docId: number,
  page: number,
  strokes: Stroke[],
): Promise<void> {
  try {
    const db = await getDB();
    await db.runAsync(
      `INSERT INTO annotations (doc_id, page, data, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(doc_id, page) DO UPDATE SET
         data = excluded.data,
         updated_at = excluded.updated_at`,
      [docId, page, JSON.stringify(strokes)],
    );
  } catch {}
}

// ── Text Annotations ──────────────────────────────────────────────────────────

export async function loadTextAnnotations(docId: number, page: number): Promise<TextAnnotation[]> {
  try {
    const db = await getDB();
    const row = await db.getFirstAsync<{ data: string }>(
      'SELECT data FROM text_annotations WHERE doc_id = ? AND page = ?',
      [docId, page],
    );
    return row ? (JSON.parse(row.data) as TextAnnotation[]) : [];
  } catch {
    return [];
  }
}

export async function saveTextAnnotations(
  docId: number,
  page: number,
  annotations: TextAnnotation[],
): Promise<void> {
  try {
    const db = await getDB();
    await db.runAsync(
      `INSERT INTO text_annotations (doc_id, page, data, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(doc_id, page) DO UPDATE SET
         data = excluded.data,
         updated_at = excluded.updated_at`,
      [docId, page, JSON.stringify(annotations)],
    );
  } catch {}
}
