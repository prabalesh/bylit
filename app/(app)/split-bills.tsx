import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    RefreshControl, Platform, Share, Alert, Modal
} from 'react-native';
import { useState, useMemo } from 'react';
import {
    Plus, Heart, Flower, Users, Check, Trash2,
    Share2, FileText, ChevronRight, Tag
} from 'lucide-react-native';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SplitBill, SplitParticipant } from '../../src/types/api';
import { useSplitBills, useDeleteSplitBill, useMarkParticipantPaid, useAccounts } from '../../src/hooks/useData';
import { useSettings } from '../../src/hooks/useData';
import { getCurrencySymbol } from '../../src/constants/Currency';
import SplitBillModal from '../../src/components/SplitBillModal';
import { FONT, ICON, BTN, RADIUS } from '../../src/constants/Sizes';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useConfirm } from '../../src/providers/ConfirmProvider';
import { useToast } from '../../src/providers/ToastProvider';

export default function SplitBillsScreen() {
    const insets = useSafeAreaInsets();
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedBill, setSelectedBill] = useState<SplitBill | null>(null);
    const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'splits' | 'settlements'>('splits');
    const [settlementModal, setSettlementModal] = useState<{ visible: boolean, participantId: string } | null>(null);

    const { data: splitBills = [], isLoading, refetch, isRefetching } = useSplitBills();
    const { data: settings } = useSettings();
    const deleteSplitBill = useDeleteSplitBill();
    const markParticipantPaid = useMarkParticipantPaid();
    const { data: accounts = [] } = useAccounts();
    const { showConfirm } = useConfirm();
    const { showToast } = useToast();

    const symbol = getCurrencySymbol(settings?.baseCurrency);

    const summary = useMemo(() => {
        let outstanding = 0;
        let settled = 0;
        for (const bill of splitBills) {
            for (const p of bill.participants) {
                if (p.isMe) continue;
                if (p.paid) settled += p.share;
                else outstanding += p.share;
            }
        }
        return { outstanding, settled };
    }, [splitBills]);

    const settlements = useMemo(() => {
        const map: Record<string, { share: number, phone?: string }> = {};
        for (const bill of splitBills) {
            for (const p of bill.participants) {
                if (p.isMe || p.paid) continue;
                if (!map[p.name]) {
                    map[p.name] = { share: 0, phone: p.phone };
                }
                map[p.name].share += p.share;
            }
        }
        return Object.entries(map)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.share - a.share);
    }, [splitBills]);

    const styles = getStyles(activeColors, insets);

    const generateTextReport = (bill: SplitBill): string => {
        const lines: string[] = [
            `📋 Split Bill: ${bill.title}`,
            `📅 Date: ${new Date(bill.date).toLocaleDateString()}`,
            bill.category ? `🏷️ Category: ${bill.category}` : '',
            `💰 Total: ${symbol}${bill.totalAmount.toLocaleString()}`,
            bill.notes ? `📝 Notes: ${bill.notes}` : '',
            '',
            '👥 Participants:',
            ...bill.participants.map(
                p => `  • ${p.name}: ${symbol}${p.share.toLocaleString()} — ${p.paid ? '✅ Paid' : '⏳ Pending'}${p.phone ? ` (${p.phone})` : ''}`
            ),
            '',
            `Pending total: ${symbol}${bill.participants.filter(p => !p.paid).reduce((s, p) => s + p.share, 0).toLocaleString()}`,
            `Paid total: ${symbol}${bill.participants.filter(p => p.paid).reduce((s, p) => s + p.share, 0).toLocaleString()}`,
        ];
        return lines.filter(l => l !== null).join('\n');
    };

    const handleShareMessage = async (bill: SplitBill) => {
        const text = generateTextReport(bill);
        await Share.share({ message: text, title: `Split Bill: ${bill.title}` });
    };

    const handleShareCSV = async (bill: SplitBill) => {
        const csvHeader = 'Name,Phone,Share,Status\n';
        const csvRows = bill.participants
            .map(p => `"${p.name}","${p.phone || ''}",${p.share},"${p.paid ? 'Paid' : 'Pending'}"`)
            .join('\n');
        const csvContent = `Title,${bill.title}\nDate,${bill.date}\nCategory,${bill.category || ''}\nTotal,${bill.totalAmount}\n\n${csvHeader}${csvRows}`;
        const fileUri = `${FileSystem.documentDirectory}split_${bill.id}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: 'utf8' });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
            await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: `${bill.title} — Report` });
        } else {
            showToast('Sharing not available on this device', 'error');
        }
    };

    const handleDelete = async (bill: SplitBill) => {
        const confirmed = await showConfirm({
            title: 'Delete Split Bill',
            message: `Delete "${bill.title}"? This cannot be undone.`,
            confirmText: 'Delete',
            type: 'danger',
        });
        if (confirmed) {
            await deleteSplitBill.mutateAsync(bill.id);
            showToast('Split bill deleted', 'success');
        }
    };

    const togglePaid = async (participantId: string, paid: boolean, isMe: boolean) => {
        if (isMe) {
            await markParticipantPaid.mutateAsync({ participantId, paid: !paid });
            return;
        }

        if (!paid) {
            if (accounts.length === 0) {
                await markParticipantPaid.mutateAsync({ participantId, paid: true });
                return;
            }
            setSettlementModal({ visible: true, participantId });
        } else {
            await markParticipantPaid.mutateAsync({ participantId, paid: false });
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.title}>Split Bills</Text>
                        {currentTheme === 'heart' && <Heart color={activeColors.tint} size={20} fill={activeColors.tint} />}
                    </View>
                    <Text style={styles.subtitle}>Track shared expenses</Text>
                </View>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => { setSelectedBill(null); setIsModalVisible(true); }}
                >
                    <Plus color="#fff" size={ICON.md} />
                </TouchableOpacity>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={isRefetching || isLoading} onRefresh={refetch} tintColor={activeColors.tint} />}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Summary Cards */}
                <View style={styles.summaryGrid}>
                    <LinearGradient colors={[activeColors.notification, activeColors.notification + 'CC']} style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Owed to you</Text>
                        <Text style={styles.summaryValue}>{symbol}{summary.outstanding.toLocaleString()}</Text>
                    </LinearGradient>
                    <LinearGradient colors={[activeColors.success, activeColors.success + 'CC']} style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Settled</Text>
                        <Text style={styles.summaryValue}>{symbol}{summary.settled.toLocaleString()}</Text>
                    </LinearGradient>
                </View>

                {/* Sub-Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'splits' && styles.activeTab]}
                        onPress={() => setActiveTab('splits')}
                    >
                        <Text style={[styles.tabText, activeTab === 'splits' && styles.activeTabText]}>Splits</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'settlements' && styles.activeTab]}
                        onPress={() => setActiveTab('settlements')}
                    >
                        <Text style={[styles.tabText, activeTab === 'settlements' && styles.activeTabText]}>Settlements</Text>
                    </TouchableOpacity>
                </View>

                {/* List Section */}
                <View style={styles.listSection}>
                    {activeTab === 'splits' ? (
                        <>
                            <Text style={styles.listSectionTitle}>All Bills ({splitBills.length})</Text>
                            {splitBills.map((bill: SplitBill) => {
                                const unpaidParticipants = bill.participants.filter((p: SplitParticipant) => !p.paid && !p.isMe);
                                const unpaidCount = unpaidParticipants.length;
                                const isExpanded = expandedBillId === bill.id;
                                const unpaidTotal = unpaidParticipants.reduce((s: number, p: SplitParticipant) => s + p.share, 0);
                                return (
                                    <View key={bill.id} style={styles.card}>
                                        {/* Card Header */}
                                        <TouchableOpacity
                                            style={styles.cardHeader}
                                            onPress={() => setExpandedBillId(isExpanded ? null : bill.id)}
                                        >
                                            <View style={styles.cardLeft}>
                                                <View style={[styles.iconContainer, { backgroundColor: activeColors.tint + '15' }]}>
                                                    <Users color={activeColors.tint} size={ICON.md} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.billTitle}>{bill.title}</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                        {bill.category && (
                                                            <View style={styles.categoryBadge}>
                                                                <Tag size={9} color={activeColors.tint} />
                                                                <Text style={[styles.categoryBadgeText, { color: activeColors.tint }]}>{bill.category}</Text>
                                                            </View>
                                                        )}
                                                        <Text style={styles.dateText}>{new Date(bill.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                                <Text style={styles.billAmount}>{symbol}{bill.totalAmount.toLocaleString()}</Text>
                                                <View style={[styles.statusBadge, { backgroundColor: unpaidCount > 0 ? activeColors.warning + '15' : activeColors.success + '15' }]}>
                                                    <Text style={[styles.statusText, { color: unpaidCount > 0 ? activeColors.warning : activeColors.success }]}>
                                                        {unpaidCount > 0 ? `${unpaidCount} pending` : 'Settled'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <View style={styles.expandedSection}>
                                                {bill.notes ? (
                                                    <Text style={styles.notesText}>{bill.notes}</Text>
                                                ) : null}

                                                {/* Participants */}
                                                {bill.participants.map((p: SplitParticipant) => (
                                                    <TouchableOpacity
                                                        key={p.id}
                                                        style={styles.participantRow}
                                                        onPress={() => togglePaid(p.id, p.paid, !!p.isMe)}
                                                    >
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                            <View style={[styles.paidCircle, { borderColor: p.paid ? activeColors.success : activeColors.border, backgroundColor: p.paid ? activeColors.success + '20' : 'transparent' }]}>
                                                                {p.paid && <Check size={10} color={activeColors.success} />}
                                                            </View>
                                                            <View>
                                                                <Text style={[styles.participantName, p.isMe && { color: activeColors.tint, fontWeight: '900' }]}>{p.name}{p.isMe ? ' (You)' : ''}</Text>
                                                                {p.phone && <Text style={styles.participantPhone}>{p.phone}</Text>}
                                                            </View>
                                                        </View>
                                                        <Text style={[styles.participantShare, { color: p.paid ? activeColors.success : activeColors.text }]}>
                                                            {symbol}{p.share.toLocaleString()}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}

                                                {/* Unpaid total */}
                                                {unpaidTotal > 0 && (
                                                    <View style={styles.unpaidTotalRow}>
                                                        <Text style={[styles.unpaidTotalLabel, { color: activeColors.warning }]}>Remaining to collect</Text>
                                                        <Text style={[styles.unpaidTotalValue, { color: activeColors.warning }]}>{symbol}{unpaidTotal.toLocaleString()}</Text>
                                                    </View>
                                                )}

                                                {/* Actions row */}
                                                <View style={styles.actionsRow}>
                                                    <TouchableOpacity
                                                        style={[styles.actionBtn, { backgroundColor: activeColors.tint + '15', borderColor: activeColors.tint + '30' }]}
                                                        onPress={() => handleShareMessage(bill)}
                                                    >
                                                        <Share2 size={14} color={activeColors.tint} />
                                                        <Text style={[styles.actionBtnText, { color: activeColors.tint }]}>Message</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.actionBtn, { backgroundColor: activeColors.success + '15', borderColor: activeColors.success + '30' }]}
                                                        onPress={() => handleShareCSV(bill)}
                                                    >
                                                        <FileText size={14} color={activeColors.success} />
                                                        <Text style={[styles.actionBtnText, { color: activeColors.success }]}>Report</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.actionBtn, { flex: 0.5 }]}
                                                        onPress={() => { setSelectedBill(bill); setIsModalVisible(true); }}
                                                    >
                                                        <ChevronRight size={14} color={activeColors.secondaryText} />
                                                        <Text style={[styles.actionBtnText, { color: activeColors.secondaryText }]}>Edit</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.actionBtn, { flex: 0.5, backgroundColor: activeColors.error + '15', borderColor: activeColors.error + '30' }]}
                                                        onPress={() => handleDelete(bill)}
                                                    >
                                                        <Trash2 size={14} color={activeColors.error} />
                                                        <Text style={[styles.actionBtnText, { color: activeColors.error }]}>Delete</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                            {splitBills.length === 0 && (
                                <View style={styles.emptyContainer}>
                                    <Users color={activeColors.secondaryText} size={40} opacity={0.3} />
                                    <Text style={styles.emptyText}>No split bills yet</Text>
                                    <Text style={styles.emptySub}>Tap + to split an expense with friends</Text>
                                </View>
                            )}
                        </>
                    ) : (
                        <>
                            <Text style={styles.listSectionTitle}>Outstanding Settlements ({settlements.length})</Text>
                            {settlements.map((s, i) => (
                                <View key={i} style={styles.card}>
                                    <View style={[styles.cardHeader, { alignItems: 'center' }]}>
                                        <View style={styles.cardLeft}>
                                            <View style={[styles.iconContainer, { backgroundColor: activeColors.notification + '15' }]}>
                                                <Text style={{ fontSize: 16, fontWeight: '900', color: activeColors.notification }}>{s.name[0].toUpperCase()}</Text>
                                            </View>
                                            <View>
                                                <Text style={styles.billTitle}>{s.name}</Text>
                                                {s.phone && <Text style={styles.dateText}>{s.phone}</Text>}
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={[styles.billAmount, { color: activeColors.notification }]}>{symbol}{s.share.toLocaleString()}</Text>
                                            <Text style={styles.statusText}>Owes you</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                            {settlements.length === 0 && (
                                <View style={styles.emptyContainer}>
                                    <Check color={activeColors.success} size={40} opacity={0.3} />
                                    <Text style={styles.emptyText}>All settled up!</Text>
                                    <Text style={styles.emptySub}>No one owes you money right now.</Text>
                                </View>
                            )}
                        </>
                    )}
                </View>

                {currentTheme === 'heart' && (
                    <View style={{ alignItems: 'center', marginTop: 20 }}>
                        <Flower color={activeColors.tint} size={32} opacity={0.2} />
                    </View>
                )}
            </ScrollView>

            <SplitBillModal
                visible={isModalVisible}
                onClose={() => { setIsModalVisible(false); setSelectedBill(null); }}
                bill={selectedBill}
            />

            {/* Settlement Account Modal */}
            <Modal
                visible={!!settlementModal?.visible}
                transparent
                animationType="fade"
                onRequestClose={() => setSettlementModal(null)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setSettlementModal(null)}
                >
                    <TouchableOpacity
                        style={styles.settlementModalContent}
                        activeOpacity={1}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={styles.settlementTitle}>Settlement Account</Text>
                        <Text style={styles.settlementSubtitle}>Where did you receive this payment?</Text>

                        <View style={styles.settlementAccountList}>
                            {accounts.map(acc => (
                                <TouchableOpacity
                                    key={acc.id}
                                    style={styles.settlementAccountItem}
                                    onPress={() => {
                                        const pid = settlementModal?.participantId;
                                        if (pid) {
                                            markParticipantPaid.mutate({
                                                participantId: pid,
                                                paid: true,
                                                toAccountId: acc.id
                                            });
                                        }
                                        setSettlementModal(null);
                                    }}
                                >
                                    <View style={[styles.settlementIcon, { backgroundColor: activeColors.tint + '15' }]}>
                                        <Check size={18} color={activeColors.tint} />
                                    </View>
                                    <Text style={styles.settlementAccountName}>{acc.name}</Text>
                                    <Text style={styles.settlementAccountBalance}>{symbol}{acc.balance.toLocaleString()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.settlementCancelBtn}
                            onPress={() => setSettlementModal(null)}
                        >
                            <Text style={styles.settlementCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? insets.top : 16, paddingBottom: 10 },
    title: { fontSize: FONT.h1, fontWeight: '900', color: colors.text },
    subtitle: { fontSize: FONT.xxs, fontWeight: '700', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
    addBtn: { ...BTN.md, backgroundColor: colors.tint, justifyContent: 'center', alignItems: 'center', borderRadius: BTN.md.borderRadius, elevation: 4, shadowColor: colors.tint, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    summaryGrid: { flexDirection: 'row', padding: 20, gap: 10 },
    summaryCard: { flex: 1, padding: 16, borderRadius: RADIUS.xl, position: 'relative', overflow: 'hidden' },
    summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: FONT.xxs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    summaryValue: { color: '#fff', fontSize: FONT.h3, fontWeight: '900', marginTop: 4 },
    tabContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.card, borderRadius: RADIUS.lg, padding: 4, borderWidth: 1, borderColor: colors.border },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: RADIUS.md },
    activeTab: { backgroundColor: colors.background, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    tabText: { fontSize: FONT.xs, fontWeight: '700', color: colors.secondaryText },
    activeTabText: { color: colors.tint, fontWeight: '800' },
    listSection: { paddingHorizontal: 20 },
    listSectionTitle: { fontSize: FONT.xxs, fontWeight: '900', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14, paddingLeft: 4 },
    card: { backgroundColor: colors.card, borderRadius: RADIUS.xl, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16 },
    cardLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
    iconContainer: { width: 40, height: 40, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
    billTitle: { fontSize: FONT.body, fontWeight: '800', color: colors.text },
    dateText: { fontSize: FONT.xxs, fontWeight: '600', color: colors.secondaryText },
    billAmount: { fontSize: FONT.h3, fontWeight: '900', color: colors.text },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm },
    statusText: { fontSize: FONT.xxs, fontWeight: '800', textTransform: 'uppercase' },
    categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.tint + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
    categoryBadgeText: { fontSize: FONT.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    expandedSection: { borderTopWidth: 1, borderTopColor: colors.border, padding: 16, gap: 0 },
    notesText: { fontSize: FONT.sm, fontWeight: '500', color: colors.secondaryText, marginBottom: 12, fontStyle: 'italic' },
    participantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
    paidCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
    participantName: { fontSize: FONT.body, fontWeight: '700', color: colors.text },
    participantPhone: { fontSize: FONT.xs, color: colors.secondaryText, fontWeight: '500' },
    participantShare: { fontSize: FONT.body, fontWeight: '800' },
    unpaidTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 2 },
    unpaidTotalLabel: { fontSize: FONT.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    unpaidTotalValue: { fontSize: FONT.body, fontWeight: '900' },
    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
    actionBtnText: { fontSize: FONT.xs, fontWeight: '800' },
    emptyContainer: { padding: 50, alignItems: 'center', gap: 8 },
    emptyText: { fontSize: FONT.body, fontWeight: '900', color: colors.text },
    emptySub: { fontSize: FONT.sm, fontWeight: '600', color: colors.secondaryText, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    settlementModalContent: { backgroundColor: colors.background, borderRadius: RADIUS.xl, width: '100%', maxWidth: 400, padding: 24, paddingBottom: 16 },
    settlementTitle: { fontSize: FONT.h3, fontWeight: '900', color: colors.text, marginBottom: 8 },
    settlementSubtitle: { fontSize: FONT.sm, fontWeight: '600', color: colors.secondaryText, marginBottom: 20 },
    settlementAccountList: { gap: 12, marginBottom: 20 },
    settlementAccountItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border },
    settlementIcon: { width: 40, height: 40, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    settlementAccountName: { flex: 1, fontSize: FONT.body, fontWeight: '700', color: colors.text },
    settlementAccountBalance: { fontSize: FONT.sm, fontWeight: '800', color: colors.secondaryText },
    settlementCancelBtn: { padding: 12, alignItems: 'center' },
    settlementCancelText: { fontSize: FONT.sm, fontWeight: '800', color: colors.tint },
});
