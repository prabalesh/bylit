import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, TextInput, Modal, TouchableOpacity,
    FlatList, ActivityIndicator, Platform
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { X, Search, Users, ChevronRight } from 'lucide-react-native';
import { useToast } from '../providers/ToastProvider';

interface ContactPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (contact: { name: string; phone?: string; id?: string }) => void;
    colors: any;
    insets: any;
}

export default function ContactPickerModal({ visible, onClose, onSelect, colors, insets }: ContactPickerProps) {
    const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (visible) {
            loadContacts();
            setSearch('');
        }
    }, [visible]);

    const loadContacts = async () => {
        setLoading(true);
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
                    sort: Contacts.SortTypes.FirstName,
                });
                setContacts(data.filter(c => c.name));
            } else {
                showToast('Contacts permission denied', 'error');
                onClose();
            }
        } catch {
            showToast('Failed to load contacts', 'error');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() =>
        contacts.filter(c =>
            c.name?.toLowerCase().includes(search.toLowerCase())
        ).slice(0, 50),
        [contacts, search]
    );

    const pickerStyles = getStyles(colors, insets);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={pickerStyles.overlay}>
                <View style={pickerStyles.sheet}>
                    <View style={pickerStyles.handle} />
                    <View style={pickerStyles.headerRow}>
                        <Text style={pickerStyles.title}>Select Contact</Text>
                        <TouchableOpacity onPress={onClose} style={pickerStyles.closeBtn}>
                            <X size={18} color={colors.secondaryText} />
                        </TouchableOpacity>
                    </View>

                    <View style={pickerStyles.searchBox}>
                        <Search size={16} color={colors.secondaryText} />
                        <TextInput
                            style={pickerStyles.searchInput}
                            placeholder="Search contacts..."
                            placeholderTextColor={colors.secondaryText + '70'}
                            value={search}
                            onChangeText={setSearch}
                            autoFocus
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')}>
                                <X size={14} color={colors.secondaryText} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {loading ? (
                        <View style={pickerStyles.empty}>
                            <ActivityIndicator color={colors.tint} size="large" />
                            <Text style={pickerStyles.emptyText}>Loading contacts...</Text>
                        </View>
                    ) : filtered.length === 0 ? (
                        <View style={pickerStyles.empty}>
                            <Users size={40} color={colors.secondaryText} opacity={0.4} />
                            <Text style={pickerStyles.emptyText}>No contacts found</Text>
                            <Text style={pickerStyles.emptySubText}>{search ? 'Try a different name' : 'Your contacts will appear here'}</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filtered}
                            keyExtractor={(item, index) => (item as any).id != null ? String((item as any).id) : String(index)}
                            renderItem={({ item }) => {
                                const initials = item.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';
                                const phone = item.phoneNumbers?.[0]?.number;
                                return (
                                    <TouchableOpacity
                                        style={pickerStyles.item}
                                        onPress={() => {
                                            onSelect({
                                                name: item.name!,
                                                phone,
                                                id: (item as any).id
                                            });
                                            onClose();
                                        }}
                                    >
                                        <View style={pickerStyles.avatar}>
                                            <Text style={pickerStyles.avatarText}>{initials}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={pickerStyles.name}>{item.name}</Text>
                                            {phone && <Text style={pickerStyles.phone}>{phone}</Text>}
                                        </View>
                                        <ChevronRight size={16} color={colors.secondaryText} />
                                    </TouchableOpacity>
                                );
                            }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

const getStyles = (colors: any, insets: any) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 24,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: colors.border,
    },
    handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
    title: { fontSize: 18, fontWeight: '900', color: colors.text },
    closeBtn: { padding: 6, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.border + '30' },
    avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.tint + '15', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.tint + '30' },
    avatarText: { fontSize: 14, fontWeight: '900', color: colors.tint },
    name: { fontSize: 14, fontWeight: '700', color: colors.text },
    phone: { fontSize: 12, color: colors.secondaryText, fontWeight: '500' },
    empty: { padding: 40, alignItems: 'center', gap: 8 },
    emptyText: { fontSize: 14, fontWeight: '700', color: colors.secondaryText },
    emptySubText: { fontSize: 12, fontWeight: '500', color: colors.secondaryText },
});
