import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Logger } from '../services/logger';
import { Colors } from '../constants/Colors';
import { FileWarning, RefreshCcw, Home } from 'lucide-react-native';
import { router } from 'expo-router';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    screenName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        Logger.logError(error, `ErrorBoundary caught error in ${this.props.screenName || 'unknown screen'}. Info: ${JSON.stringify(errorInfo)}`);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    private handleGoHome = () => {
        this.handleReset();
        router.replace('/(app)/');
    };

    public render() {
        if (this.state.hasError) {
            // Simplified theme access as we might be outside ThemeProvider if that crashed (unlikely but safe)
            const colors = Colors.light;

            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <FileWarning size={48} color={colors.error} />
                        </View>
                        <Text style={styles.title}>Oops! Something went wrong</Text>
                        <Text style={styles.message}>
                            An error occurred while rendering this screen. We've logged the technical details for debugging.
                        </Text>

                        <ScrollView style={styles.errorBox}>
                            <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
                        </ScrollView>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={[styles.button, { backgroundColor: colors.tint }]} onPress={this.handleReset}>
                                <RefreshCcw size={18} color="#fff" />
                                <Text style={styles.buttonText}>Try Again</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} onPress={this.handleGoHome}>
                                <Home size={18} color={colors.text} />
                                <Text style={[styles.buttonText, { color: colors.text }]}>Go Home</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', padding: 24 },
    content: { alignItems: 'center' },
    iconContainer: { marginBottom: 20, padding: 20, backgroundColor: '#fee2e2', borderRadius: 30 },
    title: { fontSize: 20, fontWeight: '900', color: '#09090b', marginBottom: 12, textAlign: 'center' },
    message: { fontSize: 14, color: '#52525b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    errorBox: {
        width: '100%', maxHeight: 150, backgroundColor: '#f4f4f5',
        padding: 12, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#e4e4e7'
    },
    errorText: { fontSize: 12, fontFamily: 'monospace', color: '#ef4444' },
    buttonRow: { flexDirection: 'row', gap: 12 },
    button: {
        flex: 1, flexDirection: 'row', height: 48, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center', gap: 8
    },
    buttonText: { fontSize: 14, fontWeight: '800', color: '#fff' }
});
