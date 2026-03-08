import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { useState } from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight, TrendingUp, Filter, Clock, CheckCircle2 } from 'lucide-react-native';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import { FONT, ICON, BTN, RADIUS } from '../../src/constants/Sizes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscriptions, useCategories, useAccounts, useSettings, useSaveTransaction, useUpdateSubscriptionLastProcessed } from '../../src/hooks/useData';
import { getCurrencySymbol } from '../../src/constants/Currency';
import SubscriptionModal from '../../src/components/SubscriptionModal';
import { Subscription } from '../../src/types/api';

export default function SubscriptionsScreen() {
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

    const getNextBillingDate = (dateStr: string, frequency: string) => {
        const d = new Date(dateStr);
        if (frequency === 'daily') d.setDate(d.getDate() + 1);
        else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
        else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
        else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
        return d.toISOString();
    };

    const isDue = (nextDueDateStr: string) => {
        const nextDue = new Date(nextDueDateStr);
        const now = new Date();
        return nextDue <= now;
    };

    const handleConfirmPayment = async (sub: Subscription) => {
        // Log transaction
        await saveTransaction.mutateAsync({
            accountId: sub.accountId,
            categoryId: sub.categoryId,
            amount: sub.amount,
            type: sub.type,
            date: sub.nextDueDate,
            description: `Autopay: ${sub.title}`
        });

        // Advance next due date
        const newNextDue = getNextBillingDate(sub.nextDueDate, sub.frequency);
        const processedDate = new Date().toISOString();
        await updateSubscriptionLastProcessed.mutateAsync({
            id: sub.id,
            nextDueDate: newNextDue,
            lastProcessedDate: processedDate,
        });
    };

    const renderSubscription = ({ item }: { item: Subscription }) => {
        const isExpense = item.type === 'expense';
        const color = isExpense ? activeColors.error : activeColors.success;
        const due = isDue(item.nextDueDate);

        return (
            <TouchableOpacity
                style={[styles.card, due && { borderColor: activeColors.notification }]}
                onPress={() => {
                    setSelectedSub(item);
                    setIsModalVisible(true);
                }}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.cardLeft}>
                        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                            {isExpense ? <ArrowUpRight color={color} size={18} /> : <ArrowDownLeft color={color} size={18} />}
                        </View>
                        <View>
                            <Text style={styles.title}>{item.title}</Text>
                            <Text style={styles.subText}>{item.frequency} • {accounts.find(a => a.id === item.accountId)?.name || 'Unknown Account'}</Text>
                        </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.amount, { color }]}>
                            {isExpense ? '-' : '+'}{symbol}{item.amount.toLocaleString()}
                        </Text>
                        <Text style={styles.dueText}>
                            Due: {new Date(item.nextDueDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                    </View>
                </View>

                {due && (
                    <View style={styles.actionRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Clock size={ICON.sm} color={activeColors.notification} />
                            <Text style={[styles.dueBadgeText, { color: activeColors.notification }]}>Payment is Due</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.confirmBtn, { backgroundColor: activeColors.success }]}
                            onPress={() => handleConfirmPayment(item)}
                        >
                            <CheckCircle2 size={ICON.sm} color="#fff" />
                            <Text style={styles.confirmBtnText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const styles = getStyles(activeColors, insets);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Autopay & Subscriptions</Text>
                    <Text style={styles.headerSubtitle}>Manage recurring payments</Text>
                </View>
            </View>

            <FlatList
                data={subscriptions}
                keyExtractor={(item) => item.id}
                renderItem={renderSubscription}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isRefetching || isLoading} onRefresh={refetch} tintColor={activeColors.tint} />}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No recurring payments yet</Text>
                        <Text style={styles.emptySub}>Set up autopay to track your subscriptions</Text>
                    </View>
                )}
            />

            <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                    setSelectedSub(null);
                    setIsModalVisible(true);
                }}
            >
                <Plus color="#ffffff" size={32} />
            </TouchableOpacity>

            <SubscriptionModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                subscription={selectedSub}
            />
        </View>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? insets.top : 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: FONT.h1, fontWeight: '900', color: colors.text },
    headerSubtitle: { fontSize: FONT.xs, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
    listContent: { padding: 20, paddingBottom: 100 },
    card: { backgroundColor: colors.card, padding: 16, borderRadius: RADIUS.xl, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 16 },
    iconContainer: { width: 44, height: 44, borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: FONT.body, fontWeight: '800', color: colors.text },
    subText: { fontSize: FONT.xs, fontWeight: '600', color: colors.secondaryText, textTransform: 'capitalize', marginTop: 4 },
    amount: { fontSize: 18, fontWeight: '900' },
    dueText: { fontSize: FONT.xs, fontWeight: '700', color: colors.secondaryText, marginTop: 4 },
    actionRow: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dueBadgeText: { fontSize: FONT.sm, fontWeight: '800' },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.pill },
    confirmBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '800' },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { fontSize: FONT.body, fontWeight: '900', color: colors.text },
    emptySub: { fontSize: FONT.xs, fontWeight: '600', color: colors.secondaryText, marginTop: 4 },
    addButton: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, backgroundColor: colors.tint, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: colors.tint, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12 },
});
