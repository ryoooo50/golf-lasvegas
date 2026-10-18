import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../../theme/colors';
import { Player, PlayerId } from '../../types';

interface NearPinSelectorProps {
    /** 選択肢に出すプレイヤー（ボギーくんは含めない） */
    players: Player[];
    /** undefined = 未選択, null = 該当なし */
    selected: PlayerId | null | undefined;
    nearPinRate: number;
    carryOver: number;
    onSelect: (winnerId: PlayerId | null) => void;
}

/** パー3でニアピンを取った人を選ぶ */
export function NearPinSelector({ players, selected, nearPinRate, carryOver, onSelect }: NearPinSelectorProps) {
    const { t } = useTranslation();
    const amount = (nearPinRate * (carryOver + 1)).toLocaleString();
    const stakeLabel = carryOver > 0
        ? t('common.nearPinStakeWithCarryOver', { count: carryOver, amount })
        : t('common.nearPinStake', { amount });

    const options: { id: PlayerId | null; label: string }[] = [
        ...players.map(player => ({ id: player.id, label: player.name })),
        { id: null, label: t('common.nearPinNoWinner') },
    ];

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>{t('common.nearPin')}</Text>
                <Text style={styles.stake}>{stakeLabel}</Text>
            </View>
            <View style={styles.optionRow}>
                {options.map(option => {
                    const isSelected = selected === option.id;
                    return (
                        <TouchableOpacity
                            key={option.id ?? 'none'}
                            onPress={() => onSelect(option.id)}
                            style={[styles.option, isSelected && styles.optionSelected]}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isSelected }}
                            accessibilityLabel={`${t('common.nearPin')}: ${option.label}`}
                        >
                            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]} numberOfLines={1}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: C.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.line,
        padding: 12,
        gap: 10,
    },
    headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    title: { fontSize: 13, fontWeight: '700', color: C.ink },
    stake: { fontSize: 12, color: C.ink3, flexShrink: 1, textAlign: 'right' },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    option: {
        flexGrow: 1,
        flexBasis: 64,
        minHeight: 44,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionSelected: { backgroundColor: C.ink2, borderColor: C.ink2 },
    optionText: { fontSize: 13, fontWeight: '600', color: C.ink2 },
    optionTextSelected: { color: '#ffffff' },
});
