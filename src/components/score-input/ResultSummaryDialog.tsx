import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { CalculationBreakdown, Player } from '../../types';

interface ResultSummaryDialogProps {
    visible: boolean;
    onDismiss: () => void;
    breakdown: CalculationBreakdown | null;
    teamAPlayers: Player[];
    teamBPlayers: Player[];
    rate: number;
}

export const ResultSummaryDialog: React.FC<ResultSummaryDialogProps> = ({
    visible, onDismiss, breakdown, teamAPlayers, teamBPlayers, rate,
}) => {
    const { t } = useTranslation();
    if (!breakdown) return null;

    const { teamA, teamB, diff, pushMultiplier, carryOverMultiplier, eagleMultiplier, finalMultiplier, finalPoints, isDraw } = breakdown;

    const teamALabel = teamAPlayers.map(p => p.name).join(' & ');
    const teamBLabel = teamBPlayers.map(p => p.name).join(' & ');
    const multiplierParts: string[] = [];
    if (pushMultiplier > 0) multiplierParts.push(`Push+${pushMultiplier}`);
    if (carryOverMultiplier > 0) multiplierParts.push(`CO+${carryOverMultiplier}`);
    if (eagleMultiplier > 0) multiplierParts.push(`Eagle+${eagleMultiplier}`);
    const multiplierExpression =
        multiplierParts.length > 1 ? `(${multiplierParts.join(' ')})` : multiplierParts[0];

    const renderScore = (bd: typeof teamA, label: string) => (
        <View style={styles.teamRow}>
            <Text style={styles.teamLabel}>{label}</Text>
            <Text style={styles.scoreText}>
                {bd.player1Score} + {bd.player2Score} → {bd.combinedRaw}
                {bd.flipped ? ` → 🔄${bd.combinedFinal}` : ''}
            </Text>
        </View>
    );

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss}>
                <Dialog.Title style={{ textAlign: 'center' }}>
                    {isDraw ? t('common.draw') : t('common.holeResult')}
                </Dialog.Title>
                <Dialog.Content>
                    {renderScore(teamA, teamALabel)}
                    {renderScore(teamB, teamBLabel)}

                    <View style={styles.divider} />

                    {isDraw ? (
                        <Text style={styles.drawText}>
                            {t('common.drawNextCO', { rate: carryOverMultiplier === 1 ? 2 : carryOverMultiplier + 2 })}
                        </Text>
                    ) : (
                        <>
                            <Text style={styles.formulaTitle}>{t('common.calculation')}</Text>
                            <Text style={styles.formula}>
                                {`${teamA.combinedFinal} vs ${teamB.combinedFinal}`}
                            </Text>
                            <Text style={styles.formula}>
                                {`差分 ${diff}`}
                                {multiplierExpression ? ` × ${multiplierExpression}` : ''}
                                {` = ×${finalMultiplier}`}
                            </Text>
                            <Text style={styles.points}>
                                {finalPoints}pt × {rate} = {finalPoints * rate}
                            </Text>
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
    teamRow: { marginBottom: 6 },
    teamLabel: { fontSize: 12, color: '#666', fontWeight: 'bold' },
    scoreText: { fontSize: 15, fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
    drawText: { fontSize: 15, textAlign: 'center', color: '#F57F17', fontWeight: 'bold' },
    formulaTitle: { fontSize: 12, color: '#888', marginBottom: 4 },
    formula: { fontSize: 14, color: '#333', marginBottom: 4 },
    points: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 8, color: '#1a1a1a' },
});
