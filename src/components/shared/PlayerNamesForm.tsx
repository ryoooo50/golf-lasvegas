import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { C } from '../../theme/colors';
import { PlayerHandicap } from '../../types';
import { formatHandicap } from '../../utils/handicap';

interface PlayerNamesFormProps {
    names: string[];
    playerCount: 3 | 4;
    onChange: (index: number, value: string) => void;
    handicaps: (PlayerHandicap | undefined)[];
    onHandicapPress: (index: number) => void;
}

const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

export const PlayerNamesForm: React.FC<PlayerNamesFormProps> = ({
    names,
    playerCount,
    onChange,
    handicaps,
    onHandicapPress,
}) => {
    const { t, i18n } = useTranslation();
    const language = i18n.language === 'en' ? 'en' : 'ja';

    return (
        <View style={styles.container}>
            <Text style={styles.sectionLabel}>{t('setup.players')}</Text>
            {Array.from({ length: 4 }, (_, i) => {
                const isBogueySlot = i === 3 && playerCount === 3;
                const label = t('setup.playerLabel', { number: i + 1 });

                if (isBogueySlot) {
                    return (
                        <TextInput
                            key={i}
                            label={label}
                            value={t('setup.bogeyKun')}
                            editable={false}
                            style={styles.input}
                            mode="outlined"
                            disabled
                            accessibilityLabel={`${label}: ${t('setup.bogeyKun')}`}
                        />
                    );
                }

                const handicapLabel = t('setup.handicapButton', { value: formatHandicap(handicaps[i], language) });
                return (
                    <View key={i}>
                        <TextInput
                            label={label}
                            value={names[i] ?? ''}
                            onChangeText={(v) => onChange(i, v)}
                            placeholder={DEFAULT_NAMES[i]}
                            style={styles.input}
                            mode="outlined"
                            accessibilityLabel={label}
                        />
                        <Button
                            mode="text"
                            compact
                            onPress={() => onHandicapPress(i)}
                            style={styles.handicapButton}
                            labelStyle={styles.handicapLabel}
                            textColor={handicaps[i] ? C.ink2 : C.ink4}
                            accessibilityLabel={`${label} ${handicapLabel}`}
                        >
                            {handicapLabel}
                        </Button>
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { gap: 4 },
    sectionLabel: {
        color: C.ink3,
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4,
        marginTop: 8,
    },
    input: { marginBottom: 0 },
    handicapButton: { alignSelf: 'flex-start', marginBottom: 4 },
    handicapLabel: { fontSize: 12, marginHorizontal: 4 },
});
