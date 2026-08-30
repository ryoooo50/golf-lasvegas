import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HoleHeader } from '../components/score-input/HoleHeader';
import { LivePreviewPanel } from '../components/score-input/LivePreviewPanel';
import { ParSelectDialog } from '../components/score-input/ParSelectDialog';
import { PlayerScoreCard } from '../components/score-input/PlayerScoreCard';
import { ResultSummaryDialog } from '../components/score-input/ResultSummaryDialog';
import { BottomTabBar } from '../components/shared/BottomTabBar';
import { C } from '../theme/colors';
import { useGameStore } from '../store/gameStore';
import { CalculationBreakdown, PlayerId, ScoreInput } from '../types';
import { calculateLivePreview } from '../utils/golfLogic';

export const ScoreInputScreen = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const tabBarClearance = 60 + Math.max(insets.bottom, 12) + 8;
    const {
        players, currentHole, nextHoleMultiplier, completeHole, settings,
        getRecommendedPairs, getPlayerTotalScore, updatePlayerName,
        getRemainingPushForPlayer, goToHole, resetHole, history, saveCurrentRound,
    } = useGameStore();
    const { t } = useTranslation();
    const bgScrollRef = useRef<ScrollView>(null);

    const [par, setPar] = useState<number | null>(null);
    const [scores, setScores] = useState<Record<PlayerId, number | undefined>>({});
    const [birdieFlags, setBirdieFlags] = useState<Record<PlayerId, boolean>>({});
    const [pushCounts, setPushCounts] = useState<Record<PlayerId, number>>({});
    const [teamAssignments, setTeamAssignments] = useState<Record<PlayerId, 'A' | 'B'>>({});

    const [isParDialogVisible, setIsParDialogVisible] = useState(false);
    const [isNameDialogVisible, setIsNameDialogVisible] = useState(false);
    const [editingPlayerId, setEditingPlayerId] = useState<PlayerId | null>(null);
    const [editingName, setEditingName] = useState('');
    const [isHelpVisible, setIsHelpVisible] = useState(false);
    const [resultBreakdown, setResultBreakdown] = useState<CalculationBreakdown | null>(null);
    const [isResultVisible, setIsResultVisible] = useState(false);

    const [pendingTeamChange, setPendingTeamChange] = useState<{ id: PlayerId; newTeam: 'A' | 'B' } | null>(null);

    useEffect(() => {
        bgScrollRef.current?.scrollTo({ y: 0, animated: true });
        const savedHole = history.find(h => h.holeNumber === currentHole);

        if (savedHole) {
            setPar(savedHole.par);
            const savedScores: Record<PlayerId, number | undefined> = {};
            const savedBirdie: Record<PlayerId, boolean> = {};
            const savedPush: Record<PlayerId, number> = {};
            const savedAssignments: Record<PlayerId, 'A' | 'B'> = {};

            Object.entries(savedHole.scores).forEach(([pid, val]) => {
                savedScores[pid] = val.score;
                savedBirdie[pid] = val.isBirdie;
                savedPush[pid] = val.pushCount || 0;
            });
            savedHole.teamA_Ids.forEach(id => { savedAssignments[id] = 'A'; });
            savedHole.teamB_Ids.forEach(id => { savedAssignments[id] = 'B'; });

            setScores(savedScores);
            setBirdieFlags(savedBirdie);
            setPushCounts(savedPush);
            setTeamAssignments(savedAssignments);
        } else {
            setPar(null);
            setScores({});
            setBirdieFlags({});
            const { teamA, teamB } = getRecommendedPairs(currentHole);
            const newAssignments: Record<PlayerId, 'A' | 'B'> = {};
            teamA.forEach(id => { newAssignments[id] = 'A'; });
            teamB.forEach(id => { newAssignments[id] = 'B'; });
            setTeamAssignments(newAssignments);

            // ハーフ最終ホール（9番・18番）は残りプッシュを自動消費
            if (currentHole === 9 || currentHole === 18) {
                const autoPush: Record<PlayerId, number> = {};
                players.forEach(p => {
                    const remaining = getRemainingPushForPlayer(p.id);
                    if (remaining > 0) autoPush[p.id] = remaining;
                });
                setPushCounts(autoPush);
            } else {
                setPushCounts({});
            }
        }
        // players/getRemainingPushForPlayer は意図的に依存配列から除外している。
        // players は名前編集などでも参照が変わるため、含めるとホール入力中に
        // プレイヤー名を変更しただけでスコア入力がリセットされてしまう。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentHole, history, getRecommendedPairs]);

    useEffect(() => {
        if (par === null) setIsParDialogVisible(true);
    }, [currentHole, par]);

    const isFront9 = currentHole <= 9;
    const teamA = players.filter(p => teamAssignments[p.id] === 'A');
    const teamB = players.filter(p => teamAssignments[p.id] === 'B');
    const isValidTeams = teamA.length === 2 && teamB.length === 2;
    const isScoresEntered = players.every(p => scores[p.id] !== undefined && (scores[p.id] ?? 0) > 0);
    const canSubmit = isValidTeams && isScoresEntered && par !== null;
    const isEditingExisting = history.some(h => h.holeNumber === currentHole);

    const livePreview = useMemo(() => {
        const currentCOLevel = nextHoleMultiplier === 1 ? 0 : nextHoleMultiplier / 2;
        const coMultFb = currentCOLevel * 2;
        if (!isValidTeams || par === null || teamA.length < 2 || teamB.length < 2) {
            return { isComplete: false, teamAFinalScore: 0, teamBFinalScore: 0, teamAFlipped: false, teamBFlipped: false, winnerTeam: null, diff: 0, pushMultiplier: 0, carryOverMultiplier: coMultFb, eagleMultiplier: 0, finalMultiplier: Math.max(1, coMultFb), estimatedPoints: 0 } as ReturnType<typeof calculateLivePreview>;
        }
        const previewScores: Record<PlayerId, Partial<ScoreInput>> = {};
        players.forEach(p => {
            const s = scores[p.id];
            const isEagle = par !== null && s !== undefined && s <= par - 2;
            const isBirdie = isEagle || (birdieFlags[p.id] ?? false) || (par !== null && s !== undefined && s === par - 1);
            previewScores[p.id] = {
                score: s,
                isBirdie,
                isEagle,
                pushCount: pushCounts[p.id] || 0,
            };
        });
        return calculateLivePreview(
            currentCOLevel,
            previewScores,
            [teamA[0].id, teamA[1].id],
            [teamB[0].id, teamB[1].id],
            par,
        );
    }, [scores, birdieFlags, pushCounts, par, nextHoleMultiplier, teamA, teamB, players, isValidTeams]);

    const liveMultiplier = livePreview.finalMultiplier;

    const handleScoreChange = (id: PlayerId, value: number | undefined) => {
        setScores(prev => ({ ...prev, [id]: value }));
    };

    const handleBirdieToggle = (id: PlayerId, value: boolean) => {
        setBirdieFlags(prev => ({ ...prev, [id]: value }));
    };

    const cyclePush = (id: PlayerId) => {
        const current = pushCounts[id] || 0;
        const available = getRemainingPushForPlayer(id);
        if (available <= 0) return;
        const next = current >= available ? 0 : current + 1;
        setPushCounts(prev => ({ ...prev, [id]: next }));
    };

    const getInputWarning = (scoreInputs: Record<PlayerId, ScoreInput>): string | null => {
        const assignedIds = [...teamA.map(p => p.id), ...teamB.map(p => p.id)];
        if (new Set(assignedIds).size !== assignedIds.length) {
            return t('common.duplicateTeamAssignment');
        }

        const overCapPlayers = players
            .filter(p => (scoreInputs[p.id]?.score ?? 0) > 9 && p.type !== 'bogey_kun')
            .map(p => p.name);
        if (overCapPlayers.length > 0) {
            return t('common.scoreCapWarning', { names: overCapPlayers.join(', ') });
        }

        const overPushPlayers = players
            .filter(p => (scoreInputs[p.id]?.pushCount ?? 0) > getRemainingPushForPlayer(p.id))
            .map(p => p.name);
        if (overPushPlayers.length > 0) {
            return t('common.pushOverLimitWarning', { names: overPushPlayers.join(', ') });
        }

        return null;
    };

    const alertSaveResult = (result: Awaited<ReturnType<typeof saveCurrentRound>>) => {
        const goToHistory = () => router.push('/history');
        if (result.cloudStatus === 'saved') {
            Alert.alert(t('common.roundSaved'), t('auth.cloudSaved'), [{ text: t('common.ok'), onPress: goToHistory }]);
        } else if (result.cloudStatus === 'queued') {
            Alert.alert(t('common.roundSaved'), t('auth.cloudQueued'), [{ text: t('common.ok'), onPress: goToHistory }]);
        } else {
            Alert.alert(t('common.roundSaved'), '', [{ text: t('common.ok'), onPress: goToHistory }]);
        }
    };

    const handleSubmit = () => {
        if (!canSubmit || par === null || teamA.length < 2 || teamB.length < 2) return;

        const scoreInputs: Record<PlayerId, ScoreInput> = {};
        players.forEach(p => {
            const s = scores[p.id] || 0;
            const isEagle = par !== null && s <= par - 2;
            const isBirdie = isEagle || (birdieFlags[p.id] ?? false) || (par !== null && s === par - 1);
            scoreInputs[p.id] = {
                score: s,
                isBirdie,
                isEagle,
                pushCount: pushCounts[p.id] || 0,
            };
        });

        const warning = getInputWarning(scoreInputs);

        const doComplete = async (saveAfterComplete = false) => {
            completeHole({
                par,
                scores: scoreInputs,
                teamA_Ids: [teamA[0].id, teamA[1].id],
                teamB_Ids: [teamB[0].id, teamB[1].id],
                holeNumber: currentHole,
            });
            const savedResult = useGameStore.getState().history.find(h => h.holeNumber === currentHole);
            if (savedResult?.breakdown) {
                setResultBreakdown(savedResult.breakdown);
                setIsResultVisible(true);
            }

            if (saveAfterComplete) {
                const result = await useGameStore.getState().saveCurrentRound();
                alertSaveResult(result);
            }
        };

        const proceed = () => {
            if (currentHole === 18) {
                Alert.alert(
                    t('common.finishGame'),
                    t('common.confirmFinishAndSave'),
                    [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('common.ok'), onPress: () => { void doComplete(true); } },
                    ],
                );
            } else {
                void doComplete(false);
            }
        };

        if (warning) {
            Alert.alert(
                t('common.warning'),
                warning,
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.ok'), onPress: proceed },
                ],
            );
        } else {
            proceed();
        }
    };

    const handleSaveGame = async () => {
        const result = await saveCurrentRound();
        alertSaveResult(result);
    };

    const handleTabChange = (tab: 'hole' | 'scorecard' | 'history' | 'settings') => {
        if (tab === 'scorecard') router.push('/scorecard');
        else if (tab === 'history') router.push('/history');
        else if (tab === 'settings') router.push('/settings');
    };

    const handleResetHole = () => {
        const doReset = () => {
            resetHole(currentHole);
            setScores({});
            setBirdieFlags({});
            setPushCounts({});
        };
        if (Platform.OS === 'web') {
            if (window.confirm(t('common.resetHole') + '?')) doReset();
        } else {
            Alert.alert(t('common.resetHole'), '', [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.ok'), style: 'destructive', onPress: doReset },
            ]);
        }
    };

    const openNameEditor = (id: PlayerId, name: string) => {
        setEditingPlayerId(id);
        setEditingName(name);
        setIsNameDialogVisible(true);
    };

    const saveName = () => {
        if (editingPlayerId && editingName.trim()) updatePlayerName(editingPlayerId, editingName.trim());
        setIsNameDialogVisible(false);
    };

    return (
        <View style={styles.root}>
            <StatusBar style="light" backgroundColor={C.dark} />

            <HoleHeader
                currentHole={currentHole}
                par={par}
                liveMultiplier={liveMultiplier}
                isFront9={isFront9}
                canGoPrev={currentHole > 1}
                canGoNext={isEditingExisting}
                history={history}
                onPrevHole={() => goToHole(currentHole - 1)}
                onNextHole={() => goToHole(currentHole + 1)}
                onParPress={() => setIsParDialogVisible(true)}
                onHelpPress={() => setIsHelpVisible(true)}
                onHalfToggle={(half) => {
                    if (half === 'front') {
                        const lastFront = history.filter(h => h.holeNumber <= 9).sort((a, b) => b.holeNumber - a.holeNumber)[0];
                        goToHole(lastFront ? Math.min(lastFront.holeNumber + 1, 9) : 1);
                    } else {
                        const lastBack = history.filter(h => h.holeNumber >= 10).sort((a, b) => b.holeNumber - a.holeNumber)[0];
                        goToHole(lastBack ? Math.min(lastBack.holeNumber + 1, 18) : 10);
                    }
                }}
            />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={styles.container}>
                    <ScrollView
                        ref={bgScrollRef}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Team A セクション */}
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionDot, { backgroundColor: C.greenPrimary }]} />
                            <Text style={[styles.sectionLabel, { color: C.greenDeep }]}>TEAM A</Text>
                        </View>
                        <View style={styles.teamGrid}>
                            {teamA.map(p => (
                                <PlayerScoreCard
                                    key={p.id}
                                    player={p}
                                    team="A"
                                    score={scores[p.id]}
                                    isBirdie={birdieFlags[p.id] ?? false}
                                    pushCount={pushCounts[p.id] ?? 0}
                                    par={par}
                                    totalScore={getPlayerTotalScore(p.id)}
                                    remainingPush={getRemainingPushForPlayer(p.id)}
                                    onScoreChange={handleScoreChange}
                                    onBirdieToggle={handleBirdieToggle}
                                    onPushCycle={cyclePush}
                                    onTeamToggle={(id, val) => setPendingTeamChange({ id, newTeam: val })}
                                    onNamePress={openNameEditor}
                                    onParRequired={() => setIsParDialogVisible(true)}
                                />
                            ))}
                        </View>

                        {/* Team B セクション */}
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionDot, { backgroundColor: C.coralPrimary }]} />
                            <Text style={[styles.sectionLabel, { color: C.coralDeep }]}>TEAM B</Text>
                        </View>
                        <View style={styles.teamGrid}>
                            {teamB.map(p => (
                                <PlayerScoreCard
                                    key={p.id}
                                    player={p}
                                    team="B"
                                    score={scores[p.id]}
                                    isBirdie={birdieFlags[p.id] ?? false}
                                    pushCount={pushCounts[p.id] ?? 0}
                                    par={par}
                                    totalScore={getPlayerTotalScore(p.id)}
                                    remainingPush={getRemainingPushForPlayer(p.id)}
                                    onScoreChange={handleScoreChange}
                                    onBirdieToggle={handleBirdieToggle}
                                    onPushCycle={cyclePush}
                                    onTeamToggle={(id, val) => setPendingTeamChange({ id, newTeam: val })}
                                    onNamePress={openNameEditor}
                                    onParRequired={() => setIsParDialogVisible(true)}
                                />
                            ))}
                        </View>

                        {!isValidTeams && (
                            <Text style={styles.errorText}>{t('common.teamAssignmentError')}</Text>
                        )}

                        <LivePreviewPanel
                            preview={livePreview}
                            teamANames={teamA.map(p => p.name).join(' & ')}
                            teamBNames={teamB.map(p => p.name).join(' & ')}
                        />
                    </ScrollView>

                    <View style={[styles.bottomContainer, { paddingBottom: tabBarClearance }]}>
                        {isEditingExisting && (
                            <TouchableOpacity onPress={handleResetHole} style={styles.resetBtn}>
                                <Text style={styles.resetBtnText}>{t('common.resetHole')}</Text>
                            </TouchableOpacity>
                        )}
                        <View style={styles.bottomRow}>
                            <TouchableOpacity
                                onPress={handleSaveGame}
                                style={styles.saveBtn}
                            >
                                <Text style={styles.saveBtnText}>{t('common.saveGame')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={!canSubmit}
                                style={[styles.nextBtn, !canSubmit && styles.nextBtnDisabled]}
                            >
                                <Text style={styles.nextBtnText}>
                                    {isEditingExisting
                                        ? t('common.updateHole')
                                        : currentHole === 18
                                        ? t('common.finish')
                                        : `${t('common.nextHole')} →`}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>

            <BottomTabBar activeTab="hole" onChange={handleTabChange} />

            <ParSelectDialog
                visible={isParDialogVisible}
                onSelect={p => { setPar(p); setIsParDialogVisible(false); }}
            />

            <ResultSummaryDialog
                visible={isResultVisible}
                onDismiss={() => setIsResultVisible(false)}
                breakdown={resultBreakdown}
                teamAPlayers={teamA}
                teamBPlayers={teamB}
                rate={settings.rate}
            />

            <Portal>
                <Dialog visible={isNameDialogVisible} onDismiss={() => setIsNameDialogVisible(false)}>
                    <Dialog.Title>{t('common.editName')}</Dialog.Title>
                    <Dialog.Content>
                        <TextInput label={t('common.name')} value={editingName} onChangeText={setEditingName} autoFocus />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setIsNameDialogVisible(false)}>{t('common.cancel')}</Button>
                        <Button onPress={saveName}>{t('common.save')}</Button>
                    </Dialog.Actions>
                </Dialog>

                <Dialog visible={isHelpVisible} onDismiss={() => setIsHelpVisible(false)}>
                    <Dialog.Title>{t('common.helpTitle')}</Dialog.Title>
                    <Dialog.ScrollArea>
                        <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
                            <Text variant="bodyMedium">{t('common.helpContent')}</Text>
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setIsHelpVisible(false)}>{t('common.ok')}</Button>
                    </Dialog.Actions>
                </Dialog>

                <Dialog visible={pendingTeamChange !== null} onDismiss={() => setPendingTeamChange(null)}>
                    <Dialog.Title>{t('common.teamChange')}</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium">
                            {pendingTeamChange
                                ? `${players.find(p => p.id === pendingTeamChange.id)?.name ?? ''} → Team ${pendingTeamChange.newTeam}`
                                : ''}
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setPendingTeamChange(null)}>{t('common.cancel')}</Button>
                        <Button onPress={() => {
                            if (pendingTeamChange) {
                                setTeamAssignments(prev => ({ ...prev, [pendingTeamChange.id]: pendingTeamChange.newTeam }));
                            }
                            setPendingTeamChange(null);
                        }}>{t('common.ok')}</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.dark },
    container: {
        flex: 1,
        backgroundColor: C.bg,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    scrollContent: { paddingBottom: 110 },

    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    sectionDot: { width: 8, height: 8, borderRadius: 2 },
    sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },

    teamGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },

    errorText: { color: C.coralPrimary, textAlign: 'center', fontWeight: 'bold', marginTop: 8 },

    bottomContainer: {
        padding: 16,
        backgroundColor: C.surface,
        borderTopWidth: 1,
        borderTopColor: C.line,
        gap: 8,
    },
    bottomRow: {
        flexDirection: 'row',
        gap: 10,
    },
    resetBtn: {
        height: 38,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.coralPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resetBtnText: { fontSize: 13, color: C.coralPrimary, fontWeight: '600' },
    saveBtn: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.line,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.surface,
    },
    saveBtnText: { fontSize: 13, color: C.ink3, fontWeight: '600' },
    nextBtn: {
        flex: 2,
        height: 50,
        borderRadius: 12,
        backgroundColor: C.greenPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextBtnDisabled: { backgroundColor: C.ink5 },
    nextBtnText: { fontSize: 16, fontWeight: '800', color: '#ffffff', letterSpacing: 0.3 },
});
