import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Colors } from '../constants/Colors';
import { useTheme } from '../providers/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap, Heart, Sparkles } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function BylitLoadingScreen() {
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme || 'light'];

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Entry animation - Native Driver
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
                easing: Easing.out(Easing.back(1.5)),
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
                easing: Easing.out(Easing.back(1.5)),
            }),
        ]).start();

        // Progress bar animation (cannot use native driver for width)
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: 1200,
            delay: 200,
            useNativeDriver: false,
            easing: Easing.out(Easing.quad),
        }).start();

        // Continuous rotation for the background sparkles
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 20000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();

        // Logo pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 1500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={[styles.container, { backgroundColor: activeColors.background }]}>
            <LinearGradient
                colors={[activeColors.background, activeColors.card]}
                style={StyleSheet.absoluteFill}
            />

            {/* Decorative background motion */}
            <Animated.View style={[styles.sparkleContainer, { transform: [{ rotate: spin }] }]}>
                <Sparkles color={activeColors.tint + '10'} size={width * 0.8} />
            </Animated.View>

            <Animated.View style={[
                styles.content,
                { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
            ]}>
                <Animated.View style={[
                    styles.logoContainer,
                    { backgroundColor: activeColors.tint, transform: [{ scale: pulseAnim }] }
                ]}>
                    {currentTheme === 'heart' ? (
                        <Heart color="#fff" size={48} fill="#fff" />
                    ) : (
                        <Zap color="#fff" size={48} fill="#fff" />
                    )}
                </Animated.View>

                <Text style={[styles.title, { color: activeColors.text }]}>Bylit</Text>
                <Text style={[styles.subtitle, { color: activeColors.secondaryText }]}>
                    Your Private Money Manager
                </Text>

                <View style={styles.loadingBarContainer}>
                    <View style={[styles.loadingBar, { backgroundColor: activeColors.border }]} />
                    <Animated.View style={[
                        styles.loadingProgress,
                        {
                            backgroundColor: activeColors.tint,
                            width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '70%']
                            })
                        }
                    ]} />
                </View>

                <Text style={[styles.footerText, { color: activeColors.secondaryText }]}>
                    Developed by Prabalesh
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sparkleContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        zIndex: 1,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        marginBottom: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '700',
        opacity: 0.6,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 40,
    },
    loadingBarContainer: {
        width: 180,
        height: 4,
        position: 'relative',
        marginBottom: 20,
    },
    loadingBar: {
        width: '100%',
        height: '100%',
        borderRadius: 2,
        opacity: 0.3,
    },
    loadingProgress: {
        position: 'absolute',
        top: 0,
        left: 0,
        height: '100%',
        borderRadius: 2,
    },
    footerText: {
        fontSize: 10,
        fontWeight: '800',
        opacity: 0.4,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 20,
    }
});
