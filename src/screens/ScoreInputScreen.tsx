import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { HoleHeader } from '../components/score-input/HoleHeader';
import { LivePreviewPanel } from '../components/score-input/LivePreviewPanel';
import { ParSelectDialog } from '../components/score-input/ParSelectDialog';
import { PlayerScoreCard } from '../components/score-input/PlayerScoreCard';
import { ResultSummaryDialog } from '../components/score-input/ResultSummaryDialog';
import { HistoryDialog } from '../components/shared/HistoryDialog';
import { ScorecardDialog } from '../components/shared/ScorecardDialog';
import { C } from '../theme/colors';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { CalculationBreakdown, PlayerId, ScoreInput } from '../types';
import { calculateLivePreview } from '../utils/golfLogic';

export const ScoreInputScreen = () => {
    const {
        players, currentHole, nextHoleMultiplier, completeHole, settings,
        setLanguage, getRecommendedPairs, getPlayerTotalScore, updatePlayerName,
        getRemainingPushForPlayer, goToHole, resetHole, history, updateSettings, saveCurrentRound, savedRounds, resumeRound,
    } = useGameStore();
    const deleteSavedRound = useGameStore((state) => state.deleteSavedRound);
    const { signOut, user } = useAuthStore();
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
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isScorecardVisible, setIsScorecardVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [resultBreakdown, setResultBreakdown] = useState<CalculationBreakdown | null>(null);
    const [isResultVisible, setIsResultVisible] = useState(false);

    const [editRate, setEditRate] = useState(settings.rate.toString());
    const [editPushLimit, setEditPushLimit] = useState(settings.maxPushCountPerHalf.toString());

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
            setPushCounts({});
            const { teamA, teamB } = getRecommendedPairs(currentHole);
            const newAssignments: Record<PlayerId, 'A' | 'B'> = {};
            teamA.forEach(id => { newAssignments[id] = 'A'; });
            teamB.forEach(id => { newAssignments[id] = 'B'; });
            setTeamAssignments(newAssignments);
        }

        setEditRate(settings.rate.toString());
        setEditPushLimit(settings.maxPushCountPerHalf.toString());
    }, [currentHole, history, getRecommendedPairs, settings.maxPushCountPerHalf, settings.rate]);

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
        const player = players.find(p => p.id === id);
        if (!player) return;
        const current = pushCounts[id] || 0;
        const available = Math.max(0, getRemainingPushForPlayer(id));
        if (available === 0) return;
        const next = current + 1 > available ? 0 : current + 1;
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
            .filter(p => (scoreInputs[p.id]?.pushCount ?? 0) > getRemainingPushForPlayer(p.id) + (pushCounts[p.id] || 0))
            .map(p => p.name);
        if (overPushPlayers.length > 0) {
            return t('common.pushOverLimitWarning', { names: overPushPlayers.join(', ') });
        }

        return null;
    };

    const alertSaveResult = (result: Awaited<ReturnType<typeof saveCurrentRound>>) => {
        if (result.cloudStatus === 'saved') {
            Alert.alert(t('common.roundSaved'), t('auth.cloudSaved'), [{ text: t('common.ok'), onPress: () => setIsHistoryVisible(true) }]);
        } else if (result.cloudStatus === 'queued') {
            Alert.alert(t('common.roundSaved'), t('auth.cloudQueued'), [{ text: t('common.ok'), onPress: () => setIsHistoryVisible(true) }]);
        } else {
            Alert.alert(t('common.roundSaved'), '', [{ text: t('common.ok'), onPress: () => setIsHistoryVisible(true) }]);
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

    const handleDeleteRound = (roundId: string) => {
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
                language={settings.language}
                history={history}
                onPrevHole={() => goToHole(currentHole - 1)}
                onNextHole={() => goToHole(currentHole + 1)}
                onParPress={() => setIsParDialogVisible(true)}
                onSettingsPress={() => setIsSettingsVisible(true)}
                onHelpPress={() => setIsHelpVisible(true)}
                onRestartPress={() => {
                    if (Platform.OS === 'web') {
                        if (window.confirm(t('common.confirmReset'))) {
                            useGameStore.getState().resetGame();
                        }
                    } else {
                        Alert.alert(t('common.restart'), t('common.confirmReset'), [
                            { text: t('common.cancel'), style: 'cancel' },
                            { text: t('common.ok'), onPress: () => { useGameStore.getState().resetGame(); } },
                        ]);
                    }
                }}
                onScorecardPress={() => setIsScorecardVisible(true)}
                onHistoryPress={() => setIsHistoryVisible(true)}
                onLanguageToggle={() => setLanguage(settings.language === 'en' ? 'ja' : 'en')}
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
                                    onTeamToggle={(id, val) => setTeamAssignments(prev => ({ ...prev, [id]: val }))}
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
                                    onTeamToggle={(id, val) => setTeamAssignments(prev => ({ ...prev, [id]: val }))}
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

                    <View style={styles.bottomContainer}>
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

            <ParSelectDialog
                visible={isParDialogVisible}
                onSelect={p => { setPar(p); setIsParDialogVisible(false); }}
            />

            <ScorecardDialog
                visible={isScorecardVisible}
                onDismiss={() => setIsScorecardVisible(false)}
                history={history}
                players={players}
                getPlayerTotalScore={getPlayerTotalScore}
            />

            <HistoryDialog
                visible={isHistoryVisible}
                onDismiss={() => setIsHistoryVisible(false)}
                savedRounds={savedRounds}
                onResume={(roundId) => resumeRound(roundId)}
                onDelete={handleDeleteRound}
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

                <Dialog visible={isSettingsVisible} onDismiss={() => setIsSettingsVisible(false)}>
                    <Dialog.Title>{t('common.settings')}</Dialog.Title>
                    <Dialog.Content>
                        <Text style={{ marginBottom: 10 }}>{settings.matchName}</Text>
                        <TextInput label={t('common.rate')} value={editRate} onChangeText={setEditRate} keyboardType="numeric" style={{ marginBottom: 12 }} />
                        <TextInput label={t('common.pushLimit')} value={editPushLimit} onChangeText={setEditPushLimit} keyboardType="numeric" />
                        {user && (
                            <Button
                                mode="outlined"
                                icon="logout"
                                style={{ marginTop: 16 }}
                                onPress={() => {
                                    setIsSettingsVisible(false);
                                    signOut();
                                }}
                            >
                                {t('auth.logoutButton')}
                            </Button>
                        )}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setIsSettingsVisible(false)}>{t('common.cancel')}</Button>
                        <Button onPress={() => {
                            updateSettings({ rate: parseInt(editRate, 10) || settings.rate, maxPushCountPerHalf: parseInt(editPushLimit, 10) || settings.maxPushCountPerHalf });
                            setIsSettingsVisible(false);
                        }}>{t('common.update')}</Button>
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
