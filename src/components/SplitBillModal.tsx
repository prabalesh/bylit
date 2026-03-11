import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView,
    KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import {
    X, Plus, Trash2, Users, Tag, StickyNote, DollarSign, Calendar,
    Phone, Check, UserPlus, RefreshCw, ChevronDown
} from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useTheme } from '../providers/ThemeContext';
import { FONT, ICON, BTN, RADIUS } from '../constants/Sizes';
import * as Contacts from 'expo-contacts';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAccounts, useSaveSplitBill, useSettings, useCategories } from '../hooks/useData';
import { Account, Category, SplitBill, SplitParticipant } from '../types/api';
import { getCurrencySymbol } from '../constants/Currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ContactPickerModal from './ContactPickerModal';

interface SplitBillModalProps {
    visible: boolean;
    onClose: () => void;
    bill?: SplitBill | null;
}



interface LocalParticipant {
    id?: string;
    name: string;
    contactId?: string;
    phone?: string;
    share: string;
    paid: boolean;
    isMe: boolean;
}

export default function SplitBillModal({ visible, onClose, bill }: SplitBillModalProps) {
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const { data: settings } = useSettings();
    const { data: categories = [] } = useCategories();
    const symbol = getCurrencySymbol(settings?.baseCurrency);
    const saveSplitBill = useSaveSplitBill();

    const [title, setTitle] = useState('');
    const [totalAmount, setTotalAmount] = useState('');
    const [category, setCategory] = useState('');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState(new Date());
    const [accountId, setAccountId] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [participants, setParticipants] = useState<LocalParticipant[]>([
        { name: 'Myself', share: '', paid: true, isMe: true },
    ]);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [isContactPickerVisible, setIsContactPickerVisible] = useState(false);
    const [activeParticipantIndex, setActiveParticipantIndex] = useState<number | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const insets = useSafeAreaInsets();
    const { data: accounts = [] } = useAccounts();

    useEffect(() => {
        if (accounts.length > 0 && !accountId && !bill) {
            setAccountId(accounts[0].id);
        }
    }, [accounts]);

    useEffect(() => {
        if (bill) {
            setTitle(bill.title);
            setTotalAmount(bill.totalAmount.toString());
            setCategory(bill.category || '');
            setNotes(bill.notes || '');
            setDate(new Date(bill.date));
            setAccountId(bill.accountId || '');
            setParticipants(
                bill.participants.map(p => ({
                    id: p.id,
                    name: p.name,
                    contactId: p.contactId,
                    phone: p.phone,
                    share: p.share.toString(),
                    paid: p.paid,
                    isMe: !!p.isMe,
                }))
            );
        } else {
            resetForm();
        }
    }, [bill, visible]);

    const resetForm = () => {
        setTitle('');
        setTotalAmount('');
        setCategory('');
        setNotes('');
        setDate(new Date());
        setAccountId(accounts[0]?.id || '');
        setParticipants([{ name: 'Myself', share: '', paid: true, isMe: true }]);
        setErrors({});
    };

    const splitEqually = () => {
        const total = parseFloat(totalAmount);
        if (!total || participants.length === 0) return;
        const each = (total / participants.length).toFixed(2);
        setParticipants(prev => prev.map(p => ({ ...p, share: each })));
    };

    const addParticipant = () => {
        setParticipants(prev => [...prev, { name: '', share: '', paid: false, isMe: false }]);
    };

    const removeParticipant = (index: number) => {
        setParticipants(prev => prev.filter((_, i) => i !== index));
    };

    const updateParticipant = (index: number, field: keyof LocalParticipant, value: any) => {
        setParticipants(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const pickContact = (index: number) => {
        setActiveParticipantIndex(index);
        setIsContactPickerVisible(true);
    };

    const handleContactSelect = (contact: { name: string; phone?: string; id?: string }) => {
        if (activeParticipantIndex !== null) {
            updateParticipant(activeParticipantIndex, 'name', contact.name);
            if (contact.id) updateParticipant(activeParticipantIndex, 'contactId', contact.id);
            if (contact.phone) updateParticipant(activeParticipantIndex, 'phone', contact.phone);
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!title.trim()) newErrors.title = 'Title is required';
        if (!totalAmount || isNaN(parseFloat(totalAmount))) newErrors.totalAmount = 'Valid amount required';
        if (!accountId) newErrors.accountId = 'Account is required';
        if (participants.length === 0) newErrors.participants = 'Add at least one participant';
        participants.forEach((p, i) => {
            if (!p.name.trim()) newErrors[`pname_${i}`] = 'Name required';
            if (!p.share || isNaN(parseFloat(p.share))) newErrors[`pshare_${i}`] = 'Share required';
        });
        const total = parseFloat(totalAmount) || 0;
        const sumOfShares = participants.reduce((s, p) => s + (parseFloat(p.share) || 0), 0);
        if (total > 0 && Math.abs(sumOfShares - total) > 0.01) {
            newErrors.sharesTotal = `Shares sum (${symbol}${sumOfShares.toFixed(2)}) must equal total (${symbol}${total.toFixed(2)})`;
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        await saveSplitBill.mutateAsync({
            bill: {
                id: bill?.id,
                title: title.trim(),
                totalAmount: parseFloat(totalAmount),
                category: category || undefined,
                notes: notes.trim() || undefined,
                date: date.toISOString(),
                accountId: accountId || undefined,
            },
            participants: participants.map(p => ({
                id: p.id,
                name: p.name.trim(),
                contactId: p.contactId,
                phone: p.phone,
                share: parseFloat(p.share) || 0,
                paid: p.paid,
                isMe: p.isMe,
            })),
        });
        onClose();
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) setDate(selectedDate);
    };

    const styles = getStyles(activeColors, insets);

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>{bill ? 'Edit Split Bill' : 'New Split Bill'}</Text>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <X color={activeColors.text} size={ICON.md} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        {/* Title */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={[styles.input, errors.title && styles.inputError]}
                                placeholder="e.g. Goa Trip Expenses"
                                placeholderTextColor={activeColors.secondaryText}
                                value={title}
                                onChangeText={setTitle}
                            />
                            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
                        </View>

                        {/* Amount + Date row */}
                        <View style={styles.row}>
                            <View style={[styles.fieldGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Total Amount</Text>
                                <View style={[styles.inputRow, errors.totalAmount && styles.inputError]}>
                                    <Text style={styles.inputPrefix}>{symbol}</Text>
                                    <TextInput
                                        style={styles.inputInner}
                                        placeholder="0.00"
                                        placeholderTextColor={activeColors.secondaryText}
                                        value={totalAmount}
                                        onChangeText={setTotalAmount}
                                        keyboardType="numeric"
                                    />
                                </View>
                                {errors.totalAmount && <Text style={styles.errorText}>{errors.totalAmount}</Text>}
                            </View>
                            <View style={[styles.fieldGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Date</Text>
                                <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                                    <Text style={{ color: activeColors.text, fontWeight: '600' }}>{date.toLocaleDateString()}</Text>
                                </TouchableOpacity>
                                {showDatePicker && <DateTimePicker value={date} mode="date" display="default" onChange={handleDateChange} />}
                            </View>
                        </View>

                        {/* Account Selection */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Settlement Account</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                {accounts.map((a: Account) => (
                                    <TouchableOpacity
                                        key={a.id}
                                        style={[styles.chip, accountId === a.id && styles.chipActive]}
                                        onPress={() => setAccountId(a.id)}
                                    >
                                        <Text style={[styles.chipText, accountId === a.id && styles.chipTextActive]}>{a.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            {errors.accountId && <Text style={styles.errorText}>{errors.accountId}</Text>}
                        </View>

                        {/* Category */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Category</Text>
                            <TouchableOpacity
                                style={[styles.inputRow, { justifyContent: 'space-between' }]}
                                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Tag color={activeColors.secondaryText} size={ICON.sm} />
                                    <Text style={category ? styles.inputText : styles.inputPlaceholder}>
                                        {category || 'Select category'}
                                    </Text>
                                </View>
                                <ChevronDown color={activeColors.secondaryText} size={ICON.sm} />
                            </TouchableOpacity>
                            {showCategoryPicker && (
                                <View style={styles.categoryPickerBox}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 4 }}>
                                        {categories.map((cat: Category) => (
                                            <TouchableOpacity
                                                key={cat.id}
                                                style={[styles.categoryChip, category === cat.name && { backgroundColor: activeColors.tint, borderColor: activeColors.tint }]}
                                                onPress={() => { setCategory(cat.name); setShowCategoryPicker(false); }}
                                            >
                                                <Text style={[styles.categoryChipText, category === cat.name && { color: '#fff' }]}>{cat.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        {/* Notes */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Notes (optional)</Text>
                            <TextInput
                                style={[styles.input, { height: 70, textAlignVertical: 'top', paddingTop: 12 }]}
                                placeholder="Add any extra details..."
                                placeholderTextColor={activeColors.secondaryText}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                            />
                        </View>

                        {/* Participants */}
                        <View style={styles.sectionHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Users color={activeColors.tint} size={ICON.sm} />
                                <Text style={styles.sectionTitle}>Participants</Text>
                            </View>
                            <TouchableOpacity style={styles.splitEquallyBtn} onPress={splitEqually}>
                                <RefreshCw color={activeColors.tint} size={12} />
                                <Text style={[styles.splitEquallyText, { color: activeColors.tint }]}>Split Equally</Text>
                            </TouchableOpacity>
                        </View>
                        {errors.participants && <Text style={styles.errorText}>{errors.participants}</Text>}
                        {errors.sharesTotal && <Text style={[styles.errorText, { marginBottom: 8 }]}>{errors.sharesTotal}</Text>}

                        {participants.map((p, i) => (
                            <View key={i} style={styles.participantCard}>
                                <View style={styles.participantRow}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <TextInput
                                                style={[styles.participantInput, errors[`pname_${i}`] && styles.inputError, { flex: 1 }, p.isMe && { color: activeColors.tint, fontWeight: '800' }]}
                                                placeholder={`Person ${i + 1}`}
                                                placeholderTextColor={activeColors.secondaryText}
                                                value={p.name}
                                                onChangeText={v => updateParticipant(i, 'name', v)}
                                                editable={!p.isMe}
                                            />
                                            {!p.isMe && (
                                                <TouchableOpacity
                                                    style={styles.contactBtn}
                                                    onPress={() => pickContact(i)}
                                                >
                                                    <UserPlus color={activeColors.tint} size={14} />
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity
                                                style={[styles.meBtn, p.isMe && { backgroundColor: activeColors.tint }]}
                                                onPress={() => {
                                                    // Toggle isMe: only one participant can be "Me"
                                                    setParticipants(prev => prev.map((part, idx) => ({
                                                        ...part,
                                                        isMe: idx === i ? !part.isMe : false,
                                                        name: idx === i ? (!part.isMe ? 'Myself' : '') : part.name
                                                    })));
                                                }}
                                            >
                                                <Text style={[styles.meBtnText, p.isMe && { color: '#fff' }]}>Me</Text>
                                            </TouchableOpacity>
                                        </View>
                                        {p.phone ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                                <Phone size={10} color={activeColors.secondaryText} />
                                                <Text style={styles.phoneText}>{p.phone}</Text>
                                            </View>
                                        ) : null}
                                        {errors[`pname_${i}`] && <Text style={styles.errorText}>{errors[`pname_${i}`]}</Text>}
                                    </View>

                                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                        <View style={[styles.shareInput, errors[`pshare_${i}`] && styles.inputError]}>
                                            <Text style={styles.inputPrefix}>{symbol}</Text>
                                            <TextInput
                                                style={[styles.inputInner, { width: 70 }]}
                                                placeholder="0.00"
                                                placeholderTextColor={activeColors.secondaryText}
                                                value={p.share}
                                                onChangeText={v => updateParticipant(i, 'share', v)}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            <TouchableOpacity
                                                style={[styles.paidBadge, p.paid && { backgroundColor: activeColors.success + '20', borderColor: activeColors.success }]}
                                                onPress={() => updateParticipant(i, 'paid', !p.paid)}
                                            >
                                                {p.paid && <Check size={10} color={activeColors.success} />}
                                                <Text style={[styles.paidText, { color: p.paid ? activeColors.success : activeColors.secondaryText }]}>
                                                    {p.paid ? 'Paid' : 'Unpaid'}
                                                </Text>
                                            </TouchableOpacity>
                                            {participants.length > 1 && (
                                                <TouchableOpacity onPress={() => removeParticipant(i)}>
                                                    <Trash2 size={14} color={activeColors.error} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ))}

                        <TouchableOpacity style={styles.addParticipantBtn} onPress={addParticipant}>
                            <Plus color={activeColors.tint} size={ICON.sm} />
                            <Text style={[styles.addParticipantText, { color: activeColors.tint }]}>Add Participant</Text>
                        </TouchableOpacity>

                        {/* Save */}
                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: activeColors.tint }]}
                            onPress={handleSave}
                            disabled={saveSplitBill.isPending}
                        >
                            <Text style={styles.saveBtnText}>{saveSplitBill.isPending ? 'Saving…' : bill ? 'Update Bill' : 'Create Bill'}</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
            <ContactPickerModal
                visible={isContactPickerVisible}
                onClose={() => setIsContactPickerVisible(false)}
                onSelect={handleContactSelect}
                colors={activeColors}
                insets={insets}
            />
        </Modal>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        marginTop: Platform.OS === 'android' ? 40 : (Platform.OS === 'ios' ? 50 : 0),
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
        overflow: 'hidden'
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: FONT.h2, fontWeight: '900', color: colors.text },
    closeBtn: { ...BTN.md, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderRadius: BTN.md.borderRadius, borderWidth: 1, borderColor: colors.border },
    scrollContent: { padding: 20, paddingBottom: 60 },
    fieldGroup: { marginBottom: 14 },
    label: { fontSize: FONT.xs, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    input: { backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: FONT.body, fontWeight: '600', color: colors.text },
    inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12 },
    inputInner: { flex: 1, fontSize: FONT.body, fontWeight: '700', color: colors.text, padding: 0 },
    inputPrefix: { fontSize: FONT.body, fontWeight: '800', color: colors.secondaryText, marginRight: 6 },
    inputText: { fontSize: FONT.body, fontWeight: '600', color: colors.text },
    inputPlaceholder: { fontSize: FONT.body, fontWeight: '600', color: colors.secondaryText },
    inputError: { borderColor: colors.error },
    errorText: { fontSize: FONT.xs, color: colors.error, marginTop: 4, fontWeight: '600' },
    row: { flexDirection: 'row', gap: 10 },
    chipScroll: { flexDirection: 'row', marginBottom: 4 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: 8 },
    chipActive: { borderColor: colors.tint, backgroundColor: colors.tint + '10' },
    chipText: { fontSize: FONT.xs, fontWeight: '700', color: colors.text },
    chipTextActive: { color: colors.tint },
    categoryPickerBox: { marginTop: 8, backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', padding: 8 },
    categoryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    categoryChipText: { fontSize: FONT.sm, fontWeight: '700', color: colors.text },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 6 },
    sectionTitle: { fontSize: FONT.sm, fontWeight: '900', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.8 },
    splitEquallyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    splitEquallyText: { fontSize: FONT.xs, fontWeight: '700' },
    participantCard: { backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 10 },
    participantRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    participantInput: { backgroundColor: colors.background, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: FONT.body, fontWeight: '600', color: colors.text },
    contactBtn: { width: 36, height: 36, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
    meBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, justifyContent: 'center' },
    meBtnText: { fontSize: 10, fontWeight: '900', color: colors.secondaryText, textTransform: 'uppercase' },
    shareInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6 },
    paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    paidText: { fontSize: FONT.xs, fontWeight: '700' },
    phoneText: { fontSize: FONT.xs, color: colors.secondaryText, fontWeight: '500' },
    addParticipantBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.tint + '40', borderStyle: 'dashed', marginBottom: 20 },
    addParticipantText: { fontSize: FONT.sm, fontWeight: '700' },
    saveBtn: { padding: 16, borderRadius: RADIUS.lg, alignItems: 'center', marginTop: 4 },
    saveBtnText: { fontSize: FONT.body, fontWeight: '900', color: '#fff' },
});
