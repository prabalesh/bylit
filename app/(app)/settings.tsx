import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform, Alert } from 'react-native';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import { Shield, Info, Coins, Check, Sun, Moon, Heart, Sparkles, Bell, Clock } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Repository } from '../../src/services/repository';
import { Settings as SettingsType } from '../../src/types/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { scheduleDailyExpenseReminder, cancelDailyReminder, requestNotificationPermissions } from '../../src/services/notifications';
import { CSVService } from '../../src/services/csvService';
import { useTransactions } from '../../src/hooks/useData';
import { Mail, Github, Download, Upload, FileText } from 'lucide-react-native';
import { BackupService } from '../../src/services/backupService';
import { useConfirm } from '../../src/providers/ConfirmProvider';
import { useToast } from '../../src/providers/ToastProvider';
import { CURRENCY_SYMBOLS } from '../../src/constants/Currency';
import { FONT, ICON, BTN, RADIUS } from '../../src/constants/Sizes';
import { APP_VERSION, APP_DISPLAY_NAME } from '../../src/constants/AppInfo';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const { themeMode, setThemeMode, currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const queryClient = useQueryClient();
    const { showConfirm } = useConfirm();
    const { showToast } = useToast();

    const { data: settings } = useQuery<SettingsType>({
        queryKey: ['settings'],
        queryFn: () => Repository.getSettings() as any
    });

    const { data: transactions = [] } = useTransactions();

    const updateSettingsMutation = useMutation({
        mutationFn: (updates: Partial<SettingsType>) => Repository.saveSettings(updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        }
    });

    // Local reminder state — synced from settings
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [reminderHour, setReminderHour] = useState(20);
    const [reminderMinute, setReminderMinute] = useState(0);

    useEffect(() => {
        if (settings) {
            setReminderEnabled(settings.reminderEnabled ?? false);
            setReminderHour(settings.reminderHour ?? 20);
            setReminderMinute(settings.reminderMinute ?? 0);
        }
    }, [settings]);

    const handleToggleReminder = async (value: boolean) => {
        if (!value) {
            setReminderEnabled(false);
            await cancelDailyReminder();
            updateSettingsMutation.mutate({ reminderEnabled: false });
            return;
        }

        const confirmed = await showConfirm({
            title: 'Enable Notifications',
            message: 'Bylit needs notification permissions to remind you to log your daily expenses. Would you like to enable this?',
            confirmText: 'Enable',
            cancelText: 'Not Now'
        });

        if (!confirmed) {
            setReminderEnabled(false);
            return;
        }

        const granted = await requestNotificationPermissions();
        if (!granted) {
            setReminderEnabled(false);
            showConfirm({
                title: 'Permission Denied',
                message: 'Please enable notifications for Bylit in your device settings to use daily reminders.',
                confirmText: 'OK',
                type: 'info'
            });
            return;
        }
        setReminderEnabled(true);
        await scheduleDailyExpenseReminder(reminderHour, reminderMinute);
        updateSettingsMutation.mutate({ reminderEnabled: true });
    };

    const adjustHour = (delta: number) => {
        const newHour = (reminderHour + delta + 24) % 24;
        setReminderHour(newHour);
    };

    const adjustMinute = (delta: number) => {
        const newMin = (reminderMinute + delta + 60) % 60;
        setReminderMinute(newMin);
    };

    const saveReminderTime = async () => {
        updateSettingsMutation.mutate({ reminderHour, reminderMinute });
        if (reminderEnabled) {
            await scheduleDailyExpenseReminder(reminderHour, reminderMinute);
        }
        showToast('Reminder time saved', 'success');
    };

    const formatTime = (h: number, m: number) =>
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    const menuItems = [
        { icon: <Shield color={activeColors.tint} size={18} />, label: 'Data Privacy', value: 'Local Only' },
        { icon: <Info color={activeColors.tint} size={18} />, label: 'App Version', value: `Bylit v${APP_VERSION}` },
    ];

    const handleBackupJSON = async () => {
        try {
            await BackupService.exportDataJSON();
            showToast('JSON backup exported', 'success');
        } catch (error) {
            showToast('JSON export failed', 'error');
        }
    };

    const handleRestoreJSON = async () => {
        const confirmed = await showConfirm({
            title: 'Restore JSON Data',
            message: "This will replace all current data with the backup file. It's recommended to export a backup before restoring.",
            confirmText: 'Restore',
            type: 'danger'
        });

        if (confirmed) {
            try {
                const success = await BackupService.importDataJSON();
                if (success) {
                    queryClient.invalidateQueries();
                    showToast('Data restored successfully', 'success');
                }
            } catch (error) {
                showToast('Failed to restore JSON data', 'error');
            }
        }
    };

    const handleExportSummary = async () => {
        try {
            const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
            await CSVService.exportMonthlySummary(transactions, currentMonth);
            showToast('Summary exported', 'success');
        } catch (error) {
            showToast('Export failed', 'error');
        }
    };

    const styles = getStyles(activeColors, insets);

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Appearance Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Sparkles color={activeColors.tint} size={14} />
                    <Text style={styles.sectionTitle}>Appearance</Text>
                </View>
                <View style={styles.themeGrid}>
                    {[
                        { mode: 'light', icon: Sun, label: 'Light' },
                        { mode: 'dark', icon: Moon, label: 'Dark' },
                        { mode: 'heart', icon: Heart, label: 'Heart' },
                        { mode: 'system', icon: Shield, label: 'System' },
                    ].map((item) => {
                        const isActive = themeMode === item.mode;
                        return (
                            <TouchableOpacity
                                key={item.mode}
                                style={[
                                    styles.themeCard,
                                    isActive && { borderColor: activeColors.tint, backgroundColor: activeColors.tint + '10' }
                                ]}
                                onPress={() => setThemeMode(item.mode as any)}
                            >
                                <View style={[
                                    styles.themeIconContainer,
                                    isActive && { backgroundColor: activeColors.tint, borderColor: activeColors.tint }
                                ]}>
                                    <item.icon
                                        color={isActive ? '#ffffff' : activeColors.secondaryText}
                                        size={ICON.md}
                                        fill={isActive && item.mode === 'heart' ? '#ffffff' : 'transparent'}
                                    />
                                </View>
                                <Text style={[
                                    styles.themeLabel,
                                    isActive ? { color: activeColors.tint, fontWeight: '800' } : { color: activeColors.secondaryText }
                                ]}>{item.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Currency Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Coins color={activeColors.tint} size={14} />
                    <Text style={styles.sectionTitle}>Base Currency</Text>
                </View>
                <View style={styles.menuBox}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ padding: 12, gap: 10 }}
                    >
                        {Object.keys(CURRENCY_SYMBOLS).map((currency) => {
                            const isSelected = settings?.baseCurrency === currency;
                            return (
                                <TouchableOpacity
                                    key={currency}
                                    style={[
                                        styles.currencyPill,
                                        isSelected && { borderColor: activeColors.tint, backgroundColor: activeColors.tint + '15' }
                                    ]}
                                    onPress={() => updateSettingsMutation.mutate({ baseCurrency: currency })}
                                >
                                    <View style={[styles.pillIcon, isSelected && { backgroundColor: activeColors.tint }]}>
                                        <Text style={[styles.pillIconText, isSelected && { color: '#fff' }]}>
                                            {CURRENCY_SYMBOLS[currency]}
                                        </Text>
                                    </View>
                                    <Text style={[
                                        styles.pillLabel,
                                        isSelected ? { color: activeColors.tint, fontWeight: '800' } : { color: activeColors.text }
                                    ]}>
                                        {currency}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>

            {/* Reminders Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Bell color={activeColors.tint} size={14} />
                    <Text style={styles.sectionTitle}>Reminders</Text>
                </View>
                <View style={styles.menuBox}>
                    {/* Daily Reminder Toggle */}
                    <View style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: activeColors.border + '50' }]}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconBox}>
                                <Bell color={activeColors.tint} size={18} />
                            </View>
                            <View>
                                <Text style={styles.menuLabel}>Daily Expense Reminder</Text>
                                <Text style={styles.menuSubLabel}>Remind me to add expenses every day</Text>
                            </View>
                        </View>
                        <Switch
                            value={reminderEnabled}
                            onValueChange={handleToggleReminder}
                            trackColor={{ false: activeColors.border, true: activeColors.tint + '80' }}
                            thumbColor={reminderEnabled ? activeColors.tint : activeColors.secondaryText}
                        />
                    </View>

                    {/* Time Picker Row */}
                    <View style={[styles.menuItem, { opacity: reminderEnabled ? 1 : 0.45 }]}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconBox}>
                                <Clock color={activeColors.tint} size={18} />
                            </View>
                            <Text style={styles.menuLabel}>Reminder Time</Text>
                        </View>
                        <View style={styles.timePicker}>
                            {/* Hour */}
                            <View style={styles.timeUnit}>
                                <TouchableOpacity
                                    style={styles.timeBtn}
                                    onPress={() => { adjustHour(1); }}
                                    disabled={!reminderEnabled}
                                >
                                    <Text style={[styles.timeBtnText, { color: activeColors.tint }]}>▲</Text>
                                </TouchableOpacity>
                                <Text style={styles.timeValue}>{reminderHour.toString().padStart(2, '0')}</Text>
                                <TouchableOpacity
                                    style={styles.timeBtn}
                                    onPress={() => { adjustHour(-1); }}
                                    disabled={!reminderEnabled}
                                >
                                    <Text style={[styles.timeBtnText, { color: activeColors.tint }]}>▼</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.timeSep}>:</Text>

                            {/* Minute */}
                            <View style={styles.timeUnit}>
                                <TouchableOpacity
                                    style={styles.timeBtn}
                                    onPress={() => { adjustMinute(5); }}
                                    disabled={!reminderEnabled}
                                >
                                    <Text style={[styles.timeBtnText, { color: activeColors.tint }]}>▲</Text>
                                </TouchableOpacity>
                                <Text style={styles.timeValue}>{reminderMinute.toString().padStart(2, '0')}</Text>
                                <TouchableOpacity
                                    style={styles.timeBtn}
                                    onPress={() => { adjustMinute(-5); }}
                                    disabled={!reminderEnabled}
                                >
                                    <Text style={[styles.timeBtnText, { color: activeColors.tint }]}>▼</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Save Button */}
                            <TouchableOpacity
                                style={[styles.saveTimeBtn, { backgroundColor: activeColors.tint, opacity: reminderEnabled ? 1 : 0.45 }]}
                                onPress={saveReminderTime}
                                disabled={!reminderEnabled}
                            >
                                <Check size={14} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Current time summary */}
                    {reminderEnabled && (
                        <View style={styles.reminderInfo}>
                            <Text style={styles.reminderInfoText}>
                                You'll be reminded daily at {formatTime(reminderHour, reminderMinute)}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Data Management Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Shield color={activeColors.tint} size={14} />
                    <Text style={styles.sectionTitle}>Data Management</Text>
                </View>
                <View style={styles.menuBox}>
                    <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: activeColors.border + '50' }]} onPress={handleBackupJSON}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconBox}>
                                <Download color={activeColors.tint} size={18} />
                            </View>
                            <View>
                                <Text style={styles.menuLabel}>Backup Data (JSON)</Text>
                                <Text style={styles.menuSubLabel}>Recommended: Reliable structured backup</Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: activeColors.border + '50' }]} onPress={handleRestoreJSON}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconBox}>
                                <Upload color={activeColors.tint} size={18} />
                            </View>
                            <View>
                                <Text style={styles.menuLabel}>Restore Data (JSON)</Text>
                                <Text style={styles.menuSubLabel}>Restore from a previous JSON backup</Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={handleExportSummary}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconBox}>
                                <FileText color={activeColors.tint} size={18} />
                            </View>
                            <View>
                                <Text style={styles.menuLabel}>Export Monthly Summary</Text>
                                <Text style={styles.menuSubLabel}>Detailed CSV for this month's tracking</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Information Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Info color={activeColors.tint} size={14} />
                    <Text style={styles.sectionTitle}>Information</Text>
                </View>
                <View style={styles.menuBox}>
                    {menuItems.map((item, index) => (
                        <View
                            key={index}
                            style={[
                                styles.menuItem,
                                index < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: activeColors.border + '50' }
                            ]}
                        >
                            <View style={styles.menuItemLeft}>
                                <View style={styles.menuIconBox}>
                                    {item.icon}
                                </View>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <Text style={styles.menuValue}>{item.value}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.copyright}>© 2026 Prabalesh</Text>
                <View style={styles.footerLinks}>
                    <TouchableOpacity style={styles.footerLink} onPress={() => { }}>
                        <Github size={12} color={activeColors.tint} />
                        <Text style={[styles.footerLinkText, { color: activeColors.tint }]}>github.com/prabalesh</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.footerSub}>{APP_DISPLAY_NAME} Financial • Designed for Privacy</Text>
            </View>
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 20,
    },
    section: {
        marginTop: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        paddingLeft: 4,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        color: colors.secondaryText,
    },
    themeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    themeCard: {
        width: '48%',
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
    },
    themeIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    themeLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    currencyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        paddingRight: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        gap: 10,
    },
    pillIcon: {
        width: 32,
        height: 32,
        borderRadius: 12,
        backgroundColor: colors.card,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    pillIconText: {
        fontSize: 14,
        fontWeight: '900',
        color: colors.tint,
    },
    pillLabel: {
        fontSize: 13,
        fontWeight: '700',
    },
    menuBox: {
        backgroundColor: colors.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    menuIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    menuLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    menuSubLabel: {
        fontSize: 11,
        fontWeight: '500',
        color: colors.secondaryText,
        marginTop: 2,
    },
    menuValue: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.secondaryText,
    },
    // Time Picker
    timePicker: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    timeUnit: {
        alignItems: 'center',
        gap: 2,
    },
    timeBtn: {
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    timeBtnText: {
        fontSize: 10,
        fontWeight: '900',
    },
    timeValue: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.text,
        minWidth: 28,
        textAlign: 'center',
    },
    timeSep: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 2,
    },
    saveTimeBtn: {
        width: 30,
        height: 30,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    reminderInfo: {
        paddingHorizontal: 16,
        paddingBottom: 14,
    },
    reminderInfoText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.tint,
        fontStyle: 'italic',
    },
    footer: {
        marginTop: 48,
        alignItems: 'center',
        gap: 8,
    },
    footerLinks: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 4,
    },
    footerLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    footerLinkText: {
        fontSize: 11,
        fontWeight: '700',
    },
    copyright: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.text,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    footerSub: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.secondaryText,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    }
});
