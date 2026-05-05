import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, RadioButton, Text, TextInput } from 'react-native-paper';

export interface SetupFormValues {
    matchName: string;
    rate: number;
    maxPushCountPerHalf: number;
    startCourse: 'OUT' | 'IN';
}

interface SetupFormProps {
    initialValues: SetupFormValues;
    onStart: (values: SetupFormValues) => void;
}

export const SetupForm: React.FC<SetupFormProps> = ({ initialValues, onStart }) => {
    const { t } = useTranslation();
    const [matchName, setMatchName] = useState(initialValues.matchName);
    const [rate, setRate] = useState(initialValues.rate.toString());
    const [pushLimit, setPushLimit] = useState(initialValues.maxPushCountPerHalf.toString());
    const [startCourse, setStartCourse] = useState<'OUT' | 'IN'>(initialValues.startCourse);

    const handleStart = () => {
        onStart({
            matchName,
            rate: parseInt(rate, 10) || 10,
            maxPushCountPerHalf: parseInt(pushLimit, 10) || 2,
            startCourse,
        });
    };

    return (
        <View style={styles.container}>
            <TextInput
                label={t('common.matchName')}
                value={matchName}
                onChangeText={setMatchName}
                style={styles.input}
                mode="outlined"
            />
            <TextInput
                label={t('common.rate')}
                value={rate}
                onChangeText={setRate}
                keyboardType="numeric"
                style={styles.input}
                mode="outlined"
            />
            <TextInput
                label={t('common.pushLimit')}
                value={pushLimit}
                onChangeText={setPushLimit}
                keyboardType="numeric"
                style={styles.input}
                mode="outlined"
            />

            <Text style={styles.courseLabel}>{t('common.selectStart')}</Text>
            <RadioButton.Group onValueChange={v => setStartCourse(v as 'OUT' | 'IN')} value={startCourse}>
                <RadioButton.Item label={t('common.out')} value="OUT" />
                <RadioButton.Item label={t('common.in')} value="IN" />
            </RadioButton.Group>

            <Button
                mode="contained"
                onPress={handleStart}
                style={styles.startButton}
                contentStyle={styles.startContent}
                labelStyle={styles.startLabel}
                buttonColor="#4CAF50"
            >
                {t('common.startGame')}
            </Button>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', gap: 4 },
    input: { marginBottom: 8 },
    courseLabel: { color: '#ccc', marginTop: 8, marginBottom: 4 },
    startButton: { marginTop: 16, borderRadius: 30 },
    startContent: { height: 56 },
    startLabel: { fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
});
