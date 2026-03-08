import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { Providers } from '../src/providers/providers';
import { ThemeProvider, useTheme } from '../src/providers/ThemeContext';
import { ToastProvider } from '../src/providers/ToastProvider';
import { Colors } from '../src/constants/Colors';
import { AppWalkthrough } from '../src/components/AppWalkthrough';

const MainLayout = () => {
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme === 'dark' ? 'dark' : 'light'];
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Simple delay to ensure providers are initialized if needed
        setIsReady(true);
    }, []);

    if (!isReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: activeColors.background }}>
                <ActivityIndicator size="large" color={activeColors.tint} />
            </View>
        );
    }

    return (
        <>
            <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(app)" options={{ headerShown: false }} />
            </Stack>
            <AppWalkthrough />
        </>
    );
};

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <Providers>
                <ThemeProvider>
                    <ToastProvider>
                        <MainLayout />
                    </ToastProvider>
                </ThemeProvider>
            </Providers>
        </SafeAreaProvider>
    );
}
