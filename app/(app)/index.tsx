import {
    View, Text, StyleSheet, TouchableOpacity, RefreshControl,
    ScrollView, Modal, Pressable, Alert, TextInput
} from 'react-native';
import { useMemo, useEffect, useState } from 'react';
import {
    Plus, ArrowDownLeft, ArrowUpRight, Filter, Calendar,
    LayoutGrid, Heart, UserCheck, ArrowLeftRight, Receipt,
    Repeat, Target, Settings2, Check, ChevronLeft, ChevronRight
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import TransactionModal from '../../src/components/TransactionModal';
import { Transaction, Subscription } from '../../src/types/api';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getCurrencySymbol } from '../../src/constants/Currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICON } from '../../src/constants/Sizes';
import { LinearGradient } from 'expo-linear-gradient';
import {
    useTransactions, useAccounts, useSettings,
    useDueSubscriptions, useProcessSubscriptionPayment
} from '../../src/hooks/useData';
import { useToast } from '../../src/providers/ToastProvider';
import { useConfirm } from '../../src/providers/ConfirmProvider';
import * as Linking from 'expo-linking';


export default function TransactionsScreen() {
    const insets = useSafeAreaInsets();
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [initialTransactionType, setInitialTransactionType] = useState<string | undefined>(undefined);
    const router = useRouter();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();

    const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
    const now = new Date();
    const firstDay = useMemo(() => {
        if (viewMode === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
        return new Date(now.getFullYear(), 0, 1);
    }, [viewMode]);
    const lastDay = useMemo(() => {
        if (viewMode === 'month') return new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return new Date(now.getFullYear(), 11, 31);
    }, [viewMode]);

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);

    useEffect(() => {
        setStartDate(firstDay);
        setEndDate(lastDay);
    }, [firstDay, lastDay]);

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

    const groupedTransactions = useMemo(() => {
        const groups: { [key: string]: Transaction[] } = {};
        transactions.forEach(t => {
            const date = new Date(t.date).toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });
            if (!groups[date]) groups[date] = [];
            groups[date].push(t);
        });
        return Object.keys(groups).map(date => ({ date, data: groups[date] }));
    }, [transactions]);

    const currentPeriodTotals = useMemo(() => {
        let income = 0;
        let expense = 0;
        transactions.forEach(t => {
            if (t.type === 'income') income += t.amount;
            else if (t.type === 'expense' || t.type === 'lend') expense += t.amount;
        });
        return { income, expense };
    }, [transactions]);

    const shiftPeriod = (delta: number) => {
        const newStart = new Date(startDate);
        if (viewMode === 'month') {
            newStart.setMonth(newStart.getMonth() + delta);
            newStart.setDate(1);
            const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
            setStartDate(newStart);
            setEndDate(newEnd);
        } else {
            newStart.setFullYear(newStart.getFullYear() + delta);
            newStart.setMonth(0);
            newStart.setDate(1);
            const newEnd = new Date(newStart.getFullYear(), 11, 31);
            setStartDate(newStart);
            setEndDate(newEnd);
        }
    };

    const styles = getStyles(activeColors, insets);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View style={styles.titleRow}>
                        <View>
                            <Text style={styles.title}>Finance</Text>
                            <View style={styles.toggleContainer}>
                                <TouchableOpacity
                                    style={[styles.toggleBtn, viewMode === 'month' && styles.toggleBtnActive]}
                                    onPress={() => setViewMode('month')}
                                >
                                    <Text style={[styles.toggleBtnText, viewMode === 'month' && styles.toggleBtnTextActive]}>Month</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.toggleBtn, viewMode === 'year' && styles.toggleBtnActive]}
                                    onPress={() => setViewMode('year')}
                                >
                                    <Text style={[styles.toggleBtnText, viewMode === 'year' && styles.toggleBtnTextActive]}>Year</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        {currentTheme === 'heart' && (
                            <Heart color={activeColors.tint} size={ICON.md} fill={activeColors.tint} />
                        )}
                    </View>
                    <TouchableOpacity style={styles.filterBtn} onPress={() => setIsAccountModalVisible(true)}>
                        <Filter color={activeColors.tint} size={ICON.md} />
                    </TouchableOpacity>
                </View>

                {/* Period Picker */}
                <View style={styles.monthPicker}>
                    <TouchableOpacity onPress={() => shiftPeriod(-1)} style={styles.monthBtn}>
                        <ChevronLeft color={activeColors.text} size={ICON.md} />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>
                        {viewMode === 'month'
                            ? startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                            : startDate.getFullYear()
                        }
                    </Text>
                    <TouchableOpacity onPress={() => shiftPeriod(1)} style={styles.monthBtn}>
                        <ChevronRight color={activeColors.text} size={ICON.md} />
                    </TouchableOpacity>
                </View>

                {/* Summary Cards */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { backgroundColor: activeColors.success + '10' }]}>
                        <LinearGradient
                            colors={[activeColors.success + '20', activeColors.success + '05']}
                            style={styles.summaryIconWrapper}
                        >
                            <ArrowDownLeft color={activeColors.success} size={16} strokeWidth={2.5} />
                        </LinearGradient>
                        <View>
                            <Text style={styles.summaryLabel}>Income</Text>
                            <Text style={[styles.summaryValue, { color: activeColors.success }]}>
                                {symbol}{currentPeriodTotals.income.toLocaleString('en-IN')}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: activeColors.error + '10' }]}>
                        <LinearGradient
                            colors={[activeColors.error + '20', activeColors.error + '05']}
                            style={styles.summaryIconWrapper}
                        >
                            <ArrowUpRight color={activeColors.error} size={16} strokeWidth={2.5} />
                        </LinearGradient>
                        <View>
                            <Text style={styles.summaryLabel}>Expense</Text>
                            <Text style={[styles.summaryValue, { color: activeColors.error }]}>
                                {symbol}{currentPeriodTotals.expense.toLocaleString('en-IN')}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: activeColors.tint + '10' }]}>
                        <LinearGradient
                            colors={[activeColors.tint + '20', activeColors.tint + '05']}
                            style={styles.summaryIconWrapper}
                        >
                            <Check color={activeColors.tint} size={16} strokeWidth={2.5} />
                        </LinearGradient>
                        <View>
                            <Text style={styles.summaryLabel}>Remaining</Text>
                            <Text style={[styles.summaryValue, { color: activeColors.tint }]}>
                                {symbol}{(currentPeriodTotals.income - currentPeriodTotals.expense).toLocaleString('en-IN')}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            <ScrollView
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching || isLoading}
                        onRefresh={refetch}
                        tintColor={activeColors.tint}
                    />
                }
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Filter Chips */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                >
                    <TouchableOpacity style={styles.filterChip} onPress={() => setShowStartPicker(true)}>
                        <Calendar size={ICON.sm} color={activeColors.secondaryText} />
                        <Text style={styles.filterChipText}>
                            {startDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.filterChip} onPress={() => setShowEndPicker(true)}>
                        <Calendar size={ICON.sm} color={activeColors.secondaryText} />
                        <Text style={styles.filterChipText}>
                            {endDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterChip, selectedAccountId !== '' && styles.filterChipActive]}
                        onPress={() => setIsAccountModalVisible(true)}
                    >
                        <LayoutGrid size={ICON.sm} color={selectedAccountId ? '#fff' : activeColors.secondaryText} />
                        <Text style={[styles.filterChipText, selectedAccountId !== '' && styles.filterChipTextActive]}>
                            {selectedAccountId
                                ? accounts.find(a => a.id === selectedAccountId)?.name
                                : 'All Accounts'
                            }
                        </Text>
                    </TouchableOpacity>
                </ScrollView>

                <DueAutopaySection activeColors={activeColors} symbol={symbol} />

                {/* Quick Actions */}
                <View style={styles.quickActionsSection}>
                    <View style={styles.quickActionsGrid}>
                        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(app)/split-bills')}>
                            <LinearGradient
                                colors={[activeColors.notification + '20', activeColors.notification + '05']}
                                style={styles.quickActionIcon}
                            >
                                <Receipt color={activeColors.notification} size={ICON.md} strokeWidth={2} />
                            </LinearGradient>
                            <Text style={styles.quickActionLabel}>Split Bills</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(app)/subscriptions')}>
                            <LinearGradient
                                colors={[activeColors.warning + '20', activeColors.warning + '05']}
                                style={styles.quickActionIcon}
                            >
                                <Repeat color={activeColors.warning} size={ICON.md} strokeWidth={2} />
                            </LinearGradient>
                            <Text style={styles.quickActionLabel}>Autopay</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(app)/budgets')}>
                            <LinearGradient
                                colors={[activeColors.success + '20', activeColors.success + '05']}
                                style={styles.quickActionIcon}
                            >
                                <Target color={activeColors.success} size={ICON.md} strokeWidth={2} />
                            </LinearGradient>
                            <Text style={styles.quickActionLabel}>Budgets</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(app)/categories')}>
                            <LinearGradient
                                colors={[activeColors.tint + '20', activeColors.tint + '05']}
                                style={styles.quickActionIcon}
                            >
                                <LayoutGrid color={activeColors.tint} size={ICON.md} strokeWidth={2} />
                            </LinearGradient>
                            <Text style={styles.quickActionLabel}>Categories</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickActionCard}
                            onPress={() => {
                                setSelectedTransaction(null);
                                setInitialTransactionType('transfer');
                                setIsModalVisible(true);
                            }}
                        >
                            <LinearGradient
                                colors={['#8B5CF630', '#8B5CF610']}
                                style={styles.quickActionIcon}
                            >
                                <ArrowLeftRight color="#8B5CF6" size={ICON.md} strokeWidth={2} />
                            </LinearGradient>
                            <Text style={styles.quickActionLabel}>Transfer</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.quickActionCard} onPress={() => router.push('/(app)/settings')}>
                            <LinearGradient
                                colors={[activeColors.secondaryText + '20', activeColors.secondaryText + '05']}
                                style={styles.quickActionIcon}
                            >
                                <Settings2 color={activeColors.secondaryText} size={ICON.md} strokeWidth={2} />
                            </LinearGradient>
                            <Text style={styles.quickActionLabel}>Settings</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Transactions List */}
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
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            setSelectedTransaction(item);
                                            setIsModalVisible(true);
                                        }}
                                    >
                                        <View style={styles.cardLeft}>
                                            <LinearGradient
                                                colors={[color + '30', color + '10']}
                                                style={styles.iconContainer}
                                            >
                                                {isExpense
                                                    ? <ArrowUpRight color={color} size={18} strokeWidth={2.5} />
                                                    : <ArrowDownLeft color={color} size={18} strokeWidth={2.5} />
                                                }
                                            </LinearGradient>
                                            <View style={styles.cardInfo}>
                                                <Text
                                                    style={styles.description}
                                                    numberOfLines={1}
                                                    ellipsizeMode="tail"
                                                >
                                                    {item.description || item.type}
                                                </Text>
                                                <View style={styles.metaRow}>
                                                    <View style={styles.accountTagContainer}>
                                                        <Text style={styles.accountTag}>{item.accountName || 'Unknown'}</Text>
                                                    </View>
                                                    {(item.type === 'lend' || item.type === 'borrow') && item.personName ? (
                                                        <>
                                                            <Text style={styles.metaSeparator}>•</Text>
                                                            <View style={styles.personRow}>
                                                                <UserCheck size={10} color={activeColors.secondaryText} />
                                                                <Text
                                                                    style={styles.personName}
                                                                    numberOfLines={1}
                                                                    ellipsizeMode="tail"
                                                                >
                                                                    {item.personName}
                                                                </Text>
                                                            </View>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Text style={styles.metaSeparator}>•</Text>
                                                            <Text style={styles.typeLabel}>{item.type}</Text>
                                                        </>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.cardRight}>
                                            <Text
                                                style={[styles.amount, { color }]}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                            >
                                                {isExpense ? '-' : '+'}{symbol}{item.amount.toLocaleString('en-IN')}
                                            </Text>
                                            {item.balanceAfter !== undefined && (
                                                <Text style={styles.balanceAfterText}>
                                                    {symbol}{item.balanceAfter.toLocaleString('en-IN')}
                                                </Text>
                                            )}
                                        </View>
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

                    <View style={styles.creditsContainer}>
                        <Text style={styles.creditsText}>developed by prabalesh</Text>
                        <Text style={styles.creditsLink}>github.com/prabalesh</Text>
                    </View>
                </View>
            </ScrollView>

            <TouchableOpacity
                style={styles.addButton}
                onPress={() => { setSelectedTransaction(null); setIsModalVisible(true); }}
            >
                <Plus color="#ffffff" size={32} />
            </TouchableOpacity>

            <TransactionModal
                visible={isModalVisible}
                onClose={() => { setIsModalVisible(false); setInitialTransactionType(undefined); }}
                transaction={selectedTransaction}
                initialType={initialTransactionType}
            />

            {showStartPicker && (
                <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onChange={(e, d) => { setShowStartPicker(false); if (d) setStartDate(d); }}
                />
            )}
            {showEndPicker && (
                <DateTimePicker
                    value={endDate}
                    mode="date"
                    display="default"
                    onChange={(e, d) => { setShowEndPicker(false); if (d) setEndDate(d); }}
                />
            )}

            <Modal
                visible={isAccountModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsAccountModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setIsAccountModalVisible(false)}>
                    <View style={styles.accountModalContent}>
                        <Text style={styles.modalTitle}>Select Account</Text>
                        <TouchableOpacity
                            style={styles.accountOption}
                            onPress={() => { setSelectedAccountId(''); setIsAccountModalVisible(false); }}
                        >
                            <Text style={[styles.accountOptionText, !selectedAccountId && { color: activeColors.tint }]}>
                                All Accounts
                            </Text>
                        </TouchableOpacity>
                        <ScrollView style={styles.accountScrollView}>
                            {accounts.map(acc => (
                                <TouchableOpacity
                                    key={acc.id}
                                    style={styles.accountOption}
                                    onPress={() => { setSelectedAccountId(acc.id); setIsAccountModalVisible(false); }}
                                >
                                    <View style={styles.accountOptionRow}>
                                        <Text style={[
                                            styles.accountOptionText,
                                            selectedAccountId === acc.id && { color: activeColors.tint }
                                        ]}>
                                            {acc.name}
                                        </Text>
                                        <Text style={styles.accountBalanceText}>
                                            {symbol}{acc.balance.toLocaleString('en-IN')}
                                        </Text>
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


// Separate styles for DueAutopaySection to avoid the getStyles hack
const getDueStyles = (colors: any) => StyleSheet.create({
    dueSection: { paddingHorizontal: 20, marginBottom: 20 },
    dueTitle: {
        fontSize: 10, fontWeight: '800', color: colors.secondaryText,
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
    },
    dueCard: {
        backgroundColor: colors.card, borderRadius: 20, padding: 16,
        borderWidth: 1, borderColor: colors.warning + '40',
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 8,
    },
    dueInfo: { flex: 1, marginRight: 12 },
    dueName: { fontSize: 14, fontWeight: '800', color: colors.text },
    dueDetail: { fontSize: 12, fontWeight: '600', color: colors.secondaryText, marginTop: 2 },
    dueAmount: { color: colors.warning, fontWeight: '900' },
    dueActions: { flexDirection: 'row', gap: 8 },
    completeBtn: {
        backgroundColor: colors.success + '15', width: 36, height: 36,
        borderRadius: 12, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.success + '30',
    },
    confirmModalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    confirmContent: {
        backgroundColor: colors.card, width: '100%',
        borderRadius: 28, padding: 24, borderWidth: 1, borderColor: colors.border,
    },
    confirmTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 8 },
    confirmBody: { fontSize: 14, color: colors.secondaryText, fontWeight: '600', marginBottom: 20 },
    amountInputContainer: { marginBottom: 20 },
    amountLabel: {
        fontSize: 10, fontWeight: '800', color: colors.secondaryText,
        textTransform: 'uppercase', marginBottom: 8,
    },
    amountInputWrapper: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background, borderRadius: 16,
        paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border,
    },
    amountPrefix: { fontSize: 16, fontWeight: '900', color: colors.text, marginRight: 4 },
    amountInput: { flex: 1, height: 48, fontSize: 16, fontWeight: '900', color: colors.text },
    confirmActions: { flexDirection: 'row', gap: 12 },
    cancelBtn: {
        flex: 1, height: 48, borderRadius: 16, backgroundColor: colors.background,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    cancelBtnText: { fontSize: 14, fontWeight: '800', color: colors.secondaryText },
    confirmBtn: { flex: 1, height: 48, borderRadius: 16, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' },
    confirmBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});


function DueAutopaySection({ activeColors, symbol }: { activeColors: any; symbol: string }) {
    const { data: dueSubs = [] } = useDueSubscriptions();
    const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
    const [amount, setAmount] = useState('');
    const processPayment = useProcessSubscriptionPayment();

    const styles = getDueStyles(activeColors);

    if (dueSubs.length === 0) return null;

    const handleCompletePress = (sub: Subscription) => {
        setSelectedSub(sub);
        setAmount(sub.amount.toString());
    };

    const handleConfirm = async () => {
        if (!selectedSub) return;
        const finalAmount = parseFloat(amount);
        if (isNaN(finalAmount)) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }
        try {
            await processPayment.mutateAsync({ subscription: selectedSub, actualAmount: finalAmount });
            setSelectedSub(null);
        } catch {
            Alert.alert('Error', 'Failed to process payment');
        }
    };

    return (
        <View style={styles.dueSection}>
            <Text style={styles.dueTitle}>Due Autopayments</Text>
            {dueSubs.map(sub => (
                <View key={sub.id} style={styles.dueCard}>
                    <View style={styles.dueInfo}>
                        <Text style={styles.dueName}>{sub.title}</Text>
                        <Text style={styles.dueDetail}>
                            Due {new Date(sub.nextDueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                            {' • '}
                            <Text style={styles.dueAmount}>{symbol}{sub.amount.toLocaleString('en-IN')}</Text>
                        </Text>
                    </View>
                    <View style={styles.dueActions}>
                        <TouchableOpacity style={styles.completeBtn} onPress={() => handleCompletePress(sub)}>
                            <Check color={activeColors.success} size={20} />
                        </TouchableOpacity>
                    </View>
                </View>
            ))}

            <Modal
                visible={!!selectedSub}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedSub(null)}
            >
                <View style={styles.confirmModalOverlay}>
                    <View style={styles.confirmContent}>
                        <Text style={styles.confirmTitle}>Complete Transaction?</Text>
                        <Text style={styles.confirmBody}>
                            Mark "{selectedSub?.title}" as paid for this period?
                        </Text>
                        <View style={styles.amountInputContainer}>
                            <Text style={styles.amountLabel}>Update Amount (optional)</Text>
                            <View style={styles.amountInputWrapper}>
                                <Text style={styles.amountPrefix}>{symbol}</Text>
                                <TextInput
                                    style={styles.amountInput}
                                    value={amount}
                                    onChangeText={setAmount}
                                    keyboardType="numeric"
                                    placeholder="0.00"
                                />
                            </View>
                        </View>
                        <View style={styles.confirmActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedSub(null)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmBtn}
                                onPress={handleConfirm}
                                disabled={processPayment.isPending}
                            >
                                <Text style={styles.confirmBtnText}>
                                    {processPayment.isPending ? 'Processing...' : 'Complete'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}


const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderColor: colors.border },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    title: { fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
    toggleContainer: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 3, marginTop: 8, borderWidth: 1, borderColor: colors.border + '50' },
    toggleBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9 },
    toggleBtnActive: { backgroundColor: colors.tint },
    toggleBtnText: { fontSize: 10, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase' },
    toggleBtnTextActive: { color: '#fff' },
    monthPicker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    monthBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    monthText: { fontSize: 18, fontWeight: '800', color: colors.text },
    summaryRow: { flexDirection: 'row', gap: 10 },
    summaryCard: { flex: 1, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border + '20' },
    summaryIconWrapper: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    summaryLabel: { fontSize: 11, fontWeight: '700', color: colors.secondaryText, marginBottom: 1 },
    summaryValue: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
    filterBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tint + '15', justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 100, paddingTop: 16 },
    filterRow: { paddingHorizontal: 20, gap: 8, marginBottom: 16 },
    filterChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
    },
    filterChipActive: { backgroundColor: colors.tint, borderColor: colors.tint },
    filterChipText: { fontSize: 12, fontWeight: '700', color: colors.text },
    filterChipTextActive: { color: '#fff' },
    listSection: { paddingHorizontal: 20 },
    dateGroup: { marginBottom: 24 },
    dateHeader: { marginBottom: 12, paddingLeft: 4 },
    dateHeaderText: { fontSize: 11, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 1.2, opacity: 0.8 },
    card: {
        backgroundColor: colors.card, padding: 14, borderRadius: 24, marginBottom: 12,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
    cardInfo: { flex: 1 },
    iconContainer: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    description: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    accountTagContainer: { backgroundColor: colors.tint + '12', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    accountTag: { fontSize: 10, fontWeight: '800', color: colors.tint, textTransform: 'uppercase' },
    metaSeparator: { fontSize: 12, color: colors.secondaryText, opacity: 0.3 },
    personRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    personName: { fontSize: 11, fontWeight: '700', color: colors.secondaryText },
    typeLabel: { fontSize: 11, fontWeight: '600', color: colors.secondaryText, textTransform: 'lowercase', opacity: 0.7 },
    cardRight: { alignItems: 'flex-end', marginLeft: 12 },
    amount: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
    balanceAfterText: { fontSize: 10, fontWeight: '700', color: colors.secondaryText, marginTop: 4, opacity: 0.6 },
    addButton: {
        position: 'absolute', bottom: 24, right: 24, width: 56, height: 56,
        backgroundColor: colors.tint, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
        elevation: 8, shadowColor: colors.tint,
        shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12,
    },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { fontSize: 16, fontWeight: '900', color: colors.text },
    emptySub: { fontSize: 12, fontWeight: '600', color: colors.secondaryText, marginTop: 4 },
    creditsContainer: {
        marginTop: 40, paddingVertical: 20, alignItems: 'center',
        borderTopWidth: 1, borderTopColor: colors.border + '30', marginBottom: 20,
    },
    creditsText: { fontSize: 12, fontWeight: '700', color: colors.secondaryText, textTransform: 'lowercase' },
    creditsLink: { fontSize: 10, fontWeight: '600', color: colors.tint, marginTop: 4, opacity: 0.8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    accountModalContent: {
        backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: colors.border,
    },
    accountScrollView: { maxHeight: 300 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 20 },
    accountOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
    accountOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    accountOptionText: { fontSize: 14, fontWeight: '700', color: colors.text },
    accountBalanceText: { fontSize: 12, color: colors.secondaryText, fontWeight: '600' },
    quickActionsSection: { paddingHorizontal: 20, marginBottom: 16 },
    quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    quickActionCard: {
        width: '30.5%', backgroundColor: colors.card, borderRadius: 20,
        borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center', gap: 6,
    },
    quickActionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
    quickActionLabel: { fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'center' },
});
