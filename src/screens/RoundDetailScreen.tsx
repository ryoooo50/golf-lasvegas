import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { SharePanel } from '../components/round-detail/SharePanel';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { exportRoundCsv, exportRoundPdf } from '../services/roundExport';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useSharedRoundsStore } from '../store/sharedRoundsStore';
import { RoundResult } from '../types';
import { C } from '../theme/colors';
import { nearPinAmountsForRound } from '../utils/nearPin';
import { calculateMinimumSettlement } from '../utils/settlement';

// 共有ラウンドの取得結果で再描画するため、store から直接購読する
const EMPTY_ROUNDS: RoundResult[] = [];

function formatSignedAmount(amount: number): string {
    return `${amount > 0 ? '+' : ''}${amount.toLocaleString()}`;
}

export function RoundDetailScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user, isGuest } = useAuthStore();
    const ownerId = user?.id ?? (isGuest ? 'guest' : null);
    const ownRound = useGameStore(state => state.savedRounds.find(item =>
        item.id === id && (item.ownerId === ownerId || (!item.ownerId && isGuest)),
    ));
    const sharedRounds = useSharedRoundsStore(state => (user && state.viewerId === user.id ? state.rounds : EMPTY_ROUNDS));
    const sharedRound = ownRound ? undefined : sharedRounds.find(item => item.id === id);
    const round = ownRound ?? sharedRound;
    const isShared = sharedRound !== undefined;
    // 共有リンクから replace で開いた場合は戻り先が無いのでホームへ
    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
    const cardRef = useRef<View>(null);
    const [isExporting, setIsExporting] = useState(false);
    const nearPinAmounts = useMemo(() => round ? nearPinAmountsForRound(round) : {}, [round]);
    const transfers = useMemo(
        () => round ? calculateMinimumSettlement(round.players, round.finalScores, round.settings.rate, nearPinAmounts) : [],
        [round, nearPinAmounts],
    );

    if (!round) {
        return (
            <SafeAreaView style={styles.root}>
                <ScreenHeader title={t('common.roundDetails')} onBack={goBack} />
                <Text style={styles.empty}>{t('common.roundNotFound')}</Text>
            </SafeAreaView>
        );
    }

    const runExport = async (task: () => Promise<void>) => {
        setIsExporting(true);
        try {
            await task();
        } catch (error) {
            Alert.alert(t('common.exportFailed'), error instanceof Error ? error.message : t('common.unknownError'));
        } finally {
            setIsExporting(false);
        }
    };

    const shareImage = async () => {
        if (!cardRef.current) return;
        await runExport(async () => {
            const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
            if (Platform.OS !== 'web') {
                if (!(await Sharing.isAvailableAsync())) throw new Error(t('common.sharingUnavailable'));
                await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'ラスベガス結果を共有' });
                return;
            }

            const response = await fetch(uri);
            const blob = await response.blob();
            const imageName = (round.name || 'golf-lasvegas').replace(/[\\/:*?"<>|]/g, '-');
            const file = new File([blob], `${imageName}.png`, { type: 'image/png' });
            if (navigator.canShare?.({ files: [file] })) {
                try {
                    await navigator.share({ title: round.name, files: [file] });
                    return;
                } catch {
                    // Asynchronous image generation can make some browsers reject Web Share.
                }
            }
            const downloadUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = downloadUrl;
            anchor.download = file.name;
            anchor.click();
            URL.revokeObjectURL(downloadUrl);
        });
    };

    const realPlayers = round.players.filter(player => player.type !== 'bogey_kun');
    const hasNearPin = (round.settings.nearPinRate ?? 0) > 0;

    return (
        <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
            <ScreenHeader title={t('common.roundDetails')} subtitle={round.name} onBack={goBack} />
            <ScrollView contentContainerStyle={styles.body}>
                {isShared && <Text style={styles.sharedNote}>{t('common.sharedReadOnly')}</Text>}
                <View ref={cardRef} collapsable={false} style={styles.resultCard}>
                    <Text style={styles.brand}>GOLF LAS VEGAS</Text>
                    <Text style={styles.title}>{round.name}</Text>
                    <Text style={styles.meta}>
                        {[round.settings.courseName, round.settings.playedAt].filter(Boolean).join('  /  ') || t('common.courseDateUnset')}
                    </Text>
                    {round.settings.memo ? <Text style={styles.memo}>{round.settings.memo}</Text> : null}

                    <Text style={styles.sectionTitle}>{t('common.finalResult')}</Text>
                    {realPlayers.map(player => {
                        const points = round.finalScores[player.id] ?? 0;
                        const nearPinAmount = nearPinAmounts[player.id] ?? 0;
                        return (
                            <View key={player.id} style={styles.scoreRow}>
                                <View style={styles.playerCell}>
                                    <Text style={styles.playerName}>{player.name}</Text>
                                    {hasNearPin && (
                                        <Text style={styles.nearPinText}>
                                            {t('common.nearPinAmount', { amount: formatSignedAmount(nearPinAmount) })}
                                        </Text>
                                    )}
                                </View>
                                <Text style={[styles.points, points > 0 ? styles.positive : points < 0 ? styles.negative : null]}>
                                    {points > 0 ? '+' : ''}{points} pt
                                </Text>
                                <Text style={styles.amount}>{(points * round.settings.rate + nearPinAmount).toLocaleString()}</Text>
                            </View>
                        );
                    })}

                    <Text style={styles.sectionTitle}>{t('common.minimumSettlement')}</Text>
                    {transfers.length === 0 ? (
                        <Text style={styles.noSettlement}>{t('common.noSettlement')}</Text>
                    ) : transfers.map((transfer, index) => (
                        <View key={`${transfer.fromId}-${transfer.toId}-${index}`} style={styles.transferRow}>
                            <Text style={styles.transferText}>
                                {transfer.fromName} → {transfer.toName}
                            </Text>
                            <View style={styles.transferAmounts}>
                                {transfer.points !== null && <Text style={styles.transferPoints}>{transfer.points} pt</Text>}
                                <Text style={styles.transferMoney}>{transfer.amount.toLocaleString()}</Text>
                            </View>
                        </View>
                    ))}
                    <Text style={styles.holes}>{round.history.length}/{round.roundLength} {t('common.holesPlayed')}</Text>
                </View>

                <View style={styles.actions}>
                    <Button mode="contained" icon="share-variant" loading={isExporting} disabled={isExporting} onPress={() => { void shareImage(); }}>
                        {t('common.shareResultImage')}
                    </Button>
                    <Button mode="outlined" icon="file-delimited" disabled={isExporting} onPress={() => { void runExport(() => exportRoundCsv(round)); }}>
                        {t('common.exportCsv')}
                    </Button>
                    <Button mode="outlined" icon="file-pdf-box" disabled={isExporting} onPress={() => { void runExport(() => exportRoundPdf(round)); }}>
                        {t('common.exportPdf')}
                    </Button>
                </View>

                {!isShared && <SharePanel cloudRoundId={user ? round.cloudId ?? null : null} />}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    body: { padding: 16, paddingBottom: 48 },
    empty: { padding: 24, textAlign: 'center', color: C.ink3 },
    resultCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 20 },
    brand: { color: C.greenPrimary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
    title: { color: C.ink, fontSize: 24, fontWeight: '800', marginTop: 6 },
    sharedNote: { color: C.ink2, fontSize: 12, marginTop: 4 },
    meta: { color: C.ink3, fontSize: 12, marginTop: 4 },
    memo: { color: C.ink2, fontSize: 12, lineHeight: 18, backgroundColor: C.surface2, padding: 10, borderRadius: 6, marginTop: 12 },
    sectionTitle: { color: C.ink3, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 22, marginBottom: 8 },
    scoreRow: { flexDirection: 'row', alignItems: 'center', minHeight: 42, borderTopWidth: 1, borderTopColor: C.line2 },
    playerCell: { flex: 1, paddingVertical: 6 },
    playerName: { color: C.ink, fontSize: 14, fontWeight: '700' },
    nearPinText: { color: C.ink3, fontSize: 11, marginTop: 2 },
    points: { width: 72, textAlign: 'right', color: C.ink3, fontWeight: '800', fontVariant: ['tabular-nums'] },
    amount: { width: 80, textAlign: 'right', color: C.ink2, fontSize: 12, fontVariant: ['tabular-nums'] },
    positive: { color: C.greenDeep },
    negative: { color: C.coralDeep },
    transferRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderTopWidth: 1, borderTopColor: C.line2 },
    transferText: { flex: 1, color: C.ink, fontSize: 14, fontWeight: '700' },
    transferAmounts: { alignItems: 'flex-end' },
    transferPoints: { color: C.ink2, fontSize: 12, fontWeight: '700' },
    transferMoney: { color: C.coralDeep, fontSize: 13, fontWeight: '800' },
    noSettlement: { color: C.ink3, fontSize: 13 },
    holes: { color: C.ink4, fontSize: 10, textAlign: 'right', marginTop: 18 },
    actions: { gap: 10, marginTop: 16 },
});
