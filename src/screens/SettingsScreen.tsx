import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { C } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';

function Stepper({ label, value, onChange, min = 0, max = 5 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
    return (
        <View style={styles.stepperBlock}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.stepperRow}>
                <Button mode="outlined" compact onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepperBtn}>−</Button>
                <Text style={styles.stepperValue}>{value}</Text>
                <Button mode="outlined" compact onPress={() => onChange(Math.min(max, value + 1))} style={styles.stepperBtn}>＋</Button>
            </View>
        </View>
    );
}

export const SettingsScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const { settings, updateSettings, setLanguage, resetGame } = useGameStore();
    const { signOut, user } = useAuthStore();

    const [editRate, setEditRate] = useState(settings.rate.toString());
    const [pushLimit, setPushLimit] = useState(settings.maxPushCountPerHalf);
    const [pushRecoveryOnBirdie, setPushRecoveryOnBirdie] = useState(settings.pushRecoveryOnBirdie);
    const [pushRecoveryOnEagle, setPushRecoveryOnEagle] = useState(settings.pushRecoveryOnEagle);

    const handleSave = () => {
        updateSettings({
            rate: parseInt(editRate, 10) || settings.rate,
            maxPushCountPerHalf: pushLimit,
            pushRecoveryOnBirdie,
            pushRecoveryOnEagle,
        });
        router.back();
    };

    const handleRestart = () => {
        const doReset = () => {
            resetGame();
            router.replace('/');
        };
        if (Platform.OS === 'web') {
            if (window.confirm(t('common.confirmReset'))) doReset();
        } else {
            Alert.alert(t('common.restart'), t('common.confirmReset'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.ok'), onPress: doReset },
            ]);
        }
    };

    return (
        <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
            <ScreenHeader title={t('common.settings')} onBack={() => router.back()} />
            <ScrollView contentContainerStyle={styles.body}>
                <Text style={styles.matchName}>{settings.matchName}</Text>

                <TextInput
                    label={t('common.rate')}
                    value={editRate}
                    onChangeText={setEditRate}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                />

                <Stepper label={t('setup.pushLimitLabel')} value={pushLimit} onChange={setPushLimit} />
                <Stepper label={t('setup.pushRecoveryBirdieLabel')} value={pushRecoveryOnBirdie} onChange={setPushRecoveryOnBirdie} />
                <Stepper label={t('setup.pushRecoveryEagleLabel')} value={pushRecoveryOnEagle} onChange={setPushRecoveryOnEagle} />

                <Button mode="contained" onPress={handleSave} style={styles.saveBtn} buttonColor={C.greenPrimary}>
                    {t('common.update')}
                </Button>

                <Button
                    mode="outlined"
                    style={styles.secondaryBtn}
                    onPress={() => setLanguage(settings.language === 'en' ? 'ja' : 'en')}
                >
                    {settings.language === 'en' ? '日本語に切替' : 'Switch to English'}
                </Button>

                <Button mode="outlined" style={styles.secondaryBtn} onPress={handleRestart} textColor={C.coralDeep}>
                    {t('common.restart')}
                </Button>

                {user && (
                    <Button mode="outlined" icon="logout" style={styles.secondaryBtn} onPress={() => signOut()}>
                        {t('auth.logoutButton')}
                    </Button>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    body: { padding: 16, paddingBottom: 40 },
    matchName: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 16, textAlign: 'center' },
    input: { marginBottom: 12, backgroundColor: C.surface },
    fieldLabel: { fontSize: 13, color: C.ink3, fontWeight: '600', marginBottom: 4 },
    stepperBlock: { marginBottom: 14 },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stepperBtn: { minWidth: 48 },
    stepperValue: { fontSize: 20, fontWeight: '700', width: 32, textAlign: 'center', color: C.ink },
    saveBtn: { marginTop: 12, borderRadius: 8 },
    secondaryBtn: { marginTop: 10, borderRadius: 6 },
});
