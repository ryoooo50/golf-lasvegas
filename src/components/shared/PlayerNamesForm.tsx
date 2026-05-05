import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';

interface PlayerNamesFormProps {
    names: string[];
    playerCount: 3 | 4;
    onChange: (index: number, value: string) => void;
}

const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

export const PlayerNamesForm: React.FC<PlayerNamesFormProps> = ({
    names,
    playerCount,
    onChange,
}) => {
    const { t } = useTranslation();

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

                return (
                    <TextInput
                        key={i}
                        label={label}
                        value={names[i] ?? ''}
                        onChangeText={(v) => onChange(i, v)}
                        placeholder={DEFAULT_NAMES[i]}
                        style={styles.input}
                        mode="outlined"
                        accessibilityLabel={label}
                    />
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { gap: 4 },
    sectionLabel: {
        color: '#ccc',
        fontSize: 13,
        marginBottom: 4,
        marginTop: 8,
    },
    input: { marginBottom: 4 },
});
