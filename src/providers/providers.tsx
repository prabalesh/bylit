import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { initDB } from '../services/db';
import { ThemeProvider } from './ThemeContext';
import { ToastProvider } from './ToastProvider';
import { ConfirmProvider } from './ConfirmProvider';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    const [isDbReady, setIsDbReady] = useState(false);

    useEffect(() => {
        initDB().then(() => setIsDbReady(true)).catch(console.error);
    }, []);

    if (!isDbReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <ToastProvider>
                    <ConfirmProvider>
                        {children}
                    </ConfirmProvider>
                </ToastProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
