import { getDB } from './db';
import { Transaction, Account, Category, Settings, Budget, SplitBill, SplitParticipant, Subscription } from '../types/api';

const generateId = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

export class Repository {
    // Accounts
    static async getAccounts(): Promise<Account[]> {
        const db = getDB();
        const results = await db.getAllAsync<any>('SELECT * FROM accounts WHERE sync_status != "deleted"');
        return results.map((row: any) => ({
            id: row.id,
            name: row.name,
            type: row.type,
            balance: row.balance,
            createdAt: row.updated_at,
            updatedAt: row.updated_at
        }));
    }

    static async saveAccount(account: Partial<Account>): Promise<void> {
        const db = getDB();
        const id = account.id || generateId();
        await db.runAsync(
            `INSERT OR REPLACE INTO accounts (id, name, type, balance, sync_status) 
             VALUES (?, ?, ?, ?, ?)`,
            [id, account.name || '', account.type || 'Bank', account.balance || 0, 'synced']
        );
    }

    // Transactions
    static async getTransactions(startDate?: Date, endDate?: Date, accountId?: string): Promise<Transaction[]> {
        const db = getDB();
        let query = 'SELECT * FROM transactions WHERE sync_status != "deleted"';
        const params: any[] = [];

        if (startDate && endDate) {
            query += ' AND date BETWEEN ? AND ?';
            params.push(startDate.toISOString(), endDate.toISOString());
        }

        if (accountId) {
            query += ' AND account_id = ?';
            params.push(accountId);
        }

        query += ' ORDER BY date DESC';
        const results = await db.getAllAsync<any>(query, params);

        return results.map(this.mapRowToTransaction.bind(this));
    }

    private static mapRowToTransaction(row: any): Transaction {
        return {
            id: row.id,
            accountId: row.account_id,
            toAccountId: row.to_account_id,
            categoryId: row.category_id,
            amount: row.amount,
            currency: row.currency,
            type: row.type,
            description: row.description,
            date: row.date,
            personName: row.person_name,
            dueDate: row.due_date,
            settledStatus: row.settled_status === 1,
            createdAt: row.updated_at,
            updatedAt: row.updated_at
        };
    }

    private static async applyBalanceImpact(tx: Partial<Transaction>, isRevert: boolean = false): Promise<void> {
        if (!tx.accountId || !tx.amount) return;

        const db = getDB();
        const multiplier = isRevert ? -1 : 1;

        if (tx.type === 'transfer') {
            if (!tx.toAccountId) return;
            // Subtract from source
            await db.runAsync(
                'UPDATE accounts SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [tx.amount * multiplier, tx.accountId]
            );
            // Add to destination
            await db.runAsync(
                'UPDATE accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [tx.amount * multiplier, tx.toAccountId]
            );
            return;
        }

        let balanceChange = 0;
        switch (tx.type) {
            case 'expense':
            case 'lend':
                balanceChange = -tx.amount * multiplier;
                break;
            case 'income':
            case 'borrow':
                balanceChange = tx.amount * multiplier;
                break;
            default:
                return;
        }

        await db.runAsync(
            'UPDATE accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [balanceChange, tx.accountId]
        );
    }

    static async saveTransaction(tx: Partial<Transaction>): Promise<void> {
        const db = getDB();
        const id = tx.id || generateId();

        // If update, revert old impact first
        if (tx.id) {
            const oldRow = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?', [tx.id]);
            if (oldRow) {
                const oldTx = this.mapRowToTransaction(oldRow);
                await this.applyBalanceImpact(oldTx, true);
            }
        }

        await db.runAsync(
            `INSERT OR REPLACE INTO transactions 
            (id, account_id, to_account_id, category_id, amount, currency, type, description, date, person_name, due_date, settled_status, sync_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                tx.accountId || '',
                tx.toAccountId || null,
                tx.categoryId || null,
                tx.amount || 0,
                tx.currency || 'INR',
                tx.type || 'expense',
                tx.description || '',
                tx.date || new Date().toISOString(),
                tx.personName || null,
                tx.dueDate || null,
                tx.settledStatus ? 1 : 0,
                'synced'
            ]
        );

        // Apply new impact
        const newTx = { ...tx, id };
        await this.applyBalanceImpact(newTx as Transaction);
    }

    static async deleteTransaction(id: string): Promise<void> {
        const db = getDB();
        const row = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?', [id]);
        if (!row) return;

        const tx = this.mapRowToTransaction(row);

        // If it's a lend/borrow that is settled, find and delete the linked income/expense
        if ((tx.type === 'lend' || tx.type === 'borrow') && tx.settledStatus) {
            const settlementDescPrefix = `Settlement: ${tx.personName || tx.description}`;
            const linkedRow = await db.getFirstAsync<any>(
                'SELECT id FROM transactions WHERE description LIKE ? AND amount = ? AND sync_status != "deleted"',
                [`%${settlementDescPrefix}%`, tx.amount]
            );
            if (linkedRow) {
                await this.deleteTransaction(linkedRow.id); // Recursive call to cleanup balance and mark deleted
            }
        }

        await this.applyBalanceImpact(tx, true);
        await db.runAsync('UPDATE transactions SET sync_status = "deleted" WHERE id = ?', [id]);
    }

    static async unsettleTransaction(id: string): Promise<void> {
        const db = getDB();
        await db.runAsync('UPDATE transactions SET settled_status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    }

    static async deleteAccount(id: string): Promise<void> {
        const db = getDB();
        await db.runAsync('UPDATE accounts SET sync_status = "deleted" WHERE id = ?', [id]);
    }

    // Categories
    static async getCategories(): Promise<Category[]> {
        const db = getDB();
        const results = await db.getAllAsync<any>('SELECT * FROM categories WHERE sync_status != "deleted"');
        return results.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            name: row.name,
            type: row.type,
            iconSlug: row.icon_slug,
            colorHex: row.color_hex,
            createdAt: row.updated_at,
            updatedAt: row.updated_at
        }));
    }

    static async saveCategory(category: Partial<Category>): Promise<void> {
        const db = getDB();
        const id = category.id || generateId();
        await db.runAsync(
            `INSERT OR REPLACE INTO categories (id, user_id, name, type, icon_slug, color_hex, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, (category as any).userId || null, category.name || '', category.type || 'all', category.iconSlug || '', category.colorHex || '', 'synced']
        );
    }

    static async deleteCategory(id: string): Promise<void> {
        const db = getDB();
        await db.runAsync('UPDATE categories SET sync_status = "deleted" WHERE id = ?', [id]);
    }

    // Budgets
    static async getBudgets(): Promise<Budget[]> {
        const db = getDB();
        const results = await db.getAllAsync<any>('SELECT * FROM budgets WHERE sync_status != "deleted"');
        return results.map((row: any) => ({
            id: row.id,
            userId: row.user_id || '',
            accountId: row.account_id,
            categoryId: row.category_id,
            monthlyLimit: row.monthly_limit,
            createdAt: row.updated_at,
            updatedAt: row.updated_at
        }));
    }

    static async saveBudget(budget: Partial<Budget>): Promise<void> {
        const db = getDB();
        const id = budget.id || generateId();
        await db.runAsync(
            `INSERT OR REPLACE INTO budgets (id, user_id, account_id, category_id, monthly_limit, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                id,
                budget.userId || null,
                budget.accountId || null,
                budget.categoryId || null,
                budget.monthlyLimit || 0,
                'synced'
            ]
        );
    }

    static async deleteBudget(id: string): Promise<void> {
        const db = getDB();
        await db.runAsync('UPDATE budgets SET sync_status = "deleted" WHERE id = ?', [id]);
    }

    // Settings
    static async getSettings(): Promise<Settings | null> {
        const db = getDB();
        const settings = await db.getFirstAsync<any>('SELECT * FROM settings');
        if (!settings) return null;
        return {
            id: settings.id,
            baseCurrency: settings.base_currency,
            fontSize: settings.font_size,
            iconSize: settings.icon_size,
            reminderEnabled: settings.reminder_enabled === 1,
            reminderHour: settings.reminder_hour ?? 20,
            reminderMinute: settings.reminder_minute ?? 0,
            updatedAt: settings.updated_at
        } as any;
    }

    static async saveSettings(settings: Partial<Settings>): Promise<void> {
        const db = getDB();
        const existing = await this.getSettings();
        const fixedId = 'singleton_settings';

        const baseCurrency = settings.baseCurrency !== undefined
            ? settings.baseCurrency
            : (existing?.baseCurrency ?? 'INR');
        const fontSize = settings.fontSize !== undefined
            ? settings.fontSize
            : (existing?.fontSize ?? 'medium');
        const iconSize = settings.iconSize !== undefined
            ? settings.iconSize
            : (existing?.iconSize ?? 'medium');

        const reminderEnabled = settings.reminderEnabled !== undefined
            ? settings.reminderEnabled
            : (existing?.reminderEnabled ?? false);
        const reminderHour = settings.reminderHour !== undefined
            ? settings.reminderHour
            : (existing?.reminderHour ?? 20);
        const reminderMinute = settings.reminderMinute !== undefined
            ? settings.reminderMinute
            : (existing?.reminderMinute ?? 0);

        await db.runAsync(
            `INSERT OR REPLACE INTO settings (id, base_currency, font_size, icon_size, reminder_enabled, reminder_hour, reminder_minute, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                fixedId,
                baseCurrency,
                fontSize,
                iconSize,
                reminderEnabled ? 1 : 0,
                reminderHour,
                reminderMinute,
                'synced'
            ]
        );
    }

    static async clearAllData(): Promise<void> {
        const db = getDB();
        await db.runAsync('DELETE FROM transactions');
        await db.runAsync('DELETE FROM accounts');
        await db.runAsync('DELETE FROM categories');
        await db.runAsync('DELETE FROM budgets');
        await db.runAsync('DELETE FROM split_bills');
        await db.runAsync('DELETE FROM split_participants');
        // Keep settings singleton
    }

    // Split Bills
    static async getSplitBills(): Promise<SplitBill[]> {
        const db = getDB();
        const bills = await db.getAllAsync<any>(
            'SELECT * FROM split_bills WHERE sync_status != "deleted" ORDER BY date DESC'
        );
        const result: SplitBill[] = [];
        for (const bill of bills) {
            const participants = await db.getAllAsync<any>(
                'SELECT * FROM split_participants WHERE split_bill_id = ? AND sync_status != "deleted"',
                [bill.id]
            );
            result.push({
                id: bill.id,
                title: bill.title,
                totalAmount: bill.total_amount,
                category: bill.category,
                notes: bill.notes,
                date: bill.date,
                participants: participants.map((p: any) => ({
                    id: p.id,
                    splitBillId: p.split_bill_id,
                    name: p.name,
                    contactId: p.contact_id,
                    phone: p.phone,
                    share: p.share,
                    paid: p.paid === 1,
                })),
            });
        }
        return result;
    }

    static async saveSplitBill(
        bill: Partial<SplitBill>,
        participants: Partial<SplitParticipant>[]
    ): Promise<string> {
        const db = getDB();
        const id = bill.id || generateId();
        await db.runAsync(
            `INSERT OR REPLACE INTO split_bills (id, title, total_amount, category, notes, date, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                bill.title || '',
                bill.totalAmount || 0,
                bill.category || null,
                bill.notes || null,
                bill.date || new Date().toISOString(),
                'synced',
            ]
        );
        // Remove old participants if updating
        if (bill.id) {
            await db.runAsync(
                'UPDATE split_participants SET sync_status = "deleted" WHERE split_bill_id = ?',
                [id]
            );
        }
        for (const p of participants) {
            const pid = p.id || generateId();
            await db.runAsync(
                `INSERT OR REPLACE INTO split_participants (id, split_bill_id, name, contact_id, phone, share, paid, sync_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [pid, id, p.name || '', p.contactId || null, p.phone || null, p.share || 0, p.paid ? 1 : 0, 'synced']
            );
        }
        return id;
    }

    static async deleteSplitBill(id: string): Promise<void> {
        const db = getDB();
        await db.runAsync('UPDATE split_bills SET sync_status = "deleted" WHERE id = ?', [id]);
        await db.runAsync(
            'UPDATE split_participants SET sync_status = "deleted" WHERE split_bill_id = ?',
            [id]
        );
    }

    static async markParticipantPaid(participantId: string, paid: boolean): Promise<void> {
        const db = getDB();
        await db.runAsync(
            'UPDATE split_participants SET paid = ? WHERE id = ?',
            [paid ? 1 : 0, participantId]
        );
    }

    // Subscriptions
    static async getSubscriptions(): Promise<Subscription[]> {
        const db = getDB();
        const results = await db.getAllAsync<any>('SELECT * FROM subscriptions WHERE sync_status != "deleted" ORDER BY start_date DESC');
        return results.map(row => ({
            id: row.id,
            title: row.title,
            amount: row.amount,
            accountId: row.account_id,
            categoryId: row.category_id,
            type: row.type,
            subscriptionType: row.subscription_type || 'other',
            frequency: row.frequency,
            time: row.time || '09:00',
            startDate: row.start_date,
            nextDueDate: row.next_due_date,
            reminderDays: row.reminder_days,
            lastProcessedDate: row.last_processed_date,
            createdAt: row.updated_at,
            updatedAt: row.updated_at
        }));
    }

    static async saveSubscription(sub: Partial<Subscription>): Promise<void> {
        const db = getDB();
        const id = sub.id || generateId();

        await db.runAsync(
            `INSERT OR REPLACE INTO subscriptions
            (id, title, amount, account_id, category_id, type, subscription_type, frequency, time, start_date, next_due_date, reminder_days, last_processed_date, sync_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                sub.title || '',
                sub.amount || 0,
                sub.accountId || '',
                sub.categoryId || null,
                sub.type || 'expense',
                sub.subscriptionType || 'other',
                sub.frequency || 'monthly',
                sub.time || '09:00',
                sub.startDate || new Date().toISOString(),
                sub.nextDueDate || new Date().toISOString(),
                sub.reminderDays || 0,
                sub.lastProcessedDate || null,
                'synced'
            ]
        );
    }

    static async deleteSubscription(id: string): Promise<void> {
        const db = getDB();
        await db.runAsync("UPDATE subscriptions SET sync_status = 'deleted' WHERE id = ?", [id]);
    }

    static async updateSubscriptionLastProcessed(id: string, nextDueDate: string, lastProcessedDate: string): Promise<void> {
        const db = getDB();
        await db.runAsync(
            `UPDATE subscriptions SET next_due_date = ?, last_processed_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [nextDueDate, lastProcessedDate, id]
        );
    }
}
