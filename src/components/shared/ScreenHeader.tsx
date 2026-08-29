import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../theme/colors';

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    onBack: () => void;
    right?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, subtitle, onBack, right }) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={onBack} style={styles.iconBtn} accessibilityLabel="戻る">
                <Ionicons name="chevron-back" size={22} color={C.ink} />
            </TouchableOpacity>
            <View style={styles.titleBlock}>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                <Text style={styles.title}>{title}</Text>
            </View>
            <View style={styles.iconBtn}>{right}</View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surface,
        borderBottomWidth: 1,
        borderBottomColor: C.line,
        paddingBottom: 12,
        paddingHorizontal: 8,
    },
    iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    titleBlock: { flex: 1, alignItems: 'center' },
    subtitle: { fontSize: 11, color: C.ink3, fontWeight: '700', letterSpacing: 1 },
    title: { fontSize: 15, fontWeight: '700', color: C.ink, marginTop: 1 },
});
