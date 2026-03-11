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
    if (!Notifications) {
        console.warn("Notifications module not available");
        return false;
    }

    try {
        if (Platform.OS === 'android') {
            const channel = await Notifications.setNotificationChannelAsync('bylit', {
                name: 'Bylit Reminders',
                importance: Notifications.AndroidImportance.DEFAULT,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
            console.log("✅ Notification channel set:", channel);
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
 * Cancels any previously scheduled daily reminder first.
 */
export async function scheduleDailyExpenseReminder(hour: number, minute: number): Promise<void> {
    if (!Notifications) return;
    await cancelDailyReminder();

    const granted = await requestNotificationPermissions();
    if (!granted) return;

    const result = await Notifications.scheduleNotificationAsync({
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
    console.log("✅ Daily reminder scheduled:", result);
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
