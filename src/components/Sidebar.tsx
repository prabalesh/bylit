import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../providers/ThemeContext';
import { Colors } from '../constants/Colors';
import {
    Heart, User, Settings as SettingsIcon, Home, PieChart,
    Wallet, ArrowLeftRight, Target, ChevronRight,
    Zap, RefreshCw, Plus
} from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import type { Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as appinfo from '../constants/AppInfo';
import { useDebtTotals, useSettings } from '../hooks/useData';
import { getCurrencySymbol } from '../constants/Currency';
import { BackupService } from '../services/backupService';
import { useToast } from '../providers/ToastProvider';


interface SidebarProps {
    onClose: () => void;
}

interface NavItem {
    label: string;
    icon: React.ComponentType<{ color: string; size: number }>;
    path: Href;
}

export default function Sidebar({ onClose }: SidebarProps) {
    const { currentTheme } = useTheme();
    const insets = useSafeAreaInsets();
    const activeColors = Colors[currentTheme];
    const router = useRouter();
    const pathname = usePathname();
    const { showToast } = useToast();

    const { data: debtTotals } = useDebtTotals();
    const { data: settings } = useSettings();
    const symbol = getCurrencySymbol(settings?.baseCurrency);

    const navItems: NavItem[] = [
        { label: 'Transactions', icon: Home, path: '/(app)/' },
        { label: 'Analytics', icon: PieChart, path: '/(app)/analytics' },
        { label: 'Budgets', icon: Target, path: '/(app)/budgets' },
        { label: 'Accounts', icon: Wallet, path: '/(app)/accounts' },
        { label: 'Lend & Borrow', icon: ArrowLeftRight, path: '/(app)/lend-borrow' },
        { label: 'Settings', icon: SettingsIcon, path: '/(app)/settings' },
    ];

    const styles = getStyles(activeColors, insets);

    const handleSync = async () => {
        try {
            await BackupService.exportDataJSON();
            showToast('Backup successful', 'success');
        } catch (e) {
            showToast('Backup failed', 'error');
        }
    };

    const netWorth = (debtTotals?.lent || 0) - (debtTotals?.borrowed || 0);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[activeColors.background, activeColors.card]}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.header}>
                <View style={styles.profileSection}>
                    <LinearGradient
                        colors={[activeColors.tint, activeColors.tint + 'CC']}
                        style={styles.avatar}
                    >
                        <User color="#ffffff" size={32} />
                    </LinearGradient>
                    <View>
                        <Text style={styles.userName}>Bylit Financial</Text>
                        <Text style={styles.userStatus}>Private Manager</Text>
                    </View>
                </View>
                {currentTheme === 'heart' && (
                    <View style={[styles.heartDecoration, { opacity: 0.2 }]}>
                        <Heart color={activeColors.tint} size={28} fill={activeColors.tint} />
                    </View>
                )}
            </View>

            <ScrollView style={styles.navSection} showsVerticalScrollIndicator={false}>
                {/* Wealth Summary Card */}
                <View style={styles.summaryCard}>
                    <LinearGradient
                        colors={[activeColors.card, activeColors.background]}
                        style={styles.summaryGradient}
                    >
                        <View style={styles.summaryRow}>
                            <View>
                                <Text style={styles.summaryLabel}>Lent</Text>
                                <Text style={[styles.summaryValue, { color: activeColors.success }]}>{symbol}{(debtTotals?.lent || 0).toLocaleString()}</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View>
                                <Text style={styles.summaryLabel}>Borrowed</Text>
                                <Text style={[styles.summaryValue, { color: activeColors.error }]}>{symbol}{(debtTotals?.borrowed || 0).toLocaleString()}</Text>
                            </View>
                        </View>
                        <View style={styles.netWorthRow}>
                            <Text style={styles.netWorthLabel}>Net Debt Balance</Text>
                            <Text style={[styles.netWorthValue, { color: netWorth >= 0 ? activeColors.success : activeColors.error }]}>
                                {netWorth >= 0 ? '+' : ''}{symbol}{Math.abs(netWorth).toLocaleString()}
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Main Menu */}
                <View style={styles.navGroup}>
                    <Text style={styles.navGroupTitle}>Main Menu</Text>
                    {navItems.map((item) => {
                        const isActive = pathname === item.path;
                        return (
                            <TouchableOpacity
                                key={item.path as string}
                                style={[styles.navItem, isActive && styles.navItemActive]}
                                onPress={() => {
                                    onClose();
                                    router.push(item.path);
                                }}
                            >
                                <View style={[
                                    styles.navIconContainer,
                                    { backgroundColor: isActive ? activeColors.tint + '20' : activeColors.card }
                                ]}>
                                    <item.icon color={isActive ? activeColors.tint : activeColors.secondaryText} size={20} />
                                </View>
                                <Text style={[styles.navLabel, isActive && { color: activeColors.tint }]}>{item.label}</Text>
                                {isActive && (
                                    <View style={styles.activeDot} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Quick Actions */}
                <View style={styles.navGroup}>
                    <Text style={styles.navGroupTitle}>Quick Actions</Text>
                    <TouchableOpacity style={styles.navItem} onPress={handleSync}>
                        <View style={[styles.navIconContainer, { backgroundColor: activeColors.card }]}>
                            <RefreshCw color={activeColors.secondaryText} size={20} />
                        </View>
                        <Text style={styles.navLabel}>Backup / Sync Now</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.navItem} onPress={() => { onClose(); router.push('/(app)/' as Href); }}>
                        <View style={[styles.navIconContainer, { backgroundColor: activeColors.card }]}>
                            <Plus color={activeColors.secondaryText} size={20} />
                        </View>
                        <Text style={styles.navLabel}>Add Transaction</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <View style={styles.versionContainer}>
                    <View style={styles.versionInfo}>
                        <Text style={styles.versionText}>v{appinfo.APP_VERSION}</Text>
                        <View style={styles.dot} />
                        <Text style={styles.versionText}>Secure</Text>
                    </View>
                    <View style={styles.safetyBadge}>
                        <Zap color={activeColors.tint} size={10} fill={activeColors.tint} />
                        <Text style={styles.safetyText}>Local Encryption Active</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: insets.top,
        backgroundColor: colors.background,
    },
    header: {
        padding: 24,
        paddingTop: 32,
        marginBottom: 8,
        position: 'relative',
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: colors.tint,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    userName: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.text,
        letterSpacing: -0.5,
    },
    userStatus: {
        fontSize: 12,
        color: colors.secondaryText,
        fontWeight: '600',
        marginTop: 2,
    },
    heartDecoration: {
        position: 'absolute',
        top: 24,
        right: 24,
    },
    navSection: {
        flex: 1,
    },
    summaryCard: {
        marginHorizontal: 16,
        marginBottom: 24,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    summaryGradient: {
        padding: 20,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    summaryDivider: {
        width: 1,
        height: 30,
        backgroundColor: colors.border,
        opacity: 0.5,
    },
    summaryLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.secondaryText,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '900',
    },
    netWorthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    netWorthLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text,
    },
    netWorthValue: {
        fontSize: 16,
        fontWeight: '900',
    },
    navGroup: {
        padding: 16,
        paddingTop: 0,
    },
    navGroupTitle: {
        fontSize: 10,
        fontWeight: '900',
        color: colors.secondaryText,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginLeft: 8,
        marginBottom: 16,
        opacity: 0.6,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 16,
        borderRadius: 18,
        marginBottom: 4,
        gap: 16,
    },
    navItemActive: {
        backgroundColor: colors.tint + '10',
    },
    navIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    navLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.tint,
    },
    footer: {
        padding: 20,
        paddingBottom: insets.bottom + 16,
    },
    versionContainer: {
        alignItems: 'center',
        gap: 8,
    },
    versionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: colors.secondaryText,
        opacity: 0.5,
    },
    versionText: {
        fontSize: 11,
        color: colors.secondaryText,
        fontWeight: '700',
        opacity: 0.5,
    },
    safetyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.tint + '10',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
    },
    safetyText: {
        fontSize: 10,
        color: colors.tint,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    }
});
