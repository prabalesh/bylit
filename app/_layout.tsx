import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Providers } from '../src/providers/providers';
import { useTheme } from '../src/providers/ThemeContext';
import { Colors } from '../src/constants/Colors';
import { AppWalkthrough } from '../src/components/AppWalkthrough';
import { Logger } from '../src/services/logger';
import BylitLoadingScreen from '../src/components/BylitLoadingScreen';


// Catch uncaught JS errors
const originalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
    Logger.logError(error, `Is Fatal: ${isFatal}`);
    if (originalHandler) {
        originalHandler(error, isFatal);
    }
});


// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
    /* reloading the app might trigger errors here, safely ignore */
});


const MainLayout = () => {
    const { currentTheme } = useTheme();
    // Fallback to 'light' for any theme not explicitly defined in Colors
    const activeColors = Colors[currentTheme] ?? Colors['light'];
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const prepare = async () => {
            try {
                // TODO: Replace this delay with actual asset/font preloading if needed
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                console.warn(e);
            } finally {
                setIsReady(true);
            }
        };
        prepare();
    }, []);

    if (!isReady) {
        return <BylitLoadingScreen />;
    }

    return (
        <>
            <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(app)" />
            </Stack>
            <AppWalkthrough />
        </>
    );
};


export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <Providers>
                <MainLayout />
            </Providers>
        </SafeAreaProvider>
    );
}
