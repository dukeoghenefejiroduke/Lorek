import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('lorek.db');

export const initDb = async () => {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_event_id TEXT NOT NULL UNIQUE,
            method TEXT NOT NULL,
            url TEXT NOT NULL,
            payload TEXT NOT NULL,
            client_version TEXT,
            occurred_at DATETIME,
            synced INTEGER DEFAULT 0,
            retry_count INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS lessons (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
    `);
};

export default db;
