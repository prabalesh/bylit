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

import * as SplashScreen from 'expo-splash-screen';
import BylitLoadingScreen from '../src/components/BylitLoadingScreen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
    /* reloading the app might cause some errors here, safely ignore */
});

const MainLayout = () => {
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme === 'dark' ? 'dark' : 'light'];
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const prepare = async () => {
            try {
                // Pre-load any assets or check permissions here if needed
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                console.warn(e);
            } finally {
                setIsReady(true);
            }
        };
        prepare();
    }, []);

    useEffect(() => {
        // The splash screen is now hidden by BylitLoadingScreen as soon as it mounts.
        // This ensures the animated screen takes over as quickly as possible.
    }, [isReady]);

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
