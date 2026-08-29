import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { C } from '../theme/colors';
import { useGameStore } from '../store/gameStore';

export const HistoryScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const { savedRounds, resumeRound, deleteSavedRound } = useGameStore();

    const handleResume = (roundId: string) => {
        resumeRound(roundId);
        router.replace('/');
    };

    const handleDelete = (roundId: string) => {
        Alert.alert(t('common.delete'), t('common.confirmDeleteRound'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                    const result = await deleteSavedRound(roundId);
                    if (result.cloudStatus === 'queued') {
                        Alert.alert(t('common.deletedLocalCloudQueued'));
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
            <ScreenHeader title={t('common.historyTitle')} onBack={() => router.back()} />
            <ScrollView contentContainerStyle={styles.body}>
                {savedRounds.length === 0 ? (
                    <Text style={styles.empty}>{t('common.noHistory')}</Text>
                ) : (
                    savedRounds.map((r, index) => (
                        <View key={r.id}>
                            <View style={styles.roundCard}>
                                <View style={styles.roundInfo}>
                                    <Text style={styles.roundName}>{r.name || t('common.untitledMatch')}</Text>
                                    <Text style={styles.roundDate}>{new Date(r.date).toLocaleString()}</Text>
                                    <Text style={styles.roundHoles}>
                                        {r.history.length}{t('common.holesPlayed')}
                                    </Text>
                                    <Text style={styles.roundScores}>
                                        {r.players.map(p => {
                                            const pts = r.finalScores[p.id] ?? 0;
                                            return `${p.name}: ${pts > 0 ? '+' : ''}${pts}`;
                                        }).join('  ')}
                                    </Text>
                                </View>
                                <View style={styles.actionColumn}>
                                    <Button
                                        mode="contained"
                                        compact
                                        onPress={() => handleResume(r.id)}
                                        style={styles.resumeButton}
                                        labelStyle={styles.resumeLabel}
                                        buttonColor={C.greenPrimary}
                                    >
                                        {t('common.resume')}
                                    </Button>
                                    <Button
                                        mode="text"
                                        compact
                                        textColor={C.coralDeep}
                                        onPress={() => handleDelete(r.id)}
                                        labelStyle={styles.resumeLabel}
                                    >
                                        {t('common.delete')}
                                    </Button>
                                </View>
                            </View>
                            {index < savedRounds.length - 1 && <Divider />}
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    body: { paddingBottom: 40 },
    empty: { padding: 20, textAlign: 'center', color: C.ink3 },
    roundCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 8,
        backgroundColor: C.surface,
    },
    roundInfo: { flex: 1 },
    roundName: { fontWeight: 'bold', fontSize: 15, marginBottom: 2, color: C.ink },
    roundDate: { fontSize: 11, color: C.ink3, marginBottom: 2 },
    roundHoles: { fontSize: 11, color: C.ink3, marginBottom: 4 },
    roundScores: { fontSize: 12, color: C.ink2 },
    actionColumn: { gap: 4, alignItems: 'flex-end' },
    resumeButton: { borderRadius: 8 },
    resumeLabel: { fontSize: 12 },
});
