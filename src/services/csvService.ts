import { documentDirectory, EncodingType, writeAsStringAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Repository } from './repository';
import { Transaction } from '../types/api';

export class CSVService {
    static async exportAllData() {
        try {
            const accounts = await Repository.getAccounts();
            const transactions = await Repository.getTransactions();
            const categories = await Repository.getCategories();
            const budgets = await Repository.getBudgets();

            let csvContent = "--- ACCOUNTS ---\nID,Name,Type,Balance\n";
            accounts.forEach(a => {
                csvContent += `${a.id},"${a.name.replace(/"/g, '""')}",${a.type},${a.balance}\n`;
            });

            csvContent += "\n--- CATEGORIES ---\nID,Name,Type,Icon,Color\n";
            categories.forEach(c => {
                csvContent += `${c.id},"${c.name.replace(/"/g, '""')}",${c.type},${c.iconSlug},${c.colorHex}\n`;
            });

            csvContent += "\n--- TRANSACTIONS ---\nID,AccountID,ToAccountID,CategoryID,Amount,Currency,Type,Date,Description,Person,DueDate,Settled\n";
            transactions.forEach(t => {
                const desc = `"${t.description.replace(/"/g, '""')}"`;
                const person = t.personName ? `"${t.personName.replace(/"/g, '""')}"` : '""';
                csvContent += `${t.id},${t.accountId},${t.toAccountId || ''},${t.categoryId || ''},${t.amount},${t.currency},${t.type},${t.date},${desc},${person},${t.dueDate || ''},${t.settledStatus ? '1' : '0'}\n`;
            });

            csvContent += "\n--- BUDGETS ---\nID,AccountID,CategoryID,Limit\n";
            budgets.forEach(b => {
                csvContent += `${b.id},${b.accountId || ''},${b.categoryId || ''},${b.monthlyLimit}\n`;
            });

            const fileName = `bylit_backup_${new Date().toISOString().split('T')[0]}.csv`;
            const fileUri = (documentDirectory || '') + fileName;

            await writeAsStringAsync(fileUri, csvContent, { encoding: EncodingType.UTF8 });
            await Sharing.shareAsync(fileUri);
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }

    static async exportMonthlySummary(transactions: Transaction[], monthYear: string) {
        try {
            const categories = await Repository.getCategories();
            const accounts = await Repository.getAccounts();

            let csvContent = "Date,Description,Type,Amount,Currency,Account,Category,Person,Settled\n";

            transactions.forEach(t => {
                const date = new Date(t.date).toLocaleDateString();
                const desc = t.description.replace(/"/g, '""');
                const catName = categories.find(c => c.id === t.categoryId)?.name || '';
                const accName = accounts.find(a => a.id === t.accountId)?.name || '';

                const person = t.personName ? `"${t.personName.replace(/"/g, '""')}"` : '""';
                csvContent += `${date},"${desc}",${t.type},${t.amount},${t.currency || 'INR'},"${accName}","${catName}",${person},${t.settledStatus ? 'YES' : 'NO'}\n`;
            });

            const fileName = `bylit_summary_${monthYear.replace(/ /g, '_')}.csv`;
            const fileUri = (documentDirectory || '') + fileName;

            await writeAsStringAsync(fileUri, csvContent, { encoding: EncodingType.UTF8 });
            await Sharing.shareAsync(fileUri);
        } catch (error) {
            console.error('Summary export failed:', error);
            throw error;
        }
    }

    static async importData() {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'text/comma-separated-values',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const content = await readAsStringAsync(result.assets[0].uri);
            const lines = content.split(/\r?\n/);

            const data = {
                ACCOUNTS: [] as any[],
                CATEGORIES: [] as any[],
                TRANSACTIONS: [] as any[],
                BUDGETS: [] as any[]
            };

            let currentSection = '';
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                if (line.startsWith('--- ')) {
                    currentSection = line.replace(/--- /g, '').replace(/ ---/g, '').trim();
                    i++; // Skip header
                    continue;
                }

                if (!currentSection) continue;

                const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                const clean = (val: string) => val ? val.replace(/^"|"$/g, '').replace(/""/g, '"').trim() : '';

                if (currentSection === 'ACCOUNTS') {
                    data.ACCOUNTS.push({
                        id: parts[0],
                        name: clean(parts[1]),
                        type: parts[2] as any,
                        balance: parseFloat(parts[3])
                    });
                } else if (currentSection === 'CATEGORIES') {
                    data.CATEGORIES.push({
                        id: parts[0],
                        name: clean(parts[1]),
                        type: parts[2] as any,
                        iconSlug: parts[3],
                        colorHex: parts[4]
                    });
                } else if (currentSection === 'TRANSACTIONS') {
                    data.TRANSACTIONS.push({
                        id: parts[0],
                        accountId: parts[1],
                        toAccountId: parts[2] || undefined,
                        categoryId: parts[3] || undefined,
                        amount: parseFloat(parts[4]),
                        currency: parts[5],
                        type: parts[6] as any,
                        date: parts[7],
                        description: clean(parts[8]),
                        personName: clean(parts[9]) || undefined,
                        dueDate: parts[10] || undefined,
                        settledStatus: parts[11] === '1'
                    });
                } else if (currentSection === 'BUDGETS') {
                    data.BUDGETS.push({
                        id: parts[0],
                        accountId: parts[1] || undefined,
                        categoryId: parts[2] || undefined,
                        monthlyLimit: parseFloat(parts[3])
                    });
                }
            }

            // Perform restoration
            // 1. Wipe old data
            await Repository.clearAllData();

            // 2. Import Categories
            for (const cat of data.CATEGORIES) {
                await Repository.saveCategory(cat);
            }

            // 3. Import Transactions FIRST (before accounts)
            // This ensures accounts don't exist yet, so Repository.saveTransaction 
            // won't double-impact balances (it will try to UPDATE but 0 rows affected).
            for (const tx of data.TRANSACTIONS) {
                await Repository.saveTransaction(tx);
            }

            // 4. Import Accounts (Sets final balances from CSV)
            for (const acc of data.ACCOUNTS) {
                await Repository.saveAccount(acc);
            }

            // 5. Import Budgets
            for (const b of data.BUDGETS) {
                await Repository.saveBudget(b);
            }

        } catch (error) {
            console.error('Import failed:', error);
            throw error;
        }
    }
}
