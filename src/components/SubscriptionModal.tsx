import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView,
    KeyboardAvoidingView, Platform
} from 'react-native';
import { X, Calendar, RefreshCw, Bell, Tag, ChevronDown, Repeat } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useTheme } from '../providers/ThemeContext';
import { FONT, ICON, BTN, RADIUS } from '../constants/Sizes';
import { Subscription, Frequency } from '../types/api';
import { useSaveSubscription, useCategories, useAccounts, useSettings } from '../hooks/useData';
import { getCurrencySymbol } from '../constants/Currency';

interface SubscriptionModalProps {
    visible: boolean;
    onClose: () => void;
    subscription?: Subscription | null;
}

const FREQUENCIES: { label: string, value: Frequency }[] = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Yearly', value: 'yearly' },
];

const REMINDER_OPTIONS = [
    { label: 'On Due Date', value: 0 },
    { label: '1 Day Before', value: 1 },
    { label: '3 Days Before', value: 3 },
    { label: '1 Week Before', value: 7 },
];

export default function SubscriptionModal({ visible, onClose, subscription }: SubscriptionModalProps) {
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const { data: settings } = useSettings();
    const { data: categories = [] } = useCategories();
    const { data: accounts = [] } = useAccounts();
    const symbol = getCurrencySymbol(settings?.baseCurrency);
    const saveSubscription = useSaveSubscription();

    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'expense' | 'income'>('expense');
    const [accountId, setAccountId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [frequency, setFrequency] = useState<Frequency>('monthly');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [reminderDays, setReminderDays] = useState(0);

    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showAccountPicker, setShowAccountPicker] = useState(false);
    const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
    const [showReminderPicker, setShowReminderPicker] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (subscription) {
            setTitle(subscription.title);
            setAmount(subscription.amount.toString());
            setType(subscription.type);
            setAccountId(subscription.accountId);
            setCategoryId(subscription.categoryId || '');
            setFrequency(subscription.frequency);
            setStartDate(subscription.startDate.split('T')[0]);
            setReminderDays(subscription.reminderDays);
        } else {
            resetForm();
        }
    }, [subscription, visible]);

    const resetForm = () => {
        setTitle('');
        setAmount('');
        setType('expense');
        setAccountId(accounts[0]?.id || '');
        setCategoryId('');
        setFrequency('monthly');
        setStartDate(new Date().toISOString().split('T')[0]);
        setReminderDays(0);
        setErrors({});
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!title.trim()) newErrors.title = 'Title is required';
        if (!amount || isNaN(parseFloat(amount))) newErrors.amount = 'Valid amount required';
        if (!accountId) newErrors.accountId = 'Account is required';
        // Need to do light date validation on startDate
        if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/)) newErrors.startDate = 'YYYY-MM-DD format required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;

        await saveSubscription.mutateAsync({
            id: subscription?.id,
            title: title.trim(),
            amount: parseFloat(amount),
            type,
            accountId,
            categoryId: categoryId || undefined,
            frequency,
            startDate: new Date(startDate).toISOString(),
            nextDueDate: new Date(startDate).toISOString(), // Reset nextDueDate to startDate initially, or don't override if updating
            reminderDays,
            lastProcessedDate: subscription?.lastProcessedDate,
        });
        onClose();
    };

    const styles = getStyles(activeColors);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>{subscription ? 'Edit Autopay' : 'New Autopay'}</Text>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <X color={activeColors.text} size={ICON.md} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        {/* Type Toggle */}
                        <View style={styles.typeToggle}>
                            <TouchableOpacity
                                style={[styles.typeBtn, type === 'expense' && { backgroundColor: activeColors.error }]}
                                onPress={() => setType('expense')}
                            >
                                <Text style={[styles.typeText, type === 'expense' && { color: '#fff' }]}>Expense</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeBtn, type === 'income' && { backgroundColor: activeColors.success }]}
                                onPress={() => setType('income')}
                            >
                                <Text style={[styles.typeText, type === 'income' && { color: '#fff' }]}>Income</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Title */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={[styles.input, errors.title && styles.inputError]}
                                placeholder="e.g. Netflix Subscription"
                                placeholderTextColor={activeColors.secondaryText}
                                value={title}
                                onChangeText={setTitle}
                            />
                            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
                        </View>

                        {/* Amount */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Amount</Text>
                            <View style={[styles.inputRow, errors.amount && styles.inputError]}>
                                <Text style={[styles.inputPrefix, { color: type === 'expense' ? activeColors.error : activeColors.success }]}>
                                    {type === 'expense' ? '-' : '+'}{symbol}
                                </Text>
                                <TextInput
                                    style={styles.inputInner}
                                    placeholder="0.00"
                                    placeholderTextColor={activeColors.secondaryText}
                                    value={amount}
                                    onChangeText={setAmount}
                                    keyboardType="numeric"
                                />
                            </View>
                            {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
                        </View>

                        {/* Frequency */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Frequency</Text>
                            <TouchableOpacity
                                style={[styles.inputRow, { justifyContent: 'space-between' }]}
                                onPress={() => setShowFrequencyPicker(!showFrequencyPicker)}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Repeat color={activeColors.secondaryText} size={ICON.sm} />
                                    <Text style={styles.inputText}>
                                        {FREQUENCIES.find(f => f.value === frequency)?.label}
                                    </Text>
                                </View>
                                <ChevronDown color={activeColors.secondaryText} size={ICON.sm} />
                            </TouchableOpacity>
                            {showFrequencyPicker && (
                                <View style={styles.pickerBox}>
                                    {FREQUENCIES.map(f => (
                                        <TouchableOpacity
                                            key={f.value}
                                            style={[styles.pickerItem, frequency === f.value && { backgroundColor: activeColors.tint + '15' }]}
                                            onPress={() => { setFrequency(f.value); setShowFrequencyPicker(false); }}
                                        >
                                            <Text style={[styles.pickerItemText, frequency === f.value && { color: activeColors.tint }]}>{f.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Start Date */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Start / Next Billing Date</Text>
                            <View style={[styles.inputRow, errors.startDate && styles.inputError]}>
                                <Calendar color={activeColors.secondaryText} size={ICON.sm} style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.inputInner}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={activeColors.secondaryText}
                                    value={startDate}
                                    onChangeText={setStartDate}
                                />
                            </View>
                            {errors.startDate && <Text style={styles.errorText}>{errors.startDate}</Text>}
                        </View>

                        {/* Reminders */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Reminders</Text>
                            <TouchableOpacity
                                style={[styles.inputRow, { justifyContent: 'space-between' }]}
                                onPress={() => setShowReminderPicker(!showReminderPicker)}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Bell color={activeColors.secondaryText} size={ICON.sm} />
                                    <Text style={styles.inputText}>
                                        {REMINDER_OPTIONS.find(r => r.value === reminderDays)?.label || 'None'}
                                    </Text>
                                </View>
                                <ChevronDown color={activeColors.secondaryText} size={ICON.sm} />
                            </TouchableOpacity>
                            {showReminderPicker && (
                                <View style={styles.pickerBox}>
                                    {REMINDER_OPTIONS.map(r => (
                                        <TouchableOpacity
                                            key={r.value}
                                            style={[styles.pickerItem, reminderDays === r.value && { backgroundColor: activeColors.tint + '15' }]}
                                            onPress={() => { setReminderDays(r.value); setShowReminderPicker(false); }}
                                        >
                                            <Text style={[styles.pickerItemText, reminderDays === r.value && { color: activeColors.tint }]}>{r.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Account */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Account to Deduct From</Text>
                            <TouchableOpacity
                                style={[styles.inputRow, { justifyContent: 'space-between' }, errors.accountId && styles.inputError]}
                                onPress={() => setShowAccountPicker(!showAccountPicker)}
                            >
                                <Text style={accountId ? styles.inputText : styles.inputPlaceholder}>
                                    {accounts.find(a => a.id === accountId)?.name || 'Select Account'}
                                </Text>
                                <ChevronDown color={activeColors.secondaryText} size={ICON.sm} />
                            </TouchableOpacity>
                            {showAccountPicker && (
                                <View style={styles.pickerBox}>
                                    {accounts.map(acc => (
                                        <TouchableOpacity
                                            key={acc.id}
                                            style={[styles.pickerItem, accountId === acc.id && { backgroundColor: activeColors.tint + '15' }]}
                                            onPress={() => { setAccountId(acc.id); setShowAccountPicker(false); }}
                                        >
                                            <Text style={[styles.pickerItemText, accountId === acc.id && { color: activeColors.tint }]}>{acc.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                            {errors.accountId && <Text style={styles.errorText}>{errors.accountId}</Text>}
                        </View>

                        {/* Category */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Category (Optional)</Text>
                            <TouchableOpacity
                                style={[styles.inputRow, { justifyContent: 'space-between' }]}
                                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Tag color={activeColors.secondaryText} size={ICON.sm} />
                                    <Text style={categoryId ? styles.inputText : styles.inputPlaceholder}>
                                        {categories.find(c => c.id === categoryId)?.name || 'Select Category'}
                                    </Text>
                                </View>
                                <ChevronDown color={activeColors.secondaryText} size={ICON.sm} />
                            </TouchableOpacity>
                            {showCategoryPicker && (
                                <View style={styles.pickerBox}>
                                    <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                                        {categories.map(cat => (
                                            <TouchableOpacity
                                                key={cat.id}
                                                style={[styles.pickerItem, categoryId === cat.id && { backgroundColor: activeColors.tint + '15' }]}
                                                onPress={() => { setCategoryId(cat.id); setShowCategoryPicker(false); }}
                                            >
                                                <Text style={[styles.pickerItemText, categoryId === cat.id && { color: activeColors.tint }]}>{cat.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        {/* Save */}
                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: activeColors.tint }]}
                            onPress={handleSave}
                            disabled={saveSubscription.isPending}
                        >
                            <Text style={styles.saveBtnText}>{saveSubscription.isPending ? 'Saving…' : subscription ? 'Update Autopay' : 'Create Autopay'}</Text>
                        </TouchableOpacity>

                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'android' ? 20 : 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: FONT.h2, fontWeight: '900', color: colors.text },
    closeBtn: { ...BTN.md, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderRadius: BTN.md.borderRadius, borderWidth: 1, borderColor: colors.border },
    scrollContent: { padding: 20, paddingBottom: 60 },
    typeToggle: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: colors.border },
    typeBtn: { flex: 1, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: 'center' },
    typeText: { fontSize: FONT.body, fontWeight: '700', color: colors.secondaryText },
    fieldGroup: { marginBottom: 14 },
    label: { fontSize: FONT.xs, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    input: { backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: FONT.body, fontWeight: '600', color: colors.text },
    inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12 },
    inputInner: { flex: 1, fontSize: FONT.body, fontWeight: '700', color: colors.text, padding: 0 },
    inputPrefix: { fontSize: FONT.body, fontWeight: '800', marginRight: 6 },
    inputText: { fontSize: FONT.body, fontWeight: '600', color: colors.text },
    inputPlaceholder: { fontSize: FONT.body, fontWeight: '600', color: colors.secondaryText },
    inputError: { borderColor: colors.error },
    errorText: { fontSize: FONT.xs, color: colors.error, marginTop: 4, fontWeight: '600' },
    pickerBox: { marginTop: 8, backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    pickerItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
    pickerItemText: { fontSize: FONT.body, fontWeight: '600', color: colors.text },
    saveBtn: { padding: 16, borderRadius: RADIUS.lg, alignItems: 'center', marginTop: 10 },
    saveBtnText: { fontSize: FONT.body, fontWeight: '900', color: '#fff' },
});
