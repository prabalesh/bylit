export interface User {
    id: string;
    email: string;
}

export interface Account {
    id: string;
    name: string;
    type: 'Bank' | 'Cash' | 'Credit';
    balance: number;
}

export interface Category {
    id: string;
    name: string;
    iconSlug: string;
    colorHex: string;
    type: 'expense' | 'income' | 'all';
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
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Subscription {
    id: string;
    title: string;
    amount: number;
    accountId: string;
    categoryId?: string;
    type: 'income' | 'expense';
    frequency: Frequency;
    startDate: string; // ISO
    nextDueDate: string; // ISO 
    reminderDays: number; // 0 = on day, 1 = 1 day before
    lastProcessedDate?: string; // ISO
}

export interface SplitBill {
    id: string;
    title: string;
    totalAmount: number;
    category?: string;
    notes?: string;
    date: string;
    participants: SplitParticipant[];
}
