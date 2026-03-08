import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Repository } from '../services/repository';
import { Transaction, Account, Category, Settings, Budget, SplitBill, SplitParticipant, Subscription } from '../types/api';
import { Alert } from 'react-native';
// expo-notifications is not available in Expo Go (SDK 53+).
// We lazy-load it so a missing/unavailable native module doesn't crash the app.
let Notifications: typeof import('expo-notifications') | null = null;
try {
    Notifications = require('expo-notifications');
} catch {
    // Silently ignore – running in Expo Go without notification support.
}

const safeSchedule = async (options: Parameters<typeof import('expo-notifications').scheduleNotificationAsync>[0], identifier?: string) => {
    if (!Notifications) return;
    try {
        await Notifications.scheduleNotificationAsync({ ...options, identifier } as any);
    } catch { /* ignore */ }
};

const safeCancel = async (identifier: string) => {
    if (!Notifications) return;
    try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch { /* ignore */ }
};

// --- Transactions ---
export const useTransactions = (startDate?: Date, endDate?: Date, accountId?: string) => {
    return useQuery<Transaction[]>({
        queryKey: ['transactions', startDate?.toISOString(), endDate?.toISOString(), accountId],
        queryFn: () => Repository.getTransactions(startDate, endDate, accountId),
    });
};

export const useSaveTransaction = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (tx: Partial<Transaction>) => Repository.saveTransaction(tx),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
        },
    });
};

export const useDeleteTransaction = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => Repository.deleteTransaction(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
        },
    });
};

// --- Accounts ---
export const useAccounts = () => {
    return useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: () => Repository.getAccounts(),
    });
};

export const useSaveAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (account: Partial<Account>) => Repository.saveAccount(account),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
        },
    });
};

export const useDeleteAccount = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => Repository.deleteAccount(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
        },
    });
};

// --- Categories ---
export const useCategories = () => {
    return useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: () => Repository.getCategories(),
    });
};

export const useSaveCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (category: Partial<Category>) => Repository.saveCategory(category),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        },
    });
};

export const useDeleteCategory = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => Repository.deleteCategory(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        },
    });
};

// --- Settings ---
export const useSettings = () => {
    return useQuery<Settings>({
        queryKey: ['settings'],
        queryFn: () => Repository.getSettings() as any,
    });
};

export const useUpdateSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (settings: Partial<Settings>) => Repository.saveSettings(settings),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });
};

// --- Budgets ---
export const useBudgets = () => {
    return useQuery<Budget[]>({
        queryKey: ['budgets'],
        queryFn: () => Repository.getBudgets(),
    });
};

export const useSaveBudget = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (budget: Partial<Budget>) => Repository.saveBudget(budget),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
        },
    });
};

export const useDeleteBudget = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => Repository.deleteBudget(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
        },
    });
};

// --- Split Bills ---
export const useSplitBills = () => {
    return useQuery<SplitBill[]>({
        queryKey: ['splitBills'],
        queryFn: () => Repository.getSplitBills(),
    });
};

export const useSaveSplitBill = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ bill, participants }: { bill: Partial<SplitBill>; participants: Partial<SplitParticipant>[] }) =>
            Repository.saveSplitBill(bill, participants),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['splitBills'] });
        },
    });
};

export const useDeleteSplitBill = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => Repository.deleteSplitBill(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['splitBills'] });
        },
    });
};

export const useMarkParticipantPaid = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { participantId: string, paid: boolean }) => Repository.markParticipantPaid(data.participantId, data.paid),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['splitBills'] });
        }
    });
};

// Subscriptions
const scheduleSubscriptionReminder = async (sub: Partial<Subscription>, title: string) => {
    if (!sub.id || !sub.nextDueDate) return;

    const notifId = `sub-${sub.id}`;
    // First cancel any existing reminder for this sub
    await safeCancel(notifId);

    const dueDate = new Date(sub.nextDueDate);
    const reminderDays = sub.reminderDays || 0;

    // Calculate trigger date
    const triggerDate = new Date(dueDate);
    triggerDate.setDate(triggerDate.getDate() - reminderDays);
    triggerDate.setHours(9, 0, 0, 0); // 9 AM

    // Only schedule if it's in the future
    if (triggerDate > new Date()) {
        await safeSchedule({
            content: {
                title: `Upcoming Autopay: ${title}`,
                body: `Your payment of ${sub.amount} for ${title} is due on ${dueDate.toLocaleDateString()}.`,
                data: { route: '/(app)/subscriptions' },
            },
            trigger: {
                type: 'date' as any,
                date: triggerDate,
            },
        }, notifId);
    }
};

export const useSubscriptions = () => {
    return useQuery({
        queryKey: ['subscriptions'],
        queryFn: () => Repository.getSubscriptions(),
    });
};

export const useSaveSubscription = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (subscription: Partial<Subscription>) => {
            await Repository.saveSubscription(subscription);
            await scheduleSubscriptionReminder(subscription, subscription.title || 'Subscription');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        }
    });
};

export const useDeleteSubscription = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await Repository.deleteSubscription(id);
            await safeCancel(`sub-${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        }
    });
};

export const useUpdateSubscriptionLastProcessed = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { id: string, nextDueDate: string, lastProcessedDate: string }) =>
            Repository.updateSubscriptionLastProcessed(data.id, data.nextDueDate, data.lastProcessedDate),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        }
    });
};
