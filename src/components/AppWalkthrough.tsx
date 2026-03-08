import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, Platform } from 'react-native';
import { ChevronRight, Check, Wallet, PieChart, Bell, Zap, X } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useTheme } from '../providers/ThemeContext';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const STEPS = [
    {
        title: 'Welcome to Bylit',
        description: 'Your personal finance companion. Track your spending, manage budgets, and stay on top of your money.',
        icon: Wallet,
        color: '#6366f1'
    },
    {
        title: 'Track Transactions',
        description: 'Easily add your daily expenses, income, and track lend/borrow records with a few taps.',
        icon: Zap,
        color: '#f59e0b'
    },
    {
        title: 'Smarts Analytics',
        description: 'Visualize your spending patterns with beautiful charts and stay within your monthly budgets.',
        icon: PieChart,
        color: '#10b981'
    },
    {
        title: 'Smart Reminders',
        description: 'Never forget to record an expense. Set daily reminders and get notified for important transactions.',
        icon: Bell,
        color: '#ec4899'
    }
];

export const AppWalkthrough: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];

    useEffect(() => {
        checkFirstTime();
    }, []);

    const checkFirstTime = async () => {
        const hasSeenWalkthrough = await SecureStore.getItemAsync('has_seen_walkthrough');
        if (!hasSeenWalkthrough) {
            setVisible(true);
        }
    };

    const handleNext = async () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            await finishWalkthrough();
        }
    };

    const finishWalkthrough = async () => {
        await SecureStore.setItemAsync('has_seen_walkthrough', 'true');
        setVisible(false);
    };

    if (!visible) return null;

    const step = STEPS[currentStep];
    const Icon = step.icon;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: activeColors.background }]}>
                    <View style={styles.header}>
                        <View style={styles.progressContainer}>
                            {STEPS.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.progressBar,
                                        { backgroundColor: i <= currentStep ? step.color : activeColors.border }
                                    ]}
                                />
                            ))}
                        </View>
                        <TouchableOpacity onPress={finishWalkthrough} style={styles.skipBtn}>
                            <Text style={[styles.skipText, { color: activeColors.secondaryText }]}>Skip</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        <LinearGradient
                            colors={[step.color + '20', step.color + '05']}
                            style={styles.iconWrapper}
                        >
                            <Icon size={80} color={step.color} />
                        </LinearGradient>

                        <Text style={[styles.title, { color: activeColors.text }]}>{step.title}</Text>
                        <Text style={[styles.description, { color: activeColors.secondaryText }]}>
                            {step.description}
                        </Text>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.nextBtn, { backgroundColor: step.color }]}
                            onPress={handleNext}
                        >
                            <Text style={styles.nextBtnText}>
                                {currentStep === STEPS.length - 1 ? 'Get Started' : 'Next'}
                            </Text>
                            {currentStep === STEPS.length - 1 ? <Check size={20} color="#fff" /> : <ChevronRight size={20} color="#fff" />}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 32,
        overflow: 'hidden',
        maxHeight: height * 0.8
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingBottom: 0
    },
    progressContainer: {
        flexDirection: 'row',
        gap: 6,
        flex: 1,
        marginRight: 20
    },
    progressBar: {
        height: 6,
        flex: 1,
        borderRadius: 3
    },
    skipBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    skipText: {
        fontSize: 14,
        fontWeight: '700'
    },
    content: {
        alignItems: 'center',
        padding: 32,
    },
    iconWrapper: {
        width: 160,
        height: 160,
        borderRadius: 80,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 16
    },
    description: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 24,
        opacity: 0.8
    },
    footer: {
        padding: 32,
        paddingTop: 0
    },
    nextBtn: {
        height: 64,
        borderRadius: 24,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8
    },
    nextBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800'
    }
});
