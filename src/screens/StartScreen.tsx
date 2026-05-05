import { Image } from 'expo-image';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, RadioButton, Switch, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlayerNamesForm } from '../components/shared/PlayerNamesForm';
import { HistoryDialog } from '../components/shared/HistoryDialog';
import { useGameStore } from '../store/gameStore';
import { Player } from '../types';

const BG_IMAGE = require('../../assets/images/icon.png');

const DEFAULT_PLAYER_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

export const StartScreen = () => {
    const { startGame, updateSettings, updatePlayerName, settings, players, savedRounds, resumeRound } =
        useGameStore();
    const { t } = useTranslation();

    // Form state
    const [matchName, setMatchName] = useState(settings.matchName ?? '');
    const [rate, setRate] = useState((settings.rate ?? 10).toString());
    const [playerCount, setPlayerCount] = useState<3 | 4>(4);
    const [pushLimit, setPushLimit] = useState(settings.maxPushCountPerHalf ?? 2);
    const [birdyPushRecovery, setBirdyPushRecovery] = useState(false);
    const [startCourse, setStartCourse] = useState<'OUT' | 'IN'>('OUT');
    const [playerNames, setPlayerNames] = useState<string[]>([
        players[0]?.name ?? DEFAULT_PLAYER_NAMES[0],
        players[1]?.name ?? DEFAULT_PLAYER_NAMES[1],
        players[2]?.name ?? DEFAULT_PLAYER_NAMES[2],
        players[3]?.name ?? DEFAULT_PLAYER_NAMES[3],
    ]);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);

    const handlePlayerNameChange = (index: number, value: string) => {
        setPlayerNames((prev) => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
    };

    const buildPlayers = (): Player[] => {
        const base: Player[] = Array.from({ length: 4 }, (_, i) => ({
            id: `p${i + 1}`,
            name: playerNames[i] || DEFAULT_PLAYER_NAMES[i],
            type: 'real' as const,
            pushUsageCount: { front9: 0, back9: 0 },
        }));

        if (playerCount === 3) {
            base[3] = {
                id: 'p4',
                name: 'ボギーくん',
                type: 'bogey_kun',
                pushUsageCount: { front9: 0, back9: 0 },
            };
        }

        return base;
    };

    const handleStart = () => {
        const parsedRate = parseInt(rate, 10);

        updateSettings({
            matchName,
            rate: isNaN(parsedRate) ? 10 : parsedRate,
            maxPushCountPerHalf: pushLimit,
        });

        // Apply player names directly via store
        const newPlayers = buildPlayers();
        newPlayers.forEach((p, i) => {
            if (players[i]) {
                updatePlayerName(players[i].id, p.name);
            }
        });

        const startHole = startCourse === 'OUT' ? 1 : 10;
        startGame(startHole);
    };

    const decrementPushLimit = () => setPushLimit((v) => Math.max(0, v - 1));
    const incrementPushLimit = () => setPushLimit((v) => Math.min(5, v + 1));

    return (
        <View style={styles.container}>
            <Image source={BG_IMAGE} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            <View style={styles.overlay} />

            <SafeAreaView style={styles.safeArea}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.title}>Las Vegas Golf</Text>
                    <Text style={styles.subtitle}>Ultimate Golf Game Calculator</Text>

                    <View style={styles.card}>
                        {/* Match Name */}
                        <TextInput
                            label={t('common.matchName')}
                            value={matchName}
                            onChangeText={setMatchName}
                            style={styles.input}
                            mode="outlined"
                            accessibilityLabel={t('common.matchName')}
                        />

                        {/* Rate — no currency symbol */}
                        <TextInput
                            label={t('setup.rateLabel')}
                            value={rate}
                            onChangeText={setRate}
                            keyboardType="numeric"
                            style={styles.input}
                            mode="outlined"
                            accessibilityLabel={t('setup.rateLabel')}
                        />

                        {/* Player Count */}
                        <Text style={styles.fieldLabel}>{t('setup.playerCount')}</Text>
                        <View style={styles.row}>
                            <RadioButton.Group
                                onValueChange={(v) => setPlayerCount(Number(v) as 3 | 4)}
                                value={playerCount.toString()}
                            >
                                <View style={styles.radioRow}>
                                    <RadioButton.Item
                                        label="3"
                                        value="3"
                                        style={styles.radioItem}
                                        labelStyle={styles.radioLabel}
                                    />
                                    <RadioButton.Item
                                        label="4"
                                        value="4"
                                        style={styles.radioItem}
                                        labelStyle={styles.radioLabel}
                                    />
                                </View>
                            </RadioButton.Group>
                        </View>

                        {/* Push Limit */}
                        <Text style={styles.fieldLabel}>{t('setup.pushLimitLabel')}</Text>
                        <View style={styles.stepperRow}>
                            <Button
                                mode="outlined"
                                compact
                                onPress={decrementPushLimit}
                                style={styles.stepperBtn}
                                accessibilityLabel="プッシュ上限を減らす"
                            >
                                −
                            </Button>
                            <Text style={styles.stepperValue}>{pushLimit}</Text>
                            <Button
                                mode="outlined"
                                compact
                                onPress={incrementPushLimit}
                                style={styles.stepperBtn}
                                accessibilityLabel="プッシュ上限を増やす"
                            >
                                ＋
                            </Button>
                        </View>

                        {/* Birdy Push Recovery */}
                        <View style={styles.toggleRow}>
                            <Text style={styles.toggleLabel}>{t('setup.birdyPushRecovery')}</Text>
                            <Switch
                                value={birdyPushRecovery}
                                onValueChange={setBirdyPushRecovery}
                                accessibilityLabel={t('setup.birdyPushRecovery')}
                            />
                        </View>

                        {/* Player Names */}
                        <PlayerNamesForm
                            names={playerNames}
                            playerCount={playerCount}
                            onChange={handlePlayerNameChange}
                        />

                        {/* Start Course */}
                        <Text style={styles.fieldLabel}>{t('setup.startCourseLabel')}</Text>
                        <RadioButton.Group
                            onValueChange={(v) => setStartCourse(v as 'OUT' | 'IN')}
                            value={startCourse}
                        >
                            <View style={styles.radioRow}>
                                <RadioButton.Item
                                    label={t('common.out')}
                                    value="OUT"
                                    style={styles.radioItem}
                                    labelStyle={styles.radioLabel}
                                />
                                <RadioButton.Item
                                    label={t('common.in')}
                                    value="IN"
                                    style={styles.radioItem}
                                    labelStyle={styles.radioLabel}
                                />
                            </View>
                        </RadioButton.Group>

                        {/* Start Button */}
                        <Button
                            mode="contained"
                            onPress={handleStart}
                            style={styles.startButton}
                            contentStyle={styles.startContent}
                            labelStyle={styles.startLabel}
                            buttonColor="#4CAF50"
                            accessibilityLabel={t('common.startGame')}
                        >
                            {t('common.startGame')}
                        </Button>
                    </View>

                    {/* History */}
                    <Button
                        mode="contained-tonal"
                        icon="history"
                        style={styles.historyButton}
                        onPress={() => setIsHistoryVisible(true)}
                    >
                        {t('common.viewHistory')}
                    </Button>
                </ScrollView>

                <Text style={styles.footer}>© 2024 Golf LasVegas</Text>
            </SafeAreaView>

            <HistoryDialog
                visible={isHistoryVisible}
                onDismiss={() => setIsHistoryVisible(false)}
                savedRounds={savedRounds}
                onResume={(roundId) => resumeRound(roundId)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    safeArea: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 },
    title: { fontSize: 44, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: 2, marginBottom: 6, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
    subtitle: { fontSize: 16, color: '#ddd', marginBottom: 24, fontWeight: '300', textAlign: 'center' },
    card: { backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 16, padding: 20, gap: 4 },
    input: { marginBottom: 8 },
    fieldLabel: { color: '#ccc', fontSize: 13, marginTop: 8, marginBottom: 2 },
    row: { flexDirection: 'row', alignItems: 'center' },
    radioRow: { flexDirection: 'row' },
    radioItem: { flex: 1 },
    radioLabel: { color: '#eee' },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 8 },
    stepperBtn: { minWidth: 48 },
    stepperValue: { color: '#fff', fontSize: 22, fontWeight: 'bold', width: 32, textAlign: 'center' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
    toggleLabel: { color: '#eee', fontSize: 14, flex: 1 },
    startButton: { marginTop: 20, borderRadius: 30 },
    startContent: { height: 56 },
    startLabel: { fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
    historyButton: { marginTop: 16, borderRadius: 12 },
    footer: { color: '#666', textAlign: 'center', marginBottom: 20, fontSize: 12 },
});
