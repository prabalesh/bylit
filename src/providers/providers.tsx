import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { initDB } from '../services/db';
import { ThemeProvider } from './ThemeContext';
import { ToastProvider } from './ToastProvider';
import { ConfirmProvider } from './ConfirmProvider';

import BylitLoadingScreen from '../components/BylitLoadingScreen';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
            refetchOnMount: false,
        },
    },
});

export function Providers({ children }: { children: React.ReactNode }) {
    const [isDbReady, setIsDbReady] = useState(false);

    useEffect(() => {
        initDB().then(() => setIsDbReady(true)).catch(console.error);
    }, []);

    if (!isDbReady) {
        return (
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <BylitLoadingScreen />
                </ThemeProvider>
            </QueryClientProvider>
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
