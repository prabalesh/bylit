import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme as RN_useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useQuery } from '@tanstack/react-query';
import { Repository } from '../services/repository';
import { Settings } from '../types/api';

export type ThemeMode = 'light' | 'dark' | 'heart' | 'system';

interface ThemeContextType {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    currentTheme: 'light' | 'dark' | 'heart';
    fontSize: 'small' | 'medium' | 'large';
    iconSize: 'small' | 'medium' | 'large';
    fontScale: {
        label: number;
        body: number;
        title: number;
        input: number;
    };
    iconScale: {
        xs: number;
        sm: number;
        md: number;
        lg: number;
    };
}

const FONT_SCALES = {
    small: { label: 8, body: 12, title: 16, input: 24 },
    medium: { label: 10, body: 15, title: 20, input: 36 },
    large: { label: 12, body: 17, title: 22, input: 44 },
};

const ICON_SCALES = {
    small: { xs: 8, sm: 12, md: 16, lg: 20 },
    medium: { xs: 12, sm: 16, md: 20, lg: 24 },
    large: { xs: 14, sm: 18, md: 22, lg: 28 },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = RN_useColorScheme() ?? 'light';
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        const savedTheme = await SecureStore.getItemAsync('user_theme');
        if (savedTheme) {
            setThemeModeState(savedTheme as ThemeMode);
        }
    };

    const setThemeMode = async (mode: ThemeMode) => {
        setThemeModeState(mode);
        await SecureStore.setItemAsync('user_theme', mode);
    };

    const { data: settings } = useQuery<Settings>({
        queryKey: ['settings'],
        queryFn: async () => {
            const local = await Repository.getSettings();
            if (local) return local as any;
            return { baseCurrency: 'INR', fontSize: 'small', iconSize: 'small' } as any;
        }
    });

    const currentTheme = themeMode === 'system'
        ? (systemColorScheme === 'dark' ? 'dark' : 'light')
        : (themeMode as 'light' | 'dark' | 'heart');

    const fontSizeToken: 'small' | 'medium' | 'large' = 'small';
    const iconSizeToken: 'small' | 'medium' | 'large' = 'small';

    const fontScale = FONT_SCALES[fontSizeToken];
    const iconScale = ICON_SCALES[iconSizeToken];

    return (
        <ThemeContext.Provider value={{
            themeMode,
            setThemeMode,
            currentTheme,
            fontSize: fontSizeToken,
            iconSize: iconSizeToken,
            fontScale,
            iconScale
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
