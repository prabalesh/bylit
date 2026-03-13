import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useMemo, useCallback } from 'react';
import {
    Plus, Clock, CheckCircle2, Repeat,
    Wallet, Sparkles, Heart, CalendarClock, Smartphone, CreditCard, Shield,
    Home, Briefcase, TrendingUp, Zap, Tv, GraduationCap, MoreHorizontal
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import { FONT, RADIUS } from '../../src/constants/Sizes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscriptions, useCategories, useAccounts, useSettings, useSaveTransaction, useUpdateSubscriptionLastProcessed } from '../../src/hooks/useData';
import { getCurrencySymbol } from '../../src/constants/Currency';
import SubscriptionModal from '../../src/components/SubscriptionModal';
import { Subscription, SubscriptionType } from '../../src/types/api';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';


const TYPE_META: Record<SubscriptionType, { icon: React.ComponentType<any>; color: string }> = {
    app_subscription: { icon: Smartphone, color: '#6366F1' },
    loan_emi: { icon: CreditCard, color: '#EF4444' },
    insurance: { icon: Shield, color: '#F59E0B' },
    rent: { icon: Home, color: '#8B5CF6' },
    utility: { icon: Zap, color: '#06B6D4' },
    entertainment: { icon: Tv, color: '#EC4899' },
    education: { icon: GraduationCap, color: '#10B981' },
    salary: { icon: Briefcase, color: '#22C55E' },
    investment: { icon: TrendingUp, color: '#84CC16' },
    other: { icon: MoreHorizontal, color: '#9CA3AF' },
};

const FREQ_LABEL: Record<string, string> = {
    hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
};


export default function SubscriptionsScreen() {
    return (
        <ErrorBoundary screenName="Subscriptions">
            <SubscriptionsContent />
        </ErrorBoundary>
    );
}


function SubscriptionsContent() {
    const insets = useSafeAreaInsets();
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const { data: settings } = useSettings();
    const { data: categories = [] } = useCategories();
    const { data: accounts = [] } = useAccounts();
    const symbol = getCurrencySymbol(settings?.baseCurrency);

    const { data: subscriptions = [], isLoading, refetch, isRefetching } = useSubscriptions();
    const saveTransaction = useSaveTransaction();
    const updateSubscriptionLastProcessed = useUpdateSubscriptionLastProcessed();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
    const [isAmountPromptVisible, setIsAmountPromptVisible] = useState(false);
    const [promptSub, setPromptSub] = useState<Subscription | null>(null);
    const [manualAmount, setManualAmount] = useState('');

    const getNextBillingDate = (dateStr: string, frequency: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return new Date().toISOString();
        if (frequency === 'hourly') d.setHours(d.getHours() + 1);
        else if (frequency === 'daily') d.setDate(d.getDate() + 1);
        else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
        else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
        else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
        return d.toISOString();
    };

    const isDue = (nextDueDateStr: string) => {
        try {
            if (!nextDueDateStr) return false;
            return new Date(nextDueDateStr) <= new Date();
        } catch { return false; }
    };

    const summary = useMemo(() => {
        const monthlyTotal = subscriptions
            .filter(s => s.type === 'expense')
            .reduce((acc, s) => {
                if (s.frequency === 'hourly') return acc + s.amount * 24 * 30;
                if (s.frequency === 'daily') return acc + s.amount * 30;
                if (s.frequency === 'weekly') return acc + s.amount * 4.33;
                if (s.frequency === 'monthly') return acc + s.amount;
                if (s.frequency === 'yearly') return acc + s.amount / 12;
                return acc;
            }, 0);
        const dueCount = subscriptions.filter(s => isDue(s.nextDueDate)).length;
        return { monthlyTotal, dueCount, total: subscriptions.length };
    }, [subscriptions]);

    const confirmPayment = (sub: Subscription) => {
        if (sub.isEstimated) {
            setPromptSub(sub);
            setManualAmount(sub.amount.toString());
            setIsAmountPromptVisible(true);
        } else {
            handleConfirmPayment(sub, sub.amount);
        }
    };

    const handleConfirmPayment = async (sub: Subscription, finalAmount: number) => {
        await saveTransaction.mutateAsync({
            accountId: sub.accountId,
            categoryId: sub.categoryId,
            amount: finalAmount,
            type: sub.type,
            date: sub.nextDueDate,
            description: `Autopay: ${sub.title}${sub.isEstimated ? ' (Adj)' : ''}`
        });
        const newNextDue = getNextBillingDate(sub.nextDueDate, sub.frequency);
        await updateSubscriptionLastProcessed.mutateAsync({
            id: sub.id,
            nextDueDate: newNextDue,
            lastProcessedDate: new Date().toISOString(),
        });
        setIsAmountPromptVisible(false);
    };

    const styles = getStyles(activeColors, insets);

    const renderSubscription = useCallback(({ item }: { item: Subscription }) => {
        const isExpense = item.type === 'expense';
        const color = isExpense ? activeColors.error : activeColors.success;
        const due = isDue(item.nextDueDate);
        const cat = categories.find(c => c.id === item.categoryId);
        const account = accounts.find(a => a.id === item.accountId);
        const typeMeta = TYPE_META[item.subscriptionType || 'other'] ?? TYPE_META.other;
        const TypeIcon = typeMeta.icon;

        return (
            <TouchableOpacity
                style={[styles.card, due && { borderColor: activeColors.notification, borderWidth: 1.5 }]}
                onPress={() => { setSelectedSub(item); setIsModalVisible(true); }}
                activeOpacity={0.8}
            >
                <View style={styles.cardRow}>
                    <View style={[styles.avatar, { backgroundColor: typeMeta.color + '18' }]}>
                        <TypeIcon color={typeMeta.color} size={20} />
                    </View>

                    <View style={styles.cardInfo}>
                        <View style={styles.cardTitleRow}>
                            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                            {due && (
                                <View style={[styles.dueBadge, { backgroundColor: activeColors.notification + '18' }]}>
                                    <Clock size={10} color={activeColors.notification} />
                                    <Text style={[styles.dueBadgeText, { color: activeColors.notification }]}>DUE</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.cardMeta}>
                            {cat && (
                                <View style={[styles.catChip, { backgroundColor: (cat.colorHex || activeColors.tint) + '20' }]}>
                                    <View style={[styles.catDot, { backgroundColor: cat.colorHex || activeColors.tint }]} />
                                    <Text style={[styles.catChipText, { color: cat.colorHex || activeColors.tint }]}>{cat.name}</Text>
                                </View>
                            )}
                            <View style={styles.freqChip}>
                                <Repeat size={9} color={activeColors.secondaryText} />
                                <Text style={styles.freqChipText}>{FREQ_LABEL[item.frequency] || item.frequency}</Text>
                            </View>
                            {item.isEstimated && (
                                <View style={[styles.freqChip, { backgroundColor: activeColors.tint + '15' }]}>
                                    <Sparkles size={8} color={activeColors.tint} />
                                    <Text style={[styles.freqChipText, { color: activeColors.tint }]}>ESTIMATED</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.cardFooter}>
                            <Wallet size={10} color={activeColors.secondaryText} />
                            <Text style={styles.accountText} numberOfLines={1}>{account?.name || '—'}</Text>
                            <Text style={styles.dotSep}>·</Text>
                            <CalendarClock size={10} color={activeColors.secondaryText} />
                            <Text style={styles.accountText}>
                                {(() => {
                                    const d = new Date(item.nextDueDate);
                                    return isNaN(d.getTime())
                                        ? '—'
                                        : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                                })()}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.cardRight}>
                        <Text style={[styles.amount, { color }]}>
                            {isExpense ? '-' : '+'}{symbol}{(item.amount ?? 0).toLocaleString('en-IN')}
                        </Text>
                        {due && (
                            <TouchableOpacity
                                style={[styles.confirmBtn, { backgroundColor: activeColors.success }]}
                                onPress={() => confirmPayment(item)}
                            >
                                <CheckCircle2 size={12} color="#fff" />
                                <Text style={styles.confirmBtnText}>Paid</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    }, [categories, accounts, activeColors, symbol, styles]);

    return (
        <View style={styles.container}>
            <View style={styles.headerArea}>
                <View style={styles.titleRow}>
                    <Text style={styles.headerTitle}>Autopay</Text>
                    {currentTheme === 'heart' && (
                        <Heart color={activeColors.tint} size={20} fill={activeColors.tint} />
                    )}
                </View>
                <Text style={styles.headerSub}>Recurring payments</Text>
            </View>

            {/* Summary Card */}
            <View style={styles.summaryWrap}>
                <LinearGradient
                    colors={[activeColors.tint, activeColors.tint + 'CC']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.summaryCard}
                >
                    <View style={styles.summaryIcon}>
                        <Sparkles color="rgba(255,255,255,0.5)" size={18} />
                    </View>
                    <View>
                        <Text style={styles.summaryLabel}>EST. MONTHLY SPEND</Text>
                        <Text style={styles.summaryAmount}>
                            {symbol}{Math.round(summary.monthlyTotal).toLocaleString('en-IN')}
                        </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryStats}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{summary.total}</Text>
                            <Text style={styles.statLabel}>Active</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, summary.dueCount > 0 && { color: '#FFE57A' }]}>
                                {summary.dueCount}
                            </Text>
                            <Text style={styles.statLabel}>Due</Text>
                        </View>
                    </View>
                </LinearGradient>
            </View>

            <FlatList
                data={subscriptions}
                keyExtractor={(item) => item.id}
                renderItem={renderSubscription}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching || isLoading}
                        onRefresh={refetch}
                        tintColor={activeColors.tint}
                    />
                }
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Repeat size={40} color={activeColors.border} />
                        <Text style={styles.emptyText}>No recurring payments yet</Text>
                        <Text style={styles.emptySub}>Tap + to add your first autopay</Text>
                    </View>
                )}
            />

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: activeColors.tint }]}
                onPress={() => { setSelectedSub(null); setIsModalVisible(true); }}
                activeOpacity={0.85}
            >
                <Plus color="#fff" size={28} strokeWidth={2.5} />
            </TouchableOpacity>

            <SubscriptionModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                subscription={selectedSub}
            />

            <Modal
                visible={isAmountPromptVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsAmountPromptVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={styles.keyboardView}
                    >
                        <View style={styles.promptCard}>
                            <Text style={styles.promptTitle}>Enter Actual Amount</Text>
                            <Text style={styles.promptSub}>
                                "{promptSub?.title}" is an estimated autopay. Please confirm the final amount.
                            </Text>

                            <View style={styles.promptInputRow}>
                                <Text style={styles.promptPrefix}>{symbol}</Text>
                                <TextInput
                                    style={styles.promptInput}
                                    value={manualAmount}
                                    onChangeText={setManualAmount}
                                    keyboardType="numeric"
                                    autoFocus
                                    placeholder="0.00"
                                    placeholderTextColor={activeColors.secondaryText}
                                />
                            </View>

                            <View style={styles.promptActions}>
                                <TouchableOpacity
                                    style={styles.promptCancel}
                                    onPress={() => setIsAmountPromptVisible(false)}
                                >
                                    <Text style={styles.promptCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.promptConfirm, { backgroundColor: activeColors.success }]}
                                    onPress={() => promptSub && handleConfirmPayment(promptSub, parseFloat(manualAmount) || 0)}
                                >
                                    <Text style={styles.promptConfirmText}>Confirm & Pay</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}


const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerArea: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerTitle: { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
    headerSub: {
        fontSize: FONT.xs, fontWeight: '700', color: colors.secondaryText,
        textTransform: 'uppercase', letterSpacing: 1, marginTop: 2,
    },
    summaryWrap: { paddingHorizontal: 20, paddingBottom: 12 },
    summaryCard: {
        borderRadius: RADIUS.xl, padding: 20,
        flexDirection: 'row', alignItems: 'center', gap: 16,
        elevation: 6, shadowColor: colors.tint,
        shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12,
    },
    summaryIcon: { position: 'absolute', top: 14, right: 14 },
    summaryLabel: {
        fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.65)',
        textTransform: 'uppercase', letterSpacing: 1,
    },
    summaryAmount: { fontSize: 26, fontWeight: '900', color: '#fff', marginTop: 2 },
    summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 4 },
    summaryStats: { gap: 10 },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: '900', color: '#fff' },
    statLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase' },
    listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 },
    card: {
        backgroundColor: colors.card, borderRadius: RADIUS.xl,
        marginBottom: 12, padding: 16, borderWidth: 1, borderColor: colors.border,
    },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    cardInfo: { flex: 1, gap: 4 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { fontSize: FONT.body, fontWeight: '800', color: colors.text, flex: 1 },
    dueBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    dueBadgeText: { fontSize: 8, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    cardMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
    catDot: { width: 5, height: 5, borderRadius: 3 },
    catChipText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
    freqChip: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
        backgroundColor: colors.border + '40',
    },
    freqChipText: { fontSize: 9, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.3 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    accountText: { fontSize: FONT.xs, color: colors.secondaryText, fontWeight: '600' },
    dotSep: { color: colors.border, fontWeight: '900' },
    cardRight: { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
    amount: { fontSize: 16, fontWeight: '900' },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    confirmBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    emptyContainer: { paddingTop: 60, alignItems: 'center', gap: 10 },
    emptyText: { fontSize: FONT.body, fontWeight: '900', color: colors.text, marginTop: 8 },
    emptySub: { fontSize: FONT.xs, fontWeight: '600', color: colors.secondaryText },
    fab: {
        position: 'absolute', bottom: 24, right: 24,
        width: 56, height: 56, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center',
        elevation: 8, shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12,
    },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    keyboardView: { width: '100%', alignItems: 'center' },
    promptCard: {
        backgroundColor: colors.card, borderRadius: RADIUS.xl,
        padding: 24, width: '100%', maxWidth: 340, gap: 16,
    },
    promptTitle: { fontSize: FONT.h3, fontWeight: '900', color: colors.text, textAlign: 'center' },
    promptSub: { fontSize: FONT.xs, fontWeight: '600', color: colors.secondaryText, textAlign: 'center', lineHeight: 16 },
    promptInputRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background, borderRadius: RADIUS.lg,
        paddingHorizontal: 16, paddingVertical: 12,
        borderWidth: 1, borderColor: colors.border,
    },
    promptPrefix: { fontSize: 20, fontWeight: '900', color: colors.text, marginRight: 8 },
    promptInput: { flex: 1, fontSize: 22, fontWeight: '900', color: colors.text, padding: 0 },
    promptActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    promptCancel: { flex: 1, padding: 14, borderRadius: RADIUS.md, alignItems: 'center' },
    promptCancelText: { fontSize: FONT.body, fontWeight: '700', color: colors.secondaryText },
    promptConfirm: { flex: 2, padding: 14, borderRadius: RADIUS.md, alignItems: 'center' },
    promptConfirmText: { fontSize: FONT.body, fontWeight: '900', color: '#fff' },
});
