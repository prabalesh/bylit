import { Tabs } from 'expo-router';
import {
    Home, PieChart, Wallet, ArrowLeftRight, Menu
} from 'lucide-react-native';
import {
    TouchableOpacity, View, Modal, StyleSheet,
    Animated, Pressable
} from 'react-native';
import { Colors } from '../../src/constants/Colors';
import { useTheme } from '../../src/providers/ThemeContext';
import { useState, useRef, useEffect } from 'react';
import Sidebar from '../../src/components/Sidebar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppLayout() {
    const insets = useSafeAreaInsets();
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];

    const [isSidebarVisible, setIsSidebarVisible] = useState(false);
    const slideAnim = useRef(new Animated.Value(-500)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    const openSidebar = () => {
        setIsSidebarVisible(true);
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 0,
                speed: 20,
            }),
            Animated.timing(backdropAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const closeSidebar = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -500,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.timing(backdropAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }),
        ]).start(() => setIsSidebarVisible(false));
    };

    // Reset animation when modal mounts
    useEffect(() => {
        if (!isSidebarVisible) {
            slideAnim.setValue(-500);
            backdropAnim.setValue(0);
        }
    }, [isSidebarVisible]);

    return (
        <View style={{ flex: 1 }}>
            <Tabs
                screenOptions={{
                    headerShown: true,
                    headerLeft: () => (
                        <TouchableOpacity onPress={openSidebar} style={{ marginLeft: 20 }}>
                            <Menu color={activeColors.text} size={20} />
                        </TouchableOpacity>
                    ),
                    headerTitle: 'Bylit',
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
                        title: 'Home',
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
                {/* Hidden from tab bar — accessible via sidebar */}
                <Tabs.Screen name="budgets" options={{ href: null }} />
                <Tabs.Screen name="categories" options={{ href: null }} />
                <Tabs.Screen name="split-bills" options={{ href: null }} />
                <Tabs.Screen name="subscriptions" options={{ href: null }} />
                <Tabs.Screen name="settings" options={{ href: null }} />
            </Tabs>

            <Modal
                visible={isSidebarVisible}
                transparent={true}
                animationType="none"
                onRequestClose={closeSidebar}
            >
                <View style={styles.modalOverlay}>
                    {/* Animated backdrop */}
                    <Animated.View
                        style={[
                            styles.backdrop,
                            { opacity: backdropAnim }
                        ]}
                    >
                        <Pressable style={StyleSheet.absoluteFill} onPress={closeSidebar} />
                    </Animated.View>

                    {/* Animated sidebar */}
                    <Animated.View
                        style={[
                            styles.sidebarContainer,
                            {
                                backgroundColor: activeColors.background,
                                transform: [{ translateX: slideAnim }],
                            }
                        ]}
                    >
                        <Sidebar onClose={closeSidebar} />
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
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
    },
});
