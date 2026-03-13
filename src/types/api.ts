export interface User {
    id: string;
    email: string;
}

export interface Account {
    id: string;
    name: string;
    type: 'Bank' | 'Cash' | 'Credit';
    balance: number;
    createdAt: string;
    updatedAt: string;
}

export interface Category {
    id: string;
    name: string;
    iconSlug: string;
    colorHex: string;
    type: 'expense' | 'income' | 'all';
    createdAt: string;
    updatedAt: string;
}

export interface Transaction {
    id: string;
    accountId: string;
    toAccountId?: string;
    categoryId?: string;
    amount: number;
    currency: string;
    type: 'expense' | 'income' | 'lend' | 'borrow' | 'transfer';
    description: string;
    date: string;
    tags?: string[];
    personName?: string;
    dueDate?: string;
    settledStatus?: boolean;
    relatedId?: string;
    accountName?: string;
    balanceAfter?: number;
    createdAt: string;
    updatedAt: string;
}

export interface Budget {
    id: string;
    userId: string;
    categoryId?: string;
    accountId?: string;
    monthlyLimit: number;
    createdAt: string;
    updatedAt: string;
}

export interface Settings {
    id: string;
    userId: string;
    baseCurrency: string;
    fontSize: string;
    iconSize: string;
    reminderEnabled: boolean;
    reminderHour: number;
    reminderMinute: number;
    createdAt: string;
    updatedAt: string;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface SplitParticipant {
    id: string;
    splitBillId: string;
    name: string;
    contactId?: string;
    phone?: string;
    share: number;
    paid: boolean;
    isMe?: boolean;
}

export type Frequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type SubscriptionType =
    | 'app_subscription'
    | 'loan_emi'
    | 'insurance'
    | 'rent'
    | 'salary'
    | 'investment'
    | 'utility'
    | 'entertainment'
    | 'education'
    | 'other';

export interface Subscription {
    id: string;
    title: string;
    amount: number;
    accountId: string;
    categoryId?: string;
    type: 'income' | 'expense';
    subscriptionType: SubscriptionType;
    frequency: Frequency;
    time: string; // HH:MM for the scheduled time of day (or hour for hourly)
    startDate: string; // ISO
    nextDueDate: string; // ISO
    reminderDays: number; // 0 = on day, 1 = 1 day before
    lastProcessedDate?: string; // ISO
    isEstimated?: boolean;
}

export interface SplitBill {
    id: string;
    title: string;
    totalAmount: number;
    category?: string;
    notes?: string;
    date: string;
    participants: SplitParticipant[];
    accountId?: string;
}
