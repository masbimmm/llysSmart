import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient, type Client } from '@libsql/client';
import * as schema from './schema/index';

const globalForDb = globalThis as unknown as {
  __llysDbClient?: Client;
  __llysDb?: LibSQLDatabase<typeof schema>;
  __llysPragmaInit?: boolean;
};

const client =
  globalForDb.__llysDbClient ??
  createClient({
    url: process.env.DATABASE_URL ?? 'file:local.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__llysDbClient = client;
}

if (!globalForDb.__llysPragmaInit) {
  globalForDb.__llysPragmaInit = true;
  const dbUrl = process.env.DATABASE_URL ?? 'file:local.db';
  if (dbUrl.startsWith('file:')) {
    void (async () => {
      try {
        await client.batch([
          'PRAGMA journal_mode = WAL;',
          'PRAGMA synchronous = NORMAL;',
          'PRAGMA busy_timeout = 5000;',
          'PRAGMA temp_store = MEMORY;',
          'PRAGMA cache_size = -20000;',
          'PRAGMA foreign_keys = ON;',
        ]);
        for (const col of ['custom_nick', 'tag1', 'tag2', 'tag3', 'custom_colors', 'unlocked_bodies', 'equipped_body']) {
          try {
            await client.execute(`ALTER TABLE users ADD COLUMN ${col} TEXT;`);
          } catch {}
        }
        try {
          await client.execute(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER DEFAULT (unixepoch()));`);
        } catch {}
      } catch {}
    })();
  }
}

export const db = globalForDb.__llysDb ?? drizzle(client, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__llysDb = db;
}
