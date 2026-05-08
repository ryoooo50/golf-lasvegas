import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../theme/colors';

export type BottomTab = 'hole' | 'scorecard' | 'history' | 'settings';

interface BottomTabBarProps {
    activeTab: BottomTab;
    onChange: (tab: BottomTab) => void;
}

const TABS: { key: BottomTab; icon: string; labelKey: string }[] = [
    { key: 'hole', icon: '⛳', labelKey: 'common.holeTab' },
    { key: 'scorecard', icon: '📋', labelKey: 'common.scorecard' },
    { key: 'history', icon: '📜', labelKey: 'common.viewHistory' },
    { key: 'settings', icon: '⚙', labelKey: 'common.settings' },
];

export function BottomTabBar({ activeTab, onChange }: BottomTabBarProps) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 6) }]}>
            {TABS.map(tab => {
                const isActive = tab.key === activeTab;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={styles.tab}
                        onPress={() => onChange(tab.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                    >
                        <Text style={[styles.icon, isActive && styles.iconActive]}>{tab.icon}</Text>
                        <Text style={[styles.label, isActive && styles.labelActive]}>
                            {t(tab.labelKey)}
                        </Text>
                        {isActive && <View style={styles.activeIndicator} />}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: C.dark,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.10)',
        paddingTop: 8,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
        paddingVertical: 2,
        position: 'relative',
    },
    icon: { fontSize: 18, opacity: 0.45 },
    iconActive: { opacity: 1 },
    label: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.40)', letterSpacing: 0.3 },
    labelActive: { color: '#ffffff', fontWeight: '800' },
    activeIndicator: {
        position: 'absolute',
        top: -8,
        width: 28,
        height: 2,
        borderRadius: 1,
        backgroundColor: C.greenPrimary,
    },
});
