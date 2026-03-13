import { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
    ScrollView, KeyboardAvoidingView, Platform, BackHandler
} from 'react-native';
import { X, Check, Trash2 } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Category } from '../types/api';
import { Colors } from '../constants/Colors';
import { useTheme } from '../providers/ThemeContext';
import { useToast } from '../providers/ToastProvider';
import { useConfirm } from '../providers/ConfirmProvider';
import { useSaveCategory, useDeleteCategory } from '../hooks/useData';


interface CategoryModalProps {
    visible: boolean;
    onClose: () => void;
    category?: Category | null;
}


const CATEGORY_COLORS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444',
    '#8b5cf6', '#06b6d4', '#f97316', '#22c55e', '#a855f7'
];

const COMMON_ICONS = [
    'ShoppingBag', 'Coffee', 'Utensils', 'Car', 'Home',
    'Shield', 'Smartphone', 'Zap', 'Briefcase', 'Heart',
    'Film', 'Dumbbell', 'Plane', 'Gift', 'Book',
    'Palette', 'Mic', 'Camera', 'Music', 'Wine'
];


export default function CategoryModal({ visible, onClose, category }: CategoryModalProps) {
    const insets = useSafeAreaInsets();
    const { currentTheme, fontScale, iconScale } = useTheme();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();
    const activeColors = Colors[currentTheme];

    const [name, setName] = useState('');
    const [colorHex, setColorHex] = useState(CATEGORY_COLORS[0]);
    const [iconSlug, setIconSlug] = useState(COMMON_ICONS[0]);
    const [type, setType] = useState<'expense' | 'income'>('expense');

    const saveMutation = useSaveCategory();
    const deleteMutation = useDeleteCategory();

    useEffect(() => {
        const backAction = () => {
            if (visible) { onClose(); return true; }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [visible, onClose]);

    useEffect(() => {
        if (category) {
            setName(category.name);
            setColorHex(category.colorHex);
            setIconSlug(category.iconSlug);
            setType(category.type === 'income' ? 'income' : 'expense');
        } else {
            setName('');
            setColorHex(CATEGORY_COLORS[0]);
            setIconSlug(COMMON_ICONS[0]);
            setType('expense');
        }
    }, [category, visible]);

    const handleDelete = async () => {
        if (!category) return;

        const confirmed = await showConfirm({
            title: 'Delete Category',
            message: 'Are you sure you want to delete this category? This action cannot be undone.',
            confirmText: 'Delete',
            type: 'danger'
        });

        if (confirmed) {
            deleteMutation.mutate(category.id, {
                onSuccess: () => {
                    showToast('Category deleted', 'success');
                    onClose();
                },
                onError: () => showToast('Failed to delete category', 'error')
            });
        }
    };

    const handleSave = () => {
        if (!name.trim()) {
            showToast('Please enter a category name', 'error');
            return;
        }
        saveMutation.mutate({
            id: category?.id,
            name: name.trim(),
            colorHex,
            iconSlug,
            type
        }, {
            onSuccess: () => {
                showToast(category ? 'Category updated' : 'Category created', 'success');
                onClose();
            },
            onError: () => showToast('Failed to save category', 'error')
        });
    };

    const styles = getStyles(activeColors, insets, fontScale);

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={[styles.modalOverlay, { backgroundColor: activeColors.background + '80' }]}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color={activeColors.secondaryText} size={iconScale.lg} />
                        </TouchableOpacity>
                        <View style={styles.headerCenter}>
                            <Text style={styles.title}>{category ? 'Edit Category' : 'New Category'}</Text>
                        </View>
                        <View style={styles.headerRight}>
                            {category && (
                                <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                                    <Trash2 color={activeColors.error} size={iconScale.md} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={styles.keyboardView}
                    >
                        <ScrollView
                            style={styles.content}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Type Selector */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Category Type</Text>
                                <View style={styles.typeSelector}>
                                    <TouchableOpacity
                                        style={[styles.typeBtn, type === 'expense' && { borderColor: activeColors.error }]}
                                        onPress={() => setType('expense')}
                                    >
                                        <View style={[styles.typeDot, { backgroundColor: activeColors.error }]} />
                                        <Text style={[styles.typeText, { color: activeColors.error }]}>Expense</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.typeBtn, type === 'income' && { borderColor: activeColors.success }]}
                                        onPress={() => setType('income')}
                                    >
                                        <View style={[styles.typeDot, { backgroundColor: activeColors.success }]} />
                                        <Text style={[styles.typeText, { color: activeColors.success }]}>Income</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Name Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Shopping, Salary..."
                                    placeholderTextColor={activeColors.secondaryText + '50'}
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>

                            {/* Color Picker */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Color Theme</Text>
                                <View style={styles.colorGrid}>
                                    {CATEGORY_COLORS.map(color => (
                                        <TouchableOpacity
                                            key={color}
                                            style={[
                                                styles.colorCircle,
                                                { backgroundColor: color },
                                                colorHex === color && styles.selectedColor
                                            ]}
                                            onPress={() => setColorHex(color)}
                                        >
                                            {colorHex === color && <Check color="#fff" size={20} />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Icon Picker */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Display Icon</Text>
                                <View style={styles.iconGrid}>
                                    {COMMON_ICONS.map(icon => {
                                        const IconComp = (LucideIcons as any)[icon];
                                        if (!IconComp) return null;
                                        const isSelected = iconSlug === icon;
                                        return (
                                            <TouchableOpacity
                                                key={icon}
                                                style={[
                                                    styles.iconBox,
                                                    isSelected && { backgroundColor: colorHex + '20', borderColor: colorHex }
                                                ]}
                                                onPress={() => setIconSlug(icon)}
                                            >
                                                <IconComp
                                                    size={24}
                                                    color={isSelected ? colorHex : activeColors.secondaryText + '80'}
                                                />
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            <View style={styles.scrollSpacer} />
                        </ScrollView>
                    </KeyboardAvoidingView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.saveBtn, saveMutation.isPending && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saveMutation.isPending}
                        >
                            <Text style={styles.saveBtnText}>
                                {saveMutation.isPending
                                    ? 'Processing...'
                                    : category ? 'Update Category' : 'Create Category'
                                }
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}


const getStyles = (colors: any, insets: any, fontScale: any) => StyleSheet.create({
    container: {
        flex: 1, backgroundColor: colors.background,
        marginTop: Platform.OS === 'ios' ? 100 : 40,
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
    },
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerRight: { width: 40 },
    title: { fontSize: fontScale.title, fontWeight: '900', color: colors.text },
    closeBtn: {
        padding: 6, backgroundColor: colors.card,
        borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    },
    deleteBtn: {
        padding: 6, backgroundColor: colors.error + '10',
        borderRadius: 12, borderWidth: 1, borderColor: colors.error + '20',
    },
    keyboardView: { flex: 1 },
    content: { flex: 1, padding: 20 },
    scrollSpacer: { height: 40 },
    inputGroup: { marginBottom: 24 },
    label: {
        fontSize: fontScale.label, fontWeight: '900', textTransform: 'uppercase',
        color: colors.secondaryText, marginBottom: 8, marginLeft: 4, letterSpacing: 1,
    },
    input: {
        backgroundColor: colors.card, padding: 14, borderRadius: 16,
        fontSize: fontScale.body + 1, fontWeight: '700',
        color: colors.text, borderWidth: 1, borderColor: colors.border,
    },
    typeSelector: { flexDirection: 'row', gap: 12 },
    typeBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: 18, borderRadius: 20,
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    },
    typeDot: { width: 8, height: 8, borderRadius: 4 },
    typeText: { fontSize: fontScale.body, fontWeight: '700' },
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
    colorCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    selectedColor: { borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
    iconBox: {
        width: 62, height: 62, borderRadius: 20, backgroundColor: colors.card,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    footer: {
        padding: 20,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
        backgroundColor: colors.card,
        borderTopWidth: 1, borderTopColor: colors.border,
    },
    saveBtn: {
        backgroundColor: colors.tint, padding: 16, borderRadius: 20, alignItems: 'center',
        elevation: 8, shadowColor: colors.tint,
        shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12,
    },
    saveBtnText: { color: '#ffffff', fontSize: fontScale.body + 1, fontWeight: '900' },
});
