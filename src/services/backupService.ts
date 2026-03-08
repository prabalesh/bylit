import { documentDirectory, EncodingType, writeAsStringAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Repository } from './repository';

export class BackupService {
    static async exportDataJSON() {
        try {
            const data = {
                accounts: await Repository.getAccounts(),
                categories: await Repository.getCategories(),
                transactions: await Repository.getTransactions(),
                budgets: await Repository.getBudgets(),
                settings: await Repository.getSettings(),
                exportDate: new Date().toISOString(),
                version: '1.1.0'
            };

            const jsonContent = JSON.stringify(data, null, 2);
            const fileName = `bylit_backup_${new Date().toISOString().split('T')[0]}.json`;
            const fileUri = (documentDirectory || '') + fileName;

            await writeAsStringAsync(fileUri, jsonContent, { encoding: EncodingType.UTF8 });
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

            const content = await readAsStringAsync(result.assets[0].uri);
            const data = JSON.parse(content);

            // Basic validation
            if (!data.accounts || !data.categories || !data.transactions) {
                throw new Error('Invalid backup file format');
            }

            // Perform restoration
            // 1. Wipe old data
            await Repository.clearAllData();

            // 2. Import Categories
            for (const cat of data.categories) {
                await Repository.saveCategory(cat);
            }

            // 3. Import Transactions
            // Note: We use saveTransaction which also handles balance impact.
            // However, during restoration, we want to match the EXACT state from the backup.
            // Repository.saveTransaction might double-impact if accounts exist.
            // But clearAllData wiped accounts, so first tx save will create impact on non-existent accounts (0 rows affected).
            for (const tx of data.transactions) {
                await Repository.saveTransaction(tx);
            }

            // 4. Import Accounts (Sets final balances from backup)
            for (const acc of data.accounts) {
                await Repository.saveAccount(acc);
            }

            // 5. Import Budgets
            if (data.budgets) {
                for (const b of data.budgets) {
                    await Repository.saveBudget(b);
                }
            }

            // 6. Import Settings
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
