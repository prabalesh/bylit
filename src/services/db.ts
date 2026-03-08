import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const initDB = async () => {
    if (db) return db;

    db = await SQLite.openDatabaseAsync('bylit.db');

    await db.execAsync(`
        PRAGMA journal_mode = WAL;
        
        CREATE TABLE IF NOT EXISTS settings (
            id TEXT PRIMARY KEY NOT NULL,
            remote_id TEXT,
            base_currency TEXT NOT NULL DEFAULT 'INR',
            font_size TEXT NOT NULL DEFAULT 'medium',
            icon_size TEXT NOT NULL DEFAULT 'medium',
            reminder_enabled INTEGER NOT NULL DEFAULT 0,
            reminder_hour INTEGER NOT NULL DEFAULT 20,
            reminder_minute INTEGER NOT NULL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'synced' -- 'synced', 'pending'
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY NOT NULL,
            remote_id TEXT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            balance REAL NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'INR',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'synced'
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY NOT NULL,
            remote_id TEXT,
            user_id TEXT,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'all',
            icon_slug TEXT NOT NULL,
            color_hex TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'synced'
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY NOT NULL,
            remote_id TEXT,
            account_id TEXT NOT NULL,
            to_account_id TEXT,
            paid INTEGER NOT NULL DEFAULT 0,
            sync_status TEXT NOT NULL DEFAULT 'synced'
        );

        CREATE TABLE IF NOT EXISTS split_bills (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            total_amount REAL NOT NULL,
            category TEXT,
            notes TEXT,
            date TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'synced'
        );

        CREATE TABLE IF NOT EXISTS split_participants (
            id TEXT PRIMARY KEY NOT NULL,
            split_bill_id TEXT NOT NULL,
            name TEXT NOT NULL,
            contact_id TEXT,
            phone TEXT,
            share REAL NOT NULL,
            paid INTEGER NOT NULL DEFAULT 0,
            sync_status TEXT NOT NULL DEFAULT 'synced',
            FOREIGN KEY (split_bill_id) REFERENCES split_bills (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            account_id TEXT NOT NULL,
            category_id TEXT,
            type TEXT NOT NULL,
            frequency TEXT NOT NULL,
            start_date TEXT NOT NULL,
            next_due_date TEXT NOT NULL,
            reminder_days INTEGER NOT NULL DEFAULT 0,
            last_processed_date TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'synced'
        );
    `);

    // Migrate existing settings table (safe no-op if columns already exist)
    const migrateColumns = [
        `ALTER TABLE settings ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 0`,
        `ALTER TABLE settings ADD COLUMN reminder_hour INTEGER NOT NULL DEFAULT 20`,
        `ALTER TABLE settings ADD COLUMN reminder_minute INTEGER NOT NULL DEFAULT 0`,
        `ALTER TABLE transactions ADD COLUMN to_account_id TEXT`,
    ];
    for (const stmt of migrateColumns) {
        try { await db.execAsync(stmt); } catch { /* column already exists */ }
    }

    return db;
};

export const getDB = () => {
    if (!db) throw new Error('Database not initialized');
    return db;
};
