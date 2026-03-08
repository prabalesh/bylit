import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { ArrowDownRight, ArrowUpLeft, Plus, Heart, Flower, ChevronRight, UserCheck, User } from 'lucide-react-native';
import { Transaction } from '../../src/types/api';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import TransactionModal from '../../src/components/TransactionModal';
import { getCurrencySymbol } from '../../src/constants/Currency';
import { useTransactions, useSettings } from '../../src/hooks/useData';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT, ICON, BTN, RADIUS } from '../../src/constants/Sizes';

export default function LendBorrowScreen() {
    const insets = useSafeAreaInsets();
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    const { data: transactions = [], isLoading, refetch, isRefetching } = useTransactions();
    const { data: settings } = useSettings();

    const symbol = getCurrencySymbol(settings?.baseCurrency);
    const debts = transactions.filter(t => t.type === 'lend' || t.type === 'borrow');

    const totalBorrowed = debts.filter(t => t.type === 'borrow' && !t.settledStatus).reduce((sum, t) => sum + t.amount, 0);
    const totalLent = debts.filter(t => t.type === 'lend' && !t.settledStatus).reduce((sum, t) => sum + t.amount, 0);

    const [activeTab, setActiveTab] = useState<'all' | 'net'>('all');

    const netBalances = debts
        .filter(t => !t.settledStatus && t.personName && t.personName !== 'Unknown')
        .reduce((acc, t) => {
            const name = t.personName!;
            if (!acc[name]) acc[name] = 0;
            acc[name] += t.type === 'lend' ? t.amount : -t.amount;
            return acc;
        }, {} as Record<string, number>);

    const netList = Object.keys(netBalances)
        .map(name => ({ name, amount: netBalances[name] }))
        .filter(n => n.amount !== 0)
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    const styles = getStyles(activeColors, insets);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.title}>Lend & Borrow</Text>
                        {currentTheme === 'heart' && <Heart color={activeColors.tint} size={20} fill={activeColors.tint} />}
                    </View>
                    <Text style={styles.subtitle}>Manage your debts</Text>
                </View>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => { setSelectedTransaction(null); setIsModalVisible(true); }}
                >
                    <Plus color="#fff" size={ICON.md} />
                </TouchableOpacity>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={isRefetching || isLoading} onRefresh={refetch} tintColor={activeColors.tint} />}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Premium Dual Summary */}
                <View style={styles.summaryGrid}>
                    <LinearGradient colors={[activeColors.notification, activeColors.notification + 'CC']} style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>You Owe</Text>
                        <Text style={styles.summaryValue}>{symbol}{totalBorrowed.toLocaleString()}</Text>
                        <ArrowDownRight color="#fff" size={24} style={styles.summaryIcon} opacity={0.2} />
                    </LinearGradient>
                    <LinearGradient colors={[activeColors.success, activeColors.success + 'CC']} style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Owed to You</Text>
                        <Text style={styles.summaryValue}>{symbol}{totalLent.toLocaleString()}</Text>
                        <ArrowUpLeft color="#fff" size={24} style={styles.summaryIcon} opacity={0.2} />
                    </LinearGradient>
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'all' && { backgroundColor: activeColors.tint }]}
                        onPress={() => setActiveTab('all')}
                    >
                        <Text style={[styles.tabText, activeTab === 'all' && { color: '#fff' }]}>All Records</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'net' && { backgroundColor: activeColors.tint }]}
                        onPress={() => setActiveTab('net')}
                    >
                        <Text style={[styles.tabText, activeTab === 'net' && { color: '#fff' }]}>Net Balance</Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.listSection}>
                    {activeTab === 'all' ? (
                        <>
                            {debts.map(item => {
                                const isBorrow = item.type === 'borrow';
                                const color = isBorrow ? activeColors.notification : activeColors.success;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={styles.card}
                                        onPress={() => { setSelectedTransaction(item); setIsModalVisible(true); }}
                                    >
                                        <View style={styles.cardHeader}>
                                            <View style={styles.cardLeft}>
                                                <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                                                    {isBorrow ? <ArrowDownRight color={color} size={ICON.md} /> : <ArrowUpLeft color={color} size={ICON.md} />}
                                                </View>
                                                <View>
                                                    <Text style={styles.accountType}>{item.type}</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                                        {item.personName && item.personName !== 'Unknown' && (
                                                            <UserCheck size={ICON.sm} color={color} />
                                                        )}
                                                        <Text style={styles.accountName}>{item.personName || 'Unknown'}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                            <View style={[styles.statusBadge, { backgroundColor: item.settledStatus ? activeColors.success + '15' : activeColors.warning + '15' }]}>
                                                <Text style={[styles.statusText, { color: item.settledStatus ? activeColors.success : activeColors.warning }]}>
                                                    {item.settledStatus ? 'Settled' : 'Pending'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.cardFooter}>
                                            <View>
                                                <Text style={styles.amountLabel}>AMOUNT</Text>
                                                <Text style={[styles.amountValue, { color }]}>{symbol}{item.amount.toLocaleString()}</Text>
                                            </View>
                                            {item.dueDate && (
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.amountLabel}>DUE DATE</Text>
                                                    <Text style={styles.dateValue}>{new Date(item.dueDate).toLocaleDateString()}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            {debts.length === 0 && (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No records found</Text>
                                    <Text style={styles.emptySub}>Add a loan or debt to track it</Text>
                                </View>
                            )}
                        </>
                    ) : (
                        <>
                            {netList.map(item => {
                                const isOwedToMe = item.amount > 0;
                                const color = isOwedToMe ? activeColors.success : activeColors.notification;
                                return (
                                    <View key={item.name} style={styles.card}>
                                        <View style={styles.cardHeader}>
                                            <View style={styles.cardLeft}>
                                                <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                                                    <User color={color} size={ICON.md} />
                                                </View>
                                                <View>
                                                    <Text style={styles.accountType}>{isOwedToMe ? 'Owes you' : 'You owe'}</Text>
                                                    <Text style={styles.accountName}>{item.name}</Text>
                                                </View>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.amountLabel}>NET AMOUNT</Text>
                                                <Text style={[styles.amountValue, { color }]}>{symbol}{Math.abs(item.amount).toLocaleString()}</Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                            {netList.length === 0 && (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>All settled up!</Text>
                                    <Text style={styles.emptySub}>No outstanding net balances</Text>
                                </View>
                            )}
                        </>
                    )}
                </View>
                {currentTheme === 'heart' && (
                    <View style={{ alignItems: 'center', marginTop: 20 }}>
                        <Flower color={activeColors.tint} size={32} opacity={0.2} />
                    </View>
                )}
            </ScrollView>

            <TransactionModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                transaction={selectedTransaction}
            />
        </View>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? insets.top : 16, paddingBottom: 10 },
    title: { fontSize: FONT.h1, fontWeight: '900', color: colors.text },
    subtitle: { fontSize: FONT.xxs, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
    addBtn: { ...BTN.md, backgroundColor: colors.tint, justifyContent: 'center', alignItems: 'center', borderRadius: BTN.md.borderRadius, elevation: 4, shadowColor: colors.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    summaryGrid: { flexDirection: 'row', padding: 20, gap: 10 },
    summaryCard: { flex: 1, padding: 16, borderRadius: RADIUS.xl, position: 'relative', overflow: 'hidden' },
    summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: FONT.xxs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    summaryValue: { color: '#fff', fontSize: FONT.h3, fontWeight: '900', marginTop: 4 },
    summaryIcon: { position: 'absolute', right: 8, bottom: 8 },
    tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 8 },
    tabBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    tabText: { fontSize: FONT.sm, fontWeight: '800', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
    listSection: { paddingHorizontal: 20 },
    card: { backgroundColor: colors.card, padding: 16, borderRadius: RADIUS.xl, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconContainer: { width: 36, height: 36, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
    accountType: { fontSize: FONT.xxs, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
    accountName: { fontSize: FONT.body, fontWeight: '700', color: colors.text },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm },
    statusText: { fontSize: FONT.xxs, fontWeight: '800', textTransform: 'uppercase' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', backgroundColor: colors.background + '50', padding: 12, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
    amountLabel: { fontSize: FONT.tiny, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', marginBottom: 2 },
    amountValue: { fontSize: FONT.h3, fontWeight: '900' },
    dateValue: { fontSize: FONT.sm, fontWeight: '700', color: colors.text },
    emptyContainer: { padding: 50, alignItems: 'center' },
    emptyText: { fontSize: FONT.body, fontWeight: '900', color: colors.text },
    emptySub: { fontSize: FONT.sm, fontWeight: '600', color: colors.secondaryText, marginTop: 4 }
});
