import type { Database } from "bun:sqlite";
import { generateUlid } from "../lib/ulid";

const API_KEY_PREFIX = "ask";
const API_KEY_BYTES = 24;

export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(API_KEY_BYTES));
  const encoded = Buffer.from(bytes).toString("base64url");
  return `${API_KEY_PREFIX}_${encoded}`;
}

export async function hashApiKey(rawKey: string): Promise<string> {
  const data = new TextEncoder().encode(rawKey);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("hex");
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  created_at: number;
  last_used_at: number | null;
}

export async function createApiKey(
  db: Database,
  userId: string,
  name: string,
): Promise<{ id: string; rawKey: string; keyPrefix: string; createdAt: number }> {
  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);
  const id = generateUlid();
  const createdAt = Date.now();

  db.query(
    `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, name, keyHash, keyPrefix, createdAt);

  return { id, rawKey, keyPrefix, createdAt };
}

export function findByKeyHash(db: Database, keyHash: string): ApiKeyRow | null {
  return db.query("SELECT * FROM api_keys WHERE key_hash = ?").get(keyHash) as ApiKeyRow | null;
}

export function listByUser(db: Database, userId: string): ApiKeyRow[] {
  return db
    .query("SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as ApiKeyRow[];
}

export function deleteApiKey(db: Database, keyId: string, userId: string): boolean {
  const result = db.query("DELETE FROM api_keys WHERE id = ? AND user_id = ?").run(keyId, userId);
  return result.changes > 0;
}

export function updateLastUsed(db: Database, keyId: string): void {
  db.query("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(Date.now(), keyId);
}
