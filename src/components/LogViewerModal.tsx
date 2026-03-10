import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, Share } from 'react-native';
import { X, Trash2, Share2, FileWarning } from 'lucide-react-native';
import { Logger } from '../services/logger';
import { Colors } from '../constants/Colors';
import { useTheme } from '../providers/ThemeContext';
import { FONT, RADIUS, ICON, BTN } from '../constants/Sizes';

interface LogViewerModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function LogViewerModal({ visible, onClose }: LogViewerModalProps) {
    const { currentTheme } = useTheme();
    const activeColors = Colors[currentTheme];
    const [logs, setLogs] = useState('Loading logs...');

    const loadLogs = async () => {
        const content = await Logger.getLogContent();
        setLogs(content);
    };

    useEffect(() => {
        if (visible) {
            loadLogs();
        }
    }, [visible]);

    const handleClear = async () => {
        await Logger.clearLog();
        loadLogs();
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: logs,
                title: 'Bylit Crash Report'
            });
        } catch (e) {
            console.error(e);
        }
    };

    const styles = getStyles(activeColors);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <FileWarning color={activeColors.error} size={20} />
                        <Text style={styles.title}>Crash Logs</Text>
                    </View>
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <X color={activeColors.text} size={ICON.md} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={true}>
                    <View style={styles.logBox}>
                        <Text style={styles.logText}>{logs}</Text>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={[styles.footerBtn, { backgroundColor: activeColors.error + '20' }]} onPress={handleClear}>
                        <Trash2 color={activeColors.error} size={18} />
                        <Text style={[styles.footerBtnText, { color: activeColors.error }]}>Clear</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.footerBtn, { backgroundColor: activeColors.tint }]} onPress={handleShare}>
                        <Share2 color="#fff" size={18} />
                        <Text style={[styles.footerBtnText, { color: '#fff' }]}>Share</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border
    },
    title: { fontSize: FONT.h3, fontWeight: '900', color: colors.text },
    closeBtn: { ...BTN.md, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
    content: { flex: 1, padding: 20 },
    logBox: {
        backgroundColor: colors.card, padding: 16, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: colors.border, marginBottom: 20
    },
    logText: {
        fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: colors.secondaryText, lineHeight: 18
    },
    footer: {
        flexDirection: 'row', padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: colors.border,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20
    },
    footerBtn: { flex: 1, flexDirection: 'row', height: 48, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', gap: 8 },
    footerBtnText: { fontSize: FONT.sm, fontWeight: '800' }
});
