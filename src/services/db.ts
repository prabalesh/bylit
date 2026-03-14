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
            reminder_times TEXT, -- JSON string of [{hour, minute}]
            sync_status TEXT NOT NULL DEFAULT 'synced' -- 'synced', 'pending'
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY NOT NULL,
            remote_id TEXT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            balance REAL NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'INR',
            bank_type TEXT,
            is_credit_card INTEGER DEFAULT 0,
            statement_day INTEGER,
            due_day INTEGER,
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
            category_id TEXT,
            amount REAL NOT NULL DEFAULT 0,
            remaining_amount REAL,
            currency TEXT NOT NULL DEFAULT 'INR',
            type TEXT NOT NULL DEFAULT 'expense',
            description TEXT,
            date TEXT NOT NULL,
            person_name TEXT,
            due_date TEXT,
            settled_status INTEGER NOT NULL DEFAULT 0,
            related_id TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'synced'
        );

        CREATE TABLE IF NOT EXISTS split_bills (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            total_amount REAL NOT NULL,
            category TEXT,
            notes TEXT,
            date TEXT NOT NULL,
            account_id TEXT,
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
            is_me INTEGER NOT NULL DEFAULT 0,
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
            subscription_type TEXT NOT NULL DEFAULT 'other',
            frequency TEXT NOT NULL,
            time TEXT NOT NULL DEFAULT '09:00',
            start_date TEXT NOT NULL,
            next_due_date TEXT NOT NULL,
            reminder_days INTEGER NOT NULL DEFAULT 0,
            last_processed_date TEXT,
            is_estimated INTEGER NOT NULL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'synced'
        );

        CREATE TABLE IF NOT EXISTS budgets (
            id TEXT PRIMARY KEY NOT NULL,
            remote_id TEXT,
            user_id TEXT,
            account_id TEXT,
            category_id TEXT,
            monthly_limit REAL NOT NULL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'synced'
        );

    `);

    // Migrate existing settings table (safe no-op if columns already exist)
    const migrateColumns = [
        `ALTER TABLE settings ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 0`,
        `ALTER TABLE settings ADD COLUMN reminder_hour INTEGER NOT NULL DEFAULT 20`,
        `ALTER TABLE settings ADD COLUMN reminder_minute INTEGER NOT NULL DEFAULT 0`,
        `ALTER TABLE subscriptions ADD COLUMN subscription_type TEXT NOT NULL DEFAULT 'other'`,
        `ALTER TABLE subscriptions ADD COLUMN time TEXT NOT NULL DEFAULT '09:00'`,
        `ALTER TABLE subscriptions ADD COLUMN is_estimated INTEGER NOT NULL DEFAULT 0`,
        `ALTER TABLE split_bills ADD COLUMN account_id TEXT`,
        `ALTER TABLE split_participants ADD COLUMN is_me INTEGER NOT NULL DEFAULT 0`,
        // Missing columns for budgets
        `ALTER TABLE budgets ADD COLUMN user_id TEXT`,
        `ALTER TABLE budgets ADD COLUMN remote_id TEXT`,
        `ALTER TABLE budgets ADD COLUMN account_id TEXT`,
        `ALTER TABLE budgets ADD COLUMN category_id TEXT`,
        `ALTER TABLE budgets ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
        // Missing columns for transactions
        `ALTER TABLE transactions ADD COLUMN category_id TEXT`,
        `ALTER TABLE transactions ADD COLUMN amount REAL NOT NULL DEFAULT 0`,
        `ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR'`,
        `ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'`,
        `ALTER TABLE transactions ADD COLUMN description TEXT`,
        `ALTER TABLE transactions ADD COLUMN date TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)`,
        `ALTER TABLE transactions ADD COLUMN person_name TEXT`,
        `ALTER TABLE transactions ADD COLUMN due_date TEXT`,
        `ALTER TABLE transactions ADD COLUMN settled_status INTEGER NOT NULL DEFAULT 0`,
        `ALTER TABLE transactions ADD COLUMN related_id TEXT`,
        `ALTER TABLE transactions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
        // Missing columns for categories
        `ALTER TABLE categories ADD COLUMN user_id TEXT`,
        `ALTER TABLE categories ADD COLUMN remote_id TEXT`,
        // Missing columns for accounts
        `ALTER TABLE accounts ADD COLUMN remote_id TEXT`,
        `ALTER TABLE accounts ADD COLUMN bank_type TEXT`,
        `ALTER TABLE accounts ADD COLUMN is_credit_card INTEGER DEFAULT 0`,
        // Missing columns for transactions
        `ALTER TABLE transactions ADD COLUMN remaining_amount REAL`,
        `ALTER TABLE settings ADD COLUMN reminder_times TEXT`,
        `ALTER TABLE accounts ADD COLUMN statement_day INTEGER`,
        `ALTER TABLE accounts ADD COLUMN due_day INTEGER`,
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
