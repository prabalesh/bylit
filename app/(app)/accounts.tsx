import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { Wallet, Plus, CreditCard, Banknote, Heart, Flower, ChevronRight } from 'lucide-react-native';
import { Account } from '../../src/types/api';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import AccountModal from '../../src/components/AccountModal';
import { getCurrencySymbol } from '../../src/constants/Currency';
import { useAccounts, useSettings } from '../../src/hooks/useData';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function AccountsScreen() {
    const insets = useSafeAreaInsets();
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const [isAccountModalVisible, setIsAccountModalVisible] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

    const { data: accounts = [], isLoading, refetch, isRefetching } = useAccounts();
    const { data: settings } = useSettings();

    const symbol = getCurrencySymbol(settings?.baseCurrency);
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

    const getIcon = (type: string) => {
        switch (type) {
            case 'Bank': return Wallet;
            case 'Credit': return CreditCard;
            case 'Cash': return Banknote;
            default: return Wallet;
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'Bank': return activeColors.tint;
            case 'Credit': return activeColors.notification;
            case 'Cash': return activeColors.success;
            default: return activeColors.tint;
        }
    };

    const styles = getStyles(activeColors, insets);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.title}>Accounts</Text>
                        {currentTheme === 'heart' && <Heart color={activeColors.tint} size={20} fill={activeColors.tint} />}
                    </View>
                    <Text style={styles.subtitle}>Net Worth Overview</Text>
                </View>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => { setSelectedAccount(null); setIsAccountModalVisible(true); }}
                >
                    <Plus color="#fff" size={20} />
                </TouchableOpacity>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={isRefetching || isLoading} onRefresh={refetch} tintColor={activeColors.tint} />}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Premium Net Worth Card */}
                <View style={styles.summarySection}>
                    <LinearGradient
                        colors={[activeColors.tint, activeColors.tint + 'EE']}
                        style={styles.summaryCard}
                    >
                        <Text style={styles.summaryLabel}>Total Net Worth</Text>
                        <Text style={styles.summaryValue}>{symbol}{totalBalance.toLocaleString()}</Text>
                        <View style={styles.summaryFooter}>
                            <View style={styles.accountCount}>
                                <Text style={styles.accountCountText}>{accounts.length} Active Accounts</Text>
                            </View>
                        </View>
                        {currentTheme === 'heart' && (
                            <View style={{ position: 'absolute', right: -10, bottom: -10 }}>
                                <Flower color="#fff" size={80} opacity={0.15} />
                            </View>
                        )}
                    </LinearGradient>
                </View>

                {/* Accounts List */}
                <View style={styles.listSection}>
                    {accounts.map(item => {
                        const Icon = getIcon(item.type);
                        const color = getColor(item.type);
                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.card}
                                onPress={() => { setSelectedAccount(item); setIsAccountModalVisible(true); }}
                            >
                                <View style={styles.cardLeft}>
                                    <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                                        <Icon color={color} size={22} />
                                    </View>
                                    <View>
                                        <Text style={styles.accountType}>{item.type}</Text>
                                        <Text style={styles.accountName}>{item.name}</Text>
                                    </View>
                                </View>
                                <View style={styles.cardRight}>
                                    <Text style={[styles.balanceText, { color }]}>
                                        {symbol}{item.balance.toLocaleString()}
                                    </Text>
                                    <ChevronRight size={16} color={activeColors.secondaryText} />
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    {accounts.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No accounts yet</Text>
                            <Text style={styles.emptySub}>Set up your first wallet</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <AccountModal
                visible={isAccountModalVisible}
                onClose={() => setIsAccountModalVisible(false)}
                account={selectedAccount}
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
    summarySection: { padding: 20 },
    summaryCard: { padding: 24, borderRadius: 28, overflow: 'hidden' },
    summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
    summaryValue: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 6 },
    summaryFooter: { marginTop: 16, flexDirection: 'row' },
    accountCount: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    accountCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    listSection: { paddingHorizontal: 20 },
    card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, padding: 16, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    accountType: { fontSize: 9, fontWeight: '800', color: colors.secondaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
    accountName: { fontSize: 15, fontWeight: '700', color: colors.text },
    cardRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    balanceText: { fontSize: 15, fontWeight: '900' },
    emptyContainer: { padding: 50, alignItems: 'center' },
    emptyText: { fontSize: 16, fontWeight: '900', color: colors.text },
    emptySub: { fontSize: 12, fontWeight: '600', color: colors.secondaryText, marginTop: 4 }
});
