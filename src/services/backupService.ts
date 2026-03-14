import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Repository } from './repository';
import { getDB } from './db';

export class BackupService {
    static async exportDataJSON() {
        try {
            const db = getDB();
            const data = {
                accounts: await Repository.getAccounts(),
                categories: await Repository.getCategories(),
                transactions: await Repository.getTransactions(),
                budgets: await Repository.getBudgets(),
                settings: await Repository.getSettings(),
                subscriptions: await Repository.getSubscriptions(),
                splitBills: await Repository.getSplitBills(),
                // Split participants are fetched within getSplitBills, but for a flat backup we might want them separate
                // However, getSplitBills already attaches them to each bill. 
                // To be safe and flat:
                splitParticipants: await db.getAllAsync('SELECT * FROM split_participants'),
                exportDate: new Date().toISOString(),
                version: '1.4.0'
            };

            const jsonContent = JSON.stringify(data, null, 2);
            const fileName = `bylit_backup_${new Date().toISOString().split('T')[0]}.json`;
            const fileUri = (FileSystem.documentDirectory || '') + fileName;

            await FileSystem.writeAsStringAsync(fileUri, jsonContent, { encoding: FileSystem.EncodingType.UTF8 });
            await Sharing.shareAsync(fileUri);
        } catch (error) {
            console.error('JSON Export failed:', error);
            throw error;
        }
    }

    static async importDataJSON() {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (result.canceled) return false;

            const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
            const data = JSON.parse(content);

            // Basic validation
            if (!data.accounts || !data.categories || !data.transactions) {
                throw new Error('Invalid backup file format');
            }

            const db = getDB();

            // Perform restoration in a transaction-safe manner if possible, 
            // but repository methods handle their own db calls.

            // 1. Wipe old data
            await Repository.clearAllData();

            // 2. Import Categories
            for (const cat of data.categories) {
                await Repository.saveCategory(cat);
            }

            // 3. Import Accounts
            for (const acc of data.accounts) {
                await db.runAsync(
                    `INSERT OR REPLACE INTO accounts (id, name, type, bank_type, is_credit_card, balance, sync_status)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        acc.id,
                        acc.name,
                        acc.type,
                        acc.bankType || null,
                        acc.isCreditCard ? 1 : 0,
                        acc.balance,
                        'synced'
                    ]
                );
            }

            // 4. Import Transactions 
            // We need to be careful with SaveTransaction because it applies balance impact.
            // Since we restored accounts with their FINAL balances, we should probably 
            // insert transactions directly WITHOUT applying impact, OR 
            // Restore accounts with 0 balance and let transactions build it up.
            // Preferred: Insert transactions directly to match backup state exactly.
            for (const tx of data.transactions) {
                await db.runAsync(
                    `INSERT OR REPLACE INTO transactions 
                    (id, account_id, to_account_id, category_id, amount, remaining_amount, currency, type, description, date, person_name, due_date, settled_status, related_id, sync_status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        tx.id,
                        tx.accountId,
                        tx.toAccountId || null,
                        tx.categoryId || null,
                        tx.amount,
                        tx.remainingAmount !== undefined ? tx.remainingAmount : (tx.type === 'lend' || tx.type === 'borrow' ? tx.amount : null),
                        tx.currency || 'INR',
                        tx.type,
                        tx.description || '',
                        tx.date,
                        tx.personName || null,
                        tx.dueDate || null,
                        tx.settledStatus ? 1 : 0,
                        tx.relatedId || null,
                        'synced'
                    ]
                );
            }

            // 5. Import Split Bills & Participants
            if (data.splitBills) {
                for (const bill of data.splitBills) {
                    await db.runAsync(
                        `INSERT OR REPLACE INTO split_bills (id, title, total_amount, category, notes, date, account_id, sync_status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            bill.id,
                            bill.title,
                            bill.totalAmount,
                            bill.category || null,
                            bill.notes || null,
                            bill.date,
                            bill.accountId || null,
                            'synced',
                        ]
                    );
                }
            }

            if (data.splitParticipants) {
                for (const p of data.splitParticipants) {
                    await db.runAsync(
                        `INSERT OR REPLACE INTO split_participants (id, split_bill_id, name, contact_id, phone, share, paid, is_me, sync_status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            p.id,
                            p.split_bill_id || p.splitBillId,
                            p.name,
                            p.contact_id || p.contactId || null,
                            p.phone || null,
                            p.share,
                            p.paid ? 1 : 0,
                            (p.is_me ?? p.isMe) ? 1 : 0,
                            'synced'
                        ]
                    );
                }
            }

            // 6. Import Subscriptions
            if (data.subscriptions) {
                for (const sub of data.subscriptions) {
                    await Repository.saveSubscription(sub);
                }
            }

            // 7. Import Budgets
            if (data.budgets) {
                for (const b of data.budgets) {
                    await Repository.saveBudget(b);
                }
            }

            // 8. Import Settings
            if (data.settings) {
                await Repository.saveSettings(data.settings);
            }

            return true;
        } catch (error) {
            console.error('JSON Import failed:', error);
            throw error;
        }
    }
}
