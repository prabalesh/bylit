import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, LogBox } from 'react-native';
import { Providers } from '../src/providers/providers';
import { ThemeProvider, useTheme } from '../src/providers/ThemeContext';
import { ToastProvider } from '../src/providers/ToastProvider';
import { Colors } from '../src/constants/Colors';
import { AppWalkthrough } from '../src/components/AppWalkthrough';
import { Logger } from '../src/services/logger';

// Catch uncaught JS errors
const originalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
    Logger.logError(error, `Is Fatal: ${isFatal}`);
    if (originalHandler) {
        originalHandler(error, isFatal);
    }
});

import BylitLoadingScreen from '../src/components/BylitLoadingScreen';

const MainLayout = () => {
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme === 'dark' ? 'dark' : 'light'];
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Simple delay to ensure providers are initialized if needed
        setTimeout(() => setIsReady(true), 1500); // Give splash some time to breathe
    }, []);

    if (!isReady) {
        return <BylitLoadingScreen />;
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
                <MainLayout />
            </Providers>
        </SafeAreaProvider>
    );
}
