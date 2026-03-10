import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView,
    KeyboardAvoidingView, Platform
} from 'react-native';
import {
    X, Bell, Tag, ChevronDown, Repeat, CreditCard, Smartphone, Shield,
    Home, Briefcase, TrendingUp, Zap, Tv, GraduationCap, MoreHorizontal
} from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors } from '../constants/Colors';
import { useTheme } from '../providers/ThemeContext';
import { FONT, ICON, BTN, RADIUS } from '../constants/Sizes';
import { Subscription, Frequency, SubscriptionType } from '../types/api';
import { useSaveSubscription, useCategories, useAccounts, useSettings } from '../hooks/useData';
import { getCurrencySymbol } from '../constants/Currency';

interface SubscriptionModalProps {
    visible: boolean;
    onClose: () => void;
    subscription?: Subscription | null;
}

// ───── Data ─────────────────────────────────────────────────────────────────

const FREQUENCIES: { label: string; sub: string; value: Frequency }[] = [
    { label: 'Hourly', sub: 'Repeats every hour', value: 'hourly' },
    { label: 'Daily', sub: 'Repeats every day', value: 'daily' },
    { label: 'Weekly', sub: 'Repeats every week', value: 'weekly' },
    { label: 'Monthly', sub: 'Repeats every month', value: 'monthly' },
    { label: 'Yearly', sub: 'Repeats every year', value: 'yearly' },
];

type SubTypeConfig = {
    value: SubscriptionType;
    label: string;
    icon: React.ComponentType<any>;
    color: string;
    defaultType: 'expense' | 'income';
};

const SUB_TYPES: SubTypeConfig[] = [
    { value: 'app_subscription', label: 'App / Software', icon: Smartphone, color: '#6366F1', defaultType: 'expense' },
    { value: 'loan_emi', label: 'Loan / EMI', icon: CreditCard, color: '#EF4444', defaultType: 'expense' },
    { value: 'insurance', label: 'Insurance', icon: Shield, color: '#F59E0B', defaultType: 'expense' },
    { value: 'rent', label: 'Rent', icon: Home, color: '#8B5CF6', defaultType: 'expense' },
    { value: 'utility', label: 'Utility Bill', icon: Zap, color: '#06B6D4', defaultType: 'expense' },
    { value: 'entertainment', label: 'Entertainment', icon: Tv, color: '#EC4899', defaultType: 'expense' },
    { value: 'education', label: 'Education', icon: GraduationCap, color: '#10B981', defaultType: 'expense' },
    { value: 'salary', label: 'Salary / Payroll', icon: Briefcase, color: '#22C55E', defaultType: 'income' },
    { value: 'investment', label: 'Investment Return', icon: TrendingUp, color: '#84CC16', defaultType: 'income' },
    { value: 'other', label: 'Other', icon: MoreHorizontal, color: '#9CA3AF', defaultType: 'expense' },
];

const REMINDER_OPTIONS = [
    { label: 'No reminder', value: -1 },
    { label: 'On due date', value: 0 },
    { label: '1 day before', value: 1 },
    { label: '3 days before', value: 3 },
    { label: '1 week before', value: 7 },
];

// ───── Helpers ────────────────────────────────────────────────────────────────

const formatDate = (d: Date) => d.toISOString().split('T')[0];
const formatTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const dateFromIso = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date() : d;
};

const timeToDate = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h ?? 9, m ?? 0, 0, 0);
    return d;
};

// ───── Component ──────────────────────────────────────────────────────────────

export default function SubscriptionModal({ visible, onClose, subscription }: SubscriptionModalProps) {
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const { data: settings } = useSettings();
    const { data: categories = [] } = useCategories();
    const { data: accounts = [] } = useAccounts();
    const symbol = getCurrencySymbol(settings?.baseCurrency);
    const saveSubscription = useSaveSubscription();

    // ── form state ──
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'expense' | 'income'>('expense');
    const [subType, setSubType] = useState<SubscriptionType>('other');
    const [accountId, setAccountId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [frequency, setFrequency] = useState<Frequency>('monthly');
    const [startDate, setStartDate] = useState(new Date());
    const [time, setTime] = useState(timeToDate('09:00'));
    const [reminderDays, setReminderDays] = useState(0);
    const [isEstimated, setIsEstimated] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ── picker visibility ──
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showFrequency, setShowFrequency] = useState(false);
    const [showReminder, setShowReminder] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showAccountPicker, setShowAccountPicker] = useState(false);

    // ── populate on edit ──
    useEffect(() => {
        if (subscription) {
            setTitle(subscription.title);
            setAmount(subscription.amount.toString());
            setType(subscription.type);
            setSubType(subscription.subscriptionType || 'other');
            setAccountId(subscription.accountId);
            setCategoryId(subscription.categoryId || '');
            setFrequency(subscription.frequency);
            setStartDate(dateFromIso(subscription.startDate));
            setTime(timeToDate(subscription.time || '09:00'));
            setReminderDays(subscription.reminderDays);
            setIsEstimated(!!subscription.isEstimated);
        } else {
            resetForm();
        }
    }, [subscription, visible]);

    const resetForm = () => {
        setTitle('');
        setAmount('');
        setType('expense');
        setSubType('other');
        setAccountId(accounts[0]?.id || '');
        setCategoryId('');
        setFrequency('monthly');
        setStartDate(new Date());
        setTime(timeToDate('09:00'));
        setReminderDays(0);
        setIsEstimated(false);
        setErrors({});
    };

    const selectSubType = (cfg: SubTypeConfig) => {
        setSubType(cfg.value);
        setType(cfg.defaultType);
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!title.trim()) e.title = 'Title is required';
        if (!amount || isNaN(parseFloat(amount))) e.amount = 'Valid amount required';
        if (!accountId) e.accountId = 'Account is required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        await saveSubscription.mutateAsync({
            id: subscription?.id,
            title: title.trim(),
            amount: parseFloat(amount),
            type,
            subscriptionType: subType,
            accountId,
            categoryId: categoryId || undefined,
            frequency,
            time: formatTime(time),
            startDate: startDate.toISOString(),
            nextDueDate: subscription?.nextDueDate ?? startDate.toISOString(),
            reminderDays: reminderDays < 0 ? 0 : reminderDays,
            isEstimated,
            lastProcessedDate: subscription?.lastProcessedDate,
        });
        onClose();
    };

    const styles = getStyles(activeColors);
    const selectedSubTypeCfg = SUB_TYPES.find(s => s.value === subType) || SUB_TYPES[SUB_TYPES.length - 1]; // Fallback to 'other'

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

                        {/* ── Subscription Type Grid ── */}
                        <Text style={styles.sectionLabel}>What kind of autopay?</Text>
                        <View style={styles.typeGrid}>
                            {SUB_TYPES.map(cfg => {
                                const Icon = cfg.icon;
                                const selected = subType === cfg.value;
                                return (
                                    <TouchableOpacity
                                        key={cfg.value}
                                        style={[styles.typeGridItem, selected && { borderColor: cfg.color, backgroundColor: cfg.color + '12' }]}
                                        onPress={() => selectSubType(cfg)}
                                    >
                                        <View style={[styles.typeGridIcon, { backgroundColor: cfg.color + '20' }]}>
                                            <Icon color={cfg.color} size={18} />
                                        </View>
                                        <Text style={[styles.typeGridLabel, selected && { color: cfg.color }]} numberOfLines={2}>
                                            {cfg.label}
                                        </Text>
                                        {cfg.defaultType === 'income' && (
                                            <View style={[styles.incomeTag, { backgroundColor: '#22C55E20' }]}>
                                                <Text style={{ fontSize: 8, color: '#22C55E', fontWeight: '800' }}>INCOME</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* ── Income/Expense Override Toggle ── */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Transaction Type</Text>
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
                        </View>

                        {/* ── Title ── */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={[styles.input, errors.title && styles.inputError]}
                                placeholder={`e.g. ${selectedSubTypeCfg?.label ?? 'Netflix'}`}
                                placeholderTextColor={activeColors.secondaryText}
                                value={title}
                                onChangeText={setTitle}
                            />
                            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
                        </View>

                        {/* ── Amount ── */}
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

                        {/* ── Estimated Amount Toggle ── */}
                        <View style={styles.fieldGroup}>
                            <TouchableOpacity
                                style={styles.estimateToggle}
                                onPress={() => setIsEstimated(!isEstimated)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, isEstimated && { backgroundColor: activeColors.tint, borderColor: activeColors.tint }]}>
                                    {isEstimated && <Text style={styles.checkboxTick}>✓</Text>}
                                </View>
                                <View>
                                    <Text style={styles.estimateLabel}>Estimated / Variable Amount</Text>
                                    <Text style={styles.estimateSub}>Amount may vary each interval. We'll ask you for the exact amount when it's due.</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* ── Frequency ── */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Repeat Frequency</Text>
                            <TouchableOpacity
                                style={[styles.inputRow, { justifyContent: 'space-between' }]}
                                onPress={() => setShowFrequency(!showFrequency)}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Repeat color={activeColors.secondaryText} size={ICON.sm} />
                                    <View>
                                        <Text style={styles.inputText}>
                                            {FREQUENCIES.find(f => f.value === frequency)?.label}
                                        </Text>
                                        <Text style={styles.inputSubText}>
                                            {FREQUENCIES.find(f => f.value === frequency)?.sub}
                                        </Text>
                                    </View>
                                </View>
                                <ChevronDown color={activeColors.secondaryText} size={ICON.sm} />
                            </TouchableOpacity>
                            {showFrequency && (
                                <View style={styles.pickerBox}>
                                    {FREQUENCIES.map(f => (
                                        <TouchableOpacity
                                            key={f.value}
                                            style={[styles.pickerItem, frequency === f.value && { backgroundColor: activeColors.tint + '15' }]}
                                            onPress={() => { setFrequency(f.value); setShowFrequency(false); }}
                                        >
                                            <Text style={[styles.pickerItemText, frequency === f.value && { color: activeColors.tint }]}>{f.label}</Text>
                                            <Text style={styles.pickerItemSub}>{f.sub}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* ── Start Date ── */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Start / Next Billing Date</Text>
                            <TouchableOpacity
                                style={[styles.inputRow, { justifyContent: 'space-between' }]}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={styles.inputText}>
                                    {startDate.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                                </Text>
                                <ChevronDown color={activeColors.secondaryText} size={ICON.sm} />
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={startDate}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                    onChange={(e: DateTimePickerEvent, d?: Date) => {
                                        if (Platform.OS !== 'ios') setShowDatePicker(false);
                                        if (d) setStartDate(d);
                                    }}
                                />
                            )}
                            {showDatePicker && Platform.OS === 'ios' && (
                                <TouchableOpacity style={styles.doneBtn} onPress={() => setShowDatePicker(false)}>
                                    <Text style={[styles.doneBtnText, { color: activeColors.tint }]}>Done</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* ── Time of Day ── (hidden for hourly) */}
                        {frequency !== 'hourly' && (
                            <View style={styles.fieldGroup}>
                                <Text style={styles.label}>Time of Day</Text>
                                <TouchableOpacity
                                    style={[styles.inputRow, { justifyContent: 'space-between' }]}
                                    onPress={() => setShowTimePicker(true)}
                                >
                                    <Text style={styles.inputText}>{formatTime(time)}</Text>
                                    <ChevronDown color={activeColors.secondaryText} size={ICON.sm} />
                                </TouchableOpacity>
                                {showTimePicker && (
                                    <DateTimePicker
                                        value={time}
                                        mode="time"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(e: DateTimePickerEvent, d?: Date) => {
                                            if (Platform.OS !== 'ios') setShowTimePicker(false);
                                            if (d) setTime(d);
                                        }}
                                    />
                                )}
                                {showTimePicker && Platform.OS === 'ios' && (
                                    <TouchableOpacity style={styles.doneBtn} onPress={() => setShowTimePicker(false)}>
                                        <Text style={[styles.doneBtnText, { color: activeColors.tint }]}>Done</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* ── Reminder ── */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Reminder</Text>
                            <TouchableOpacity
                                style={[styles.inputRow, { justifyContent: 'space-between' }]}
                                onPress={() => setShowReminder(!showReminder)}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Bell color={activeColors.secondaryText} size={ICON.sm} />
                                    <Text style={styles.inputText}>
                                        {REMINDER_OPTIONS.find(r => r.value === reminderDays)?.label ?? 'On due date'}
                                    </Text>
                                </View>
                                <ChevronDown color={activeColors.secondaryText} size={ICON.sm} />
                            </TouchableOpacity>
                            {showReminder && (
                                <View style={styles.pickerBox}>
                                    {REMINDER_OPTIONS.map(r => (
                                        <TouchableOpacity
                                            key={r.value}
                                            style={[styles.pickerItem, reminderDays === r.value && { backgroundColor: activeColors.tint + '15' }]}
                                            onPress={() => { setReminderDays(r.value); setShowReminder(false); }}
                                        >
                                            <Text style={[styles.pickerItemText, reminderDays === r.value && { color: activeColors.tint }]}>{r.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* ── Account ── */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>{type === 'expense' ? 'Deduct from Account' : 'Credit to Account'}</Text>
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

                        {/* ── Category ── */}
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
                                    <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true} persistentScrollbar={true}>
                                        <TouchableOpacity
                                            style={[styles.pickerItem, !categoryId && { backgroundColor: activeColors.tint + '15' }]}
                                            onPress={() => { setCategoryId(''); setShowCategoryPicker(false); }}
                                        >
                                            <Text style={[styles.pickerItemText, !categoryId && { color: activeColors.tint }]}>None</Text>
                                        </TouchableOpacity>
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

                        {/* ── Save ── */}
                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: activeColors.tint }]}
                            onPress={handleSave}
                            disabled={saveSubscription.isPending}
                        >
                            <Text style={styles.saveBtnText}>
                                {saveSubscription.isPending ? 'Saving…' : subscription ? 'Update Autopay' : 'Create Autopay'}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, paddingTop: Platform.OS === 'android' ? 20 : 16,
        borderBottomWidth: 1, borderBottomColor: colors.border
    },
    headerTitle: { fontSize: FONT.h2, fontWeight: '900', color: colors.text },
    closeBtn: { ...BTN.md, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderRadius: BTN.md.borderRadius, borderWidth: 1, borderColor: colors.border },
    scrollContent: { padding: 20, paddingBottom: 60 },

    sectionLabel: { fontSize: FONT.xs, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    typeGridItem: {
        width: '30.5%', backgroundColor: colors.card, borderRadius: RADIUS.lg,
        borderWidth: 1.5, borderColor: colors.border,
        padding: 10, alignItems: 'center', gap: 6, position: 'relative',
    },
    typeGridIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    typeGridLabel: { fontSize: 10, fontWeight: '700', color: colors.secondaryText, textAlign: 'center' },
    incomeTag: { position: 'absolute', top: 5, right: 5, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },

    typeToggle: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: 4, borderWidth: 1, borderColor: colors.border },
    typeBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center' },
    typeText: { fontSize: FONT.sm, fontWeight: '700', color: colors.secondaryText },

    fieldGroup: { marginBottom: 14 },
    label: { fontSize: FONT.xs, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    input: { backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: FONT.body, fontWeight: '600', color: colors.text },
    inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12 },
    inputInner: { flex: 1, fontSize: FONT.body, fontWeight: '700', color: colors.text, padding: 0 },
    inputPrefix: { fontSize: FONT.body, fontWeight: '800', marginRight: 6 },
    inputText: { fontSize: FONT.body, fontWeight: '600', color: colors.text },
    inputSubText: { fontSize: FONT.xs, fontWeight: '500', color: colors.secondaryText, marginTop: 1 },
    inputPlaceholder: { fontSize: FONT.body, fontWeight: '600', color: colors.secondaryText },
    inputError: { borderColor: colors.error },
    errorText: { fontSize: FONT.xs, color: colors.error, marginTop: 4, fontWeight: '600' },

    doneBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4, marginTop: 4 },
    doneBtnText: { fontSize: FONT.body, fontWeight: '700' },

    pickerBox: { marginTop: 8, backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    pickerItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
    pickerItemText: { fontSize: FONT.body, fontWeight: '600', color: colors.text },
    pickerItemSub: { fontSize: FONT.xs, fontWeight: '500', color: colors.secondaryText, marginTop: 2 },

    saveBtn: { padding: 16, borderRadius: RADIUS.lg, alignItems: 'center', marginTop: 10 },
    saveBtnText: { fontSize: FONT.body, fontWeight: '900', color: '#fff' },

    estimateToggle: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.card, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border, marginTop: 2, justifyContent: 'center', alignItems: 'center' },
    checkboxTick: { color: '#fff', fontSize: 12, fontWeight: '900' },
    estimateLabel: { fontSize: FONT.sm, fontWeight: '700', color: colors.text },
    estimateSub: { fontSize: FONT.xs, fontWeight: '500', color: colors.secondaryText, marginTop: 2, marginRight: 20 },
});
