import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { Colors } from '../constants/Colors';
import { useTheme } from './ThemeContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react-native';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [message, setMessage] = useState('');
    const [type, setType] = useState<ToastType>('success');
    const [visible, setVisible] = useState(false);
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-100)).current;

    const showToast = useCallback((msg: string, toastType: ToastType = 'success') => {
        setMessage(msg);
        setType(toastType);
        setVisible(true);

        // Reset animations
        fadeAnim.setValue(0);
        translateY.setValue(-100);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();

        // Hide after 3 seconds
        setTimeout(() => {
            hideToast();
        }, 3000);
    }, [fadeAnim, translateY]);

    const hideToast = useCallback(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => setVisible(false));
    }, [fadeAnim, translateY]);

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle2 color="#fff" size={20} />;
            case 'error': return <AlertCircle color="#fff" size={20} />;
            case 'info': return <Info color="#fff" size={20} />;
        }
    };

    const getBackgroundColor = () => {
        switch (type) {
            case 'success': return activeColors.success;
            case 'error': return activeColors.error;
            case 'info': return activeColors.tint;
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {visible && (
                <Animated.View
                    style={[
                        styles.toastContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY }],
                            backgroundColor: getBackgroundColor(),
                        },
                    ]}
                >
                    <View style={styles.content}>
                        {getIcon()}
                        <Text style={styles.text}>{message}</Text>
                    </View>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 20,
        right: 20,
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    text: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
    },
});
