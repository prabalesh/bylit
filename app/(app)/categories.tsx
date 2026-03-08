import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView, Platform } from 'react-native';
import { useState, useMemo } from 'react';
import { Plus, ChevronRight, HelpCircle, Heart, Trash2, X } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import CategoryModal from '../../src/components/CategoryModal';
import { Category } from '../../src/types/api';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import { useCategories } from '../../src/hooks/useData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CategoriesScreen() {
    const insets = useSafeAreaInsets();
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

    const { data: categories = [], isLoading, refetch, isRefetching } = useCategories();

    const groupedCategories = useMemo(() => {
        const groups: { [key: string]: Category[] } = {};
        categories.forEach(c => {
            const type = c.type.charAt(0).toUpperCase() + c.type.slice(1);
            if (!groups[type]) groups[type] = [];
            groups[type].push(c);
        });
        return Object.keys(groups).map(type => ({ type, data: groups[type] }));
    }, [categories]);

    const styles = getStyles(activeColors, insets);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.title}>Categories</Text>
                        {currentTheme === 'heart' && <Heart color={activeColors.tint} size={20} fill={activeColors.tint} />}
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

            <FlatList
                contentContainerStyle={styles.listContent}
                data={groupedCategories}
                keyExtractor={item => item.type}
                refreshControl={<RefreshControl refreshing={isRefetching || isLoading} onRefresh={refetch} tintColor={activeColors.tint} />}
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
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.card}
                                    onPress={() => { setSelectedCategory(item); setIsCategoryModalVisible(true); }}
                                >
                                    <View style={styles.cardLeft}>
                                        <View style={[styles.iconContainer, { backgroundColor: item.colorHex + '15' }]}>
                                            <IconComp size={22} color={item.colorHex} />
                                        </View>
                                        <Text style={styles.cardName}>{item.name}</Text>
                                    </View>
                                    <ChevronRight size={18} color={activeColors.secondaryText} />
                                </TouchableOpacity>
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
        </View>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? insets.top : 16, paddingBottom: 10 },
    title: { fontSize: 24, fontWeight: '900', color: colors.text },
    subtitle: { fontSize: 11, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
    addBtn: { width: 38, height: 38, backgroundColor: colors.tint, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: colors.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 },
    section: { marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingLeft: 4 },
    sectionTitle: { fontSize: 10, fontWeight: '900', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 1 },
    sectionBadge: { backgroundColor: colors.card, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
    sectionBadgeText: { fontSize: 9, fontWeight: '800', color: colors.secondaryText },
    card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, padding: 14, borderRadius: 20, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
    emptyContainer: { padding: 50, alignItems: 'center' },
    emptyText: { fontSize: 16, fontWeight: '900', color: colors.text },
    emptySub: { fontSize: 12, fontWeight: '600', color: colors.secondaryText, marginTop: 4 }
});
