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
import { SplitBill, SplitParticipant } from '../types/api';
import { useSaveSplitBill, useSettings, useCategories } from '../hooks/useData';
import { getCurrencySymbol } from '../constants/Currency';
import * as Contacts from 'expo-contacts';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

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
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [participants, setParticipants] = useState<LocalParticipant[]>([
        { name: '', share: '', paid: false },
    ]);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (bill) {
            setTitle(bill.title);
            setTotalAmount(bill.totalAmount.toString());
            setCategory(bill.category || '');
            setNotes(bill.notes || '');
            setDate(bill.date.split('T')[0]);
            setParticipants(
                bill.participants.map(p => ({
                    id: p.id,
                    name: p.name,
                    contactId: p.contactId,
                    phone: p.phone,
                    share: p.share.toString(),
                    paid: p.paid,
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
        setDate(new Date().toISOString().split('T')[0]);
        setParticipants([{ name: '', share: '', paid: false }]);
        setErrors({});
    };

    const splitEqually = () => {
        const total = parseFloat(totalAmount);
        if (!total || participants.length === 0) return;
        const each = (total / participants.length).toFixed(2);
        setParticipants(prev => prev.map(p => ({ ...p, share: each })));
    };

    const addParticipant = () => {
        setParticipants(prev => [...prev, { name: '', share: '', paid: false }]);
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

    const pickContact = async (index: number) => {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') return;
        const { data } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        });
        if (data.length === 0) return;
        // Simple picker via Alert with first 10 contacts
        const choices = data.slice(0, 30).filter(c => c.name);
        Alert.alert(
            'Select Contact',
            undefined,
            [
                ...choices.map(c => ({
                    text: c.name || '',
                    onPress: () => {
                        updateParticipant(index, 'name', c.name || '');
                        updateParticipant(index, 'contactId', c.id);
                        const phone = c.phoneNumbers?.[0]?.number;
                        if (phone) updateParticipant(index, 'phone', phone);
                    }
                })),
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!title.trim()) newErrors.title = 'Title is required';
        if (!totalAmount || isNaN(parseFloat(totalAmount))) newErrors.totalAmount = 'Valid amount required';
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
                date: new Date(date).toISOString(),
            },
            participants: participants.map(p => ({
                id: p.id,
                name: p.name.trim(),
                contactId: p.contactId,
                phone: p.phone,
                share: parseFloat(p.share) || 0,
                paid: p.paid,
            })),
        });
        onClose();
    };

    const styles = getStyles(activeColors);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
                                <TextInput
                                    style={styles.input}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={activeColors.secondaryText}
                                    value={date}
                                    onChangeText={setDate}
                                />
                            </View>
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
                                        {categories.map(cat => (
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
                                                style={[styles.participantInput, errors[`pname_${i}`] && styles.inputError, { flex: 1 }]}
                                                placeholder={`Person ${i + 1}`}
                                                placeholderTextColor={activeColors.secondaryText}
                                                value={p.name}
                                                onChangeText={v => updateParticipant(i, 'name', v)}
                                            />
                                            <TouchableOpacity
                                                style={styles.contactBtn}
                                                onPress={() => pickContact(i)}
                                            >
                                                <UserPlus color={activeColors.tint} size={14} />
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
        </Modal>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: Platform.OS === 'android' ? 20 : 16, borderBottomWidth: 1, borderBottomColor: colors.border },
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
    contactBtn: { ...BTN.sm, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', borderRadius: BTN.sm.borderRadius },
    shareInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 6 },
    paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    paidText: { fontSize: FONT.xs, fontWeight: '700' },
    phoneText: { fontSize: FONT.xs, color: colors.secondaryText, fontWeight: '500' },
    addParticipantBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.tint + '40', borderStyle: 'dashed', marginBottom: 20 },
    addParticipantText: { fontSize: FONT.sm, fontWeight: '700' },
    saveBtn: { padding: 16, borderRadius: RADIUS.lg, alignItems: 'center', marginTop: 4 },
    saveBtnText: { fontSize: FONT.body, fontWeight: '900', color: '#fff' },
});
