import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Modal, TouchableOpacity, ScrollView, Platform, BackHandler } from 'react-native';
import { X, Trash2, Target, Wallet } from 'lucide-react-native';
import { Budget } from '../types/api';
import { Colors } from '../constants/Colors';
import { useTheme } from '../providers/ThemeContext';
import { useToast } from '../providers/ToastProvider';
import { useConfirm } from '../providers/ConfirmProvider';
import { useCategories, useAccounts, useSettings, useSaveBudget, useDeleteBudget } from '../hooks/useData';


interface BudgetModalProps {
    visible: boolean;
    onClose: () => void;
    budget?: Budget | null;
}


export default function BudgetModal({ visible, onClose, budget = null }: BudgetModalProps) {
    const { currentTheme, fontScale, iconScale } = useTheme();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();
    const activeColors = Colors[currentTheme];

    const [monthlyLimit, setMonthlyLimit] = useState('');
    const [budgetType, setBudgetType] = useState<'category' | 'account'>('category');
    const [categoryId, setCategoryId] = useState('');
    const [accountId, setAccountId] = useState('');

    const { data: categories = [] } = useCategories();
    const { data: accounts = [] } = useAccounts();
    const { data: settings } = useSettings();

    const saveMutation = useSaveBudget();
    const deleteMutation = useDeleteBudget();

    // BackHandler is Android-only
    useEffect(() => {
        if (Platform.OS !== 'android') return;
        const backAction = () => {
            if (visible) { onClose(); return true; }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [visible, onClose]);

    useEffect(() => {
        if (budget) {
            setMonthlyLimit(budget.monthlyLimit.toString());
            if (budget.categoryId) {
                setBudgetType('category');
                setCategoryId(budget.categoryId);
            } else if (budget.accountId) {
                setBudgetType('account');
                setAccountId(budget.accountId);
            }
        } else {
            setMonthlyLimit('');
            setBudgetType('category');
            setCategoryId(categories.length > 0 ? categories[0].id : '');
            setAccountId(accounts.length > 0 ? accounts[0].id : '');
        }
    }, [budget, visible, categories, accounts]);

    const handleDelete = async () => {
        const confirmed = await showConfirm({
            title: 'Delete Budget',
            message: 'Are you sure you want to delete this budget plan?',
            confirmText: 'Delete',
            type: 'danger'
        });
        if (confirmed) {
            deleteMutation.mutate(budget!.id, {
                onSuccess: () => { showToast('Budget deleted', 'success'); onClose(); },
                onError: () => showToast('Failed to delete budget', 'error')
            });
        }
    };

    const handleSave = () => {
        const numLimit = parseFloat(monthlyLimit);
        if (isNaN(numLimit) || numLimit <= 0) {
            showToast('Please enter a valid monthly limit', 'error');
            return;
        }
        if (budgetType === 'category' && !categoryId) {
            showToast('Please select a category', 'error');
            return;
        }
        if (budgetType === 'account' && !accountId) {
            showToast('Please select an account', 'error');
            return;
        }

        saveMutation.mutate({
            id: budget?.id,
            monthlyLimit: numLimit,
            ...(budgetType === 'category' ? { categoryId } : { accountId }),
        }, {
            onSuccess: () => {
                showToast(budget ? 'Budget plan updated' : 'Budget plan created', 'success');
                onClose();
            },
            onError: () => showToast('Failed to save budget', 'error')
        });
    };

    const styles = getStyles(activeColors, fontScale);

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            {/* Ensure colors.background is always a 6-digit hex for the opacity concat to work correctly */}
            <View style={[styles.modalOverlay, { backgroundColor: activeColors.background + '80' }]}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{budget ? 'Edit Budget' : 'New Budget'}</Text>
                        <View style={styles.headerRight}>
                            {budget && (
                                <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                                    <Trash2 color={activeColors.error} size={iconScale.md} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <X color={activeColors.secondaryText} size={iconScale.lg} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView style={styles.content}>
                        <View style={styles.typeSelector}>
                            <TouchableOpacity
                                style={[styles.typeBtn, budgetType === 'category' && styles.typeBtnActive]}
                                onPress={() => setBudgetType('category')}
                            >
                                <Target size={iconScale.sm} color={budgetType === 'category' ? '#fff' : activeColors.secondaryText} />
                                <Text style={[styles.typeBtnText, budgetType === 'category' && styles.typeBtnTextActive]}>Category</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeBtn, budgetType === 'account' && styles.typeBtnActive]}
                                onPress={() => setBudgetType('account')}
                            >
                                <Wallet size={iconScale.sm} color={budgetType === 'account' ? '#fff' : activeColors.secondaryText} />
                                <Text style={[styles.typeBtnText, budgetType === 'account' && styles.typeBtnTextActive]}>Account</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Monthly Limit ({settings?.baseCurrency || 'INR'})</Text>
                            <TextInput
                                style={styles.inputLarge}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor={activeColors.secondaryText + '50'}
                                value={monthlyLimit}
                                onChangeText={setMonthlyLimit}
                                autoFocus={!budget}
                                textAlign="center"
                                cursorColor={activeColors.tint}
                                selectionColor={activeColors.tint + '30'}
                            />
                        </View>

                        {budgetType === 'category' ? (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Select Category</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                    {categories.map((c) => (
                                        <TouchableOpacity
                                            key={c.id}
                                            style={[styles.chip, categoryId === c.id && styles.chipActive]}
                                            onPress={() => setCategoryId(c.id)}
                                        >
                                            <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        ) : (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Select Account</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                    {accounts.map((a) => (
                                        <TouchableOpacity
                                            key={a.id}
                                            style={[styles.chip, accountId === a.id && styles.chipActive]}
                                            onPress={() => setAccountId(a.id)}
                                        >
                                            <Text style={[styles.chipText, accountId === a.id && styles.chipTextActive]}>{a.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <View style={styles.scrollSpacer} />
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.saveBtn, saveMutation.isPending && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saveMutation.isPending}
                        >
                            <Text style={styles.saveBtnText}>
                                {saveMutation.isPending ? 'Processing...' : budget ? 'Update Budget' : 'Establish Budget'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}


const getStyles = (colors: any, fontScale: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        marginTop: Platform.OS === 'ios' ? 100 : 40,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    title: { fontSize: fontScale.title, fontWeight: '900', color: colors.text },
    closeBtn: { padding: 6, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    deleteBtn: { padding: 6, backgroundColor: colors.error + '10', borderRadius: 12, borderWidth: 1, borderColor: colors.error + '20' },
    content: { flex: 1, padding: 20 },
    typeSelector: {
        flexDirection: 'row', backgroundColor: colors.card, borderRadius: 18,
        marginBottom: 24, padding: 4, borderWidth: 1, borderColor: colors.border,
    },
    typeBtn: {
        flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 14,
        flexDirection: 'row', justifyContent: 'center', gap: 8,
    },
    typeBtnActive: {
        backgroundColor: colors.tint, elevation: 4, shadowColor: colors.tint,
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
    },
    typeBtnText: {
        fontSize: fontScale.label + 1, fontWeight: '800', color: colors.secondaryText,
        textTransform: 'uppercase', letterSpacing: 0.5,
    },
    typeBtnTextActive: { color: '#ffffff' },
    inputGroup: { marginBottom: 24 },
    label: {
        fontSize: fontScale.label, fontWeight: '900', textTransform: 'uppercase',
        color: colors.secondaryText, marginBottom: 8, marginLeft: 4, letterSpacing: 1,
    },
    inputLarge: {
        backgroundColor: colors.card, padding: 20, borderRadius: 20,
        fontSize: fontScale.input, fontWeight: '900', color: colors.tint,
        borderWidth: 1, borderColor: colors.border, textAlign: 'center',
    },
    chipScroll: { flexDirection: 'row', paddingVertical: 4 },
    chip: {
        paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card,
        borderRadius: 14, marginRight: 10, borderWidth: 1, borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.tint + '15', borderColor: colors.tint },
    chipText: { fontSize: fontScale.body - 1, fontWeight: '700', color: colors.secondaryText },
    chipTextActive: { color: colors.tint },
    scrollSpacer: { height: 40 },
    footer: { padding: 20, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
    saveBtn: {
        backgroundColor: colors.tint, padding: 16, borderRadius: 20, alignItems: 'center',
        elevation: 8, shadowColor: colors.tint,
        shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12,
    },
    saveBtnText: { color: '#ffffff', fontSize: fontScale.body + 1, fontWeight: '900' },
});
