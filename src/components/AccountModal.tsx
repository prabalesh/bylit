import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Modal, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { X, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Account } from '../types/api';
import { Colors } from '../constants/Colors';
import { useTheme } from '../providers/ThemeContext';
import { useToast } from '../providers/ToastProvider';
import { useConfirm } from '../providers/ConfirmProvider';
import { useSettings, useSaveAccount, useDeleteAccount } from '../hooks/useData';


const ACCOUNT_TYPES = ['Bank', 'Cash', 'Credit'];


interface AccountModalProps {
    visible: boolean;
    onClose: () => void;
    account?: Account | null;
}


export default function AccountModal({ visible, onClose, account = null }: AccountModalProps) {
    const insets = useSafeAreaInsets();
    const { currentTheme, fontScale, iconScale } = useTheme();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();
    const activeColors = Colors[currentTheme];

    const [name, setName] = useState('');
    const [type, setType] = useState('Bank');
    const [balance, setBalance] = useState('');

    const { data: settings } = useSettings();
    const saveMutation = useSaveAccount();
    const deleteMutation = useDeleteAccount();

    useEffect(() => {
        const backAction = () => {
            if (visible) {
                onClose();
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [visible, onClose]);

    useEffect(() => {
        if (account) {
            setName(account.name);
            setType(account.type);
            setBalance(account.balance.toString());
        } else {
            setName('');
            setType('Bank');
            setBalance('');
        }
    }, [account, visible]);

    const handleDelete = async () => {
        const confirmed = await showConfirm({
            title: 'Delete Account',
            message: 'Are you sure you want to delete this account? This action cannot be undone.',
            confirmText: 'Delete',
            type: 'danger'
        });
        if (confirmed) {
            deleteMutation.mutate(account!.id, {
                onSuccess: () => {
                    showToast('Account deleted', 'success');
                    onClose();
                },
                onError: () => showToast('Failed to delete account', 'error')
            });
        }
    };

    const handleSave = () => {
        const numBalance = parseFloat(balance);
        if (!name.trim()) {
            showToast('Please enter an account name', 'error');
            return;
        }
        if (isNaN(numBalance)) {
            showToast('Please enter a valid balance', 'error');
            return;
        }
        saveMutation.mutate({
            id: account?.id,
            name: name.trim(),
            type: type as any,
            balance: numBalance,
        }, {
            onSuccess: () => {
                showToast(account ? 'Account updated' : 'Account created', 'success');
                onClose();
            },
            onError: () => showToast('Failed to save account', 'error')
        });
    };

    const styles = getStyles(activeColors, insets, fontScale);

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={[styles.modalOverlay, { backgroundColor: activeColors.background + '80' }]}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <Text style={styles.title}>{account ? 'Edit Account' : 'New Account'}</Text>
                        </View>
                        <View style={styles.headerRight}>
                            {account && (
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
                            {ACCOUNT_TYPES.map(t => (
                                <TouchableOpacity
                                    key={t}
                                    style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                                    onPress={() => setType(t)}
                                >
                                    <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Account Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. HDFC Bank, Pocket"
                                placeholderTextColor={activeColors.secondaryText + '50'}
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Initial Balance</Text>
                            <TextInput
                                style={styles.inputLarge}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor={activeColors.secondaryText + '50'}
                                value={balance}
                                onChangeText={setBalance}
                                autoFocus={!account}
                                textAlign="center"
                                cursorColor={activeColors.tint}
                                selectionColor={activeColors.tint + '30'}
                            />
                        </View>

                        <View style={styles.scrollSpacer} />
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.saveBtn, saveMutation.isPending && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saveMutation.isPending}
                        >
                            <Text style={styles.saveBtnText}>
                                {saveMutation.isPending ? 'Processing...' : account ? 'Update Account' : 'Create Account'}
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
        flex: 1,
        backgroundColor: colors.background,
        marginTop: Math.max(insets.top, 40),
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
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    title: { fontSize: fontScale.title, fontWeight: '900', color: colors.text },
    closeBtn: {
        padding: 6, backgroundColor: colors.card,
        borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    },
    deleteBtn: {
        padding: 6, backgroundColor: colors.error + '10',
        borderRadius: 12, borderWidth: 1, borderColor: colors.error + '20',
    },
    content: { flex: 1, padding: 20 },
    typeSelector: {
        flexDirection: 'row', backgroundColor: colors.card, borderRadius: 18,
        marginBottom: 24, padding: 4, borderWidth: 1, borderColor: colors.border,
    },
    typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 14 },
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
    input: {
        backgroundColor: colors.card, padding: 14, borderRadius: 16,
        fontSize: fontScale.body + 1, fontWeight: '700', color: colors.text,
        borderWidth: 1, borderColor: colors.border,
    },
    inputLarge: {
        backgroundColor: colors.card, padding: 20, borderRadius: 20,
        fontSize: fontScale.input, fontWeight: '900', color: colors.tint,
        borderWidth: 1, borderColor: colors.border, textAlign: 'center',
    },
    scrollSpacer: { height: 40 },
    footer: {
        padding: 20,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    saveBtn: {
        backgroundColor: colors.tint, padding: 16, borderRadius: 20, alignItems: 'center',
        elevation: 8, shadowColor: colors.tint,
        shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12,
    },
    saveBtnText: { color: '#ffffff', fontSize: fontScale.body + 1, fontWeight: '900' },
});
