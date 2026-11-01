import * as SQLite from 'expo-sqlite';

let db = null;

const getDb = () => {
    if (!db) {
        try {
            db = SQLite.openDatabaseSync('lorek.db');
        } catch (error) {
            console.warn('Failed to open database synchronously, fallback or web mode:', error);
        }
    }
    return db;
};

export const initDb = async () => {
    try {
        const database = getDb();
        if (database && typeof database.execAsync === 'function') {
            await database.execAsync(`
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
                CREATE TABLE IF NOT EXISTS downloaded_language_packs (
                    code TEXT PRIMARY KEY,
                    name TEXT,
                    uri TEXT,
                    version TEXT
                );
            `);
        }
    } catch (error) {
        console.warn('Database initialization warning:', error);
    }
};

const dbProxy = new Proxy({}, {
    get(target, prop) {
        const database = getDb();
        if (database && typeof database[prop] === 'function') {
            return database[prop].bind(database);
        }
        return database?.[prop];
    }
});

export default dbProxy;
