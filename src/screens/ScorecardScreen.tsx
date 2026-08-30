import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScoreBadge } from '../components/scorecard/ScoreBadge';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import { C } from '../theme/colors';
import { useGameStore } from '../store/gameStore';
import { HoleResult, Player, PlayerId } from '../types';

const HOLE_COL_WIDTH = 34;
const SUB_COL_WIDTH = 46;
const LABEL_COL_WIDTH = 84;

const FRONT_HOLES = Array.from({ length: 9 }, (_, i) => i + 1);
const BACK_HOLES = Array.from({ length: 9 }, (_, i) => i + 10);

function HeaderCell({ label, width, tone }: { label: string; width: number; tone?: 'sub' | 'total' }) {
    return (
        <View style={[styles.headerCell, { width }, tone === 'sub' && styles.headerCellSub, tone === 'total' && styles.headerCellTotal]}>
            <Text style={styles.headerCellText}>{label}</Text>
        </View>
    );
}

export const ScorecardScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const { players, history, settings, getPlayerTotalScore } = useGameStore();

    const holeMap = useMemo(() => {
        const map = new Map<number, HoleResult>();
        history.forEach(h => map.set(h.holeNumber, h));
        return map;
    }, [history]);

    const parFor = (holeNumber: number) => holeMap.get(holeNumber)?.par ?? null;
    const sumPars = (holes: number[]) => holes.reduce((sum, n) => sum + (parFor(n) ?? 0), 0);

    const scoreFor = (playerId: PlayerId, holeNumber: number) => {
        const hole = holeMap.get(holeNumber);
        if (!hole) return null;
        return hole.scores[playerId]?.score ?? null;
    };
    const pushedFor = (playerId: PlayerId, holeNumber: number) => {
        const hole = holeMap.get(holeNumber);
        return (hole?.scores[playerId]?.pushCount ?? 0) > 0;
    };
    const sumScores = (playerId: PlayerId, holes: number[]) => {
        const vals = holes.map(n => scoreFor(playerId, n)).filter((v): v is number => v !== null);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
    };

    const realPlayers = players.filter((p: Player) => p.type !== 'bogey_kun');

    return (
        <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
            <ScreenHeader
                title={t('common.scorecard')}
                subtitle={settings.matchName || t('common.untitledMatch')}
                onBack={() => router.back()}
            />

            <ScrollView contentContainerStyle={styles.body}>
                <ScrollView horizontal showsHorizontalScrollIndicator>
                    <View>
                        {/* ヘッダー行 */}
                        <View style={styles.row}>
                            <View style={[styles.labelCell, styles.headerCell]}>
                                <Text style={styles.headerCellText}>{t('common.scorecard')}</Text>
                            </View>
                            {FRONT_HOLES.map(n => <HeaderCell key={n} label={String(n)} width={HOLE_COL_WIDTH} />)}
                            <HeaderCell label={t('common.out')} width={SUB_COL_WIDTH} tone="sub" />
                            {BACK_HOLES.map(n => <HeaderCell key={n} label={String(n)} width={HOLE_COL_WIDTH} />)}
                            <HeaderCell label={t('common.in')} width={SUB_COL_WIDTH} tone="sub" />
                            <HeaderCell label={t('common.total')} width={SUB_COL_WIDTH} tone="total" />
                        </View>

                        {/* Par行 */}
                        <View style={styles.row}>
                            <View style={styles.labelCell}>
                                <Text style={styles.labelTextMuted}>Par</Text>
                            </View>
                            {FRONT_HOLES.map(n => (
                                <View key={n} style={[styles.plainCell, { width: HOLE_COL_WIDTH }]}>
                                    <Text style={styles.plainCellText}>{parFor(n) ?? '—'}</Text>
                                </View>
                            ))}
                            <View style={[styles.plainCell, styles.subCell, { width: SUB_COL_WIDTH }]}>
                                <Text style={styles.plainCellText}>{sumPars(FRONT_HOLES) || '—'}</Text>
                            </View>
                            {BACK_HOLES.map(n => (
                                <View key={n} style={[styles.plainCell, { width: HOLE_COL_WIDTH }]}>
                                    <Text style={styles.plainCellText}>{parFor(n) ?? '—'}</Text>
                                </View>
                            ))}
                            <View style={[styles.plainCell, styles.subCell, { width: SUB_COL_WIDTH }]}>
                                <Text style={styles.plainCellText}>{sumPars(BACK_HOLES) || '—'}</Text>
                            </View>
                            <View style={[styles.plainCell, styles.totalCell, { width: SUB_COL_WIDTH }]}>
                                <Text style={styles.plainCellText}>{sumPars([...FRONT_HOLES, ...BACK_HOLES]) || '—'}</Text>
                            </View>
                        </View>

                        {/* プレイヤー行 */}
                        {realPlayers.map((p, idx) => (
                            <View key={p.id} style={[styles.row, idx % 2 === 1 && styles.rowAlt]}>
                                <View style={styles.labelCell}>
                                    <Text style={styles.labelText} numberOfLines={1}>{p.name}</Text>
                                </View>
                                {FRONT_HOLES.map(n => (
                                    <View key={n} style={{ width: HOLE_COL_WIDTH, alignItems: 'center' }}>
                                        <ScoreBadge score={scoreFor(p.id, n)} par={parFor(n) ?? 4} pushed={pushedFor(p.id, n)} />
                                    </View>
                                ))}
                                <View style={[styles.plainCell, styles.subCell, { width: SUB_COL_WIDTH }]}>
                                    <Text style={styles.subCellText}>{sumScores(p.id, FRONT_HOLES) ?? '—'}</Text>
                                </View>
                                {BACK_HOLES.map(n => (
                                    <View key={n} style={{ width: HOLE_COL_WIDTH, alignItems: 'center' }}>
                                        <ScoreBadge score={scoreFor(p.id, n)} par={parFor(n) ?? 4} pushed={pushedFor(p.id, n)} />
                                    </View>
                                ))}
                                <View style={[styles.plainCell, styles.subCell, { width: SUB_COL_WIDTH }]}>
                                    <Text style={styles.subCellText}>{sumScores(p.id, BACK_HOLES) ?? '—'}</Text>
                                </View>
                                <View style={[styles.plainCell, styles.totalCell, { width: SUB_COL_WIDTH }]}>
                                    <Text style={styles.totalCellText}>{sumScores(p.id, [...FRONT_HOLES, ...BACK_HOLES]) ?? '—'}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>

                {/* 凡例 */}
                <View style={styles.legendRow}>
                    <LegendItem symbol="birdie" label={t('common.birdie')} />
                    <LegendItem symbol="eagle" label={t('common.eagleOrBetter')} />
                    <LegendItem symbol="bogey" label={t('common.bogey')} />
                    <LegendItem symbol="double" label={t('common.doubleBogeyOrWorse')} />
                    <Text style={styles.legendPush}>{t('common.pushLegend')}</Text>
                </View>

                {/* ホール別ポイント内訳 */}
                <Text style={styles.sectionTitle}>{t('common.holeByHoleBreakdown')}</Text>
                <View style={styles.pointsTable}>
                    <ScrollView horizontal>
                        <View>
                            <View style={styles.pointsHeaderRow}>
                                <Text style={[styles.pointsHeaderText, { width: 32 }]}>H</Text>
                                <Text style={[styles.pointsHeaderText, { width: 40 }]}>×</Text>
                                {realPlayers.map(p => (
                                    <Text key={p.id} style={[styles.pointsHeaderText, { width: 70 }]} numberOfLines={1}>{p.name}</Text>
                                ))}
                            </View>
                            {history.map(h => (
                                <View key={h.holeNumber} style={styles.pointsRow}>
                                    <Text style={[styles.pointsCellText, { width: 32 }]}>{h.holeNumber}</Text>
                                    <Text style={[styles.pointsCellText, { width: 40 }]}>×{h.appliedMultiplier}</Text>
                                    {realPlayers.map(p => {
                                        const pts = h.pointsResult[p.id] ?? 0;
                                        const color = pts > 0 ? C.greenDeep : pts < 0 ? C.coralDeep : C.ink4;
                                        return (
                                            <Text key={p.id} style={[styles.pointsCellText, { width: 70, color, fontWeight: '700' }]}>
                                                {pts > 0 ? `+${pts}` : pts}
                                            </Text>
                                        );
                                    })}
                                </View>
                            ))}
                            <View style={[styles.pointsRow, styles.pointsTotalRow]}>
                                <Text style={[styles.pointsCellText, { width: 32, fontWeight: '700' }]}>計</Text>
                                <Text style={[styles.pointsCellText, { width: 40 }]}>{''}</Text>
                                {realPlayers.map(p => {
                                    const total = getPlayerTotalScore(p.id);
                                    const yen = total * settings.rate;
                                    const color = total > 0 ? C.greenDeep : total < 0 ? C.coralDeep : C.ink3;
                                    return (
                                        <View key={p.id} style={{ width: 70 }}>
                                            <Text style={[styles.pointsCellText, { color, fontWeight: '700' }]}>
                                                {total > 0 ? `+${total}` : total}pt
                                            </Text>
                                            <Text style={[styles.pointsCellSub, { color }]}>{yen.toLocaleString()}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

function LegendItem({ symbol, label }: { symbol: 'birdie' | 'eagle' | 'bogey' | 'double'; label: string }) {
    return (
        <View style={styles.legendItem}>
            <ScoreBadge score={symbol === 'birdie' ? 3 : symbol === 'eagle' ? 2 : symbol === 'bogey' ? 5 : 6} par={4} />
            <Text style={styles.legendText}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    body: { paddingBottom: 40 },
    row: { flexDirection: 'row', alignItems: 'center', height: 40 },
    rowAlt: { backgroundColor: C.surface2 },
    labelCell: { width: LABEL_COL_WIDTH, paddingLeft: 10, justifyContent: 'center' },
    labelText: { fontSize: 12, fontWeight: '700', color: C.ink2 },
    labelTextMuted: { fontSize: 12, fontWeight: '600', color: C.ink3 },
    headerCell: {
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.greenPrimary,
    },
    headerCellSub: { backgroundColor: C.greenDeep },
    headerCellTotal: { backgroundColor: C.dark },
    headerCellText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    plainCell: { alignItems: 'center', justifyContent: 'center' },
    plainCellText: { fontSize: 12, color: C.ink3, fontVariant: ['tabular-nums'] },
    subCell: { backgroundColor: C.surface2 },
    subCellText: { fontSize: 13, fontWeight: '700', color: C.ink2, fontVariant: ['tabular-nums'] },
    totalCell: { backgroundColor: C.line2 },
    totalCellText: { fontSize: 13, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendText: { fontSize: 11, color: C.ink3, fontWeight: '600' },
    legendPush: { fontSize: 11, color: C.sky, fontWeight: '700' },
    sectionTitle: { fontSize: 12, fontWeight: '700', color: C.ink3, letterSpacing: 1, paddingHorizontal: 16, marginBottom: 8, marginTop: 4 },
    pointsTable: { marginHorizontal: 16, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
    pointsHeaderRow: { flexDirection: 'row', backgroundColor: C.surface2, paddingVertical: 8 },
    pointsHeaderText: { fontSize: 10, fontWeight: '700', color: C.ink3, textAlign: 'center' },
    pointsRow: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line2 },
    pointsCellText: { fontSize: 12, color: C.ink2, textAlign: 'center', fontVariant: ['tabular-nums'] },
    pointsCellSub: { fontSize: 10, textAlign: 'center', fontVariant: ['tabular-nums'] },
    pointsTotalRow: { backgroundColor: C.surface2 },
});
