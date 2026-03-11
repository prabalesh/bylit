import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../providers/ThemeContext';
import { Colors } from '../constants/Colors';
import { Heart, User, Settings as SettingsIcon, Home, PieChart, Wallet, ArrowLeftRight, Target, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as appinfo from '../constants/AppInfo';


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

    const navItems: NavItem[] = [
        { label: 'Transactions', icon: Home, path: '/(app)/' },
        { label: 'Analytics', icon: PieChart, path: '/(app)/analytics' },
        { label: 'Budgets', icon: Target, path: '/(app)/budgets' },
        { label: 'Accounts', icon: Wallet, path: '/(app)/accounts' },
        { label: 'Lend & Borrow', icon: ArrowLeftRight, path: '/(app)/lend-borrow' },
        { label: 'Settings', icon: SettingsIcon, path: '/(app)/settings' },
    ];

    const styles = getStyles(activeColors, insets);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[activeColors.background, activeColors.card]}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View style={styles.profileSection}>
                        <LinearGradient
                            colors={[activeColors.tint, activeColors.tint + '90']}
                            style={styles.avatar}
                        >
                            <User color="#ffffff" size={32} />
                        </LinearGradient>
                        <View>
                            <Text style={styles.userName}>Bylit Financial</Text>
                            <Text style={styles.userStatus}>Your Private Money Manager</Text>
                        </View>
                    </View>
                </View>

                {currentTheme === 'heart' && (
                    <View style={[styles.heartDecoration, { opacity: 0.1 }]}>
                        <Heart color={activeColors.tint} size={24} fill={activeColors.tint} />
                    </View>
                )}
            </View>

            <ScrollView style={styles.navSection} showsVerticalScrollIndicator={false}>
                <View style={styles.navGroup}>
                    <Text style={styles.navGroupTitle}>Main Menu</Text>
                    {navItems.map((item) => (
                        <TouchableOpacity
                            key={item.path as string}
                            style={styles.navItem}
                            onPress={() => {
                                onClose();
                                router.push(item.path);
                            }}
                        >
                            <View style={[styles.navIconContainer, { backgroundColor: activeColors.card }]}>
                                <item.icon color={activeColors.tint} size={20} />
                            </View>
                            <Text style={styles.navLabel}>{item.label}</Text>
                            <View style={{ opacity: 0.3 }}>
                                <ChevronRight color={activeColors.secondaryText} size={16} />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <View style={styles.versionContainer}>
                    <Text style={styles.versionText}>v{appinfo.APP_VERSION} • Private & Secure</Text>
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
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
    navGroup: {
        padding: 16,
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
        padding: 14,
        borderRadius: 20,
        marginBottom: 8,
        gap: 16,
    },
    navIconContainer: {
        width: 42,
        height: 42,
        borderRadius: 14,
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
    footer: {
        padding: 20,
        paddingBottom: insets.bottom + 16,
    },
    versionContainer: {
        marginTop: 16,
        alignItems: 'center',
    },
    versionText: {
        fontSize: 11,
        color: colors.secondaryText,
        fontWeight: '700',
        opacity: 0.5,
    }
});
