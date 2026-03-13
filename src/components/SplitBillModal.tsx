import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView,
    KeyboardAvoidingView, Platform
} from 'react-native';
import {
    X, Plus, Trash2, Users, Tag, Phone, Check,
    UserPlus, RefreshCw, ChevronDown, Minus
} from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useTheme } from '../providers/ThemeContext';
import { FONT, ICON, RADIUS } from '../constants/Sizes';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAccounts, useSaveSplitBill, useSettings, useCategories } from '../hooks/useData';
import { Account, Category, SplitBill } from '../types/api';
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

type SplitMode = 'equally' | 'parts' | 'percentage' | 'manual';

const SPLIT_MODES: { key: SplitMode; label: string; hint: string }[] = [
    { key: 'equally', label: 'Equal', hint: 'Divided equally among all' },
    { key: 'parts', label: 'Parts', hint: 'Set ratio parts per person' },
    { key: 'percentage', label: '%', hint: 'Enter % share per person' },
    { key: 'manual', label: 'Manual', hint: 'Enter exact amount per person' },
];


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
    const [splitMode, setSplitMode] = useState<SplitMode>('equally');
    const [participants, setParticipants] = useState<LocalParticipant[]>([
        { name: 'Myself', share: '1', paid: true, isMe: true },
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
    }, [accounts, accountId, bill]);

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
            setSplitMode('manual');
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
        setParticipants([{ name: 'Myself', share: '1', paid: true, isMe: true }]);
        setSplitMode('equally');
        setErrors({});
    };

    const computedAmounts = useMemo(() => {
        const total = parseFloat(totalAmount) || 0;
        if (total <= 0) return participants.map(() => 0);

        if (splitMode === 'equally') {
            const share = total / participants.length;
            return participants.map(() => share);
        }
        if (splitMode === 'parts') {
            const totalParts = participants.reduce((sum, p) => sum + (parseFloat(p.share) || 0), 0);
            return participants.map(p =>
                totalParts > 0 ? ((parseFloat(p.share) || 0) / totalParts) * total : 0
            );
        }
        if (splitMode === 'percentage') {
            return participants.map(p => ((parseFloat(p.share) || 0) / 100) * total);
        }
        // manual
        return participants.map(p => parseFloat(p.share) || 0);
    }, [splitMode, participants, totalAmount]);

    const totalPartsOrPercent = useMemo(() => {
        if (splitMode === 'parts') {
            return participants.reduce((sum, p) => sum + (parseFloat(p.share) || 0), 0);
        }
        if (splitMode === 'percentage') {
            return participants.reduce((sum, p) => sum + (parseFloat(p.share) || 0), 0);
        }
        return null;
    }, [splitMode, participants]);

    const getFinalParticipants = useCallback(() => {
        return participants.map((p, i) => ({ ...p, share: computedAmounts[i].toFixed(2) }));
    }, [participants, computedAmounts]);

    const addParticipant = () => {
        setParticipants(prev => [
            ...prev,
            { name: '', share: splitMode === 'percentage' ? '0' : '1', paid: false, isMe: false }
        ]);
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

    const adjustPart = (index: number, delta: number) => {
        setParticipants(prev => {
            const updated = [...prev];
            const current = parseFloat(updated[index].share) || 0;
            const next = Math.max(1, current + delta);
            updated[index] = { ...updated[index], share: next.toString() };
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
        });

        const total = parseFloat(totalAmount) || 0;
        const sumOfAmounts = computedAmounts.reduce((s, a) => s + a, 0);

        if (splitMode === 'percentage') {
            const totalPct = participants.reduce((s, p) => s + (parseFloat(p.share) || 0), 0);
            if (Math.abs(totalPct - 100) > 0.5) {
                newErrors.sharesTotal = `Percentages must sum to 100% (currently ${totalPct.toFixed(1)}%)`;
            }
        } else if (splitMode === 'manual' && total > 0 && Math.abs(sumOfAmounts - total) > 0.05) {
            newErrors.sharesTotal = `Sum (${symbol}${sumOfAmounts.toFixed(2)}) must equal total (${symbol}${total.toFixed(2)})`;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        const finalParticipants = getFinalParticipants();

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
            participants: finalParticipants.map(p => ({
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
    const currentModeHint = SPLIT_MODES.find(m => m.key === splitMode)?.hint ?? '';

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.container}>
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

                        {/* Amount + Date */}
                        <View style={styles.row}>
                            <View style={styles.rowField}>
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
                            <View style={styles.rowField}>
                                <Text style={styles.label}>Date</Text>
                                <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                                    <Text style={styles.dateText}>{date.toLocaleDateString('en-IN')}</Text>
                                </TouchableOpacity>
                                {showDatePicker && (
                                    <DateTimePicker value={date} mode="date" display="default" onChange={handleDateChange} />
                                )}
                            </View>
                        </View>

                        {/* Account */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Settlement Account</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                {accounts.map((a: Account) => (
                                    <TouchableOpacity
                                        key={a.id}
                                        style={[styles.chip, accountId === a.id && styles.chipActive]}
                                        onPress={() => setAccountId(a.id)}
                                    >
                                        <Text style={[styles.chipText, accountId === a.id && styles.chipTextActive]}>
                                            {a.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            {errors.accountId && <Text style={styles.errorText}>{errors.accountId}</Text>}
                        </View>

                        {/* Category */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Category</Text>
                            <TouchableOpacity
                                style={styles.categoryRow}
                                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                            >
                                <View style={styles.categoryRowLeft}>
                                    <Tag color={activeColors.secondaryText} size={ICON.sm} />
                                    <Text style={category ? styles.inputText : styles.inputPlaceholder}>
                                        {categories.find(c => c.id === category)?.name || category || 'Select category'}
                                    </Text>
                                </View>
                                <ChevronDown color={activeColors.secondaryText} size={ICON.sm} />
                            </TouchableOpacity>
                            {showCategoryPicker && (
                                <View style={styles.categoryPickerBox}>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.categoryPickerContent}
                                    >
                                        {categories.map((cat: Category) => (
                                            <TouchableOpacity
                                                key={cat.id}
                                                style={[
                                                    styles.categoryChip,
                                                    category === cat.id && { backgroundColor: activeColors.tint, borderColor: activeColors.tint }
                                                ]}
                                                onPress={() => { setCategory(cat.id); setShowCategoryPicker(false); }}
                                            >
                                                <Text style={[
                                                    styles.categoryChipText,
                                                    category === cat.id && styles.categoryChipTextActive
                                                ]}>
                                                    {cat.name}
                                                </Text>
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
                                style={styles.notesInput}
                                placeholder="Add any extra details..."
                                placeholderTextColor={activeColors.secondaryText}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                            />
                        </View>

                        {/* Split Mode Tabs */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Split Mode</Text>
                            <View style={styles.modeTabBar}>
                                {SPLIT_MODES.map(m => (
                                    <TouchableOpacity
                                        key={m.key}
                                        style={[styles.modeTab, splitMode === m.key && { backgroundColor: activeColors.tint }]}
                                        onPress={() => setSplitMode(m.key)}
                                    >
                                        <Text style={[styles.modeTabText, splitMode === m.key && styles.modeTabTextActive]}>
                                            {m.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={styles.modeHint}>{currentModeHint}</Text>
                        </View>

                        {/* Participants header */}
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionTitleRow}>
                                <Users color={activeColors.tint} size={ICON.sm} />
                                <Text style={styles.sectionTitle}>Participants</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.resetBtn}
                                onPress={() => setParticipants(prev => prev.map(p => ({ ...p, share: '1' })))}
                            >
                                <RefreshCw color={activeColors.tint} size={12} />
                                <Text style={[styles.resetBtnText, { color: activeColors.tint }]}>Reset</Text>
                            </TouchableOpacity>
                        </View>

                        {errors.participants && <Text style={styles.errorText}>{errors.participants}</Text>}
                        {errors.sharesTotal && <Text style={[styles.errorText, styles.errorMargin]}>{errors.sharesTotal}</Text>}

                        {/* Parts / Percentage running total hint */}
                        {(splitMode === 'parts' || splitMode === 'percentage') && totalPartsOrPercent !== null && (
                            <View style={[styles.totalHintRow, { backgroundColor: activeColors.tint + '12' }]}>
                                <Text style={[styles.totalHintText, { color: activeColors.tint }]}>
                                    {splitMode === 'parts'
                                        ? `Total parts: ${totalPartsOrPercent}`
                                        : `Total %: ${totalPartsOrPercent.toFixed(1)}% ${Math.abs(totalPartsOrPercent - 100) < 0.5 ? '✓' : '(must be 100%)'}`
                                    }
                                </Text>
                            </View>
                        )}

                        {/* Participant cards */}
                        {participants.map((p, i) => (
                            <View key={p.id ?? `${p.name}-${i}`} style={styles.participantCard}>

                                {/* Name row */}
                                <View style={styles.participantNameRow}>
                                    <TextInput
                                        style={[
                                            styles.participantInput,
                                            errors[`pname_${i}`] && styles.inputError,
                                            styles.participantInputFlex,
                                            p.isMe && { color: activeColors.tint, fontWeight: '800' }
                                        ]}
                                        placeholder={`Person ${i + 1}`}
                                        placeholderTextColor={activeColors.secondaryText}
                                        value={p.name}
                                        onChangeText={v => updateParticipant(i, 'name', v)}
                                        editable={!p.isMe}
                                    />
                                    {!p.isMe && (
                                        <TouchableOpacity style={styles.iconBtn} onPress={() => pickContact(i)}>
                                            <UserPlus color={activeColors.tint} size={14} />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={[styles.meBtn, p.isMe && { backgroundColor: activeColors.tint, borderColor: activeColors.tint }]}
                                        onPress={() => {
                                            setParticipants(prev => prev.map((part, idx) => ({
                                                ...part,
                                                isMe: idx === i ? !part.isMe : false,
                                                name: idx === i ? (!part.isMe ? 'Myself' : '') : part.name,
                                            })));
                                        }}
                                    >
                                        <Text style={[styles.meBtnText, p.isMe && styles.meBtnTextActive]}>Me</Text>
                                    </TouchableOpacity>
                                    {participants.length > 1 && (
                                        <TouchableOpacity style={styles.iconBtn} onPress={() => removeParticipant(i)}>
                                            <Trash2 size={14} color={activeColors.error} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {p.phone && (
                                    <View style={styles.phoneRow}>
                                        <Phone size={10} color={activeColors.secondaryText} />
                                        <Text style={styles.phoneText}>{p.phone}</Text>
                                    </View>
                                )}
                                {errors[`pname_${i}`] && <Text style={styles.errorText}>{errors[`pname_${i}`]}</Text>}

                                {/* Share input — mode specific */}
                                <View style={styles.shareRow}>
                                    {splitMode === 'equally' && (
                                        <View style={styles.shareDisplayBox}>
                                            <Text style={styles.shareDisplayLabel}>Share</Text>
                                            <Text style={[styles.shareDisplayAmount, { color: activeColors.tint }]}>
                                                {symbol}{computedAmounts[i].toFixed(2)}
                                            </Text>
                                        </View>
                                    )}

                                    {splitMode === 'parts' && (
                                        <View style={styles.partsRow}>
                                            <Text style={styles.shareDisplayLabel}>Parts</Text>
                                            <View style={styles.stepper}>
                                                <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustPart(i, -1)}>
                                                    <Minus size={12} color={activeColors.text} />
                                                </TouchableOpacity>
                                                <Text style={styles.stepperValue}>{parseFloat(p.share) || 0}</Text>
                                                <TouchableOpacity style={styles.stepperBtn} onPress={() => adjustPart(i, 1)}>
                                                    <Plus size={12} color={activeColors.text} />
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={[styles.computedLabel, { color: activeColors.tint }]}>
                                                = {symbol}{computedAmounts[i].toFixed(2)}
                                            </Text>
                                        </View>
                                    )}

                                    {splitMode === 'percentage' && (
                                        <View style={styles.partsRow}>
                                            <Text style={styles.shareDisplayLabel}>Percent</Text>
                                            <View style={styles.inlineInput}>
                                                <TextInput
                                                    style={styles.inlineInputField}
                                                    value={p.share}
                                                    onChangeText={v => updateParticipant(i, 'share', v)}
                                                    keyboardType="numeric"
                                                    placeholder="0"
                                                    placeholderTextColor={activeColors.secondaryText}
                                                />
                                                <Text style={styles.inlineInputSuffix}>%</Text>
                                            </View>
                                            <Text style={[styles.computedLabel, { color: activeColors.tint }]}>
                                                = {symbol}{computedAmounts[i].toFixed(2)}
                                            </Text>
                                        </View>
                                    )}

                                    {splitMode === 'manual' && (
                                        <View style={styles.partsRow}>
                                            <Text style={styles.shareDisplayLabel}>Amount</Text>
                                            <View style={styles.inlineInput}>
                                                <Text style={styles.inlineInputPrefix}>{symbol}</Text>
                                                <TextInput
                                                    style={styles.inlineInputField}
                                                    value={p.share}
                                                    onChangeText={v => updateParticipant(i, 'share', v)}
                                                    keyboardType="numeric"
                                                    placeholder="0.00"
                                                    placeholderTextColor={activeColors.secondaryText}
                                                />
                                            </View>
                                        </View>
                                    )}

                                    {/* Paid toggle — only enabled for "Me" participant */}
                                    <TouchableOpacity
                                        style={[
                                            styles.paidBadge,
                                            p.paid && { backgroundColor: activeColors.success + '20', borderColor: activeColors.success },
                                            !p.isMe && styles.paidBadgeDisabled,
                                        ]}
                                        onPress={() => updateParticipant(i, 'paid', !p.paid)}
                                        disabled={!p.isMe}
                                    >
                                        {p.paid
                                            ? <Check size={11} color={p.isMe ? activeColors.success : activeColors.secondaryText} />
                                            : <View style={styles.unpaidDot} />
                                        }
                                        <Text style={[
                                            styles.paidText,
                                            {
                                                color: p.paid
                                                    ? (p.isMe ? activeColors.success : activeColors.secondaryText)
                                                    : activeColors.secondaryText
                                            }
                                        ]}>
                                            {p.paid ? 'Paid' : 'Unpaid'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        <TouchableOpacity style={styles.addParticipantBtn} onPress={addParticipant}>
                            <Plus color={activeColors.tint} size={ICON.sm} />
                            <Text style={[styles.addParticipantText, { color: activeColors.tint }]}>Add Participant</Text>
                        </TouchableOpacity>

                        {/* Summary Table */}
                        {participants.length > 0 && parseFloat(totalAmount) > 0 && (
                            <View style={[styles.summaryTable, { borderColor: activeColors.border }]}>
                                <View style={[styles.summaryHeaderRow, { backgroundColor: activeColors.tint + '12' }]}>
                                    <Text style={[styles.summaryHeaderCell, { flex: 2 }]}>Name</Text>
                                    <Text style={[styles.summaryHeaderCell, { flex: 1, textAlign: 'right' }]}>Amount</Text>
                                    <Text style={[styles.summaryHeaderCell, { flex: 1, textAlign: 'center' }]}>Status</Text>
                                </View>
                                {participants.map((p, i) => (
                                    <View
                                        key={i}
                                        style={[styles.summaryRow, i % 2 === 1 && { backgroundColor: activeColors.card }]}
                                    >
                                        <Text style={[styles.summaryCellName, { flex: 2 }]} numberOfLines={1}>
                                            {p.name || `Person ${i + 1}`}{p.isMe ? ' (You)' : ''}
                                        </Text>
                                        <Text style={[styles.summaryCellAmount, { flex: 1, color: activeColors.tint }]}>
                                            {symbol}{computedAmounts[i].toFixed(2)}
                                        </Text>
                                        <View style={{ flex: 1, alignItems: 'center' }}>
                                            <View style={[
                                                styles.summaryStatusBadge,
                                                { backgroundColor: p.paid ? activeColors.success + '20' : activeColors.warning + '15' }
                                            ]}>
                                                <Text style={[
                                                    styles.summaryStatusText,
                                                    { color: p.paid ? activeColors.success : activeColors.warning }
                                                ]}>
                                                    {p.paid ? 'Paid' : 'Pending'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                                <View style={[styles.summaryTotalRow, { borderTopColor: activeColors.border }]}>
                                    <Text style={[styles.summaryTotalLabel, { flex: 2, color: activeColors.text }]}>Total</Text>
                                    <Text style={[styles.summaryTotalAmount, { flex: 1, color: activeColors.tint }]}>
                                        {symbol}{computedAmounts.reduce((s, a) => s + a, 0).toFixed(2)}
                                    </Text>
                                    <View style={{ flex: 1 }} />
                                </View>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: activeColors.tint }]}
                            onPress={handleSave}
                            disabled={saveSplitBill.isPending}
                        >
                            <Text style={styles.saveBtnText}>
                                {saveSplitBill.isPending ? 'Saving…' : bill ? 'Update Bill' : 'Create Bill'}
                            </Text>
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
    keyboardView: { flex: 1 },
    container: {
        flex: 1, backgroundColor: colors.background,
        marginTop: Platform.OS === 'android' ? 40 : 50,
        borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, overflow: 'hidden',
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: FONT.h2, fontWeight: '900', color: colors.text },
    closeBtn: {
        width: 36, height: 36, backgroundColor: colors.card,
        justifyContent: 'center', alignItems: 'center',
        borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    },
    scrollContent: { padding: 20, paddingBottom: 60 },
    fieldGroup: { marginBottom: 14 },
    label: {
        fontSize: FONT.xs, fontWeight: '800', color: colors.secondaryText,
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
    },
    input: {
        backgroundColor: colors.card, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: FONT.body, fontWeight: '600', color: colors.text,
    },
    notesInput: {
        backgroundColor: colors.card, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: FONT.body, fontWeight: '600', color: colors.text,
        height: 70, textAlignVertical: 'top',
    },
    dateText: { color: colors.text, fontWeight: '600' },
    inputRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
        borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: 14, paddingVertical: 12,
    },
    inputInner: { flex: 1, fontSize: FONT.body, fontWeight: '700', color: colors.text, padding: 0 },
    inputPrefix: { fontSize: FONT.body, fontWeight: '800', color: colors.secondaryText, marginRight: 6 },
    inputText: { fontSize: FONT.body, fontWeight: '600', color: colors.text },
    inputPlaceholder: { fontSize: FONT.body, fontWeight: '600', color: colors.secondaryText },
    inputError: { borderColor: colors.error },
    errorText: { fontSize: FONT.xs, color: colors.error, marginTop: 4, fontWeight: '600' },
    errorMargin: { marginBottom: 8 },
    row: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    rowField: { flex: 1 },
    chipScroll: { flexDirection: 'row', marginBottom: 4 },
    chip: {
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill,
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, marginRight: 8,
    },
    chipActive: { borderColor: colors.tint, backgroundColor: colors.tint + '10' },
    chipText: { fontSize: FONT.xs, fontWeight: '700', color: colors.text },
    chipTextActive: { color: colors.tint },
    categoryRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.card, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12,
    },
    categoryRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    categoryPickerBox: {
        marginTop: 8, backgroundColor: colors.card, borderRadius: RADIUS.lg,
        borderWidth: 1, borderColor: colors.border, overflow: 'hidden', padding: 8,
    },
    categoryPickerContent: { gap: 8, padding: 4 },
    categoryChip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill,
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
    },
    categoryChipText: { fontSize: FONT.sm, fontWeight: '700', color: colors.text },
    categoryChipTextActive: { color: '#fff' },

    // Mode tabs
    modeTabBar: {
        flexDirection: 'row', backgroundColor: colors.card,
        borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
        padding: 4, gap: 4,
    },
    modeTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: RADIUS.sm },
    modeTabText: { fontSize: 11, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase' },
    modeTabTextActive: { color: '#fff' },
    modeHint: { fontSize: FONT.xs, color: colors.secondaryText, fontWeight: '600', marginTop: 6, paddingLeft: 2 },

    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 10, marginTop: 4,
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { fontSize: FONT.sm, fontWeight: '900', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.8 },
    resetBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm,
        backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    resetBtnText: { fontSize: FONT.xs, fontWeight: '700' },
    totalHintRow: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, marginBottom: 10 },
    totalHintText: { fontSize: FONT.xs, fontWeight: '800' },

    // Participant card
    participantCard: {
        backgroundColor: colors.card, borderRadius: RADIUS.lg,
        borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 10, gap: 10,
    },
    participantNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    participantInput: {
        backgroundColor: colors.background, borderRadius: RADIUS.sm,
        borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: 12, paddingVertical: 8,
        fontSize: FONT.body, fontWeight: '600', color: colors.text,
    },
    participantInputFlex: { flex: 1 },
    iconBtn: {
        width: 34, height: 34, backgroundColor: colors.background,
        borderWidth: 1, borderColor: colors.border,
        justifyContent: 'center', alignItems: 'center', borderRadius: 10,
    },
    meBtn: {
        paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
    },
    meBtnText: { fontSize: 10, fontWeight: '900', color: colors.secondaryText, textTransform: 'uppercase' },
    meBtnTextActive: { color: '#fff' },
    phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    phoneText: { fontSize: FONT.xs, color: colors.secondaryText, fontWeight: '500' },

    // Share row
    shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    shareDisplayBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    shareDisplayLabel: { fontSize: FONT.xs, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase' },
    shareDisplayAmount: { fontSize: FONT.body, fontWeight: '900' },
    partsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    stepper: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background, borderRadius: RADIUS.sm,
        borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    stepperBtn: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.card },
    stepperValue: { paddingHorizontal: 14, fontSize: FONT.body, fontWeight: '900', color: colors.text },
    computedLabel: { fontSize: FONT.sm, fontWeight: '800' },
    inlineInput: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.background, borderRadius: RADIUS.sm,
        borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: 8, paddingVertical: 6,
    },
    inlineInputPrefix: { fontSize: FONT.body, fontWeight: '800', color: colors.secondaryText, marginRight: 4 },
    inlineInputSuffix: { fontSize: FONT.body, fontWeight: '800', color: colors.secondaryText, marginLeft: 4 },
    inlineInputField: { width: 60, fontSize: FONT.body, fontWeight: '700', color: colors.text, padding: 0 },

    // Paid badge
    paidBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm,
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
        marginLeft: 'auto',
    },
    paidBadgeDisabled: { opacity: 0.4 },
    unpaidDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.secondaryText + '60' },
    paidText: { fontSize: FONT.xs, fontWeight: '700' },

    addParticipantBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: 12, borderRadius: RADIUS.lg,
        borderWidth: 1, borderColor: colors.tint + '40',
        borderStyle: 'dashed', marginBottom: 16,
    },
    addParticipantText: { fontSize: FONT.sm, fontWeight: '700' },

    // Summary table
    summaryTable: { borderRadius: RADIUS.lg, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
    summaryHeaderRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
    summaryHeaderCell: { fontSize: 10, fontWeight: '900', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.background },
    summaryCellName: { fontSize: FONT.sm, fontWeight: '700', color: colors.text },
    summaryCellAmount: { fontSize: FONT.sm, fontWeight: '900', textAlign: 'right' },
    summaryStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
    summaryStatusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    summaryTotalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
    summaryTotalLabel: { fontSize: FONT.sm, fontWeight: '900', textTransform: 'uppercase' },
    summaryTotalAmount: { fontSize: FONT.sm, fontWeight: '900', textAlign: 'right' },

    saveBtn: { padding: 16, borderRadius: RADIUS.lg, alignItems: 'center', marginTop: 4 },
    saveBtnText: { fontSize: FONT.body, fontWeight: '900', color: '#fff' },
});
