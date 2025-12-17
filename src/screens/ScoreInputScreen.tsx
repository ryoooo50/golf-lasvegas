import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Button, Chip, DataTable, Dialog, IconButton, Portal, RadioButton, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { PlayerId, ScoreInput } from '../types';
import { calculateCurrentHoleRate } from '../utils/golfLogic';

// Colors
const COLOR_TEAM_A_BG = '#E3F2FD';
const COLOR_TEAM_A_TEXT = '#0D47A1';
const COLOR_TEAM_B_BG = '#FCE4EC';
const COLOR_TEAM_B_TEXT = '#880E4F';
const COLOR_TEXT_PRIMARY = '#212121';
const COLOR_INPUT_BG = '#F5F5F5';
const COLOR_BORDER = '#E0E0E0';
const COLOR_PRIMARY_ACTION = '#2196F3';

export const ScoreInputScreen = () => {
    const theme = useTheme();
    const {
        players, currentHole, nextHoleMultiplier, completeHole, settings,
        setLanguage, getRecommendedPairs, getPlayerTotalScore, updatePlayerName,
        goToHole, history, startGame, updateSettings, saveCurrentRound, savedRounds
    } = useGameStore();
    const { t } = useTranslation();
    const { width } = useWindowDimensions();
    const bgScrollRef = useRef<ScrollView>(null);

    // Local state
    const [par, setPar] = useState<number | null>(null);
    const [scores, setScores] = useState<Record<PlayerId, number>>({});
    const [pushCounts, setPushCounts] = useState<Record<PlayerId, number>>({}); // CHANGED: boolean -> number
    const [teamAssignments, setTeamAssignments] = useState<Record<PlayerId, 'A' | 'B'>>({});

    // Dialogs
    const [isNameDialogVisible, setIsNameDialogVisible] = useState(false);
    const [editingPlayerId, setEditingPlayerId] = useState<PlayerId | null>(null);
    const [editingName, setEditingName] = useState('');

    const [isHelpVisible, setIsHelpVisible] = useState(false);

    // Setup / Settings
    const [isSetupVisible, setIsSetupVisible] = useState(history.length === 0 && currentHole === 1);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);

    // Par Selection Dialog
    const [isParDialogVisible, setIsParDialogVisible] = useState(false);

    useEffect(() => {
        if (!isSetupVisible && par === null) {
            setIsParDialogVisible(true);
        }
    }, [isSetupVisible, par]);

    // Setup Fields
    const [startCourse, setStartCourse] = useState<'OUT' | 'IN'>('OUT');
    const [matchName, setMatchName] = useState('');
    const [editRate, setEditRate] = useState(settings.rate.toString());
    const [editPushLimit, setEditPushLimit] = useState(settings.maxPushCountPerHalf.toString());

    // Scorecard / History
    const [isScorecardVisible, setIsScorecardVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);


    // Initialize/Hydrate
    useEffect(() => {
        // Scroll to Top on Hole Change
        if (bgScrollRef.current) {
            bgScrollRef.current.scrollTo({ y: 0, animated: true });
        }

        const savedHole = history.find(h => h.holeNumber === currentHole);

        if (savedHole) {
            setPar(savedHole.par);
            const savedScores: Record<PlayerId, number> = {};
            const savedPushCounts: Record<PlayerId, number> = {};
            const savedAssignments: Record<PlayerId, 'A' | 'B'> = {};

            Object.entries(savedHole.scores).forEach(([pid, val]) => {
                savedScores[pid] = val.score;
                savedPushCounts[pid] = val.pushCount || 0;
            });

            savedHole.teamA_Ids.forEach(id => savedAssignments[id] = 'A');
            savedHole.teamB_Ids.forEach(id => savedAssignments[id] = 'B');

            setScores(savedScores);
            setPushCounts(savedPushCounts);
            setTeamAssignments(savedAssignments);
        } else {
            setPar(null); // Force selection
            setScores({});
            setPushCounts({});

            const { teamA, teamB } = getRecommendedPairs(currentHole);
            const newAssignments: Record<PlayerId, 'A' | 'B'> = {};
            teamA.forEach(id => newAssignments[id] = 'A');
            teamB.forEach(id => newAssignments[id] = 'B');
            setTeamAssignments(newAssignments);
        }

        // Sync settings to edit state when opened
        setMatchName(settings.matchName);
        setEditRate(settings.rate.toString());
        setEditPushLimit(settings.maxPushCountPerHalf.toString());

    }, [currentHole, history, getRecommendedPairs, settings]);

    const handleStartGame = () => {
        // Validate
        const rate = parseInt(editRate, 10) || 10;
        const pushLimit = parseInt(editPushLimit, 10) || 2;

        updateSettings({ matchName, rate, maxPushCountPerHalf: pushLimit });

        setIsSetupVisible(false);
        const startHole = startCourse === 'OUT' ? 1 : 10;
        startGame(startHole);
    };

    const handleUpdateSettingsMIDGAME = () => {
        const rate = parseInt(editRate, 10) || settings.rate;
        const pushLimit = parseInt(editPushLimit, 10) || settings.maxPushCountPerHalf;
        updateSettings({ matchName, rate, maxPushCountPerHalf: pushLimit });
        setIsSettingsVisible(false);
    };

    const confirmRestart = () => {
        Alert.alert(
            t('common.restart'),
            t('common.confirmReset'),
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'OK', onPress: () => setIsSetupVisible(true) }
            ]
        );
    };

    const handleSaveGame = () => {
        saveCurrentRound();
        Alert.alert(t('common.roundSaved'), '', [{ text: 'OK', onPress: () => setIsHistoryVisible(true) }]);
    };

    const handleScoreChange = (id: PlayerId, text: string) => {
        // Allow empty string to clear the field
        if (text === '') {
            const newScores = { ...scores };
            delete newScores[id]; // Removes key, making value undefined
            setScores(newScores);
            return;
        }

        const val = parseInt(text, 10);
        // Only update if it's a valid number
        if (!isNaN(val)) {
            setScores(prev => ({ ...prev, [id]: val }));
        }
    };

    const cyclePush = (id: PlayerId) => {
        const player = players.find(p => p.id === id);
        if (!player) return;

        const maxPush = settings.maxPushCountPerHalf;
        const usedInHalf = isFront9 ? player.pushUsageCount.front9 : player.pushUsageCount.back9;
        const available = Math.max(0, maxPush - usedInHalf);
        const currentSelected = pushCounts[id] || 0;

        // Logic: 0 -> 1 -> ... -> Available -> 0
        if (available === 0) return;

        let nextVal = currentSelected + 1;
        if (nextVal > available) {
            nextVal = 0;
        }
        setPushCounts(prev => ({ ...prev, [id]: nextVal }));
    };

    const toggleTeam = (id: PlayerId, val: 'A' | 'B') => {
        setTeamAssignments(prev => ({ ...prev, [id]: val }));
    };

    const openNameEditor = (id: PlayerId, currentName: string) => {
        setEditingPlayerId(id);
        setEditingName(currentName);
        setIsNameDialogVisible(true);
    };

    const saveName = () => {
        if (editingPlayerId && editingName.trim()) {
            updatePlayerName(editingPlayerId, editingName.trim());
        }
        setIsNameDialogVisible(false);
        setEditingPlayerId(null);
    };

    // Navigation
    const handlePrevHole = () => {
        if (currentHole > 1) {
            goToHole(currentHole - 1);
        }
    };

    const handleNextHoleNav = () => {
        goToHole(currentHole + 1);
    };

    // Validation
    const isFront9 = currentHole <= 9;
    const teamA = players.filter(p => teamAssignments[p.id] === 'A');
    const teamB = players.filter(p => teamAssignments[p.id] === 'B');
    const isValidTeams = teamA.length === 2 && teamB.length === 2;
    const isScoresEntered = players.every(p => scores[p.id] !== undefined && scores[p.id] > 0);
    const canSubmit = isValidTeams && isScoresEntered && par !== null;

    const handleSubmit = () => {
        if (!canSubmit || par === null) return;

        const scoreInputs: Record<PlayerId, ScoreInput> = {};
        players.forEach(p => {
            const s = scores[p.id] || 0;
            scoreInputs[p.id] = {
                score: s,
                isBirdie: s < par,
                pushCount: pushCounts[p.id] || 0,
            };
        });

        const teamA_Ids: [PlayerId, PlayerId] = [teamA[0].id, teamA[1].id];
        const teamB_Ids: [PlayerId, PlayerId] = [teamB[0].id, teamB[1].id];

        const doComplete = () => {
            completeHole({
                par,
                scores: scoreInputs,
                teamA_Ids,
                teamB_Ids,
                holeNumber: currentHole
            });
            // If 18H, we don't show "Next Hole", but we should probably inform user?
            if (currentHole < 18) {
                Alert.alert(t('common.success'), t('common.holeCompleted'));
            }
        };

        if (currentHole === 18) {
            Alert.alert(
                t('common.finishGame') || 'Finish Method',
                t('common.confirmFinish') || 'End score input and go to result screen?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'OK', onPress: doComplete }
                ]
            );
        } else {
            doComplete();
        }
    };

    const isEditingExisting = history.some(h => h.holeNumber === currentHole);

    // Live Rate Calculation
    const currentHoleData = history.find(h => h.holeNumber === currentHole);

    const liveRate = React.useMemo(() => {
        if (currentHoleData) {
            return currentHoleData.appliedMultiplier ?? 1;
        }

        const tempScores: Record<PlayerId, ScoreInput> = {};
        players.forEach(p => {
            const s = scores[p.id] || 0;
            // Check birdie: must have valid score and par
            const isBirdie = (par !== null && s > 0 && s < par);
            tempScores[p.id] = {
                score: s,
                isBirdie,
                pushCount: pushCounts[p.id] || 0 // Correctly use number
            };
        });

        return calculateCurrentHoleRate(nextHoleMultiplier, tempScores);
    }, [scores, pushCounts, par, nextHoleMultiplier, currentHoleData, players]);

    return (
        <View style={styles.root}>
            <StatusBar style="light" backgroundColor="#000000" />

            <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeAreaHeader}>
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <View style={{ flexDirection: 'row', gap: 0 }}>
                            <IconButton icon="help-circle-outline" iconColor="#ffffff" size={20} onPress={() => setIsHelpVisible(true)} />
                            <IconButton icon="cog" iconColor="#ffffff" size={20} onPress={() => setIsSettingsVisible(true)} />
                            <TouchableOpacity onPress={confirmRestart} style={styles.topBtn}>
                                <Text style={styles.topBtnText}>{t('common.restart').toUpperCase()}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => setIsScorecardVisible(true)} style={[styles.topBtn, { marginRight: 12 }]}>
                                <Text style={styles.topBtnText}>{t('common.scorecard').toUpperCase()}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setIsHistoryVisible(true)} style={[styles.topBtn, { marginRight: 12 }]}>
                                <Text style={styles.topBtnText}>{t('common.viewHistory').toUpperCase()}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setLanguage(settings.language === 'en' ? 'ja' : 'en')} style={styles.topBtn}>
                                <Text style={[styles.topBtnText, { fontWeight: 'bold' }]}>{settings.language.toUpperCase()}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.navRow}>
                        <IconButton
                            icon="chevron-left"
                            iconColor="#ffffff"
                            size={30}
                            disabled={currentHole <= 1 && history.length === 0}
                            onPress={handlePrevHole}
                        />
                        <View style={styles.holeInfo}>
                            <Text variant="headlineSmall" style={styles.headerText}>Hole {currentHole}</Text>
                            <Text variant="titleSmall" style={styles.headerSubText}>{par ? `Par ${par}` : ''}</Text>
                        </View>
                        <IconButton
                            icon="chevron-right"
                            iconColor="#ffffff"
                            size={30}
                            disabled={!isEditingExisting}
                            style={{ opacity: isEditingExisting ? 1 : 0 }}
                            onPress={handleNextHoleNav}
                        />
                    </View>

                    <View style={styles.infoBar}>
                        <Chip icon="flag" mode="outlined" textStyle={{ color: '#ffffff' }} style={styles.chip}>x{liveRate}</Chip>
                        <Text style={{ color: '#ddd', fontWeight: 'bold' }}>
                            {isFront9 ? t('common.out') : t('common.in')}
                        </Text>
                    </View>
                </View>
            </SafeAreaView>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.container}>
                    <ScrollView
                        ref={bgScrollRef}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >

                        {/* Par Display / Edit */}
                        <TouchableOpacity onPress={() => setIsParDialogVisible(true)} style={[styles.parRow, !par && styles.parRowHighlight]}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: par ? '#333' : '#D32F2F', textAlign: 'center' }}>
                                {par ? `Par ${par}` : `Tap to Select Par`}
                            </Text>
                            <Text style={{ fontSize: 12, color: '#666', textAlign: 'center', marginTop: 2 }}>
                                {t('common.tapToChange')}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.listContainer}>
                            {players.map(p => {
                                const currentPushCount = isFront9 ? p.pushUsageCount.front9 : p.pushUsageCount.back9;
                                const maxPush = settings.maxPushCountPerHalf;
                                const canPush = currentPushCount < maxPush;
                                const myPushCount = pushCounts[p.id] || 0;
                                const isPushing = myPushCount > 0;
                                const totalScore = getPlayerTotalScore(p.id);

                                const team = teamAssignments[p.id];
                                const isTeamA = team === 'A';
                                const cardBg = isTeamA ? COLOR_TEAM_A_BG : COLOR_TEAM_B_BG;
                                const cardText = isTeamA ? COLOR_TEAM_A_TEXT : COLOR_TEAM_B_TEXT;
                                const borderColor = isTeamA ? '#90CAF9' : '#F48FB1';

                                return (
                                    <View key={p.id} style={[styles.playerCard, { backgroundColor: cardBg, borderColor }]}>
                                        <TouchableOpacity
                                            style={styles.nameSection}
                                            onPress={() => openNameEditor(p.id, p.name)}
                                        >
                                            <Text
                                                style={[styles.playerName, { color: cardText }]}
                                                numberOfLines={1}
                                                adjustsFontSizeToFit
                                            >
                                                {p.name}
                                            </Text>
                                            <View style={styles.totalScoreContainer}>
                                                <Text style={styles.totalScoreLabel}>Total:</Text>
                                                <Text style={styles.totalScoreValue}>
                                                    {totalScore > 0 ? `+${totalScore}` : totalScore}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>

                                        <View style={styles.scoreSection}>
                                            <TextInput
                                                mode="outlined"
                                                value={scores[p.id]?.toString() || ''}
                                                onChangeText={txt => handleScoreChange(p.id, txt)}
                                                keyboardType="number-pad"
                                                style={styles.scoreInput}
                                                contentStyle={styles.scoreInputContent}
                                                outlineColor={COLOR_BORDER}
                                                activeOutlineColor={cardText}
                                                dense
                                                disabled={par === null}
                                            />
                                        </View>

                                        <View style={styles.controlsSection}>
                                            <SegmentedButtons
                                                value={team}
                                                onValueChange={val => toggleTeam(p.id, val as 'A' | 'B')}
                                                density="high"
                                                buttons={[
                                                    { value: 'A', label: 'A', style: { minWidth: 20 } },
                                                    { value: 'B', label: 'B', style: { minWidth: 20 } },
                                                ]}
                                                style={styles.teamSeg}
                                            />
                                            <TouchableOpacity
                                                onPress={() => cyclePush(p.id)}
                                                disabled={currentPushCount >= maxPush && !(pushCounts[p.id] || 0)}
                                                style={[
                                                    styles.pushButton,
                                                    (pushCounts[p.id] || 0) > 0
                                                        ? { backgroundColor: cardText }
                                                        : { borderColor: cardText, borderWidth: 1 }
                                                ]}
                                            >
                                                <Text style={{ fontSize: 10, color: (pushCounts[p.id] || 0) > 0 ? 'white' : cardText }}>
                                                    {t('common.push')} {(pushCounts[p.id] || 0) > 0 ? `x${pushCounts[p.id]} ` : ''}
                                                    {Math.max(0, maxPush - currentPushCount)}/{maxPush}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>



                        {!isValidTeams && (
                            <Text style={styles.errorText}>
                                {t('common.teamAssignmentError')}
                            </Text>
                        )}
                    </ScrollView>

                    {/* Footer Button - Update or Next & Save */}
                    <View style={[styles.bottomContainer, { flexDirection: 'row', gap: 10 }]}>
                        <Button
                            mode="outlined"
                            onPress={handleSaveGame}
                            contentStyle={{ height: 50 }}
                            style={{ flex: 1, borderRadius: 8, borderColor: '#aaa' }}
                        >
                            {t('common.saveGame')}
                        </Button>
                        <Button
                            mode="contained"
                            onPress={handleSubmit}
                            contentStyle={{ height: 50 }}
                            labelStyle={{ fontSize: 16, fontWeight: 'bold', color: '#ffffff' }}
                            disabled={!canSubmit}
                            buttonColor={COLOR_PRIMARY_ACTION}
                            style={{ flex: 2, borderRadius: 8 }}
                        >
                            {isEditingExisting ? t('common.updateHole') : (currentHole === 18 ? (t('common.finish') || 'Finish') : t('common.nextHole'))}
                        </Button>
                    </View>

                </View>
            </KeyboardAvoidingView>

            {/* Dialogs */}
            <Portal>
                {/* Name Edit */}
                <Dialog visible={isNameDialogVisible} onDismiss={() => setIsNameDialogVisible(false)}>
                    <Dialog.Title>Edit Name</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label="Name"
                            value={editingName}
                            onChangeText={setEditingName}
                            autoFocus
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setIsNameDialogVisible(false)}>Cancel</Button>
                        <Button onPress={saveName}>Save</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Help */}
                <Dialog visible={isHelpVisible} onDismiss={() => setIsHelpVisible(false)}>
                    <Dialog.Title>{t('common.helpTitle')}</Dialog.Title>
                    <Dialog.ScrollArea>
                        <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
                            <Text variant="bodyMedium">{t('common.helpContent')}</Text>
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setIsHelpVisible(false)}>OK</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Setup Modal (Start Match) */}
                <Dialog visible={isSetupVisible} dismissable={false}>
                    <Dialog.Title>{t('common.startGame')}</Dialog.Title>
                    <Dialog.ScrollArea>
                        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                            <TextInput label={t('common.matchName')} value={matchName} onChangeText={setMatchName} style={styles.inputSpacing} />
                            <TextInput label={t('common.rate')} value={editRate} onChangeText={setEditRate} keyboardType="numeric" style={styles.inputSpacing} />
                            <TextInput label={t('common.pushLimit')} value={editPushLimit} onChangeText={setEditPushLimit} keyboardType="numeric" style={styles.inputSpacing} />

                            <Text style={{ marginBottom: 10, marginTop: 10 }}>{t('common.selectStart')}:</Text>
                            <RadioButton.Group onValueChange={value => setStartCourse(value as 'OUT' | 'IN')} value={startCourse}>
                                <RadioButton.Item label={t('common.out')} value="OUT" />
                                <RadioButton.Item label={t('common.in')} value="IN" />
                            </RadioButton.Group>
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={handleStartGame}>{t('common.startGame')}</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Mid-Game Settings Modal */}
                <Dialog visible={isSettingsVisible} onDismiss={() => setIsSettingsVisible(false)}>
                    <Dialog.Title>{t('common.settings')}</Dialog.Title>
                    <Dialog.Content>
                        <Text style={{ marginBottom: 10 }}>Match: {settings.matchName}</Text>
                        <TextInput label={t('common.rate')} value={editRate} onChangeText={setEditRate} keyboardType="numeric" style={styles.inputSpacing} />
                        <TextInput label={t('common.pushLimit')} value={editPushLimit} onChangeText={setEditPushLimit} keyboardType="numeric" style={styles.inputSpacing} />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setIsSettingsVisible(false)}>Cancel</Button>
                        <Button onPress={handleUpdateSettingsMIDGAME}>Update</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Scorecard Modal */}
                <Dialog visible={isScorecardVisible} onDismiss={() => setIsScorecardVisible(false)} style={{ maxHeight: '80%' }}>
                    <Dialog.Title>{t('common.scorecard')}</Dialog.Title>
                    <Dialog.ScrollArea>
                        <ScrollView horizontal>
                            <ScrollView>
                                <DataTable>
                                    <DataTable.Header>
                                        <DataTable.Title style={{ width: 50 }}>H</DataTable.Title>
                                        <DataTable.Title style={{ width: 50 }}>P</DataTable.Title>
                                        {players.map(p => (
                                            <DataTable.Title key={p.id} style={{ width: 80 }} numeric>{p.name}</DataTable.Title>
                                        ))}
                                    </DataTable.Header>

                                    {history.map((h, i) => (
                                        <DataTable.Row key={i}>
                                            <DataTable.Cell style={{ width: 50 }}>{h.holeNumber}</DataTable.Cell>
                                            <DataTable.Cell style={{ width: 50 }}>{h.par}</DataTable.Cell>
                                            {players.map(p => (
                                                <DataTable.Cell key={p.id} style={{ width: 80 }} numeric>
                                                    {h.scores[p.id]?.score}
                                                    {h.pointsResult[p.id] !== 0 ? ` (${h.pointsResult[p.id] > 0 ? '+' : ''}${h.pointsResult[p.id]})` : ''}
                                                </DataTable.Cell>
                                            ))}
                                        </DataTable.Row>
                                    ))}

                                    {/* Total Row */}
                                    {history.length > 0 && (
                                        <DataTable.Row>
                                            <DataTable.Cell style={{ width: 50 }}>Tot</DataTable.Cell>
                                            <DataTable.Cell style={{ width: 50 }}>{''}</DataTable.Cell>
                                            {players.map(p => (
                                                <DataTable.Cell key={p.id} style={{ width: 80 }} numeric>
                                                    {getPlayerTotalScore(p.id)}
                                                </DataTable.Cell>
                                            ))}
                                        </DataTable.Row>
                                    )}

                                </DataTable>
                            </ScrollView>
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setIsScorecardVisible(false)}>Close</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* History List Modal (Simple version for "View History") */}
                <Dialog visible={isHistoryVisible} onDismiss={() => setIsHistoryVisible(false)} style={{ maxHeight: '80%' }}>
                    <Dialog.Title>{t('common.historyTitle')}</Dialog.Title>
                    <Dialog.ScrollArea>
                        <ScrollView>
                            {savedRounds.length === 0 ? (
                                <Text>{t('common.noHistory')}</Text>
                            ) : (
                                savedRounds.map(r => (
                                    <View key={r.id} style={{ marginBottom: 15, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
                                        <Text style={{ fontWeight: 'bold' }}>{r.name}</Text>
                                        <Text style={{ fontSize: 12, color: '#666' }}>{new Date(r.date).toLocaleString()}</Text>
                                        <Text style={{ marginTop: 4 }}>
                                            Scores: {r.players.map(p => `${p.name}: ${r.finalScores[p.id] || 0}`).join(', ')}
                                        </Text>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </Dialog.ScrollArea>
                    <Dialog.Actions>
                        <Button onPress={() => setIsHistoryVisible(false)}>Close</Button>
                    </Dialog.Actions>
                </Dialog>

                {/* Par Selection Dialog */}
                <Dialog visible={isParDialogVisible} dismissable={false}>
                    <Dialog.Title style={{ textAlign: 'center' }}>{t('common.selectPar') || 'Select Par'}</Dialog.Title>
                    <Dialog.Content>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                            {[3, 4, 5].map(p => (
                                <Button
                                    key={p}
                                    mode="contained"
                                    onPress={() => { setPar(p); setIsParDialogVisible(false); }}
                                    style={{ flex: 1, marginHorizontal: 4 }}
                                    contentStyle={{ height: 60 }}
                                    labelStyle={{ fontSize: 24, fontWeight: 'bold' }}
                                >
                                    {p}
                                </Button>
                            ))}
                        </View>
                    </Dialog.Content>
                </Dialog>

            </Portal>

        </View >
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#000000',
    },
    safeAreaHeader: {
        backgroundColor: '#000000',
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    topBtn: {
        padding: 4,
    },
    topBtnText: {
        color: '#ccc',
        fontSize: 12,
    },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 4,
    },
    holeInfo: {
        alignItems: 'center',
    },
    headerText: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
    headerSubText: {
        color: '#cccccc',
    },
    infoBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    chip: {
        backgroundColor: '#333',
        height: 28,
    },
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    scrollContent: {
        paddingBottom: 100,
    },
    parRow: {
        padding: 16,
        paddingBottom: 8,
        backgroundColor: '#fafafa',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    parRowHighlight: {
        backgroundColor: '#ffebee',
    },
    parSeg: {
        flex: 1,
    },
    parSegPulse: {
        opacity: 0.8
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    playerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    nameSection: {
        flex: 1,
        marginRight: 8,
        justifyContent: 'center',
    },
    playerName: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    totalScoreContainer: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        flexDirection: 'row',
    },
    totalScoreLabel: {
        fontSize: 11,
        color: '#333',
        marginRight: 4,
    },
    totalScoreValue: {
        fontSize: 12,
        fontWeight: '900',
        color: '#000000',
    },
    scoreSection: {
        width: 60,
        marginRight: 12,
    },
    scoreInput: {
        backgroundColor: COLOR_INPUT_BG,
        textAlign: 'center',
        height: 50,
        fontSize: 18,
    },
    scoreInputContent: {
        textAlign: 'center',
        fontWeight: 'bold',
        color: COLOR_TEXT_PRIMARY,
    },
    controlsSection: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
    },
    teamSeg: {
        height: 28,
        width: 90,
    },
    pushButton: {
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 4,
        minWidth: 80,
        alignItems: 'center',
    },

    errorText: {
        color: '#D32F2F',
        textAlign: 'center',
        fontWeight: 'bold',
        marginTop: 8,
    },
    bottomContainer: {
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    inputSpacing: {
        marginBottom: 12,
    }
});
