import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView, Modal } from 'react-native';
import { useState, useMemo } from 'react';
import { Plus, HelpCircle, Heart, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CategoryModal from '../../src/components/CategoryModal';
import { Category } from '../../src/types/api';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import { useCategories, useTransactions, useSettings } from '../../src/hooks/useData';
import { getCurrencySymbol } from '../../src/constants/Currency';


export default function CategoriesScreen() {
    const insets = useSafeAreaInsets();
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [isTransactionModalVisible, setIsTransactionModalVisible] = useState(false);
    const [viewingCategory, setViewingCategory] = useState<Category | null>(null);

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const { data: categories = [], isLoading, refetch, isRefetching } = useCategories();
    const { data: transactions = [] } = useTransactions(startDate, endDate);
    const { data: settings } = useSettings();
    const symbol = getCurrencySymbol(settings?.baseCurrency);

    const groupedCategories = useMemo(() => {
        const groups: { [key: string]: Category[] } = {};
        categories.forEach(c => {
            const type = c.type.charAt(0).toUpperCase() + c.type.slice(1);
            if (!groups[type]) groups[type] = [];
            groups[type].push(c);
        });
        return Object.keys(groups).map(type => ({ type, data: groups[type] }));
    }, [categories]);

    // Memoized to avoid double-filtering in modal render + empty check
    const viewingCategoryTransactions = useMemo(() =>
        transactions
            .filter(t => t.categoryId === viewingCategory?.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        [transactions, viewingCategory]
    );

    const shiftMonth = (delta: number) => {
        const newStart = new Date(startDate);
        newStart.setMonth(newStart.getMonth() + delta);
        newStart.setDate(1);

        const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);

        setStartDate(newStart);
        setEndDate(newEnd);
    };

    const styles = getStyles(activeColors, insets);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <View style={styles.titleRow}>
                            <Text style={styles.title}>Categories</Text>
                            {currentTheme === 'heart' && (
                                <Heart color={activeColors.tint} size={20} fill={activeColors.tint} />
                            )}
                        </View>
                        <Text style={styles.subtitle}>Organize your spending</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => { setSelectedCategory(null); setIsCategoryModalVisible(true); }}
                    >
                        <Plus color="#fff" size={20} />
                    </TouchableOpacity>
                </View>

                {/* Month Picker */}
                <View style={styles.monthPicker}>
                    <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthBtn}>
                        <ChevronLeft color={activeColors.text} size={20} />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>
                        {startDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </Text>
                    <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthBtn}>
                        <ChevronRight color={activeColors.text} size={20} />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                contentContainerStyle={styles.listContent}
                data={groupedCategories}
                keyExtractor={item => item.type}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching || isLoading}
                        onRefresh={refetch}
                        tintColor={activeColors.tint}
                    />
                }
                showsVerticalScrollIndicator={false}
                renderItem={({ item: group }) => (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{group.type}</Text>
                            <View style={styles.sectionBadge}>
                                <Text style={styles.sectionBadgeText}>{group.data.length}</Text>
                            </View>
                        </View>
                        {group.data.map(item => {
                            const IconComp = (LucideIcons as any)[item.iconSlug] || HelpCircle;
                            return (
                                <View key={item.id} style={styles.card}>
                                    <TouchableOpacity
                                        style={styles.cardLeft}
                                        onPress={() => { setSelectedCategory(item); setIsCategoryModalVisible(true); }}
                                    >
                                        <View style={[styles.iconContainer, { backgroundColor: item.colorHex + '15' }]}>
                                            <IconComp size={22} color={item.colorHex} />
                                        </View>
                                        <Text style={styles.cardName}>{item.name}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.viewTransBtn}
                                        onPress={() => { setViewingCategory(item); setIsTransactionModalVisible(true); }}
                                    >
                                        <LucideIcons.History size={18} color={activeColors.secondaryText} />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No categories found</Text>
                        <Text style={styles.emptySub}>Add some to get started</Text>
                    </View>
                }
            />

            <CategoryModal
                visible={isCategoryModalVisible}
                onClose={() => { setIsCategoryModalVisible(false); setSelectedCategory(null); }}
                category={selectedCategory}
            />

            {/* Transactions Modal */}
            <Modal
                visible={isTransactionModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsTransactionModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {viewingCategory?.name || ''} Transactions
                            </Text>
                            <TouchableOpacity onPress={() => setIsTransactionModalVisible(false)}>
                                <X color={activeColors.text} size={24} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.modalScroll}>
                            {viewingCategoryTransactions.length > 0 ? (
                                viewingCategoryTransactions.map(t => (
                                    <View key={t.id} style={styles.transactionItem}>
                                        <View>
                                            <Text style={styles.transactionDesc}>{t.description || 'No description'}</Text>
                                            <Text style={styles.transactionDate}>
                                                {new Date(t.date).toLocaleDateString('en-IN')}
                                            </Text>
                                        </View>
                                        <Text style={[
                                            styles.transactionAmount,
                                            { color: t.type === 'expense' ? activeColors.error : activeColors.success }
                                        ]}>
                                            {t.type === 'expense' ? '-' : '+'}{symbol}{t.amount.toLocaleString('en-IN')}
                                        </Text>
                                    </View>
                                ))
                            ) : (
                                <View style={styles.modalEmptyContainer}>
                                    <Text style={styles.emptySub}>No transactions found for this category</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {
                showStartPicker && (
                    <DateTimePicker
                        value={startDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_, selectedDate) => {
                            setShowStartPicker(Platform.OS === 'ios');
                            if (selectedDate) setStartDate(selectedDate);
                        }}
                    />
                )
            }
            {
                showEndPicker && (
                    <DateTimePicker
                        value={endDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_, selectedDate) => {
                            setShowEndPicker(Platform.OS === 'ios');
                            if (selectedDate) setEndDate(selectedDate);
                        }}
                    />
                )
            }
        </View >
    );
}


const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: 20, borderBottomWidth: 1, borderColor: colors.border },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1 },
    subtitle: { fontSize: 13, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
    addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tint, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: colors.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    monthPicker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    monthBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    monthText: { fontSize: 18, fontWeight: '800', color: colors.text },
    listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 },
    section: { marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingLeft: 4 },
    sectionTitle: {
        fontSize: 10, fontWeight: '900', color: colors.secondaryText,
        textTransform: 'uppercase', letterSpacing: 1,
    },
    sectionBadge: {
        backgroundColor: colors.card, paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 6, borderWidth: 1, borderColor: colors.border,
    },
    sectionBadgeText: { fontSize: 9, fontWeight: '800', color: colors.secondaryText },
    card: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.card, padding: 14, borderRadius: 20,
        marginBottom: 8, borderWidth: 1, borderColor: colors.border,
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
    viewTransBtn: { padding: 8 },
    emptyContainer: { padding: 50, alignItems: 'center' },
    emptyText: { fontSize: 16, fontWeight: '900', color: colors.text },
    emptySub: { fontSize: 12, fontWeight: '600', color: colors.secondaryText, marginTop: 4 },
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.background, borderTopLeftRadius: 32,
        borderTopRightRadius: 32, height: '70%', padding: 24,
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
    modalScroll: { paddingBottom: 40 },
    modalEmptyContainer: { padding: 40, alignItems: 'center' },
    transactionItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border + '30',
    },
    transactionDesc: { fontSize: 14, fontWeight: '700', color: colors.text },
    transactionDate: { fontSize: 12, color: colors.secondaryText, marginTop: 2 },
    transactionAmount: { fontSize: 16, fontWeight: '900' },
});
