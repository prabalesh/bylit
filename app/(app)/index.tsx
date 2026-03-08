import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView, Modal, Pressable, Platform } from 'react-native';
import { useState, useMemo } from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight, Filter, Calendar, ChevronDown, LayoutGrid, Heart, Flower, UserCheck, ArrowLeftRight, Wallet, Receipt, Repeat, Target, Settings2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import TransactionModal from '../../src/components/TransactionModal';
import { Transaction } from '../../src/types/api';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getCurrencySymbol } from '../../src/constants/Currency';
import { useTransactions, useAccounts, useSettings } from '../../src/hooks/useData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT, ICON, BTN, RADIUS } from '../../src/constants/Sizes';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';

export default function TransactionsScreen() {
    const insets = useSafeAreaInsets();
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [initialTransactionType, setInitialTransactionType] = useState<string | undefined>(undefined);
    const router = useRouter();

    // Filter states
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);

    const { data: accounts = [] } = useAccounts();
    const { data: settings } = useSettings();
    const { data: transactions = [], isLoading, refetch, isRefetching } = useTransactions(startDate, endDate, selectedAccountId);

    const url = Linking.useURL();

    useEffect(() => {
        if (url) {
            const { path } = Linking.parse(url);
            if (path === 'add-transaction') {
                setSelectedTransaction(null);
                setIsModalVisible(true);
            }
        }
    }, [url]);

    const symbol = getCurrencySymbol(settings?.baseCurrency);

    const summary = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        const lend = transactions.filter(t => t.type === 'lend').reduce((acc, t) => acc + t.amount, 0);
        const borrow = transactions.filter(t => t.type === 'borrow').reduce((acc, t) => acc + t.amount, 0);
        const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
        return { income, expense, lend, borrow, balance: income - expense, totalBalance };
    }, [transactions, accounts]);

    const groupedTransactions = useMemo(() => {
        const groups: { [key: string]: Transaction[] } = {};
        transactions.forEach(t => {
            const date = new Date(t.date).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            if (!groups[date]) groups[date] = [];
            groups[date].push(t);
        });
        return Object.keys(groups).map(date => ({ date, data: groups[date] }));
    }, [transactions]);

    const styles = getStyles(activeColors, insets);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.title}>Finance</Text>
                        {currentTheme === 'heart' && <Heart color={activeColors.tint} size={ICON.md} fill={activeColors.tint} />}
                    </View>
                    <Text style={styles.subtitle}>{startDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}</Text>
                </View>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setIsAccountModalVisible(true)}>
                    <Filter color={activeColors.tint} size={ICON.md} />
                </TouchableOpacity>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={isRefetching || isLoading} onRefresh={refetch} tintColor={activeColors.tint} />}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >

                {/* Filters Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    <TouchableOpacity style={styles.filterChip} onPress={() => setShowStartPicker(true)}>
                        <Calendar size={ICON.sm} color={activeColors.secondaryText} />
                        <Text style={styles.filterChipText}>{startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.filterChip} onPress={() => setShowEndPicker(true)}>
                        <Calendar size={ICON.sm} color={activeColors.secondaryText} />
                        <Text style={styles.filterChipText}>{endDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.filterChip, selectedAccountId !== '' && styles.filterChipActive]} onPress={() => setIsAccountModalVisible(true)}>
                        <LayoutGrid size={ICON.sm} color={selectedAccountId ? '#fff' : activeColors.secondaryText} />
                        <Text style={[styles.filterChipText, selectedAccountId !== '' && { color: '#fff' }]}>
                            {selectedAccountId ? accounts.find(a => a.id === selectedAccountId)?.name : 'All Accounts'}
                        </Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Quick Actions */}
                <View style={styles.quickActionsSection}>
                    <View style={styles.quickActionsGrid}>
                        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(app)/split-bills')}>
                            <View style={[styles.quickActionIcon, { backgroundColor: activeColors.notification + '15' }]}>
                                <Receipt color={activeColors.notification} size={ICON.md} />
                            </View>
                            <Text style={styles.quickActionLabel}>Split Bills</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(app)/subscriptions')}>
                            <View style={[styles.quickActionIcon, { backgroundColor: activeColors.warning + '15' }]}>
                                <Repeat color={activeColors.warning} size={ICON.md} />
                            </View>
                            <Text style={styles.quickActionLabel}>Autopay</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(app)/budgets')}>
                            <View style={[styles.quickActionIcon, { backgroundColor: activeColors.success + '15' }]}>
                                <Target color={activeColors.success} size={ICON.md} />
                            </View>
                            <Text style={styles.quickActionLabel}>Budgets</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(app)/categories')}>
                            <View style={[styles.quickActionIcon, { backgroundColor: activeColors.tint + '15' }]}>
                                <LayoutGrid color={activeColors.tint} size={ICON.md} />
                            </View>
                            <Text style={styles.quickActionLabel}>Categories</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.quickActionCard} onPress={() => {
                            setSelectedTransaction(null);
                            setInitialTransactionType('transfer');
                            setIsModalVisible(true);
                        }}>
                            <View style={[styles.quickActionIcon, { backgroundColor: '#8B5CF615' }]}>
                                <ArrowLeftRight color="#8B5CF6" size={ICON.md} />
                            </View>
                            <Text style={styles.quickActionLabel}>Transfer</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(app)/settings')}>
                            <View style={[styles.quickActionIcon, { backgroundColor: activeColors.secondaryText + '15' }]}>
                                <Settings2 color={activeColors.secondaryText} size={ICON.md} />
                            </View>
                            <Text style={styles.quickActionLabel}>Settings</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Transitions List */}
                <View style={styles.listSection}>
                    {groupedTransactions.map((group) => (
                        <View key={group.date} style={styles.dateGroup}>
                            <View style={styles.dateHeader}>
                                <Text style={styles.dateHeaderText}>{group.date}</Text>
                            </View>
                            {group.data.map((item) => {
                                const isExpense = item.type === 'expense' || item.type === 'lend';
                                const color = isExpense ? activeColors.error : activeColors.success;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={styles.card}
                                        onPress={() => {
                                            setSelectedTransaction(item);
                                            setIsModalVisible(true);
                                        }}
                                    >
                                        <View style={styles.cardLeft}>
                                            <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                                                {isExpense ? <ArrowUpRight color={color} size={18} /> : <ArrowDownLeft color={color} size={18} />}
                                            </View>
                                            <View>
                                                <Text style={styles.description}>{item.description || item.type}</Text>
                                                {(item.type === 'lend' || item.type === 'borrow') && item.personName ? (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                        <UserCheck size={10} color={color} />
                                                        <Text style={[styles.typeLabel, { color }]}>{item.personName}</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.typeLabel}>{item.type}</Text>
                                                )}
                                            </View>
                                        </View>
                                        <Text style={[styles.amount, { color }]}>
                                            {isExpense ? '-' : '+'}{symbol}{item.amount.toLocaleString()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                    {transactions.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No transactions found</Text>
                            <Text style={styles.emptySub}>Time to track some numbers!</Text>
                        </View>
                    )}

                    {/* Developer Credits */}
                    <View style={styles.creditsContainer}>
                        <Text style={styles.creditsText}>developed by prabalesh</Text>
                        <Text style={styles.creditsLink}>github.com/prabalesh</Text>
                    </View>
                </View>
            </ScrollView>

            <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                    setSelectedTransaction(null);
                    setIsModalVisible(true);
                }}
            >
                <Plus color="#ffffff" size={32} />
            </TouchableOpacity>

            {/* Modals & Pickers */}
            <TransactionModal
                visible={isModalVisible}
                onClose={() => { setIsModalVisible(false); setInitialTransactionType(undefined); }}
                transaction={selectedTransaction}
                initialType={initialTransactionType}
            />

            {showStartPicker && <DateTimePicker value={startDate} mode="date" display="default" onChange={(e, d) => { setShowStartPicker(false); if (d) setStartDate(d); }} />}
            {showEndPicker && <DateTimePicker value={endDate} mode="date" display="default" onChange={(e, d) => { setShowEndPicker(false); if (d) setEndDate(d); }} />}

            <Modal visible={isAccountModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsAccountModalVisible(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setIsAccountModalVisible(false)}>
                    <View style={styles.accountModalContent}>
                        <Text style={styles.modalTitle}>Select Account</Text>
                        <TouchableOpacity style={styles.accountOption} onPress={() => { setSelectedAccountId(''); setIsAccountModalVisible(false); }}>
                            <Text style={[styles.accountOptionText, !selectedAccountId && { color: activeColors.tint }]}>All Accounts</Text>
                        </TouchableOpacity>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {accounts.map(acc => (
                                <TouchableOpacity key={acc.id} style={styles.accountOption} onPress={() => { setSelectedAccountId(acc.id); setIsAccountModalVisible(false); }}>
                                    <View style={styles.accountOptionRow}>
                                        <Text style={[styles.accountOptionText, selectedAccountId === acc.id && { color: activeColors.tint }]}>{acc.name}</Text>
                                        <Text style={styles.accountBalanceText}>{symbol}{acc.balance.toLocaleString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? insets.top : 16, paddingBottom: 10 },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },
    subtitle: { fontSize: 11, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
    filterBtn: { padding: 8, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
    summaryContainer: { padding: 20 },
    summaryCard: { padding: 24, borderRadius: 28, overflow: 'hidden', elevation: 8, shadowColor: colors.tint, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
    summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    summaryBalance: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 2 },
    summaryStats: { flexDirection: 'row', marginTop: 20, padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, alignItems: 'center' },
    statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    statIconContainer: { width: 20, height: 20, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
    dividerVertical: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 10 },
    statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
    statValue: { color: '#fff', fontSize: 12, fontWeight: '800' },
    heartDecoration: { position: 'absolute', right: -10, top: -10 },
    filterRow: { paddingHorizontal: 20, gap: 8, marginBottom: 16 },
    filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
    filterChipActive: { backgroundColor: colors.tint, borderColor: colors.tint },
    filterChipText: { fontSize: 12, fontWeight: '700', color: colors.text },
    listSection: { paddingHorizontal: 20 },
    dateGroup: { marginBottom: 20 },
    dateHeader: { marginBottom: 10, paddingLeft: 4 },
    dateHeaderText: { fontSize: 10, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 1 },
    card: { backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconContainer: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    description: { fontSize: 14, fontWeight: '700', color: colors.text },
    typeLabel: { fontSize: 10, fontWeight: '600', color: colors.secondaryText, textTransform: 'capitalize', marginTop: 2 },
    amount: { fontSize: 15, fontWeight: '900' },
    addButton: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, backgroundColor: colors.tint, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: colors.tint, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12 },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { fontSize: 16, fontWeight: '900', color: colors.text },
    emptySub: { fontSize: 12, fontWeight: '600', color: colors.secondaryText, marginTop: 4 },
    creditsContainer: {
        marginTop: 40,
        paddingVertical: 20,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.border + '30',
        marginBottom: 20
    },
    creditsText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.secondaryText,
        textTransform: 'lowercase'
    },
    creditsLink: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.tint,
        marginTop: 4,
        opacity: 0.8
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    accountModalContent: { backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: colors.border },
    modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 20 },
    accountOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
    accountOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    accountOptionText: { fontSize: 14, fontWeight: '700', color: colors.text },
    accountBalanceText: { fontSize: 12, color: colors.secondaryText, fontWeight: '600' },
    quickActionsSection: { paddingHorizontal: 20, marginBottom: 16 },
    quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    quickActionCard: {
        width: '30.5%',
        backgroundColor: colors.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        alignItems: 'center',
        gap: 6,
    },
    quickActionIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    quickActionLabel: { fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'center' },
    quickActionSub: { fontSize: 10, fontWeight: '600', color: colors.secondaryText, textAlign: 'center' },
});
