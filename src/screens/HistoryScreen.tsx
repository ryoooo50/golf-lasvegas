import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HistoryRoundRow } from '../components/history/HistoryRoundRow';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { C } from '../theme/colors';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useSharedRoundsStore } from '../store/sharedRoundsStore';
import { RoundResult } from '../types';
import { confirmAction, notify } from '../utils/dialogs';

// 共有ラウンドの再描画のため、store から直接購読する（取得前は同じ空配列を返して無駄な再描画を避ける）
const EMPTY_ROUNDS: RoundResult[] = [];

export const HistoryScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const { savedRounds, resumeRound, duplicateRound, deleteSavedRound } = useGameStore();
    const { user, isGuest } = useAuthStore();
    const ownerId = user?.id ?? (isGuest ? 'guest' : null);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paused' | 'completed'>('all');
    const sharedRounds = useSharedRoundsStore(state => (user && state.viewerId === user.id ? state.rounds : EMPTY_ROUNDS));
    const matchesFilters = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        return (round: RoundResult) => {
            const statusMatches = statusFilter === 'all' || round.gameStatus === statusFilter;
            const searchable = [
                round.name,
                round.settings.courseName,
                round.settings.memo,
                ...round.players.map(player => player.name),
            ].join(' ').toLocaleLowerCase();
            return statusMatches && (!normalizedQuery || searchable.includes(normalizedQuery));
        };
    }, [query, statusFilter]);
    const visibleRounds = useMemo(
        () => savedRounds.filter(round => (round.ownerId === ownerId || (!round.ownerId && isGuest)) && matchesFilters(round)),
        [isGuest, matchesFilters, ownerId, savedRounds],
    );
    const visibleSharedRounds = useMemo(() => sharedRounds.filter(matchesFilters), [matchesFilters, sharedRounds]);

    useEffect(() => {
        if (user) void useSharedRoundsStore.getState().loadSharedRounds(user.id);
    }, [user]);

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

    const handleRemoveShared = (roundId: string) => {
        confirmAction({
            title: t('common.removeFromList'),
            message: t('common.removeFromListConfirm'),
            okText: t('common.removeFromList'),
            cancelText: t('common.cancel'),
            destructive: true,
            onConfirm: async () => {
                const removed = await useSharedRoundsStore.getState().removeSharedRound(roundId);
                if (!removed) notify(t('common.removeFromList'), t('common.shareNetworkError'), t('common.ok'));
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
                    visibleSharedRounds.length === 0 && <Text style={styles.empty}>{t('common.noHistory')}</Text>
                ) : (
                    visibleRounds.map((r, index) => (
                        <View key={r.id}>
                            <HistoryRoundRow round={r}>
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
                            </HistoryRoundRow>
                            {index < visibleRounds.length - 1 && <Divider />}
                        </View>
                    ))
                )}
                {visibleSharedRounds.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>{t('common.sharedRoundsTitle')}</Text>
                        {visibleSharedRounds.map((r, index) => (
                            <View key={r.id}>
                                <HistoryRoundRow round={r}>
                                    <Button mode="contained" compact onPress={() => router.push({ pathname: './round-detail', params: { id: r.id } })} style={styles.resumeButton} labelStyle={styles.resumeLabel} buttonColor={C.greenPrimary}>
                                        {t('common.details')}
                                    </Button>
                                    <Button mode="text" compact textColor={C.coralDeep} onPress={() => handleRemoveShared(r.id)} labelStyle={styles.resumeLabel}>
                                        {t('common.removeFromList')}
                                    </Button>
                                </HistoryRoundRow>
                                {index < visibleSharedRounds.length - 1 && <Divider />}
                            </View>
                        ))}
                    </>
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
    sectionTitle: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, fontSize: 13, fontWeight: '700', color: C.ink3 },
    resumeButton: { borderRadius: 8 },
    resumeLabel: { fontSize: 12 },
});
