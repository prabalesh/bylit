import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { PieChart as GiftedPieChart, BarChart } from 'react-native-gifted-charts';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import {
    CreditCard, TrendingUp, TrendingDown, PieChart as PieIcon,
    BarChart3, Heart, Flower, ChevronRight, X, ChevronLeft, Calendar,
    Target, Zap, AlertCircle, Wallet
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInUp, FadeInRight, Layout } from 'react-native-reanimated';
import { getCurrencySymbol } from '../../src/constants/Currency';
import { useTransactions, useCategories, useAccounts, useSettings, useBudgets } from '../../src/hooks/useData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICON, RADIUS, FONT } from '../../src/constants/Sizes';


export default function AnalyticsScreen() {
    const insets = useSafeAreaInsets();
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];

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

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const { data: transactions = [], isLoading, refetch, isRefetching } = useTransactions(startDate, endDate);
    const { data: categories = [] } = useCategories();
    const { data: accounts = [] } = useAccounts();
    const { data: settings } = useSettings();
    const { data: budgets = [] } = useBudgets();

    const symbol = getCurrencySymbol(settings?.baseCurrency);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);

    const stats = useMemo(() => {
        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + t.amount, 0);
        const expense = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + t.amount, 0);

        const categoryMap: Record<string, number> = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            const catId = t.categoryId || 'uncategorized';
            categoryMap[catId] = (categoryMap[catId] || 0) + t.amount;
        });

        const categoryData = Object.entries(categoryMap)
            .map(([id, value]) => {
                const cat = categories.find(c => c.id === id);
                const budget = budgets.find(b => b.categoryId === id);
                return {
                    id,
                    value,
                    color: cat?.colorHex || activeColors.secondaryText,
                    text: cat?.name || 'Other',
                    budget: budget?.monthlyLimit || 0,
                    percent: expense > 0 ? (value / expense) * 100 : 0
                };
            })
            .sort((a, b) => b.value - a.value);

        const trendData = viewMode === 'month' ? (() => {
            const days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return d.toISOString().split('T')[0];
            });

            return days.map(day => {
                const dayExpense = transactions
                    .filter(t => t.date.startsWith(day) && t.type === 'expense')
                    .reduce((acc, t) => acc + t.amount, 0);
                return {
                    value: dayExpense,
                    label: new Date(day).toLocaleDateString([], { weekday: 'narrow' }),
                    frontColor: activeColors.tint || '#10b981',
                    topLabelComponent: () => (
                        <Text style={{ fontSize: 8, color: activeColors.secondaryText, marginBottom: 4 }}>
                            {dayExpense > 0 ? (dayExpense / 1000).toFixed(1) + 'k' : ''}
                        </Text>
                    )
                };
            });
        })() : (() => {
            const months = Array.from({ length: 12 }, (_, i) => i);
            const yearStr = startDate.getFullYear().toString();

            return months.map(m => {
                const monthPad = (m + 1).toString().padStart(2, '0');
                const prefix = `${yearStr}-${monthPad}`;
                const monthExpense = transactions
                    .filter(t => t.date.startsWith(prefix) && t.type === 'expense')
                    .reduce((acc, t) => acc + t.amount, 0);
                return {
                    value: monthExpense,
                    label: new Date(2000, m, 1).toLocaleDateString([], { month: 'narrow' }),
                    frontColor: activeColors.tint || '#10b981',
                    topLabelComponent: () => (
                        <Text style={{ fontSize: 8, color: activeColors.secondaryText, marginBottom: 4 }}>
                            {monthExpense > 0 ? (monthExpense / 1000).toFixed(1) + 'k' : ''}
                        </Text>
                    )
                };
            });
        })();

        // Insights calculations
        const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
        const dailyAvg = expense / daysInPeriod;

        let projectedSpend = expense;
        if (viewMode === 'month' && now.getMonth() === startDate.getMonth()) {
            const currentDay = now.getDate();
            const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            projectedSpend = (expense / currentDay) * totalDaysInMonth;
        }

        const totalBudgetLimit = budgets.reduce((acc, b) => acc + (b.monthlyLimit || 0), 0);
        const budgetUtilization = totalBudgetLimit > 0 ? (expense / totalBudgetLimit) * 100 : 0;

        const totalBorrowed = transactions
            .filter(t => t.type === 'borrow' && !t.settledStatus)
            .reduce((acc, t) => acc + t.amount, 0);
        const totalLent = transactions
            .filter(t => t.type === 'lend' && !t.settledStatus)
            .reduce((acc, t) => acc + t.amount, 0);
        const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

        return {
            income, expense, savings: income - expense,
            categoryData, trendData, totalBorrowed, totalLent,
            savingsRate, dailyAvg, projectedSpend, budgetUtilization, totalBudgetLimit
        };
    }, [transactions, categories, accounts, activeColors, budgets, startDate, endDate, viewMode]);

    // Memoized filtered transactions for selected category modal
    const selectedCategoryTransactions = useMemo(() =>
        transactions
            .filter(t =>
                t.categoryId === selectedCategoryId ||
                (!t.categoryId && selectedCategoryId === 'uncategorized')
            )
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        [transactions, selectedCategoryId]
    );

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
                    <View>
                        <Text style={styles.headerTitle}>Analytics</Text>
                        <View style={styles.periodToggle}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, viewMode === 'month' && styles.toggleActive]}
                                onPress={() => setViewMode('month')}
                            >
                                <Text style={[styles.toggleText, viewMode === 'month' && styles.toggleTextActive]}>Month</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleBtn, viewMode === 'year' && styles.toggleActive]}
                                onPress={() => setViewMode('year')}
                            >
                                <Text style={[styles.toggleText, viewMode === 'year' && styles.toggleTextActive]}>Year</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.headerIconBtn}>
                        <Zap color={activeColors.tint} size={20} />
                    </TouchableOpacity>
                </View>

                <View style={styles.dateNavigator}>
                    <TouchableOpacity onPress={() => shiftPeriod(-1)} style={styles.navBtn}>
                        <ChevronLeft color={activeColors.text} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dateLabel} onPress={() => viewMode === 'month' ? setShowStartPicker(true) : null}>
                        <Calendar size={14} color={activeColors.tint} style={{ marginRight: 6 }} />
                        <Text style={styles.navLabel}>
                            {viewMode === 'month'
                                ? startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                                : startDate.getFullYear()
                            }
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => shiftPeriod(1)} style={styles.navBtn}>
                        <ChevronRight color={activeColors.text} size={20} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={activeColors.tint} />}
            >
                {/* Visual Overview */}
                <Animated.View entering={FadeInUp.delay(100)} style={styles.mainOverview}>
                    <View style={styles.overviewCard}>
                        <View style={styles.overviewRow}>
                            <View>
                                <Text style={styles.overviewLabel}>Cash Flow</Text>
                                <Text style={styles.overviewAmount}>
                                    {symbol}{stats.savings.toLocaleString('en-IN')}
                                </Text>
                            </View>
                            <View style={[styles.rateBadge, { backgroundColor: stats.savings >= 0 ? activeColors.success + '20' : activeColors.error + '20' }]}>
                                <Text style={[styles.rateText, { color: stats.savings >= 0 ? activeColors.success : activeColors.error }]}>
                                    {stats.savingsRate.toFixed(1)}% savings
                                </Text>
                            </View>
                        </View>

                        <View style={styles.progressTrack}>
                            <View style={[styles.progressBar, { width: `${Math.min(100, (stats.expense / (stats.income || 1)) * 100)}%`, backgroundColor: activeColors.error }]} />
                        </View>

                        <View style={styles.overviewStats}>
                            <View style={styles.subStat}>
                                <View style={[styles.dot, { backgroundColor: activeColors.success }]} />
                                <Text style={styles.subStatLabel}>In: {symbol}{stats.income.toLocaleString('en-IN')}</Text>
                            </View>
                            <View style={styles.subStat}>
                                <View style={[styles.dot, { backgroundColor: activeColors.error }]} />
                                <Text style={styles.subStatLabel}>Out: {symbol}{stats.expense.toLocaleString('en-IN')}</Text>
                            </View>
                        </View>
                    </View>
                </Animated.View>

                {/* Insights Grid */}
                <View style={styles.insightsGrid}>
                    <Animated.View entering={FadeInUp.delay(200)} style={styles.insightCard}>
                        <View style={[styles.insightIcon, { backgroundColor: '#3B82F620' }]}>
                            <TrendingDown color="#3B82F6" size={16} />
                        </View>
                        <Text style={styles.insightLabel}>Daily Burn</Text>
                        <Text style={styles.insightValue}>{symbol}{stats.dailyAvg.toFixed(0)}</Text>
                        <Text style={styles.insightSub}>Avg. spending/day</Text>
                    </Animated.View>

                    <Animated.View entering={FadeInUp.delay(300)} style={styles.insightCard}>
                        <View style={[styles.insightIcon, { backgroundColor: '#8B5CF620' }]}>
                            <Target color="#8B5CF6" size={16} />
                        </View>
                        <Text style={styles.insightLabel}>Projection</Text>
                        <Text style={styles.insightValue}>{symbol}{stats.projectedSpend.toFixed(0)}</Text>
                        <Text style={styles.insightSub}>Est. month end</Text>
                    </Animated.View>
                </View>

                {/* Spending Trend */}
                <Animated.View entering={FadeInUp.delay(400)} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Spending Trend</Text>
                        <BarChart3 color={activeColors.secondaryText} size={16} />
                    </View>
                    <View style={styles.chartContainer}>
                        <BarChart
                            data={stats.trendData}
                            hideRules
                            yAxisThickness={0}
                            xAxisThickness={0}
                            yAxisTextStyle={{ color: activeColors.secondaryText, fontSize: 10 }}
                            xAxisLabelTextStyle={{ color: activeColors.secondaryText, fontSize: 10 }}
                            noOfSections={3}
                            width={Dimensions.get('window').width - 100}
                            frontColor={activeColors.tint || '#10b981'}
                            barWidth={viewMode === 'month' ? 22 : 12}
                            spacing={viewMode === 'month' ? 16 : 8}
                            yAxisLabelPrefix={symbol}
                            yAxisLabelWidth={45}
                        />
                    </View>
                </Animated.View>

                {/* Category Allocation */}
                <Animated.View entering={FadeInUp.delay(500)} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Category Spending</Text>
                        <PieIcon color={activeColors.secondaryText} size={16} />
                    </View>

                    <View style={styles.allocationContainer}>
                        {stats.categoryData.length > 0 ? (
                            stats.categoryData.map((item, index) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.categoryCard}
                                    onPress={() => {
                                        setSelectedCategoryId(item.id);
                                        setIsCategoryModalVisible(true);
                                    }}
                                >
                                    <View style={styles.categoryInfo}>
                                        <View style={[styles.categoryIcon, { backgroundColor: item.color + '15' }]}>
                                            <Text style={{ color: item.color, fontWeight: '900', fontSize: 12 }}>{index + 1}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.categoryTitleRow}>
                                                <Text style={styles.categoryName}>{item.text}</Text>
                                                <Text style={styles.categoryAmount}>{symbol}{item.value.toLocaleString('en-IN')}</Text>
                                            </View>

                                            {/* Progress Bar & Budget */}
                                            <View style={styles.budgetRow}>
                                                <View style={styles.progressBg}>
                                                    <View
                                                        style={[
                                                            styles.progressFill,
                                                            {
                                                                width: `${Math.min(100, item.budget > 0 ? (item.value / item.budget) * 100 : item.percent)}%`,
                                                                backgroundColor: item.budget > 0 && item.value > item.budget ? activeColors.error : item.color
                                                            }
                                                        ]}
                                                    />
                                                </View>
                                                <Text style={styles.budgetText}>
                                                    {item.budget > 0
                                                        ? `${((item.value / item.budget) * 100).toFixed(0)}% of ${symbol}${item.budget.toLocaleString()}`
                                                        : `${item.percent.toFixed(1)}% of total`
                                                    }
                                                </Text>
                                            </View>
                                        </View>
                                        <ChevronRight size={16} color={activeColors.border} />
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <AlertCircle color={activeColors.secondaryText} size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                                <Text style={styles.emptyText}>No expenses for this period</Text>
                            </View>
                        )}
                    </View>
                </Animated.View>

                {/* Asset Summary */}
                <Animated.View entering={FadeInUp.delay(600)} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Accounts & Assets</Text>
                        <Wallet color={activeColors.secondaryText} size={16} />
                    </View>
                    <View style={styles.accountsContainer}>
                        {accounts.map((acc) => (
                            <View key={acc.id} style={styles.accountCard}>
                                <View style={[styles.accountType, { backgroundColor: activeColors.tint + '10' }]}>
                                    <CreditCard color={activeColors.tint} size={16} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.accountCardName}>{acc.name}</Text>
                                    <Text style={styles.accountCardType}>{acc.type}</Text>
                                </View>
                                <Text style={styles.accountCardBalance}>{symbol}{acc.balance.toLocaleString('en-IN')}</Text>
                            </View>
                        ))}
                    </View>
                </Animated.View>

                <View style={{ height: 100 }} />
            </ScrollView>

            <Modal
                visible={isCategoryModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setIsCategoryModalVisible(false)}
            >
                <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint="dark" style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {categories.find(c => c.id === selectedCategoryId)?.name || 'Transactions'}
                            </Text>
                            <TouchableOpacity onPress={() => setIsCategoryModalVisible(false)} style={styles.modalCloseBtn}>
                                <X color={activeColors.text} size={20} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                            {selectedCategoryTransactions.map((t, i) => (
                                <Animated.View key={t.id} entering={FadeInRight.delay(i * 50)} style={styles.modalTxItem}>
                                    <View>
                                        <Text style={styles.modalTxDesc}>{t.description || 'Generic Expense'}</Text>
                                        <Text style={styles.modalTxDate}>{new Date(t.date).toLocaleDateString()}</Text>
                                    </View>
                                    <Text style={[styles.modalTxAmount, { color: t.type === 'expense' ? activeColors.error : activeColors.success }]}>
                                        {t.type === 'expense' ? '-' : '+'}{symbol}{t.amount.toLocaleString('en-IN')}
                                    </Text>
                                </Animated.View>
                            ))}
                        </ScrollView>
                    </View>
                </BlurView>
            </Modal>

            {showStartPicker && (
                <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onChange={(_, d) => { setShowStartPicker(false); if (d) setStartDate(d); }}
                />
            )}
        </View>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 15 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { fontSize: 26, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
    headerIconBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },

    periodToggle: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 3, marginTop: 10, width: 140, borderWidth: 1, borderColor: colors.border },
    toggleBtn: { flex: 1, paddingVertical: 5, alignItems: 'center', borderRadius: 9 },
    toggleActive: { backgroundColor: colors.tint },
    toggleText: { fontSize: 10, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase' },
    toggleTextActive: { color: '#fff' },

    dateNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    navBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    dateLabel: { flexDirection: 'row', alignItems: 'center' },
    navLabel: { fontSize: 16, fontWeight: '800', color: colors.text },

    scrollContent: { paddingHorizontal: 20, paddingTop: 10 },

    mainOverview: { marginBottom: 20 },
    overviewCard: { backgroundColor: colors.card, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: colors.border, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15 },
    overviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    overviewLabel: { fontSize: 11, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 1 },
    overviewAmount: { fontSize: 32, fontWeight: '900', color: colors.text, marginTop: 4, letterSpacing: -1 },
    rateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    rateText: { fontSize: 11, fontWeight: '800' },

    progressTrack: { height: 8, backgroundColor: colors.border + '50', borderRadius: 4, marginBottom: 16, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 4 },

    overviewStats: { flexDirection: 'row', gap: 20 },
    subStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    subStatLabel: { fontSize: 12, fontWeight: '700', color: colors.secondaryText },
    dot: { width: 6, height: 6, borderRadius: 3 },

    insightsGrid: { flexDirection: 'row', gap: 12, marginBottom: 25 },
    insightCard: { flex: 1, backgroundColor: colors.card, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: colors.border },
    insightIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    insightLabel: { fontSize: 10, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase' },
    insightValue: { fontSize: 18, fontWeight: '900', color: colors.text, marginVertical: 4 },
    insightSub: { fontSize: 10, fontWeight: '600', color: colors.secondaryText, opacity: 0.7 },

    section: { marginBottom: 28 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 13, fontWeight: '900', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
    chartContainer: { backgroundColor: colors.card, borderRadius: 28, padding: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },

    allocationContainer: { gap: 12 },
    categoryCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.border },
    categoryInfo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    categoryIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    categoryTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    categoryName: { fontSize: 14, fontWeight: '800', color: colors.text },
    categoryAmount: { fontSize: 14, fontWeight: '900', color: colors.text },

    budgetRow: { gap: 6 },
    progressBg: { height: 4, backgroundColor: colors.border + '50', borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    budgetText: { fontSize: 10, fontWeight: '700', color: colors.secondaryText, opacity: 0.8 },

    accountsContainer: { gap: 10 },
    accountCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 12 },
    accountType: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    accountCardName: { fontSize: 14, fontWeight: '800', color: colors.text },
    accountCardType: { fontSize: 10, fontWeight: '600', color: colors.secondaryText, textTransform: 'uppercase' },
    accountCardBalance: { fontSize: 14, fontWeight: '900', color: colors.text },

    emptyState: { padding: 40, alignItems: 'center' },
    emptyText: { fontSize: 14, fontWeight: '700', color: colors.secondaryText },

    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 36, borderTopRightRadius: 36, height: '75%', padding: 24, borderTopWidth: 1, borderColor: colors.border },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
    modalCloseBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    modalScroll: { paddingBottom: 40 },
    modalTxItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
    modalTxDesc: { fontSize: 14, fontWeight: '700', color: colors.text },
    modalTxDate: { fontSize: 11, fontWeight: '600', color: colors.secondaryText, marginTop: 4 },
    modalTxAmount: { fontSize: 16, fontWeight: '900' },
});
