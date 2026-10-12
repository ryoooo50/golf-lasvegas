import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { C } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { confirmAction, notify } from '../utils/dialogs';

export const HistoryScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const { savedRounds, resumeRound, duplicateRound, deleteSavedRound } = useGameStore();
    const { user, isGuest } = useAuthStore();
    const ownerId = user?.id ?? (isGuest ? 'guest' : null);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paused' | 'completed'>('all');
    const visibleRounds = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        return savedRounds.filter(round => {
            const owned = round.ownerId === ownerId || (!round.ownerId && isGuest);
            const statusMatches = statusFilter === 'all' || round.gameStatus === statusFilter;
            const searchable = [
                round.name,
                round.settings.courseName,
                round.settings.memo,
                ...round.players.map(player => player.name),
            ].join(' ').toLocaleLowerCase();
            return owned && statusMatches && (!normalizedQuery || searchable.includes(normalizedQuery));
        });
    }, [isGuest, ownerId, query, savedRounds, statusFilter]);

    const handleResume = (roundId: string) => {
        resumeRound(roundId);
        router.replace('/');
    };

    const handleDuplicate = (roundId: string) => {
        duplicateRound(roundId);
        router.replace('/');
    };

    const handleDelete = (roundId: string) => {
        confirmAction({
            title: t('common.delete'),
            message: t('common.confirmDeleteRound'),
            okText: t('common.delete'),
            cancelText: t('common.cancel'),
            destructive: true,
            onConfirm: async () => {
                const result = await deleteSavedRound(roundId);
                if (result.cloudStatus === 'queued') {
                    notify(t('common.deletedLocalCloudQueued'), '', t('common.ok'));
                }
            },
        });
    };

    return (
        <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
            <ScreenHeader title={t('common.historyTitle')} onBack={() => router.back()} />
            <ScrollView contentContainerStyle={styles.body}>
                <View style={styles.filters}>
                    <TextInput
                        mode="outlined"
                        dense
                        value={query}
                        onChangeText={setQuery}
                        placeholder={t('common.searchHistory')}
                        left={<TextInput.Icon icon="magnify" />}
                    />
                    <SegmentedButtons
                        value={statusFilter}
                        onValueChange={value => setStatusFilter(value as 'all' | 'paused' | 'completed')}
                        buttons={[
                            { value: 'all', label: t('common.all') },
                            { value: 'paused', label: t('common.paused') },
                            { value: 'completed', label: t('common.completed') },
                        ]}
                    />
                </View>
                {visibleRounds.length === 0 ? (
                    <Text style={styles.empty}>{t('common.noHistory')}</Text>
                ) : (
                    visibleRounds.map((r, index) => (
                        <View key={r.id}>
                            <View style={styles.roundCard}>
                                <View style={styles.roundInfo}>
                                    <Text style={styles.roundName}>{r.name || t('common.untitledMatch')}</Text>
                                    <Text style={r.gameStatus === 'paused' ? styles.pausedBadge : styles.completedBadge}>
                                        {r.gameStatus === 'paused' ? t('common.paused') : t('common.completed')}
                                    </Text>
                                    <Text style={styles.roundDate}>{new Date(r.date).toLocaleString()}</Text>
                                    {r.settings.courseName ? <Text style={styles.roundCourse}>{r.settings.courseName}</Text> : null}
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
                                    <Button mode="contained" compact onPress={() => router.push({ pathname: './round-detail', params: { id: r.id } })} style={styles.resumeButton} labelStyle={styles.resumeLabel} buttonColor={C.greenPrimary}>
                                        {t('common.details')}
                                    </Button>
                                    {r.gameStatus === 'paused' && (
                                        <Button mode="outlined" compact onPress={() => handleResume(r.id)} labelStyle={styles.resumeLabel}>
                                            {t('common.resume')}
                                        </Button>
                                    )}
                                    <Button mode="text" compact onPress={() => handleDuplicate(r.id)} labelStyle={styles.resumeLabel}>
                                        {t('common.duplicateRound')}
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
                            {index < visibleRounds.length - 1 && <Divider />}
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
    filters: { padding: 12, gap: 10, backgroundColor: C.surface },
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
    pausedBadge: { alignSelf: 'flex-start', color: C.coralDeep, backgroundColor: C.coralTint, fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
    completedBadge: { alignSelf: 'flex-start', color: C.greenDeep, backgroundColor: C.greenTint, fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
    roundDate: { fontSize: 11, color: C.ink3, marginBottom: 2 },
    roundCourse: { fontSize: 11, color: C.greenDeep, fontWeight: '600', marginBottom: 2 },
    roundHoles: { fontSize: 11, color: C.ink3, marginBottom: 4 },
    roundScores: { fontSize: 12, color: C.ink2 },
    actionColumn: { gap: 4, alignItems: 'flex-end' },
    resumeButton: { borderRadius: 8 },
    resumeLabel: { fontSize: 12 },
});
