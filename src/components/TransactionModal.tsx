import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Modal, TouchableOpacity, ScrollView, Platform, Alert, BackHandler, FlatList, ActivityIndicator, Share } from 'react-native';
import * as Contacts from 'expo-contacts';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Repository } from '../../src/services/repository';
import { X, Calendar as CalendarIcon, Clock, Trash2, Plus, Check, Users, Search, ChevronRight, UserCheck, Share2, Bell, BellOff } from 'lucide-react-native';
import { Transaction, Account, Category } from '../types/api';
import { Colors } from '../constants/Colors';
import { useTheme } from '../providers/ThemeContext';
import { useToast } from '../providers/ToastProvider';
import { useConfirm } from '../providers/ConfirmProvider';
import { useAccounts, useCategories, useSettings, useSaveTransaction, useDeleteTransaction } from '../hooks/useData';
import CategoryModal from './CategoryModal';
import { getCurrencySymbol } from '../constants/Currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendLendBorrowNotification, scheduleLendBorrowReminder } from '../services/notifications';

const TYPES = ['expense', 'income', 'lend', 'borrow', 'transfer'];

interface TransactionModalProps {
    visible: boolean;
    onClose: () => void;
    transaction?: Transaction | null;
    initialType?: string;
}

import ContactPickerModal from './ContactPickerModal';

// ─── Main Modal ──────────────────────────────────────────────────────────────
export default function TransactionModal({ visible, onClose, transaction = null, initialType }: TransactionModalProps) {
    const insets = useSafeAreaInsets();
    const { currentTheme, fontScale, iconScale } = useTheme();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();
    const activeColors = Colors[currentTheme];

    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('expense');
    const [date, setDate] = useState(new Date());
    const [accountId, setAccountId] = useState('');
    const [toAccountId, setToAccountId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [personName, setPersonName] = useState('');
    const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
    const [isContactPickerVisible, setIsContactPickerVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isSettlementMode, setIsSettlementMode] = useState(false);
    const [settlementAccountId, setSettlementAccountId] = useState('');
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [showDueDatePicker, setShowDueDatePicker] = useState(false);
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const { data: accounts = [] } = useAccounts();
    const { data: categories = [] } = useCategories();
    const { data: settings } = useSettings();

    const saveMutation = useSaveTransaction();
    const deleteMutation = useDeleteTransaction();

    const isLendOrBorrow = type === 'lend' || type === 'borrow';

    useEffect(() => {
        // Reset category if type changes to something incompatible
        if (!relevantCategories.find(c => c.id === categoryId)) {
            setCategoryId('');
        }
        // Clear errors when type changes
        setErrors({});
    }, [type]);

    useEffect(() => {
        const backAction = () => {
            if (visible) { onClose(); return true; }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [visible, onClose]);

    useEffect(() => {
        if (accounts.length > 0 && !accountId) {
            setAccountId(accounts[0].id);
        }
    }, [accounts]);

    useEffect(() => {
        if (transaction) {
            setAmount(transaction.amount.toString());
            setDescription(transaction.description);
            setType(transaction.type);
            setDate(new Date(transaction.date));
            setAccountId(transaction.accountId);
            setToAccountId(transaction.toAccountId || '');
            setCategoryId(transaction.categoryId || '');
            setPersonName(transaction.personName || '');
            setDueDate(transaction.dueDate ? new Date(transaction.dueDate) : null);
            setReminderEnabled(!!transaction.dueDate);
        } else {
            setAmount('');
            setDescription('');
            setType(initialType || 'expense');
            setDate(new Date());
            if (accounts.length > 0) setAccountId(accounts[0].id);
            setToAccountId(accounts.length > 1 ? accounts[1].id : '');
            setCategoryId('');
            setPersonName('');
            setDueDate(null);
            setReminderEnabled(false);
        }
        setIsSettlementMode(false);
        setSettlementAccountId('');
        setErrors({});
    }, [transaction, visible, accounts]);

    const handleDelete = async () => {
        const confirmed = await showConfirm({
            title: 'Delete Transaction',
            message: 'Are you sure you want to delete this record permanently?',
            confirmText: 'Delete',
            type: 'danger'
        });

        if (confirmed) {
            deleteMutation.mutate(transaction!.id, {
                onSuccess: () => { showToast('Transaction deleted', 'success'); onClose(); },
                onError: () => showToast('Failed to delete transaction', 'error')
            });
        }
    };

    const handleSave = () => {
        const newErrors: { [key: string]: string } = {};
        const numAmount = parseFloat(amount);

        if (!amount || isNaN(numAmount) || numAmount <= 0) {
            newErrors.amount = 'Please enter a valid amount';
        }
        if (!description.trim() && (type === 'expense' || type === 'income')) {
            newErrors.description = 'Please enter a description';
        }
        if (!accountId) {
            newErrors.account = 'Please select an account';
        }
        if (type === 'transfer' && !toAccountId) {
            newErrors.toAccount = 'Please select a destination account';
        }
        if (type === 'transfer' && accountId === toAccountId) {
            newErrors.toAccount = 'Source and destination accounts must be different';
        }
        if (isLendOrBorrow && !personName.trim()) {
            newErrors.person = 'Please enter or select a person name';
        }
        if ((type === 'expense' || type === 'income') && !categoryId) {
            newErrors.category = 'Please select a category';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});

        saveMutation.mutate({
            id: transaction?.id,
            categoryId: (type === 'expense' || type === 'income') ? categoryId : undefined,
            accountId,
            toAccountId: type === 'transfer' ? toAccountId : undefined,
            amount: numAmount,
            currency: settings?.baseCurrency || 'INR',
            type: type as any,
            description: description.trim() || (isLendOrBorrow ? personName.trim() : (type === 'transfer' ? 'Self Transfer' : '')),
            date: date.toISOString(),
            personName: isLendOrBorrow ? personName.trim() : undefined,
            dueDate: (isLendOrBorrow && reminderEnabled && dueDate) ? dueDate.toISOString() : undefined,
        }, {
            onSuccess: (savedTx: any) => {
                showToast(transaction ? 'Transaction updated' : 'Transaction saved', 'success');
                // Fire lend/borrow immediate notification
                if (isLendOrBorrow && personName.trim()) {
                    sendLendBorrowNotification(
                        type as 'lend' | 'borrow',
                        personName.trim(),
                        numAmount,
                        settings?.baseCurrency || 'INR'
                    );

                    // Schedule due date reminder
                    if (reminderEnabled && dueDate) {
                        scheduleLendBorrowReminder(
                            transaction?.id || (savedTx?.id as string),
                            type as 'lend' | 'borrow',
                            personName.trim(),
                            numAmount,
                            settings?.baseCurrency || 'INR',
                            dueDate
                        );
                    }
                }
                onClose();
            },
            onError: () => showToast('Failed to save transaction', 'error')
        });
    };

    const handleSettle = () => {
        if (!settlementAccountId) {
            setErrors({ settlementAccount: 'Please select an account for settlement' });
            return;
        }

        const numAmount = parseFloat(amount);
        const offsetType = type === 'lend' ? 'income' : 'expense';
        const settlementDescription = `Settlement: ${personName || description}`;

        // 1. Mark original as settled
        saveMutation.mutate({
            ...transaction!,
            settledStatus: true,
        }, {
            onSuccess: () => {
                // 2. Create offset transaction
                saveMutation.mutate({
                    accountId: settlementAccountId,
                    amount: numAmount,
                    currency: settings?.baseCurrency || 'INR',
                    type: offsetType as any,
                    description: settlementDescription,
                    date: new Date().toISOString(),
                    categoryId: categoryId || undefined,
                }, {
                    onSuccess: () => {
                        showToast('Transaction settled successfully', 'success');
                        onClose();
                    },
                    onError: () => showToast('Failed to create settlement record', 'error')
                });
            },
            onError: () => showToast('Failed to update original transaction', 'error')
        });
    };

    const handleCancelSettlement = async () => {
        const confirmed = await showConfirm({
            title: 'Cancel Settlement',
            message: 'Are you sure you want to cancel the settlement for this transaction?',
            confirmText: 'Yes, Cancel',
            type: 'danger'
        });

        if (confirmed) {
            try {
                await Repository.unsettleTransaction(transaction!.id);
                showToast('Settlement cancelled', 'success');
                onClose();
            } catch (err) {
                showToast('Failed to cancel settlement', 'error');
            }
        }
    };

    const handleShare = async () => {
        if (!personName) return;
        const symbol = getCurrencySymbol(settings?.baseCurrency);
        const dateStr = dueDate ? dueDate.toLocaleDateString() : 'soon';
        const message = type === 'lend'
            ? `Hi ${personName}, a friendly reminder that the ${symbol}${amount} lent for "${description || 'settlement'}" is due on ${dateStr}.`
            : `Hi ${personName}, just letting you know I've recorded the ${symbol}${amount} borrowed from you, due on ${dateStr}.`;

        try {
            await Share.share({ message });
        } catch (error) {
            showToast('Failed to share reminder', 'error');
        }
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            const newDate = new Date(date);
            newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            setDate(newDate);
        }
    };

    const handleTimeChange = (event: any, selectedTime?: Date) => {
        setShowTimePicker(Platform.OS === 'ios');
        if (selectedTime) {
            const newDate = new Date(date);
            newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0);
            setDate(newDate);
        }
    };

    const handleDueDateChange = (event: any, selectedDate?: Date) => {
        setShowDueDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setDueDate(selectedDate);
        }
    };

    const relevantCategories = categories.filter((c: Category) => c.type === type || (c.type === 'all' && (type === 'expense' || type === 'income')));
    const styles = getStyles(activeColors, insets, fontScale);

    return (
        <>
            <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
                <View style={[styles.modalOverlay, { backgroundColor: activeColors.background + '80' }]}>
                    <View style={styles.container}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>{transaction ? 'Edit Transaction' : 'New Transaction'}</Text>
                            <View style={styles.headerRight}>
                                {transaction && (
                                    <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
                                        <Trash2 color={activeColors.error} size={iconScale.md} />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                    <X color={activeColors.secondaryText} size={iconScale.lg} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                            {/* Type Selector */}
                            <View style={styles.typeSelectorWrapper}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeSelector}>
                                    {TYPES.map(t => (
                                        <TouchableOpacity
                                            key={t}
                                            style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                                            onPress={() => setType(t)}
                                        >
                                            <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>{t}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Amount */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Amount ({settings?.baseCurrency || 'INR'})</Text>
                                <TextInput
                                    style={styles.inputLarge}
                                    keyboardType="numeric"
                                    placeholder="0.00"
                                    placeholderTextColor={activeColors.secondaryText + '50'}
                                    value={amount}
                                    onChangeText={(val) => {
                                        setAmount(val);
                                        if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }));
                                    }}
                                    cursorColor={activeColors.tint}
                                    selectionColor={activeColors.tint + '30'}
                                />
                                {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
                            </View>

                            {/* Description — hidden for lend/borrow (auto-filled from person) */}
                            {!isLendOrBorrow && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Description</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="What was this for?"
                                        placeholderTextColor={activeColors.secondaryText + '50'}
                                        value={description}
                                        onChangeText={(val) => {
                                            setDescription(val);
                                            if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                                        }}
                                    />
                                    {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
                                </View>
                            )}

                            {/* Person Name — only for lend/borrow */}
                            {isLendOrBorrow && (
                                <View style={styles.inputGroup}>
                                    <View style={styles.labelRow}>
                                        <Text style={styles.label}>Person</Text>
                                        <TouchableOpacity
                                            onPress={() => setIsContactPickerVisible(true)}
                                            style={styles.contactBtn}
                                        >
                                            <Users size={13} color={activeColors.tint} />
                                            <Text style={styles.contactBtnText}>From Contacts</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Tagged person chip if already selected */}
                                    {personName ? (
                                        <View style={styles.taggedPersonRow}>
                                            <View style={styles.taggedPersonAvatar}>
                                                <Text style={styles.taggedPersonInitials}>
                                                    {personName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text style={styles.taggedPersonName}>{personName}</Text>
                                            <TouchableOpacity onPress={() => setPersonName('')} style={styles.clearPersonBtn}>
                                                <X size={12} color={activeColors.secondaryText} />
                                            </TouchableOpacity>
                                        </View>
                                    ) : null}

                                    <TextInput
                                        style={[styles.input, personName && { marginTop: 10 }]}
                                        placeholder="Or type a name..."
                                        placeholderTextColor={activeColors.secondaryText + '50'}
                                        value={personName}
                                        onChangeText={(val) => {
                                            setPersonName(val);
                                            if (errors.person) setErrors(prev => ({ ...prev, person: '' }));
                                        }}
                                    />
                                    {errors.person && <Text style={styles.errorText}>{errors.person}</Text>}
                                </View>
                            )}

                            {/* Date & Time */}
                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>Date</Text>
                                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                                        <CalendarIcon size={iconScale.sm} color={activeColors.secondaryText} />
                                        <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>Time</Text>
                                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowTimePicker(true)}>
                                        <Clock size={iconScale.sm} color={activeColors.secondaryText} />
                                        <Text style={styles.dateText}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {showDatePicker && <DateTimePicker value={date} mode="date" display="default" onChange={handleDateChange} />}
                            {showTimePicker && <DateTimePicker value={date} mode="time" display="default" onChange={handleTimeChange} />}

                            {/* Due Date & Reminder — only for lend/borrow */}
                            {isLendOrBorrow && (
                                <View style={styles.inputGroup}>
                                    <View style={styles.labelRow}>
                                        <Text style={styles.label}>Reminder & Due Date</Text>
                                        <TouchableOpacity onPress={() => setReminderEnabled(!reminderEnabled)} style={[styles.reminderToggle, reminderEnabled && styles.reminderToggleActive]}>
                                            {reminderEnabled ? <Bell size={14} color="#fff" /> : <BellOff size={14} color={activeColors.secondaryText} />}
                                            <Text style={[styles.reminderToggleText, reminderEnabled && { color: '#fff' }]}>{reminderEnabled ? 'ON' : 'OFF'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {reminderEnabled && (
                                        <View style={styles.dueDatePickerRow}>
                                            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDueDatePicker(true)}>
                                                <CalendarIcon size={iconScale.sm} color={activeColors.secondaryText} />
                                                <Text style={styles.dateText}>{dueDate ? dueDate.toLocaleDateString() : 'Select Due Date'}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                                                <Share2 size={18} color={activeColors.tint} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    {showDueDatePicker && <DateTimePicker value={dueDate || new Date()} mode="date" display="default" onChange={handleDueDateChange} />}
                                </View>
                            )}

                            {/* Account */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{type === 'transfer' ? 'Source Account' : 'Account'}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                    {accounts.map((a: Account) => (
                                        <TouchableOpacity
                                            key={a.id}
                                            style={[styles.chip, accountId === a.id && styles.chipActive]}
                                            onPress={() => {
                                                setAccountId(a.id);
                                                if (errors.account) setErrors(prev => ({ ...prev, account: '' }));
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                {accountId === a.id && <Check size={14} color={activeColors.tint} />}
                                                <Text style={[styles.chipText, accountId === a.id && styles.chipTextActive]}>{a.name}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                {errors.account && <Text style={styles.errorText}>{errors.account}</Text>}
                            </View>

                            {/* Destination Account — only for transfer */}
                            {type === 'transfer' && (
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Destination Account</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                        {accounts.map((a: Account) => (
                                            <TouchableOpacity
                                                key={a.id}
                                                style={[styles.chip, toAccountId === a.id && styles.chipActive]}
                                                onPress={() => {
                                                    setToAccountId(a.id);
                                                    if (errors.toAccount) setErrors(prev => ({ ...prev, toAccount: '' }));
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    {toAccountId === a.id && <Check size={14} color={activeColors.tint} />}
                                                    <Text style={[styles.chipText, toAccountId === a.id && styles.chipTextActive]}>{a.name}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    {errors.toAccount && <Text style={styles.errorText}>{errors.toAccount}</Text>}
                                </View>
                            )}

                            {/* Category — only for expense/income */}
                            {(type === 'expense' || type === 'income') && (
                                <View style={styles.inputGroup}>
                                    <View style={styles.labelRow}>
                                        <Text style={styles.label}>Category</Text>
                                        <TouchableOpacity onPress={() => setIsCategoryModalVisible(true)} style={styles.addCategoryBtn}>
                                            <Plus size={iconScale.sm} color={activeColors.tint} />
                                            <Text style={styles.addCategoryBtnText}>Add</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                        {relevantCategories.map((c: Category) => (
                                            <TouchableOpacity
                                                key={c.id}
                                                style={[styles.chip, categoryId === c.id && styles.chipActive, { borderColor: c.colorHex }]}
                                                onPress={() => {
                                                    setCategoryId(c.id);
                                                    if (errors.category) setErrors(prev => ({ ...prev, category: '' }));
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    {categoryId === c.id && <Check size={14} color={activeColors.tint} />}
                                                    <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
                                </View>
                            )}

                            {/* Settlement Section */}
                            {!isSettlementMode && transaction && isLendOrBorrow && !transaction.settledStatus && (
                                <View style={styles.settlementTrigger}>
                                    <TouchableOpacity
                                        style={styles.settleBtn}
                                        onPress={() => {
                                            setIsSettlementMode(true);
                                            if (accounts.length > 0) setSettlementAccountId(accounts[0].id);
                                        }}
                                    >
                                        <Check color="#fff" size={18} />
                                        <Text style={styles.settleBtnText}>Settle this {type}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {transaction && transaction.settledStatus && (
                                <View style={styles.settlementTrigger}>
                                    <TouchableOpacity
                                        style={[styles.settleBtn, { backgroundColor: activeColors.error }]}
                                        onPress={handleCancelSettlement}
                                    >
                                        <X color="#fff" size={18} />
                                        <Text style={styles.settleBtnText}>Cancel Settlement</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {isSettlementMode && (
                                <View style={styles.settlementContainer}>
                                    <View style={styles.settlementHeader}>
                                        <Text style={styles.settlementTitle}>Settlement Details</Text>
                                        <TouchableOpacity onPress={() => setIsSettlementMode(false)}>
                                            <Text style={{ color: activeColors.error, fontSize: 12, fontWeight: '700' }}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.settlementSub}>Select account where the money will go to/come from:</Text>

                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                        {accounts.map((a: Account) => (
                                            <TouchableOpacity
                                                key={a.id}
                                                style={[styles.chip, settlementAccountId === a.id && styles.chipActive]}
                                                onPress={() => {
                                                    setSettlementAccountId(a.id);
                                                    setErrors(prev => ({ ...prev, settlementAccount: '' }));
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    {settlementAccountId === a.id && <Check size={14} color={activeColors.tint} />}
                                                    <Text style={[styles.chipText, settlementAccountId === a.id && styles.chipTextActive]}>{a.name}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    {errors.settlementAccount && <Text style={styles.errorText}>{errors.settlementAccount}</Text>}

                                    <TouchableOpacity
                                        style={[styles.confirmSettleBtn, saveMutation.isPending && { opacity: 0.7 }]}
                                        onPress={handleSettle}
                                        disabled={saveMutation.isPending}
                                    >
                                        <Text style={styles.confirmSettleText}>
                                            {saveMutation.isPending ? 'Processing...' : `Confirm Settlement (${settings?.baseCurrency} ${amount})`}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={{ height: 40 }} />
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.saveBtn, saveMutation.isPending && { opacity: 0.7 }]}
                                onPress={handleSave}
                                disabled={saveMutation.isPending}
                            >
                                <Text style={styles.saveBtnText}>
                                    {saveMutation.isPending ? 'Processing...' : transaction ? 'Update Record' : 'Save Record'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <CategoryModal visible={isCategoryModalVisible} onClose={() => setIsCategoryModalVisible(false)} />
            </Modal>

            {/* Contact Picker — rendered outside main modal to avoid nesting issues */}
            <ContactPickerModal
                visible={isContactPickerVisible}
                onClose={() => setIsContactPickerVisible(false)}
                onSelect={(contact) => setPersonName(contact.name)}
                colors={activeColors}
                insets={insets}
            />
        </>
    );
}

const getStyles = (colors: any, insets: any, fontScale: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        marginTop: Platform.OS === 'ios' ? 100 : 40,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border
    },
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    title: { fontSize: fontScale.title, fontWeight: '900', color: colors.text },
    closeBtn: { padding: 6, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
    deleteBtn: { padding: 6, backgroundColor: colors.error + '10', borderRadius: 12, borderWidth: 1, borderColor: colors.error + '20' },
    content: { flex: 1, padding: 20 },
    typeSelectorWrapper: { marginBottom: 24 },
    typeSelector: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 18, padding: 4, borderWidth: 1, borderColor: colors.border },
    typeBtn: { paddingHorizontal: 20, paddingVertical: 10, alignItems: 'center', borderRadius: 14, minWidth: 100 },
    typeBtnActive: { backgroundColor: colors.tint, elevation: 4, shadowColor: colors.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    typeBtnText: { fontSize: fontScale.label + 1, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
    typeBtnTextActive: { color: '#ffffff' },
    addCategoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.tint + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.tint + '30' },
    addCategoryBtnText: { fontSize: fontScale.label, fontWeight: '800', color: colors.tint, textTransform: 'uppercase' },
    inputGroup: { marginBottom: 24 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingRight: 4 },
    row: { flexDirection: 'row', gap: 16 },
    label: { fontSize: fontScale.label, fontWeight: '900', textTransform: 'uppercase', color: colors.secondaryText, marginBottom: 8, marginLeft: 4, letterSpacing: 1 },
    errorText: { fontSize: 12, fontWeight: '700', color: colors.error, marginTop: 4, marginLeft: 4 },
    input: { backgroundColor: colors.card, padding: 14, borderRadius: 16, fontSize: fontScale.body + 1, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border },
    inputLarge: { backgroundColor: colors.card, padding: 20, borderRadius: 20, fontSize: fontScale.input, fontWeight: '900', color: colors.tint, borderWidth: 1, borderColor: colors.border, textAlign: 'center' },
    contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.tint + '12', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: colors.tint + '25' },
    contactBtnText: { fontSize: fontScale.label, fontWeight: '800', color: colors.tint, textTransform: 'uppercase', letterSpacing: 0.5 },
    taggedPersonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.tint + '10', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.tint + '30', marginBottom: 4 },
    taggedPersonAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.tint, justifyContent: 'center', alignItems: 'center' },
    taggedPersonInitials: { fontSize: 12, fontWeight: '900', color: '#fff' },
    taggedPersonName: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.tint },
    clearPersonBtn: { padding: 4, backgroundColor: colors.border, borderRadius: 6 },
    datePickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
    dateText: { fontSize: fontScale.body, fontWeight: '700', color: colors.text },
    chipScroll: { flexDirection: 'row', paddingVertical: 4 },
    chip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderRadius: 14, marginRight: 10, borderWidth: 1, borderColor: colors.border },
    chipActive: { backgroundColor: colors.tint + '15', borderColor: colors.tint },
    chipText: { fontSize: fontScale.body - 1, fontWeight: '700', color: colors.secondaryText },
    chipTextActive: { color: colors.tint },
    footer: { padding: 20, paddingBottom: insets.bottom > 0 ? insets.bottom : 20, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
    saveBtn: { backgroundColor: colors.tint, padding: 16, borderRadius: 20, alignItems: 'center', elevation: 8, shadowColor: colors.tint, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12 },
    saveBtnText: { color: '#ffffff', fontSize: fontScale.body + 1, fontWeight: '900' },
    settlementTrigger: { marginTop: 10, paddingHorizontal: 4 },
    settleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.success, padding: 14, borderRadius: 16, elevation: 2 },
    settleBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
    settlementContainer: { marginTop: 20, backgroundColor: colors.card, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: colors.success + '30' },
    settlementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    settlementTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
    settlementSub: { fontSize: 12, fontWeight: '600', color: colors.secondaryText, marginBottom: 12 },
    confirmSettleBtn: { backgroundColor: colors.success, marginTop: 16, padding: 14, borderRadius: 16, alignItems: 'center' },
    confirmSettleText: { color: '#fff', fontSize: 14, fontWeight: '900' },
    reminderToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    reminderToggleActive: { backgroundColor: colors.tint, borderColor: colors.tint },
    reminderToggleText: { fontSize: 10, fontWeight: '800', color: colors.secondaryText },
    dueDatePickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    shareBtn: { padding: 12, backgroundColor: colors.tint + '10', borderRadius: 16, borderWidth: 1, borderColor: colors.tint + '20' }
});
