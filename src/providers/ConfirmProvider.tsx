import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Platform } from 'react-native';
import { Colors } from '../constants/Colors';
import { useTheme } from './ThemeContext';
import { AlertTriangle, Info, HelpCircle } from 'lucide-react-native';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'warning';
}

interface ConfirmContextType {
    showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];

    const showConfirm = useCallback((confirmOptions: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setOptions(confirmOptions);
            setResolvePromise(() => resolve);
            setVisible(true);
        });
    }, []);

    const handleConfirm = () => {
        setVisible(false);
        if (resolvePromise) resolvePromise(true);
    };

    const handleCancel = () => {
        setVisible(false);
        if (resolvePromise) resolvePromise(false);
    };

    const getIcon = () => {
        const type = options?.type || 'info';
        switch (type) {
            case 'danger': return <AlertTriangle color={activeColors.error} size={32} />;
            case 'warning': return <AlertTriangle color={activeColors.warning} size={32} />;
            case 'info': return <HelpCircle color={activeColors.tint} size={32} />;
            default: return <Info color={activeColors.tint} size={32} />;
        }
    };

    return (
        <ConfirmContext.Provider value={{ showConfirm }}>
            {children}
            <Modal
                transparent
                visible={visible}
                animationType="fade"
                onRequestClose={handleCancel}
            >
                <View style={styles.overlay}>
                    <View style={[styles.container, { backgroundColor: activeColors.card }]}>
                        <View style={styles.iconContainer}>
                            {getIcon()}
                        </View>
                        <Text style={[styles.title, { color: activeColors.text }]}>{options?.title}</Text>
                        <Text style={[styles.message, { color: activeColors.secondaryText }]}>{options?.message}</Text>

                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={handleCancel}
                            >
                                <Text style={[styles.cancelButtonText, { color: activeColors.secondaryText }]}>
                                    {options?.cancelText || 'Cancel'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    options?.type === 'danger' ? { backgroundColor: activeColors.error } : { backgroundColor: activeColors.tint }
                                ]}
                                onPress={handleConfirm}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {options?.confirmText || 'Confirm'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ConfirmContext.Provider>
    );
};

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 10,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    footer: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    button: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'transparent',
    },
    cancelButtonText: {
        fontWeight: '600',
        fontSize: 15,
    },
    confirmButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
});
