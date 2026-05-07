import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { C } from '../../theme/colors';
import { LivePreviewResult } from '../../utils/golfLogic';

interface LivePreviewPanelProps {
    preview: LivePreviewResult;
    teamANames: string;
    teamBNames: string;
}

export function LivePreviewPanel({ preview, teamANames, teamBNames }: LivePreviewPanelProps) {
    const { t } = useTranslation();

    if (!preview.isComplete) return null;

    const {
        winnerTeam, diff, pushMultiplier, carryOverMultiplier, eagleMultiplier,
        finalMultiplier, estimatedPoints,
        teamAFlipped, teamBFlipped, teamAFinalScore, teamBFinalScore,
    } = preview;

    const isDraw = winnerTeam === 'draw';
    const winnerColor = winnerTeam === 'A' ? C.greenPrimary : C.coralPrimary;

    return (
        <View style={styles.card}>
            {/* スコア比較行 */}
            <View style={styles.compareRow}>
                <View style={styles.teamScore}>
                    <Text style={styles.teamLabel}>A {teamAFlipped ? '· FLIP' : ''}</Text>
                    <Text style={[styles.teamNum, { color: C.greenDeep }]}>{teamAFinalScore}</Text>
                </View>
                <Text style={styles.vs}>{isDraw ? '=' : winnerTeam === 'A' ? '<' : '>'}</Text>
                <View style={styles.teamScore}>
                    <Text style={styles.teamLabel}>B {teamBFlipped ? '· FLIP' : ''}</Text>
                    <Text style={[styles.teamNum, { color: C.coralDeep }]}>{teamBFinalScore}</Text>
                </View>
            </View>

            {/* 倍率ピル行 */}
            <View style={styles.pillRow}>
                <View style={styles.pillGhost}>
                    <Text style={styles.pillGhostText}>差 {diff}</Text>
                </View>
                {pushMultiplier > 0 && (
                    <View style={styles.pillSky}>
                        <Text style={styles.pillSkyText}>{t('common.pushMult', { n: pushMultiplier })}</Text>
                    </View>
                )}
                {carryOverMultiplier > 0 && (
                    <View style={styles.pillGold}>
                        <Text style={styles.pillGoldText}>{t('common.carryMult', { n: carryOverMultiplier })}</Text>
                    </View>
                )}
                {eagleMultiplier > 0 && (
                    <View style={styles.pillGold}>
                        <Text style={styles.pillGoldText}>🦅 +{eagleMultiplier}</Text>
                    </View>
                )}
                <View style={styles.pillInk}>
                    <Text style={styles.pillInkText}>×{finalMultiplier}</Text>
                </View>
            </View>

            {/* 結果行 */}
            <View style={styles.resultRow}>
                {isDraw ? (
                    <View style={{ flex: 1 }}>
                        <Text style={styles.drawLabel}>{t('common.draw')}</Text>
                        <Text style={styles.drawSub}>{t('common.nextCarryOver', { rate: pushMultiplier + carryOverMultiplier + eagleMultiplier + 2 })}</Text>
                    </View>
                ) : (
                    <>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.winnerLabel, { color: C.ink3 }]}>
                                {`TEAM ${winnerTeam} ${t('common.wins')}`}
                            </Text>
                            <Text style={[styles.points, { color: winnerColor }]}>
                                +{estimatedPoints}
                                <Text style={styles.ptUnit}>pt</Text>
                            </Text>
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginVertical: 8,
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.line,
        padding: 14,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    teamScore: { alignItems: 'center', gap: 2 },
    teamLabel: { fontSize: 10, color: C.ink3, fontWeight: '700', letterSpacing: 0.8 },
    teamNum: { fontSize: 28, fontWeight: '700', lineHeight: 32, fontVariant: ['tabular-nums'] },
    vs: { fontSize: 16, color: C.ink4, fontWeight: '700' },

    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pillGhost: {
        backgroundColor: C.line2,
        borderRadius: 99,
        paddingHorizontal: 9,
        paddingVertical: 3,
    },
    pillGhostText: { fontSize: 11, fontWeight: '700', color: C.ink3, fontVariant: ['tabular-nums'] },
    pillSky: {
        backgroundColor: C.skyTint,
        borderRadius: 99,
        paddingHorizontal: 9,
        paddingVertical: 3,
    },
    pillSkyText: { fontSize: 11, fontWeight: '700', color: C.sky },
    pillGold: {
        backgroundColor: C.goldTint,
        borderRadius: 99,
        paddingHorizontal: 9,
        paddingVertical: 3,
    },
    pillGoldText: { fontSize: 11, fontWeight: '700', color: C.gold },
    pillInk: {
        backgroundColor: C.ink,
        borderRadius: 99,
        paddingHorizontal: 9,
        paddingVertical: 3,
    },
    pillInkText: { fontSize: 11, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },

    resultRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: C.line2,
    },
    winnerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
    points: { fontSize: 32, fontWeight: '700', lineHeight: 36, fontVariant: ['tabular-nums'] },
    ptUnit: { fontSize: 14, fontWeight: '600', color: C.ink3 },
    drawLabel: { fontSize: 16, fontWeight: '700', color: '#c08000' },
    drawSub: { fontSize: 12, color: C.ink3, marginTop: 2 },
});
