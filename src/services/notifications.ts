import { Platform } from 'react-native';
import { getCurrencySymbol } from '../constants/Currency';

// Dynamically load to prevent crash in Expo Go SDK 53
let Notifications: any = null;
try {
    Notifications = require('expo-notifications');
} catch (e) {
    console.warn("expo-notifications failed to load. Are you in Expo Go?");
}

// Notification channel identifier for the daily reminder
const DAILY_REMINDER_ID = 'bylit_daily_expense_reminder';

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
    if (!Notifications) return false;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('bylit', {
            name: 'Bylit Reminders',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
        });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

/**
 * Schedule a daily repeating local notification at the given hour:minute.
 * Cancels any previously scheduled daily reminder first.
 */
export async function scheduleDailyExpenseReminder(hour: number, minute: number): Promise<void> {
    if (!Notifications) return;
    await cancelDailyReminder();

    const granted = await requestNotificationPermissions();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
        identifier: DAILY_REMINDER_ID,
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
            channelId: 'bylit',
        },
    });
}

/**
 * Cancel the scheduled daily expense reminder.
 */
export async function cancelDailyReminder(): Promise<void> {
    if (!Notifications) return;
    try {
        await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
    } catch {
        // Ignore if not found
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
            sound: true, // Added sound based on original sendLendBorrowNotification
            data: { type, name }, // Simplified data based on provided edit
        },
        trigger: {
            channelId: 'bylit',
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
            channelId: 'bylit',
        },
    });
};
