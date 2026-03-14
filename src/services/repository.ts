import { getDB } from './db';
import { Transaction, Account, Category, Settings, Budget, SplitBill, SplitParticipant, Subscription, Frequency } from '../types/api';

const generateId = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

export class Repository {
    // Accounts
    static async getAccounts(): Promise<Account[]> {
        const db = getDB();
        const results = await db.getAllAsync<any>('SELECT * FROM accounts WHERE sync_status != "deleted"');
        return results.map((row: any) => ({
            id: String(row.id),
            name: String(row.name),
            type: (row.type || 'Bank') as any,
            bankType: row.bank_type as any,
            isCreditCard: row.is_credit_card === 1,
            statementDay: row.statement_day,
            dueDay: row.due_day,
            balance: Number(row.balance) || 0,
            createdAt: String(row.updated_at || new Date().toISOString()),
            updatedAt: String(row.updated_at || new Date().toISOString())
        }));
    }

    static async saveAccount(account: Partial<Account>): Promise<void> {
        const db = getDB();
        const id = account.id || generateId();
        await db.runAsync(
            `INSERT OR REPLACE INTO accounts (id, name, type, bank_type, is_credit_card, statement_day, due_day, balance, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                account.name || '',
                account.type || 'Bank',
                account.bankType || null,
                account.isCreditCard ? 1 : 0,
                account.statementDay || null,
                account.dueDay || null,
                account.balance || 0,
                'synced'
            ]
        );
    }

    // Transactions
    static async getTransactions(startDate?: Date, endDate?: Date, accountId?: string, limit: number = 100, offset: number = 0): Promise<Transaction[]> {
        const db = getDB();

        // Build query with filters
        let whereClause = 'WHERE sync_status != "deleted"';
        const params: any[] = [];

        if (startDate) {
            whereClause += ' AND date >= ?';
            params.push(startDate.toISOString());
        }
        if (endDate) {
            whereClause += ' AND date <= ?';
            params.push(endDate.toISOString());
        }
        if (accountId) {
            whereClause += ' AND (account_id = ? OR to_account_id = ?)';
            params.push(accountId, accountId);
        }

        const query = `SELECT * FROM transactions ${whereClause} ORDER BY date DESC LIMIT ? OFFSET ?`;
        const results = await db.getAllAsync<any>(query, [...params, limit, offset]);

        // Fetch accounts to get names
        const accounts = await this.getAccounts();
        const accountMap = new Map(accounts.map(a => [a.id, a.name]));

        const transactions = results.map(row => {
            const tx = this.mapRowToTransaction(row);
            tx.accountName = accountMap.get(tx.accountId) || 'Unknown';
            return tx;
        });

        // Note: For large data, running balance calculation should ideally be 
        // pre-calculated or stored per transaction to avoid high memory usage.
        // This current optimization limits the rows fetched while still providing names.
        return transactions;
    }

    private static mapRowToTransaction(row: any): Transaction {
        return {
            id: String(row.id || ''),
            accountId: String(row.account_id || ''),
            toAccountId: row.to_account_id ? String(row.to_account_id) : undefined,
            categoryId: row.category_id ? String(row.category_id) : undefined,
            amount: Number(row.amount) || 0,
            remainingAmount: row.remaining_amount !== null ? Number(row.remaining_amount) : undefined,
            currency: String(row.currency || 'INR'),
            type: (row.type || 'expense') as any,
            description: String(row.description || ''),
            date: String(row.date || new Date().toISOString()),
            personName: row.person_name ? String(row.person_name) : undefined,
            dueDate: row.due_date ? String(row.due_date) : undefined,
            settledStatus: row.settled_status === 1,
            relatedId: row.related_id ? String(row.related_id) : undefined,
            createdAt: String(row.updated_at || new Date().toISOString()),
            updatedAt: String(row.updated_at || new Date().toISOString())
        };
    }

    private static async applyBalanceImpact(tx: Partial<Transaction>, isRevert: boolean = false): Promise<void> {
        if (!tx.accountId || !tx.amount) return;

        const db = getDB();
        const multiplier = isRevert ? -1 : 1;

        if (tx.type === 'transfer' || tx.type === 'credit bill') {
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
        const isLendOrBorrow = tx.type === 'lend' || tx.type === 'borrow';

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
            (id, account_id, to_account_id, category_id, amount, remaining_amount, currency, type, description, date, person_name, due_date, settled_status, related_id, sync_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                tx.accountId || '',
                tx.toAccountId || null,
                tx.categoryId || null,
                tx.amount || 0,
                tx.remainingAmount !== undefined ? tx.remainingAmount : (isLendOrBorrow ? (tx.amount || 0) : null),
                tx.currency || 'INR',
                tx.type || 'expense',
                tx.description || '',
                tx.date || new Date().toISOString(),
                tx.personName || null,
                tx.dueDate || null,
                tx.settledStatus ? 1 : 0,
                tx.relatedId || null,
                'synced'
            ]
        );

        // Apply new impact
        const newTx = { ...tx, id };
        await this.applyBalanceImpact(newTx as Transaction);
    }

    static async deleteTransaction(id: string): Promise<void> {
        const db = getDB();
        const row = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ? AND sync_status != "deleted"', [id]);
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

        // If it's a settlement transaction being deleted, unmark the split participant as paid
        if (tx.type === 'income' && tx.description.startsWith('Settlement:') && tx.relatedId) {
            await db.runAsync('UPDATE split_participants SET paid = 0 WHERE id = ?', [tx.relatedId]);
            // Also unmark the original 'lend' transaction as settled
            const lendTx = await db.getFirstAsync<any>(
                'SELECT id FROM transactions WHERE type = "lend" AND related_id = ? AND sync_status != "deleted"',
                [tx.relatedId]
            );
            if (lendTx) {
                await db.runAsync('UPDATE transactions SET settled_status = 0 WHERE id = ?', [lendTx.id]);
            }
        }

        await this.applyBalanceImpact(tx, true);
        await db.runAsync('UPDATE transactions SET sync_status = "deleted" WHERE id = ?', [id]);
    }

    static async unsettleTransaction(id: string): Promise<void> {
        const db = getDB();
        await db.runAsync('UPDATE transactions SET settled_status = 0, remaining_amount = amount, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    }

    static async recordPayment(originalTransactionId: string, paymentAmount: number, accountId: string, date: string): Promise<void> {
        const db = getDB();
        const original = await db.getFirstAsync<any>('SELECT * FROM transactions WHERE id = ?', [originalTransactionId]);
        if (!original) throw new Error('Original transaction not found');

        const originalTx = this.mapRowToTransaction(original);
        const newRemaining = Math.max(0, (original.remaining_amount ?? original.amount) - paymentAmount);

        // 1. Create the payment transaction
        const paymentType = originalTx.type === 'lend' ? 'income' : 'expense';
        const paymentDesc = `Payment: ${originalTx.personName || originalTx.description}`;

        await this.saveTransaction({
            accountId,
            amount: paymentAmount,
            currency: originalTx.currency,
            type: paymentType,
            description: paymentDesc,
            date,
            relatedId: originalTransactionId,
        });

        // 2. Update original remaining amount
        await db.runAsync(
            'UPDATE transactions SET remaining_amount = ?, settled_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newRemaining, newRemaining === 0 ? 1 : 0, originalTransactionId]
        );
    }

    static async getPaymentsForTransaction(id: string): Promise<Transaction[]> {
        const db = getDB();
        const results = await db.getAllAsync<any>(
            'SELECT * FROM transactions WHERE related_id = ? AND sync_status != "deleted" ORDER BY date DESC',
            [id]
        );
        return results.map(row => this.mapRowToTransaction(row));
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
        const settings = await db.getFirstAsync<any>('SELECT * FROM settings WHERE id = ?', ['singleton_settings']);
        if (!settings) return null;
        return {
            id: String(settings.id),
            userId: String(settings.remote_id || ''),
            baseCurrency: String(settings.base_currency || 'INR'),
            fontSize: String(settings.font_size || 'medium'),
            iconSize: String(settings.icon_size || 'medium'),
            reminderEnabled: settings.reminder_enabled === 1,
            reminderHour: Number(settings.reminder_hour ?? 20),
            reminderMinute: Number(settings.reminder_minute ?? 0),
            reminderTimes: settings.reminder_times ? JSON.parse(settings.reminder_times) : undefined,
            createdAt: String(settings.updated_at || new Date().toISOString()),
            updatedAt: String(settings.updated_at || new Date().toISOString())
        } as Settings;
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
        const reminderTimes = settings.reminderTimes !== undefined
            ? settings.reminderTimes
            : (existing?.reminderTimes ?? []);

        await db.runAsync(
            `INSERT OR REPLACE INTO settings (id, base_currency, font_size, icon_size, reminder_enabled, reminder_hour, reminder_minute, reminder_times, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                fixedId,
                baseCurrency,
                fontSize,
                iconSize,
                reminderEnabled ? 1 : 0,
                reminderHour,
                reminderMinute,
                JSON.stringify(reminderTimes),
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
        await db.runAsync('DELETE FROM subscriptions');
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
                accountId: bill.account_id,
                participants: participants.map((p: any) => ({
                    id: p.id,
                    splitBillId: p.split_bill_id,
                    name: p.name,
                    contactId: p.contact_id,
                    phone: p.phone,
                    share: p.share,
                    paid: p.paid === 1,
                    isMe: p.is_me === 1,
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
            `INSERT OR REPLACE INTO split_bills (id, title, total_amount, category, notes, date, account_id, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                bill.title || '',
                bill.totalAmount || 0,
                bill.category || null,
                bill.notes || null,
                bill.date || new Date().toISOString(),
                bill.accountId || null,
                'synced',
            ]
        );

        // Automated Transaction: Handle balance impact and split logic
        if (!bill.id && bill.accountId && bill.totalAmount) {
            // 1. User's share as 'expense'
            const me = participants.find(p => p.isMe);
            if (me && me.share) {
                await this.saveTransaction({
                    accountId: bill.accountId,
                    amount: me.share,
                    type: 'expense',
                    description: `Share of: ${bill.title}`,
                    date: bill.date || new Date().toISOString(),
                    categoryId: bill.category || undefined,
                    relatedId: id,
                });
            }

            // 2. Others' shares as individual 'lend' transactions
            for (const p of participants) {
                if (p.isMe || !p.share) continue;
                const participantId = p.id || generateId();
                p.id = participantId; // Ensure we use the same ID for participant and transaction relatedId
                await this.saveTransaction({
                    accountId: bill.accountId!,
                    amount: p.share,
                    type: 'lend',
                    description: `Lent for ${bill.title}: ${p.name}`,
                    personName: p.name,
                    date: bill.date || new Date().toISOString(),
                    relatedId: participantId,
                });
            }
        }
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
                `INSERT OR REPLACE INTO split_participants (id, split_bill_id, name, contact_id, phone, share, paid, is_me, sync_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [pid, id, p.name || '', p.contactId || null, p.phone || null, p.share || 0, p.paid ? 1 : 0, p.isMe ? 1 : 0, 'synced']
            );
        }
        return id;
    }

    static async deleteSplitBill(id: string): Promise<void> {
        const db = getDB();
        // Also delete associated transactions FIRST
        const associatedTx = await db.getAllAsync<any>(
            'SELECT id FROM transactions WHERE (related_id IN (SELECT id FROM split_participants WHERE split_bill_id = ?) OR related_id = ?) AND sync_status != "deleted"',
            [id, id]
        );
        for (const tx of associatedTx) {
            await this.deleteTransaction(tx.id);
        }

        await db.runAsync('UPDATE split_bills SET sync_status = "deleted" WHERE id = ?', [id]);
        await db.runAsync(
            'UPDATE split_participants SET sync_status = "deleted" WHERE split_bill_id = ?',
            [id]
        );
    }

    static async markParticipantPaid(participantId: string, paid: boolean, toAccountId?: string): Promise<void> {
        const db = getDB();

        // Fetch participant and split bill for transaction automation
        const p = await db.getFirstAsync<any>('SELECT * FROM split_participants WHERE id = ?', [participantId]);
        if (!p) return;

        const bill = await db.getFirstAsync<any>('SELECT * FROM split_bills WHERE id = ?', [p.split_bill_id]);

        const wasPaid = p.paid === 1;
        const isMe = p.is_me === 1;

        await db.runAsync(
            'UPDATE split_participants SET paid = ? WHERE id = ?',
            [paid ? 1 : 0, participantId]
        );

        // Automated Transaction: Credit amount when someone else pays
        if (paid && !wasPaid && !isMe && bill) {
            const creditAccountId = toAccountId || bill.account_id;
            if (creditAccountId) {
                await this.saveTransaction({
                    accountId: creditAccountId,
                    amount: p.share,
                    type: 'income',
                    description: `Settlement: ${p.name} for ${bill.title}`,
                    date: new Date().toISOString(),
                    relatedId: participantId,
                });

                // Also mark the original 'lend' transaction as settled
                const lendTx = await db.getFirstAsync<any>(
                    'SELECT id FROM transactions WHERE type = "lend" AND related_id = ? AND sync_status != "deleted"',
                    [participantId]
                );
                if (lendTx) {
                    await db.runAsync('UPDATE transactions SET settled_status = 1 WHERE id = ?', [lendTx.id]);
                }
            }
        } else if (!paid && wasPaid && !isMe) {
            // If unmarked as paid, find and delete the settlement transaction
            const settlementTx = await db.getFirstAsync<any>(
                'SELECT id FROM transactions WHERE type = "income" AND related_id = ? AND sync_status != "deleted"',
                [participantId]
            );
            if (settlementTx) {
                await this.deleteTransaction(settlementTx.id);
            }

            // Also unmark the original 'lend' transaction as settled
            const lendTx = await db.getFirstAsync<any>(
                'SELECT id FROM transactions WHERE type = "lend" AND related_id = ? AND sync_status != "deleted"',
                [participantId]
            );
            if (lendTx) {
                await db.runAsync('UPDATE transactions SET settled_status = 0 WHERE id = ?', [lendTx.id]);
            }
        }
    }

    // Subscriptions
    static async getSubscriptions(): Promise<Subscription[]> {
        const db = getDB();
        const results = await db.getAllAsync<any>('SELECT * FROM subscriptions WHERE sync_status != "deleted" ORDER BY start_date DESC');
        return results.map(row => ({
            id: String(row.id || ''),
            title: String(row.title || 'Untitled'),
            amount: Number(row.amount) || 0,
            accountId: String(row.account_id || ''),
            categoryId: row.category_id ? String(row.category_id) : undefined,
            type: (row.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
            subscriptionType: (row.subscription_type || 'other') as any,
            frequency: (row.frequency || 'monthly') as any,
            time: String(row.time || '09:00'),
            startDate: String(row.start_date || new Date().toISOString()),
            nextDueDate: String(row.next_due_date || new Date().toISOString()),
            reminderDays: Number(row.reminder_days) || 0,
            lastProcessedDate: row.last_processed_date ? String(row.last_processed_date) : undefined,
            isEstimated: row.is_estimated === 1,
            createdAt: String(row.updated_at || new Date().toISOString()),
            updatedAt: String(row.updated_at || new Date().toISOString())
        }));
    }

    static async saveSubscription(sub: Partial<Subscription>): Promise<string> {
        const db = getDB();
        const id = sub.id || generateId();

        await db.runAsync(
            `INSERT OR REPLACE INTO subscriptions
            (id, title, amount, account_id, category_id, type, subscription_type, frequency, time, start_date, next_due_date, reminder_days, last_processed_date, is_estimated, sync_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                sub.isEstimated ? 1 : 0,
                'synced'
            ]
        );
        return id;
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


    static async getPeriodTotals(startDate: Date, endDate: Date): Promise<{ income: number; expense: number }> {
        const db = getDB();
        const start = startDate.toISOString();
        const end = endDate.toISOString();

        const result = await db.getFirstAsync<any>(
            `SELECT 
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type IN ('expense', 'lend') THEN amount ELSE 0 END) as expense
             FROM transactions 
             WHERE sync_status != 'deleted' AND date >= ? AND date <= ?`,
            [start, end]
        );

        return {
            income: Number(result?.income) || 0,
            expense: Number(result?.expense) || 0
        };
    }

    static async getDebtTotals(): Promise<{ lent: number; borrowed: number }> {
        const db = getDB();
        const result = await db.getFirstAsync<any>(
            `SELECT 
                SUM(CASE WHEN type = 'lend' THEN COALESCE(remaining_amount, amount) ELSE 0 END) as lent,
                SUM(CASE WHEN type = 'borrow' THEN COALESCE(remaining_amount, amount) ELSE 0 END) as borrowed
             FROM transactions 
             WHERE sync_status != 'deleted' AND settled_status = 0 AND type IN ('lend', 'borrow')`
        );

        return {
            lent: Number(result?.lent) || 0,
            borrowed: Number(result?.borrowed) || 0
        };
    }

    static async getNetBalances(): Promise<{ name: string; amount: number }[]> {
        const db = getDB();
        const results = await db.getAllAsync<any>(
            `SELECT 
                person_name as name,
                SUM(CASE WHEN type = 'lend' THEN COALESCE(remaining_amount, amount) ELSE -COALESCE(remaining_amount, amount) END) as amount
             FROM transactions 
             WHERE sync_status != 'deleted' AND settled_status = 0 AND type IN ('lend', 'borrow')
             GROUP BY person_name
             HAVING amount != 0
             ORDER BY ABS(amount) DESC`
        );

        return results.map(row => ({
            name: String(row.name || 'Unknown'),
            amount: Number(row.amount) || 0
        }));
    }

    static calculateNextDueDate(currentDueDate: string, frequency: Frequency): string {
        const date = new Date(currentDueDate);
        switch (frequency) {
            case 'hourly':
                date.setHours(date.getHours() + 1);
                break;
            case 'daily':
                date.setDate(date.getDate() + 1);
                break;
            case 'weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'monthly':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
        }
        return date.toISOString();
    }
}
