import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../providers/ThemeContext';
import { Colors } from '../constants/Colors';
import { LogOut, LogIn, Sun, Moon, Heart, User, Settings as SettingsIcon, Home, PieChart, Wallet, ArrowLeftRight, Target, ChevronRight, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SidebarProps {
    onClose: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
    const { themeMode, setThemeMode, currentTheme } = useTheme();
    const insets = useSafeAreaInsets();
    const activeColors = Colors[currentTheme];
    const router = useRouter();

    const navItems = [
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
                    <View style={styles.heartDecoration}>
                        <Heart color={activeColors.tint} size={24} fill={activeColors.tint} opacity={0.1} />
                    </View>
                )}
            </View>

            <ScrollView style={styles.navSection} showsVerticalScrollIndicator={false}>
                <View style={styles.navGroup}>
                    <Text style={styles.navGroupTitle}>Main Menu</Text>
                    {navItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.navItem}
                            onPress={() => {
                                onClose();
                                router.push(item.path as any);
                            }}
                        >
                            <View style={[styles.navIconContainer, { backgroundColor: activeColors.card }]}>
                                <item.icon color={activeColors.tint} size={20} />
                            </View>
                            <Text style={styles.navLabel}>{item.label}</Text>
                            <ChevronRight color={activeColors.secondaryText} size={16} opacity={0.3} />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <View style={styles.versionContainer}>
                    <Text style={styles.versionText}>v1.2.0 • Private & Secure</Text>
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
    themeCard: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    themeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        marginLeft: 4,
    },
    themeCardTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: colors.secondaryText,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    themeGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    themeOption: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    themeOptionActive: {
        backgroundColor: colors.tint,
        borderColor: colors.tint,
        elevation: 4,
    },
    themeOptionLabel: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
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
