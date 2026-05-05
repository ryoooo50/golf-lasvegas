import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { HoleHeader } from '../components/score-input/HoleHeader';
import { LivePreviewPanel } from '../components/score-input/LivePreviewPanel';
import { ParSelectDialog } from '../components/score-input/ParSelectDialog';
import { PlayerScoreCard } from '../components/score-input/PlayerScoreCard';
import { ResultSummaryDialog } from '../components/score-input/ResultSummaryDialog';
import { HistoryDialog } from '../components/shared/HistoryDialog';
import { ScorecardDialog } from '../components/shared/ScorecardDialog';
import { useGameStore } from '../store/gameStore';
import { CalculationBreakdown, PlayerId, ScoreInput } from '../types';
import { calculateLivePreview } from '../utils/golfLogic';

export const ScoreInputScreen = () => {
    const {
        players, currentHole, nextHoleMultiplier, completeHole, settings,
        setLanguage, getRecommendedPairs, getPlayerTotalScore, updatePlayerName,
        goToHole, history, updateSettings, saveCurrentRound, savedRounds, resumeRound,
    } = useGameStore();
    const { t } = useTranslation();
    const bgScrollRef = useRef<ScrollView>(null);

    // スコア入力ステート
    const [par, setPar] = useState<number | null>(null);
    const [scores, setScores] = useState<Record<PlayerId, number>>({});
    const [birdieFlags, setBirdieFlags] = useState<Record<PlayerId, boolean>>({});
    const [pushCounts, setPushCounts] = useState<Record<PlayerId, number>>({});
    const [teamAssignments, setTeamAssignments] = useState<Record<PlayerId, 'A' | 'B'>>({});

    // ダイアログ表示ステート
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

    // 設定編集ステート
    const [editRate, setEditRate] = useState(settings.rate.toString());
    const [editPushLimit, setEditPushLimit] = useState(settings.maxPushCountPerHalf.toString());

    // ホール変更時に入力を初期化
    useEffect(() => {
        bgScrollRef.current?.scrollTo({ y: 0, animated: true });
        const savedHole = history.find(h => h.holeNumber === currentHole);

        if (savedHole) {
            setPar(savedHole.par);
            const savedScores: Record<PlayerId, number> = {};
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
    }, [currentHole, history]);

    // パー未選択なら自動でダイアログを出す
    useEffect(() => {
        if (par === null) setIsParDialogVisible(true);
    }, [currentHole]);

    const isFront9 = currentHole <= 9;
    const teamA = players.filter(p => teamAssignments[p.id] === 'A');
    const teamB = players.filter(p => teamAssignments[p.id] === 'B');
    const isValidTeams = teamA.length === 2 && teamB.length === 2;
    const isScoresEntered = players.every(p => scores[p.id] !== undefined && scores[p.id] > 0);
    const canSubmit = isValidTeams && isScoresEntered && par !== null;
    const isEditingExisting = history.some(h => h.holeNumber === currentHole);

    // リアルタイムプレビュー計算
    const livePreview = useMemo(() => {
        if (!isValidTeams || par === null || teamA.length < 2 || teamB.length < 2) {
            return { isComplete: false, teamAFinalScore: 0, teamBFinalScore: 0, teamAFlipped: false, teamBFlipped: false, winnerTeam: null, diff: 0, pushMultiplier: 1, carryOverMultiplier: nextHoleMultiplier, finalMultiplier: nextHoleMultiplier, estimatedPoints: 0 } as ReturnType<typeof calculateLivePreview>;
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
            nextHoleMultiplier,
            previewScores,
            [teamA[0].id, teamA[1].id],
            [teamB[0].id, teamB[1].id],
            par,
        );
    }, [scores, birdieFlags, pushCounts, par, nextHoleMultiplier, teamA, teamB, players, isValidTeams]);

    const liveMultiplier = livePreview.finalMultiplier;

    // ハンドラ
    const handleScoreChange = (id: PlayerId, text: string) => {
        if (text === '') {
            const next = { ...scores };
            delete next[id];
            setScores(next);
            return;
        }
        const val = parseInt(text, 10);
        if (!isNaN(val)) setScores(prev => ({ ...prev, [id]: val }));
    };

    const handleBirdieToggle = (id: PlayerId, value: boolean) => {
        setBirdieFlags(prev => ({ ...prev, [id]: value }));
    };

    const cyclePush = (id: PlayerId) => {
        const player = players.find(p => p.id === id);
        if (!player) return;
        const usedInHalf = isFront9 ? player.pushUsageCount.front9 : player.pushUsageCount.back9;
        const maxPush = settings.maxPushCountPerHalf;
        const available = Math.max(0, maxPush - usedInHalf);
        if (available === 0) return;
        const current = pushCounts[id] || 0;
        const next = current + 1 > available ? 0 : current + 1;
        setPushCounts(prev => ({ ...prev, [id]: next }));
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

        const doComplete = () => {
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
        };

        if (currentHole === 18) {
            Alert.alert(
                t('common.finishGame'),
                t('common.confirmFinish'),
                [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.ok'), onPress: doComplete }]
            );
        } else {
            doComplete();
        }
    };

    const handleSaveGame = () => {
        saveCurrentRound();
        Alert.alert(t('common.roundSaved'), '', [{ text: t('common.ok'), onPress: () => setIsHistoryVisible(true) }]);
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
            <StatusBar style="light" backgroundColor="#000000" />

            <HoleHeader
                currentHole={currentHole}
                par={par}
                liveMultiplier={liveMultiplier}
                isFront9={isFront9}
                canGoPrev={currentHole > 1}
                canGoNext={isEditingExisting}
                language={settings.language}
                onPrevHole={() => goToHole(currentHole - 1)}
                onNextHole={() => goToHole(currentHole + 1)}
                onParPress={() => setIsParDialogVisible(true)}
                onSettingsPress={() => setIsSettingsVisible(true)}
                onHelpPress={() => setIsHelpVisible(true)}
                onRestartPress={() => Alert.alert(t('common.restart'), t('common.confirmReset'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.ok'), onPress: () => { useGameStore.getState().resetGame(); } },
                ])}
                onScorecardPress={() => setIsScorecardVisible(true)}
                onHistoryPress={() => setIsHistoryVisible(true)}
                onLanguageToggle={() => setLanguage(settings.language === 'en' ? 'ja' : 'en')}
            />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={styles.container}>
                    <ScrollView ref={bgScrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

                        <View style={styles.listContainer}>
                            {players.map(p => (
                                <PlayerScoreCard
                                    key={p.id}
                                    player={p}
                                    team={teamAssignments[p.id] ?? 'A'}
                                    score={scores[p.id]}
                                    isBirdie={birdieFlags[p.id] ?? false}
                                    pushCount={pushCounts[p.id] ?? 0}
                                    par={par}
                                    isFront9={isFront9}
                                    totalScore={getPlayerTotalScore(p.id)}
                                    maxPushPerHalf={settings.maxPushCountPerHalf}
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
                        <Button
                            mode="outlined"
                            onPress={handleSaveGame}
                            contentStyle={{ height: 50 }}
                            labelStyle={{ fontSize: 13 }}
                            style={{ flex: 1.3, borderRadius: 8, borderColor: '#aaa' }}
                        >
                            {t('common.saveGame')}
                        </Button>
                        <Button
                            mode="contained"
                            onPress={handleSubmit}
                            contentStyle={{ height: 50 }}
                            labelStyle={{ fontSize: 16, fontWeight: 'bold', color: '#ffffff' }}
                            disabled={!canSubmit}
                            buttonColor="#2196F3"
                            style={{ flex: 2, borderRadius: 8 }}
                        >
                            {isEditingExisting ? t('common.updateHole') : currentHole === 18 ? t('common.finish') : t('common.nextHole')}
                        </Button>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* ダイアログ群 */}
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
                {/* 名前編集 */}
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

                {/* ヘルプ */}
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

                {/* ゲーム中設定 */}
                <Dialog visible={isSettingsVisible} onDismiss={() => setIsSettingsVisible(false)}>
                    <Dialog.Title>{t('common.settings')}</Dialog.Title>
                    <Dialog.Content>
                        <Text style={{ marginBottom: 10 }}>{settings.matchName}</Text>
                        <TextInput label={t('common.rate')} value={editRate} onChangeText={setEditRate} keyboardType="numeric" style={{ marginBottom: 12 }} />
                        <TextInput label={t('common.pushLimit')} value={editPushLimit} onChangeText={setEditPushLimit} keyboardType="numeric" />
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
    root: { flex: 1, backgroundColor: '#000000' },
    container: { flex: 1, backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
    scrollContent: { paddingBottom: 100 },
    listContainer: { paddingHorizontal: 16, paddingVertical: 8 },
    errorText: { color: '#D32F2F', textAlign: 'center', fontWeight: 'bold', marginTop: 8 },
    bottomContainer: { padding: 16, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#f0f0f0', flexDirection: 'row', gap: 10 },
});
