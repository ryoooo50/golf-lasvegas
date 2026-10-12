import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { C } from '../../theme/colors';
import { HoleResult, Player, PlayerId, TeamScoreBreakdown } from '../../types';

interface ResultSummaryDialogProps {
    visible: boolean;
    onDismiss: () => void;
    /** 確定したホールの結果。チーム構成もこのホールのもの（teamA_Ids / teamB_Ids）を使う */
    result: HoleResult | null;
    players: Player[];
    rate: number;
}

export const ResultSummaryDialog: React.FC<ResultSummaryDialogProps> = ({
    visible, onDismiss, result, players, rate,
}) => {
    const { t } = useTranslation();
    if (!result) return null;

    const { breakdown, teamA_Ids, teamB_Ids, pointsResult, nextHoleMultiplier } = result;
    const { teamA, teamB, diff, pushMultiplier, carryOverMultiplier, eagleMultiplier, finalMultiplier, isDraw } = breakdown;

    const nameOf = (id: PlayerId) => players.find(p => p.id === id)?.name ?? id;
    const teamALabel = teamA_Ids.map(nameOf).join(' & ');
    const teamBLabel = teamB_Ids.map(nameOf).join(' & ');
    const winnerLabel = teamA.combinedFinal < teamB.combinedFinal ? teamALabel : teamBLabel;

    const multiplierParts: string[] = [];
    if (pushMultiplier > 0) multiplierParts.push(`Push ${pushMultiplier}`);
    if (carryOverMultiplier > 0) multiplierParts.push(`CO ${carryOverMultiplier}`);
    if (eagleMultiplier > 0) multiplierParts.push(`Eagle ${eagleMultiplier}`);
    const multiplierDetail = multiplierParts.length > 0 ? ` (${multiplierParts.join(' + ')})` : '';

    const renderTeam = (bd: TeamScoreBreakdown, ids: [PlayerId, PlayerId], label: string) => (
        <View style={styles.teamRow}>
            <Text style={styles.teamLabel}>{label}</Text>
            <Text style={styles.scoreText}>
                {`${nameOf(ids[0])} ${bd.player1Score} / ${nameOf(ids[1])} ${bd.player2Score} → ${bd.combinedRaw}`}
                {bd.flipped ? ` → ${bd.combinedFinal} (${t('common.flipped')})` : ''}
            </Text>
        </View>
    );

    const pointRows = [...teamA_Ids, ...teamB_Ids].map(id => {
        const points = pointsResult[id] ?? 0;
        return (
            <View key={id} style={styles.pointRow}>
                <Text style={styles.pointName}>{nameOf(id)}</Text>
                <Text style={styles.pointValue}>
                    {`${points > 0 ? '+' : ''}${points}pt (${points * rate})`}
                </Text>
            </View>
        );
    });

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
                <Dialog.Title style={styles.dialogTitle}>
                    {isDraw ? t('common.draw') : `${winnerLabel} ${t('common.wins')}`}
                </Dialog.Title>
                <Dialog.Content>
                    {renderTeam(teamA, teamA_Ids, 'TEAM A')}
                    {renderTeam(teamB, teamB_Ids, 'TEAM B')}

                    <View style={styles.divider} />

                    {isDraw ? (
                        <Text style={styles.drawText}>
                            {t('common.drawNextCO', { rate: nextHoleMultiplier })}
                        </Text>
                    ) : (
                        <>
                            <Text style={styles.formulaTitle}>{t('common.calculation')}</Text>
                            <Text style={styles.formula}>
                                {`${teamA.combinedFinal} vs ${teamB.combinedFinal} → ${t('common.diffLabel')} ${diff}`}
                            </Text>
                            <Text style={styles.formula}>
                                {`${diff} × ${finalMultiplier}${multiplierDetail} = ${diff * finalMultiplier}pt`}
                            </Text>
                            <View style={styles.pointList}>{pointRows}</View>
                        </>
                    )}
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>{t('common.ok')}</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

const styles = StyleSheet.create({
    dialog: { backgroundColor: C.surface },
    dialogTitle: { textAlign: 'center', color: C.ink },
    teamRow: { marginBottom: 6 },
    teamLabel: { fontSize: 12, color: C.ink3, fontWeight: 'bold' },
    scoreText: { fontSize: 15, fontWeight: 'bold', color: C.ink },
    divider: { height: 1, backgroundColor: C.line, marginVertical: 12 },
    drawText: { fontSize: 15, textAlign: 'center', color: C.ink2, fontWeight: 'bold' },
    formulaTitle: { fontSize: 12, color: C.ink4, marginBottom: 4 },
    formula: { fontSize: 14, color: C.ink2, marginBottom: 4 },
    pointList: { marginTop: 8, gap: 4 },
    pointRow: { flexDirection: 'row', justifyContent: 'space-between' },
    pointName: { fontSize: 14, color: C.ink },
    pointValue: { fontSize: 14, fontWeight: 'bold', color: C.ink },
});
