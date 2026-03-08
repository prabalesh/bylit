import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { useMemo } from 'react';
import { PieChart as GiftedPieChart, BarChart } from 'react-native-gifted-charts';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import { CreditCard, TrendingUp, TrendingDown, PieChart as PieIcon, BarChart3, Heart, Flower } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrencySymbol } from '../../src/constants/Currency';
import { useTransactions, useCategories, useAccounts, useSettings } from '../../src/hooks/useData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AnalyticsScreen() {
    const insets = useSafeAreaInsets();
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];

    const { data: transactions = [], isLoading, refetch, isRefetching } = useTransactions();
    const { data: categories = [] } = useCategories();
    const { data: accounts = [] } = useAccounts();
    const { data: settings } = useSettings();

    const symbol = getCurrencySymbol(settings?.baseCurrency);

    const stats = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        const savings = income - expense;

        // Category breakdown
        const categoryMap: Record<string, number> = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            const catId = t.categoryId || 'uncategorized';
            categoryMap[catId] = (categoryMap[catId] || 0) + t.amount;
        });

        const categoryData = Object.entries(categoryMap)
            .map(([id, value]) => {
                const cat = categories.find(c => c.id === id);
                return {
                    value,
                    color: cat?.colorHex || activeColors.secondaryText,
                    text: cat?.name || 'Other',
                };
            })
            .sort((a, b) => b.value - a.value);

        // Trend data (last 7 days)
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        const trendData = days.map(day => {
            const dayTrans = transactions.filter(t => t.date.startsWith(day));
            const dayExpense = dayTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
            return {
                value: dayExpense,
                label: new Date(day).toLocaleDateString([], { weekday: 'narrow' }),
                frontColor: activeColors.tint,
                topLabelComponent: () => (
                    <Text style={{ fontSize: 8, color: activeColors.secondaryText, marginBottom: 4 }}>
                        {dayExpense > 0 ? (dayExpense / 1000).toFixed(1) + 'k' : ''}
                    </Text>
                )
            };
        });

        const totalBorrowed = transactions.filter(t => t.type === 'borrow' && !t.settledStatus).reduce((acc, t) => acc + t.amount, 0);
        const totalLent = transactions.filter(t => t.type === 'lend' && !t.settledStatus).reduce((acc, t) => acc + t.amount, 0);
        const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

        // Asset allocation (accounts)
        const assetAllocationData = accounts.map(account => ({
            value: account.balance,
            color: activeColors.tint,
            text: account.name,
        })).filter(item => item.value > 0);


        return { income, expense, savings, categoryData, trendData, totalBorrowed, totalLent, savingsRate, assetAllocationData };
    }, [transactions, categories, accounts, activeColors]);

    const styles = getStyles(activeColors, insets);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.title}>Analytics</Text>
                        {currentTheme === 'heart' && <Heart color={activeColors.tint} size={20} fill={activeColors.tint} />}
                    </View>
                    <Text style={styles.subtitle}>Insights & Trends</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn}>
                    <BarChart3 color={activeColors.tint} size={20} />
                </TouchableOpacity>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={isRefetching || isLoading} onRefresh={refetch} tintColor={activeColors.tint} />}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.summaryGrid}>
                    <LinearGradient colors={[activeColors.success, activeColors.success + 'CC']} style={styles.summaryCard}>
                        <TrendingUp color="#fff" size={20} opacity={0.6} />
                        <View style={{ marginTop: 16 }}>
                            <Text style={styles.summaryLabel}>Total Income</Text>
                            <Text style={styles.summaryValue}>{symbol}{stats.income.toLocaleString()}</Text>
                        </View>
                    </LinearGradient>
                    <LinearGradient colors={[activeColors.notification, activeColors.notification + 'CC']} style={styles.summaryCard}>
                        <TrendingDown color="#fff" size={20} opacity={0.6} />
                        <View style={{ marginTop: 16 }}>
                            <Text style={styles.summaryLabel}>Total Expense</Text>
                            <Text style={styles.summaryValue}>{symbol}{stats.expense.toLocaleString()}</Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Savings & Debt Summary */}
                <View style={styles.infoRow}>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoLabel}>Savings Rate</Text>
                        <Text style={[styles.infoValue, { color: activeColors.success }]}>{stats.savingsRate.toFixed(1)}%</Text>
                    </View>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoLabel}>Net Debt</Text>
                        <Text style={[styles.infoValue, { color: stats.totalLent - stats.totalBorrowed >= 0 ? activeColors.success : activeColors.error }]}>
                            {symbol}{(stats.totalLent - stats.totalBorrowed).toLocaleString()}
                        </Text>
                    </View>
                </View>

                {/* Performance Chart */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Daily Spending</Text>
                        <Text style={styles.sectionBadge}>Last 7 days</Text>
                    </View>
                    <View style={styles.chartCard}>
                        <BarChart
                            data={stats.trendData}
                            barWidth={22}
                            noOfSections={3}
                            barBorderRadius={6}
                            frontColor={activeColors.tint}
                            yAxisThickness={0}
                            xAxisThickness={0}
                            hideRules
                            yAxisTextStyle={{ color: activeColors.secondaryText, fontSize: 10 }}
                            xAxisLabelTextStyle={{ color: activeColors.secondaryText, fontSize: 10 }}
                            width={Dimensions.get('window').width - 100}
                        />
                    </View>
                </View>

                {/* Category Breakdown */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Expense Allocation</Text>
                        <PieIcon color={activeColors.secondaryText} size={16} />
                    </View>
                    <View style={[styles.chartCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 32 }]}>
                        <GiftedPieChart
                            data={stats.categoryData.length > 0 ? stats.categoryData : [{ value: 1, color: activeColors.border }]}
                            radius={70}
                            innerRadius={55}
                            donut
                            innerCircleColor={activeColors.card}
                        />
                        <View style={styles.legend}>
                            {stats.categoryData.slice(0, 4).map((item, index) => (
                                <View key={index} style={styles.legendItem}>
                                    <View style={[styles.dot, { backgroundColor: item.color }]} />
                                    <Text style={styles.legendText} numberOfLines={1}>{item.text}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Asset Allocation */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Asset Allocation</Text>
                        <CreditCard color={activeColors.secondaryText} size={16} />
                    </View>
                    <View style={styles.chartCard}>
                        {accounts.map((acc) => (
                            <View key={acc.id} style={styles.accountRow}>
                                <View style={styles.accountInfo}>
                                    <View style={[styles.dot, { backgroundColor: activeColors.tint }]} />
                                    <Text style={styles.accountName}>{acc.name}</Text>
                                    <View style={[styles.typeBadge, { backgroundColor: activeColors.border + '50' }]}>
                                        <Text style={[styles.typeBadgeText, { color: activeColors.secondaryText }]}>{acc.type}</Text>
                                    </View>
                                </View>
                                <Text style={styles.accountBalance}>{symbol}{acc.balance.toLocaleString()}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Top Categories */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Top Categories</Text>
                        <PieIcon color={activeColors.secondaryText} size={16} />
                    </View>
                    <View style={styles.chartCard}>
                        {stats.categoryData.length > 0 ? (
                            stats.categoryData.slice(0, 5).map((item, index) => (
                                <View key={index} style={styles.rankRow}>
                                    <View style={styles.rankInfo}>
                                        <View style={[styles.rankIcon, { backgroundColor: item.color + '15' }]}>
                                            <Text style={{ color: item.color, fontSize: 10, fontWeight: '900' }}>{index + 1}</Text>
                                        </View>
                                        <Text style={styles.rankName}>{item.text}</Text>
                                    </View>
                                    <Text style={styles.rankValue}>{symbol}{item.value.toLocaleString()}</Text>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No data available for this period</Text>
                            </View>
                        )}
                    </View>
                </View>
                {currentTheme === 'heart' && (
                    <View style={{ alignItems: 'center', marginTop: 20 }}>
                        <Flower color={activeColors.tint} size={32} opacity={0.2} />
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? insets.top : 16, paddingBottom: 16 },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },
    subtitle: { fontSize: 11, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
    iconBtn: { padding: 8, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    summaryGrid: { flexDirection: 'row', padding: 20, gap: 10 },
    summaryCard: { flex: 1, padding: 20, borderRadius: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
    summaryLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 },
    summaryValue: { fontSize: 18, fontWeight: '900', color: '#fff', marginTop: 4 },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
    sectionTitle: { fontSize: 12, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 1 },
    sectionBadge: { fontSize: 10, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase' },
    chartCard: { backgroundColor: colors.card, padding: 20, borderRadius: 28, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    legend: { gap: 10, flex: 1, marginLeft: 20 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    legendText: { fontSize: 12, fontWeight: '700', color: colors.secondaryText },
    rankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + '30' },
    rankInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rankIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    rankName: { fontSize: 14, fontWeight: '700', color: colors.text },
    rankValue: { fontSize: 15, fontWeight: '900', color: colors.text },
    emptyContainer: { padding: 30, alignItems: 'center' },
    emptyText: { fontSize: 12, fontWeight: '700', color: colors.secondaryText },
    infoRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
    infoCard: { flex: 1, backgroundColor: colors.card, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
    infoLabel: { fontSize: 9, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', marginBottom: 4 },
    infoValue: { fontSize: 16, fontWeight: '900' },
    accountRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '30' },
    accountInfo: { flexDirection: 'row', alignItems: 'center' },
    accountName: { fontSize: 14, fontWeight: '700', color: colors.text },
    accountBalance: { fontSize: 14, fontWeight: '900', color: colors.text },
    typeBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    typeBadgeText: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' }
});
