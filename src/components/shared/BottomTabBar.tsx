import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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
        <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
            <BlurView intensity={60} tint="light" style={styles.container}>
                {TABS.map(tab => {
                    const isActive = tab.key === activeTab;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tab, isActive && styles.tabActive]}
                            onPress={() => onChange(tab.key)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                        >
                            <Ionicons
                                name={tab.icon}
                                size={18}
                                color={isActive ? '#ffffff' : C.ink3}
                            />
                            <Text style={[styles.label, isActive && styles.labelActive]}>
                                {t(tab.labelKey)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        left: 12,
        right: 12,
    },
    container: {
        flexDirection: 'row',
        height: 60,
        borderRadius: 999,
        padding: 5,
        gap: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: 'rgba(255,255,255,0.75)',
        shadowColor: '#141e14',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        borderRadius: 999,
    },
    tabActive: {
        backgroundColor: C.ink,
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: C.ink3,
    },
    labelActive: {
        color: '#ffffff',
    },
});
