import { Ionicons } from '@expo/vector-icons';
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

const TABS: { key: BottomTab; icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
    { key: 'hole', icon: 'flag', labelKey: 'common.holeTab' },
    { key: 'scorecard', icon: 'grid-outline', labelKey: 'common.scorecard' },
    { key: 'history', icon: 'time-outline', labelKey: 'common.viewHistory' },
    { key: 'settings', icon: 'settings-outline', labelKey: 'common.settings' },
];

export function BottomTabBar({ activeTab, onChange }: BottomTabBarProps) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
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
                        <View style={[styles.indicator, isActive && styles.indicatorActive]} />
                        <Ionicons
                            name={tab.icon}
                            size={18}
                            color={isActive ? C.greenPrimary : 'rgba(255,255,255,0.45)'}
                        />
                        <Text style={[styles.label, isActive && styles.labelActive]}>
                            {t(tab.labelKey)}
                        </Text>
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
        borderTopColor: 'rgba(255,255,255,0.08)',
        paddingTop: 6,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingVertical: 4,
    },
    indicator: {
        width: 16,
        height: 2,
        backgroundColor: 'transparent',
        marginBottom: 2,
    },
    indicatorActive: {
        backgroundColor: C.greenPrimary,
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.45)',
    },
    labelActive: {
        color: C.greenPrimary,
    },
});
