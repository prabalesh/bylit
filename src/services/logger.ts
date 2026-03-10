import * as FileSystem from 'expo-file-system/legacy';

const { documentDirectory, writeAsStringAsync, readAsStringAsync, deleteAsync, getInfoAsync } = FileSystem;

const LOG_FILE = `${documentDirectory}crash_report.log`;

export class Logger {
    static async logError(error: Error | any, additionalInfo: string = '') {
        const timestamp = new Date().toISOString();
        const stack = error?.stack || 'No stack trace';
        const message = error?.message || String(error);

        const logEntry = `
[${timestamp}] CRASH REPORT
Message: ${message}
Info: ${additionalInfo}
Stack:
${stack}
--------------------------------------------------
`;

        try {
            // Use append to avoid reading the whole file during a crash
            await writeAsStringAsync(LOG_FILE, logEntry, { append: true });
            console.log('Error logged to file:', LOG_FILE);
        } catch (e) {
            console.error('Failed to log error to file:', e);
        }
    }

    static async getLogContent(): Promise<string> {
        try {
            const fileInfo = await getInfoAsync(LOG_FILE);
            if (fileInfo.exists) {
                return await readAsStringAsync(LOG_FILE);
            }
            return 'No logs found.';
        } catch (e) {
            return `Error reading logs: ${e}`;
        }
    }

    static async clearLog() {
        try {
            await deleteAsync(LOG_FILE, { idempotent: true });
        } catch (e) {
            console.error('Failed to clear log:', e);
        }
    }
}
