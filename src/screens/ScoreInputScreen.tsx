import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { HoleHeader } from '../components/score-input/HoleHeader';
import { LivePreviewPanel } from '../components/score-input/LivePreviewPanel';
import { ParSelectDialog } from '../components/score-input/ParSelectDialog';
import { PlayerScoreCard } from '../components/score-input/PlayerScoreCard';
import { ResultSummaryDialog } from '../components/score-input/ResultSummaryDialog';
import { BottomTabBar } from '../components/shared/BottomTabBar';
import { HandicapDialog } from '../components/shared/HandicapDialog';
import { SyncStatusBanner } from '../components/shared/SyncStatusBanner';
import { C } from '../theme/colors';
import { getRoundHoleSequence, useGameStore } from '../store/gameStore';
import { HoleResult, Player, PlayerId, SaveRoundResult, ScoreInput } from '../types';
import { confirmAction, notify } from '../utils/dialogs';
import { calculateLivePreview } from '../utils/golfLogic';
import { buildScoreInput, formatHandicap, grossScoreOf } from '../utils/handicap';

export const ScoreInputScreen = () => {
    const router = useRouter();
    const {
        players, currentHole, nextHoleMultiplier, completeHole, settings,
        getRecommendedPairs, getPlayerTotalScore, updatePlayerName, setPlayerHandicap,
        getRemainingPushForPlayer, goToHole, resetHole, history,
        saveDraft, pauseCurrentRound, startHole,
    } = useGameStore();
    const { t, i18n } = useTranslation();
    const language = i18n.language === 'en' ? 'en' : 'ja';
    const bgScrollRef = useRef<ScrollView>(null);

    const [par, setPar] = useState<number | null>(null);
    const [scores, setScores] = useState<Record<PlayerId, number | undefined>>({});
    const [birdieFlags, setBirdieFlags] = useState<Record<PlayerId, boolean>>({});
    const [pushCounts, setPushCounts] = useState<Record<PlayerId, number>>({});
    const [teamAssignments, setTeamAssignments] = useState<Record<PlayerId, 'A' | 'B'>>({});
    // 入力 state がどのホールのものか。ホール移動直後の1レンダーは前ホールの値が残っているため、
    // これが currentHole と一致するまでドラフト保存しない（前ホールの値が次ホールに引き継がれるのを防ぐ）
    const [loadedHole, setLoadedHole] = useState<number | null>(null);

    const [isParDialogVisible, setIsParDialogVisible] = useState(false);
    const [isNameDialogVisible, setIsNameDialogVisible] = useState(false);
    const [editingPlayerId, setEditingPlayerId] = useState<PlayerId | null>(null);
    const [editingName, setEditingName] = useState('');
    const [isHelpVisible, setIsHelpVisible] = useState(false);
    const [isHandicapDialogVisible, setIsHandicapDialogVisible] = useState(false);
    // 確定したホールの結果。確定直後に currentHole が次ホールへ進み teamAssignments も
    // 次ホールの推奨ペアに置き換わるため、表示用のチーム情報も確定時点のものを保持する。
    const [lastHoleResult, setLastHoleResult] = useState<HoleResult | null>(null);
    const [isResultVisible, setIsResultVisible] = useState(false);

    const [pendingTeamChange, setPendingTeamChange] = useState<{ id: PlayerId; newTeam: 'A' | 'B' } | null>(null);

    useEffect(() => {
        bgScrollRef.current?.scrollTo({ y: 0, animated: true });
        setLoadedHole(currentHole);
        const savedHole = history.find(h => h.holeNumber === currentHole);

        if (savedHole) {
            setPar(savedHole.par);
            const savedScores: Record<PlayerId, number | undefined> = {};
            const savedBirdie: Record<PlayerId, boolean> = {};
            const savedPush: Record<PlayerId, number> = {};
            const savedAssignments: Record<PlayerId, 'A' | 'B'> = {};

            Object.entries(savedHole.scores).forEach(([pid, val]) => {
                savedScores[pid] = grossScoreOf(val);
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
            const persistedDraft = useGameStore.getState().draftHole;
            if (persistedDraft?.holeNumber === currentHole) {
                setPar(persistedDraft.par);
                setScores(persistedDraft.scores);
                setBirdieFlags(persistedDraft.birdieFlags);
                setPushCounts(persistedDraft.pushCounts);
                setTeamAssignments(persistedDraft.teamAssignments);
                return;
            }
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
        if (loadedHole !== currentHole) return;
        if (Object.keys(teamAssignments).length === 0) return;
        saveDraft({
            holeNumber: currentHole,
            par,
            scores,
            birdieFlags,
            pushCounts,
            teamAssignments,
        });
    }, [currentHole, loadedHole, par, scores, birdieFlags, pushCounts, teamAssignments, saveDraft]);

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
    const hasCurrentInput = par !== null || Object.keys(scores).length > 0 || Object.keys(pushCounts).length > 0;
    const holeSequence = useMemo(
        () => getRoundHoleSequence(startHole, settings.roundLength),
        [startHole, settings.roundLength],
    );
    const currentSequenceIndex = holeSequence.indexOf(currentHole);
    const previousHole = currentSequenceIndex > 0 ? holeSequence[currentSequenceIndex - 1] : null;
    const nextHole = currentSequenceIndex >= 0 && currentSequenceIndex < holeSequence.length - 1
        ? holeSequence[currentSequenceIndex + 1]
        : null;
    const willCompleteRound = holeSequence.every(hole =>
        hole === currentHole || history.some(result => result.holeNumber === hole),
    );

    // 実打数からハンデ適用後の ScoreInput を作る。バーディー/イーグルはハンデ適用後で判定する
    const toScoreInput = (player: Player, gross: number, parValue: number): ScoreInput => buildScoreInput({
        gross,
        par: parValue,
        pushCount: pushCounts[player.id] || 0,
        handicap: player.type === 'bogey_kun' ? undefined : player.handicap,
    });

    const livePreview = useMemo(() => {
        const currentCOLevel = nextHoleMultiplier === 1 ? 0 : nextHoleMultiplier / 2;
        const coMultFb = currentCOLevel * 2;
        if (!isValidTeams || par === null || teamA.length < 2 || teamB.length < 2) {
            return { isComplete: false, teamAFinalScore: 0, teamBFinalScore: 0, teamAFlipped: false, teamBFlipped: false, winnerTeam: null, diff: 0, pushMultiplier: 0, carryOverMultiplier: coMultFb, eagleMultiplier: 0, finalMultiplier: Math.max(1, coMultFb), estimatedPoints: 0 } as ReturnType<typeof calculateLivePreview>;
        }
        const previewScores: Record<PlayerId, Partial<ScoreInput>> = {};
        players.forEach(p => {
            const s = scores[p.id];
            previewScores[p.id] = s === undefined
                ? { pushCount: pushCounts[p.id] || 0 }
                : toScoreInput(p, s, par);
        });
        return calculateLivePreview(
            currentCOLevel,
            previewScores,
            [teamA[0].id, teamA[1].id],
            [teamB[0].id, teamB[1].id],
            par,
        );
        // toScoreInput は pushCounts のみに依存するため依存配列には含めない
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scores, pushCounts, par, nextHoleMultiplier, teamA, teamB, players, isValidTeams]);

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

    const cloudStatusMessage = (result: SaveRoundResult): string => {
        if (result.cloudStatus === 'saved') return t('auth.cloudSaved');
        if (result.cloudStatus === 'queued') return t('auth.cloudQueued');
        return '';
    };

    const notifyRoundFinished = (result: SaveRoundResult) => {
        const goToResult = () => {
            if (result.roundId) router.push({ pathname: './round-detail', params: { id: result.roundId } });
            else router.push('/history');
        };
        notify(t('common.roundSaved'), cloudStatusMessage(result), t('common.ok'), goToResult);
    };

    const handleSubmit = () => {
        if (!canSubmit || par === null || teamA.length < 2 || teamB.length < 2) return;

        const scoreInputs: Record<PlayerId, ScoreInput> = {};
        players.forEach(p => {
            scoreInputs[p.id] = toScoreInput(p, scores[p.id] || 0, par);
        });

        const warning = getInputWarning(scoreInputs);

        const doComplete = async (finishRound: boolean) => {
            completeHole({
                par,
                scores: scoreInputs,
                teamA_Ids: [teamA[0].id, teamA[1].id],
                teamB_Ids: [teamB[0].id, teamB[1].id],
                holeNumber: currentHole,
            });

            if (finishRound) {
                // 保存してラウンドを閉じ（gameStatus → menu）、結果画面へ移動する
                const result = await useGameStore.getState().finishCurrentRound();
                notifyRoundFinished(result);
                return;
            }

            const savedResult = useGameStore.getState().history.find(h => h.holeNumber === currentHole);
            if (savedResult) {
                setLastHoleResult(savedResult);
                setIsResultVisible(true);
            }
        };

        const proceed = () => {
            if (willCompleteRound) {
                confirmAction({
                    title: t('common.finishGame'),
                    message: t('common.confirmFinishAndSave'),
                    okText: t('common.finish'),
                    cancelText: t('common.cancel'),
                    onConfirm: () => { void doComplete(true); },
                });
            } else {
                void doComplete(false);
            }
        };

        if (warning) {
            confirmAction({
                title: t('common.warning'),
                message: warning,
                okText: t('common.ok'),
                cancelText: t('common.cancel'),
                onConfirm: proceed,
            });
        } else {
            proceed();
        }
    };

    const handleSaveGame = async () => {
        saveDraft({ holeNumber: currentHole, par, scores, birdieFlags, pushCounts, teamAssignments });
        const result = await pauseCurrentRound();
        notify(t('common.roundPaused'), cloudStatusMessage(result), t('common.ok'), () => router.replace('/'));
    };

    const handleTabChange = (tab: 'hole' | 'scorecard' | 'history' | 'settings') => {
        if (tab === 'scorecard') router.push('/scorecard');
        else if (tab === 'history') router.push('/history');
        else if (tab === 'settings') router.push('/settings');
    };

    const handleResetHole = () => {
        const confirmationLabel = isEditingExisting ? t('common.resetHole') : t('common.clearCurrentInput');
        const doReset = () => {
            resetHole(currentHole);
            setScores({});
            setBirdieFlags({});
            setPushCounts({});
        };
        confirmAction({
            title: `${confirmationLabel}?`,
            okText: t('common.ok'),
            cancelText: t('common.cancel'),
            destructive: true,
            onConfirm: doReset,
        });
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

    const editingPlayer = players.find(p => p.id === editingPlayerId);
    const canEditHandicap = editingPlayer !== undefined && editingPlayer.type !== 'bogey_kun';

    return (
        <View style={styles.root}>
            <StatusBar style="light" backgroundColor={C.dark} />

            <HoleHeader
                currentHole={currentHole}
                par={par}
                liveMultiplier={liveMultiplier}
                isFront9={isFront9}
                canGoPrev={previousHole !== null}
                canGoNext={nextHole !== null && isEditingExisting}
                history={history}
                holeNumbers={holeSequence}
                onPrevHole={() => { if (previousHole !== null) goToHole(previousHole); }}
                onNextHole={() => { if (nextHole !== null) goToHole(nextHole); }}
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
            <SyncStatusBanner />

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

                    <View style={styles.bottomContainer}>
                        {(isEditingExisting || hasCurrentInput) && (
                            <TouchableOpacity onPress={handleResetHole} style={styles.resetBtn}>
                                <Text style={styles.resetBtnText}>
                                    {isEditingExisting ? t('common.resetHole') : t('common.clearCurrentInput')}
                                </Text>
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
                                    {willCompleteRound
                                        ? (isEditingExisting ? t('common.updateAndFinish') : t('common.finishRound'))
                                        : isEditingExisting
                                        ? t('common.updateHole')
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
                result={lastHoleResult}
                players={players}
                rate={settings.rate}
            />

            <HandicapDialog
                visible={isHandicapDialogVisible}
                playerName={editingPlayer?.name ?? ''}
                value={editingPlayer?.handicap}
                onDismiss={() => setIsHandicapDialogVisible(false)}
                onSave={handicap => {
                    if (editingPlayerId) setPlayerHandicap(editingPlayerId, handicap);
                    setIsHandicapDialogVisible(false);
                }}
            />

            <Portal>
                <Dialog visible={isNameDialogVisible} onDismiss={() => setIsNameDialogVisible(false)}>
                    <Dialog.Title>{t('common.editName')}</Dialog.Title>
                    <Dialog.Content>
                        <TextInput label={t('common.name')} value={editingName} onChangeText={setEditingName} autoFocus />
                        {canEditHandicap && (
                            <Button
                                mode="text"
                                compact
                                onPress={() => { setIsNameDialogVisible(false); setIsHandicapDialogVisible(true); }}
                                style={{ alignSelf: 'flex-start', marginTop: 8 }}
                            >
                                {t('setup.handicapButton', { value: formatHandicap(editingPlayer?.handicap, language) })}
                            </Button>
                        )}
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
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
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
        borderRadius: 6,
        borderWidth: 1,
        borderColor: C.coralPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resetBtnText: { fontSize: 13, color: C.coralPrimary, fontWeight: '600' },
    saveBtn: {
        flex: 1,
        height: 50,
        borderRadius: 8,
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
        borderRadius: 8,
        backgroundColor: C.greenPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextBtnDisabled: { backgroundColor: C.ink5 },
    nextBtnText: { fontSize: 16, fontWeight: '800', color: '#ffffff', letterSpacing: 0.3 },
});
