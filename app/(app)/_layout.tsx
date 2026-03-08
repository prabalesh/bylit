import { Tabs } from 'expo-router';
import { Home, PieChart, Wallet, ArrowLeftRight, Settings, Menu, Sun, Moon, Target, LayoutGrid, Receipt } from 'lucide-react-native';
import { useColorScheme, TouchableOpacity, View, Modal, StyleSheet, Animated, Pressable } from 'react-native';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import { useState, useRef } from 'react';
import Sidebar from '../../src/components/Sidebar';
import { Repository } from '../../src/services/repository';
import { useEffect } from 'react';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppLayout() {
    const insets = useSafeAreaInsets();
    const { currentTheme, setThemeMode, iconSize } = useTheme();
    const activeColors = Colors[currentTheme];
    const [isSidebarVisible, setIsSidebarVisible] = useState(false);

    const toggleSidebar = () => setIsSidebarVisible(!isSidebarVisible);

    return (
        <View style={{ flex: 1 }}>
            <Tabs
                screenOptions={{
                    headerShown: true,
                    headerLeft: () => (
                        <TouchableOpacity onPress={toggleSidebar} style={{ marginLeft: 20 }}>
                            <Menu color={activeColors.text} size={20} />
                        </TouchableOpacity>
                    ),
                    headerTitle: "Bylit",
                    headerStyle: {
                        backgroundColor: activeColors.background,
                        elevation: 0,
                        shadowOpacity: 0,
                        borderBottomWidth: 1,
                        borderBottomColor: activeColors.border,
                    },
                    headerTitleStyle: {
                        fontWeight: '900',
                        fontSize: 20,
                        color: activeColors.text,
                        letterSpacing: -0.5,
                    },
                    tabBarStyle: {
                        backgroundColor: activeColors.card,
                        borderTopWidth: 1,
                        borderTopColor: activeColors.border,
                        height: 60 + insets.bottom,
                        paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
                        paddingTop: 8,
                    },
                    tabBarActiveTintColor: activeColors.tint,
                    tabBarInactiveTintColor: activeColors.tabIconDefault,
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Transactions',
                        tabBarIcon: ({ color }) => <Home color={color} size={24} />,
                    }}
                />
                <Tabs.Screen
                    name="analytics"
                    options={{
                        title: 'Analytics',
                        tabBarIcon: ({ color }) => <PieChart color={color} size={24} />,
                    }}
                />
                <Tabs.Screen
                    name="budgets"
                    options={{
                        title: 'Budgets',
                        tabBarIcon: ({ color }) => <Target color={color} size={24} />,
                    }}
                />
                <Tabs.Screen
                    name="categories"
                    options={{
                        title: 'Categories',
                        tabBarIcon: ({ color }) => <LayoutGrid color={color} size={24} />,
                    }}
                />
                <Tabs.Screen
                    name="accounts"
                    options={{
                        title: 'Accounts',
                        tabBarIcon: ({ color }) => <Wallet color={color} size={24} />,
                    }}
                />
                <Tabs.Screen
                    name="lend-borrow"
                    options={{
                        title: 'Lend/Borrow',
                        tabBarIcon: ({ color }) => <ArrowLeftRight color={color} size={24} />,
                    }}
                />
                <Tabs.Screen
                    name="split-bills"
                    options={{
                        title: 'Split Bills',
                        tabBarIcon: ({ color }) => <Receipt color={color} size={24} />,
                        href: null,
                    }}
                />
                <Tabs.Screen
                    name="settings"
                    options={{
                        title: "Settings",
                        href: null,
                    }}
                />
            </Tabs>

            <Modal
                visible={isSidebarVisible}
                transparent={true}
                animationType="none"
                onRequestClose={toggleSidebar}
            >
                <View style={styles.modalOverlay}>
                    <Pressable style={styles.backdrop} onPress={toggleSidebar} />
                    <Animated.View style={[styles.sidebarContainer, { backgroundColor: activeColors.background }]}>
                        <Sidebar onClose={toggleSidebar} />
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        flexDirection: 'row',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sidebarContainer: {
        width: '80%',
        height: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
});
