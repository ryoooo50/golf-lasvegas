import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { RadioButton, Text } from 'react-native-paper';
import { C } from '../../theme/colors';
import { NEAR_PIN_RATE_OPTIONS } from '../../utils/nearPin';

interface NearPinRateSelectorProps {
    value: number;
    onChange: (rate: number) => void;
}

/** ニアピンの額の選択（なし / 500円 / 1000円） */
export function NearPinRateSelector({ value, onChange }: NearPinRateSelectorProps) {
    const { t } = useTranslation();

    return (
        <View>
            <Text style={styles.fieldLabel}>{t('setup.nearPinLabel')}</Text>
            <RadioButton.Group onValueChange={v => onChange(Number(v))} value={value.toString()}>
                <View style={styles.radioRow}>
                    {NEAR_PIN_RATE_OPTIONS.map(rate => (
                        <RadioButton.Item
                            key={rate}
                            label={rate === 0 ? t('setup.nearPinNone') : t('setup.nearPinRateOption', { amount: rate.toLocaleString() })}
                            value={rate.toString()}
                            style={styles.radioItem}
                            labelStyle={styles.radioLabel}
                        />
                    ))}
                </View>
            </RadioButton.Group>
        </View>
    );
}

const styles = StyleSheet.create({
    fieldLabel: { color: C.ink3, fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 4 },
    radioRow: { flexDirection: 'row' },
    radioItem: { flex: 1, paddingHorizontal: 4 },
    radioLabel: { color: C.ink2, fontSize: 14 },
});
