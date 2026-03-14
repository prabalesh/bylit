import { Platform } from 'react-native';
import { getCurrencySymbol } from '../constants/Currency';

// Dynamically load to prevent crash in Expo Go SDK 53
let Notifications: any = null;
try {
    Notifications = require('expo-notifications');
    console.log("✅ expo-notifications loaded successfully");
} catch (e) {
    console.error("❌ expo-notifications failed to load:", e);
}

// Notification channel identifier for the daily reminder
// Notification channel identifiers
const DAILY_REMINDER_ID_PREFIX = 'bylit_daily_reminder_';
const CHANNEL_REMINDERS = 'reminders';
const CHANNEL_TRANSACTIONS = 'transactions';
const CHANNEL_LEND_BORROW = 'lend_borrow';

// Configure how notifications appear when the app is in foreground
if (Notifications) {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}

/**
 * Request permission to show local notifications.
 * Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    if (!Notifications) {
        console.warn("Notifications module not available");
        return false;
    }

    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
                name: 'Daily Reminders',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
            await Notifications.setNotificationChannelAsync(CHANNEL_TRANSACTIONS, {
                name: 'Transaction Alerts',
                importance: Notifications.AndroidImportance.DEFAULT,
            });
            await Notifications.setNotificationChannelAsync(CHANNEL_LEND_BORROW, {
                name: 'Lend & Borrow Reminders',
                importance: Notifications.AndroidImportance.MAX,
            });
            console.log("✅ Notification channels configured");
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        console.log("Current notification status:", existingStatus);
        if (existingStatus === 'granted') return true;

        const { status } = await Notifications.requestPermissionsAsync();
        console.log("Requested notification status:", status);
        return status === 'granted';
    } catch (error) {
        console.error("Error requesting notification permissions:", error);
        return false;
    }
}

/**
 * Schedule a daily repeating local notification at the given hour:minute.
 */
export async function scheduleDailyExpenseReminder(hour: number, minute: number): Promise<void> {
    if (!Notifications) return;

    const granted = await requestNotificationPermissions();
    if (!granted) return;

    const identifier = `${DAILY_REMINDER_ID_PREFIX}${hour}_${minute}`;

    const result = await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
            title: '💰 Time to log your expenses!',
            body: "Don't forget to add today's transactions in Bylit.",
            sound: true,
            data: { type: 'daily_reminder' },
            autoDismiss: true,
        },
        trigger: {
            hour,
            minute,
            repeats: true,
            channelId: CHANNEL_REMINDERS,
        },
    });
    console.log(`✅ Daily reminder scheduled for ${hour}:${minute}:`, result);
}

/**
 * Cancel a specific scheduled daily expense reminder.
 */
export async function cancelDailyReminder(hour: number, minute: number): Promise<void> {
    if (!Notifications) return;
    try {
        await Notifications.cancelScheduledNotificationAsync(`${DAILY_REMINDER_ID_PREFIX}${hour}_${minute}`);
    } catch {
        // Ignore if not found
    }
}

/**
 * Cancel all scheduled daily expense reminders.
 */
export async function cancelAllDailyReminders(): Promise<void> {
    if (!Notifications) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
        if (notification.identifier.startsWith(DAILY_REMINDER_ID_PREFIX)) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
    }
}

/**
 * Send an immediate local notification for a lend or borrow transaction.
 */
export const sendLendBorrowNotification = async (type: 'lend' | 'borrow', name: string, amount: number, currency: string) => {
    // The original code had a dynamic import for Notifications.
    // For now, assuming Notifications is always available due to direct import.

    const granted = await requestNotificationPermissions();
    if (!granted) return;

    const symbol = getCurrencySymbol(currency);
    const title = type === 'lend' ? 'New Lent Record' : 'New Borrow Record';
    const body = type === 'lend'
        ? `You lent ${symbol}${amount.toLocaleString()} to ${name}`
        : `You borrowed ${symbol}${amount.toLocaleString()} from ${name}`;

    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true,
            data: { type, name },
        },
        trigger: {
            channelId: CHANNEL_TRANSACTIONS,
        }, // Immediate
    });
};

/**
 * Schedule a local notification reminder for a lend or borrow transaction's due date.
 */
export const scheduleLendBorrowReminder = async (txId: string, type: 'lend' | 'borrow', name: string, amount: number, currency: string, dueDate: Date) => {
    if (!Notifications) return;

    const granted = await requestNotificationPermissions();
    if (!granted) return;

    const symbol = getCurrencySymbol(currency);
    const title = type === 'lend' ? 'Payment Reminder (Lent)' : 'Payment Reminder (Borrowed)';
    const body = type === 'lend'
        ? `${name} owes you ${symbol}${amount.toLocaleString()}. Due today!`
        : `You owe ${name} ${symbol}${amount.toLocaleString()}. Due today!`;

    // Use transaction ID as notification identifier to allow cancellation/replacement
    await Notifications.scheduleNotificationAsync({
        identifier: `reminder_${txId}`,
        content: {
            title,
            body,
            sound: true,
            data: { type, txId, name },
        },
        trigger: {
            date: dueDate,
            channelId: CHANNEL_LEND_BORROW,
        },
    });
};
