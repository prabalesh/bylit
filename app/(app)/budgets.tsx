import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Repository } from '../../src/services/repository';
import { Budget, Transaction, Category, Account, Settings } from '../../src/types/api';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import { Plus, Target, Wallet, AlertCircle, Pencil, Trash2 } from 'lucide-react-native';
import BudgetModal from '../../src/components/BudgetModal';
import TransactionModal from '../../src/components/TransactionModal';
import { getCurrencySymbol } from '../../src/constants/Currency';
import { useConfirm } from '../../src/providers/ConfirmProvider';
import { useToast } from '../../src/providers/ToastProvider';

export default function BudgetsScreen() {
    const { currentTheme, fontScale, iconScale } = useTheme();
    const activeColors = Colors[currentTheme];
    const { showConfirm } = useConfirm();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [isBudgetModalVisible, setIsBudgetModalVisible] = useState(false);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

    const { data: budgets = [], isLoading: budgetsLoading, refetch: refetchBudgets, isRefetching: isRefetchingBudgets } = useQuery<Budget[]>({
        queryKey: ['budgets'],
        queryFn: () => Repository.getBudgets()
    });

    const { data: transactions = [] } = useQuery<Transaction[]>({
        queryKey: ['transactions'],
        queryFn: () => Repository.getTransactions()
    });

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: () => Repository.getCategories()
    });

    const { data: accounts = [] } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: () => Repository.getAccounts()
    });

    const { data: settings } = useQuery<Settings>({
        queryKey: ['settings'],
        queryFn: () => Repository.getSettings() as any
    });

    const symbol = getCurrencySymbol(settings?.baseCurrency);

    const deleteBudgetMutation = useMutation({
        mutationFn: (id: string) => Repository.deleteBudget(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] });
            showToast('Budget deleted', 'success');
        }
    });

    const handleDeleteBudget = async (id: string) => {
        const confirmed = await showConfirm({
            title: 'Delete Budget',
            message: 'Are you sure you want to delete this budget?',
            confirmText: 'Delete',
            type: 'danger'
        });
        if (confirmed) {
            deleteBudgetMutation.mutate(id);
        }
    };

    const styles = getStyles(activeColors);

    const renderBudget = ({ item }: { item: Budget }) => {
        const category = categories.find(c => c.id === item.categoryId);
        const account = accounts.find(a => a.id === item.accountId);

        // Calculate spending for this budget
        const spending = transactions
            .filter(t => (item.categoryId ? t.categoryId === item.categoryId : t.accountId === item.accountId) && t.type === 'expense')
            .reduce((acc, t) => acc + t.amount, 0);

        const progress = Math.min(spending / item.monthlyLimit, 1);
        const progressPercent = Math.round(progress * 100);

        return (
            <View style={styles.budgetCard}>
                <View style={styles.budgetHeader}>
                    <View style={styles.budgetInfo}>
                        <View style={[styles.iconContainer, { backgroundColor: activeColors.tint + '15' }]}>
                            {item.categoryId ? (
                                <Target size={18} color={activeColors.tint} />
                            ) : (
                                <Wallet size={18} color={activeColors.tint} />
                            )}
                        </View>
                        <View>
                            <Text style={styles.budgetName}>{category?.name || account?.name || 'Unknown'}</Text>
                            <Text style={styles.budgetType}>{item.categoryId ? 'Category' : 'Account'} Budget</Text>
                        </View>
                    </View>
                    <View style={styles.budgetActions}>
                        <TouchableOpacity
                            onPress={() => { setSelectedBudget(item); setIsBudgetModalVisible(true); }}
                            style={styles.actionBtn}
                        >
                            <Pencil size={16} color={activeColors.secondaryText} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleDeleteBudget(item.id)}
                            style={styles.actionBtn}
                        >
                            <Trash2 size={16} color={activeColors.error} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.progressSection}>
                    <View style={styles.progressLabels}>
                        <Text style={styles.spentText}>{symbol}{spending.toLocaleString()} spent</Text>
                        <Text style={styles.limitText}>Limit: {symbol}{item.monthlyLimit.toLocaleString()}</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                        <View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: `${progressPercent}%`,
                                    backgroundColor: progress > 0.9 ? activeColors.error : progress > 0.7 ? '#f59e0b' : activeColors.tint
                                }
                            ]}
                        />
                    </View>
                    <View style={styles.progressFooter}>
                        <Text style={styles.percentText}>{progressPercent}% used</Text>
                        {progress > 0.9 && (
                            <View style={styles.warningTag}>
                                <AlertCircle size={12} color={activeColors.error} />
                                <Text style={styles.warningText}>Near Limit</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.topHeader}>
                <View>
                    <Text style={styles.title}>Planning</Text>
                    <Text style={styles.subtitle}>Budget Management</Text>
                </View>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setIsBudgetModalVisible(true)}
                >
                    <Plus color={activeColors.tint} size={18} />
                    <Text style={styles.addBtnText}>New</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={budgets}
                keyExtractor={item => item.id}
                renderItem={renderBudget}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={budgetsLoading || isRefetchingBudgets}
                        onRefresh={refetchBudgets}
                        tintColor={activeColors.tint}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No budgets found.</Text>
                        <Text style={styles.emptySubText}>Add your first budget to start tracking.</Text>
                    </View>
                }
            />

            <BudgetModal
                visible={isBudgetModalVisible}
                onClose={() => { setIsBudgetModalVisible(false); setSelectedBudget(null); }}
                budget={selectedBudget}
            />
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },
    subtitle: { fontSize: 13, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.tint + '15', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.tint + '30' },
    addBtnText: { fontSize: 12, fontWeight: '800', color: colors.tint, textTransform: 'uppercase' },
    listContent: { padding: 20, paddingBottom: 120 },
    budgetCard: { backgroundColor: colors.card, padding: 20, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    budgetInfo: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    iconContainer: { padding: 10, borderRadius: 12 },
    budgetName: { fontSize: 16, fontWeight: '800', color: colors.text },
    budgetType: { fontSize: 10, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase' },
    budgetActions: { flexDirection: 'row', gap: 10 },
    actionBtn: { padding: 8, backgroundColor: colors.background, borderRadius: 10 },
    progressSection: { gap: 10 },
    progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    spentText: { fontSize: 13, fontWeight: '600', color: colors.secondaryText },
    limitText: { fontSize: 13, fontWeight: '800', color: colors.text },
    progressBarBg: { height: 8, backgroundColor: colors.background, borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 4 },
    progressFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    percentText: { fontSize: 12, fontWeight: '800', color: colors.text },
    warningTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    warningText: { fontSize: 11, fontWeight: '800', color: colors.error, textTransform: 'uppercase' },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { fontSize: 16, fontWeight: '900', color: colors.text, textAlign: 'center' },
    emptySubText: { fontSize: 12, fontWeight: '600', color: colors.secondaryText, textAlign: 'center', marginTop: 8 }
});

