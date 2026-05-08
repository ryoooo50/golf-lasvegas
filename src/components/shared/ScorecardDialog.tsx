import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native';
import { Button, DataTable, Dialog, Portal, Text } from 'react-native-paper';
import { C } from '../../theme/colors';
import { HoleResult, Player, PlayerId } from '../../types';

interface ScorecardDialogProps {
    visible: boolean;
    onDismiss: () => void;
    history: HoleResult[];
    players: Player[];
    getPlayerTotalScore: (id: PlayerId) => number;
    rate: number;
}

export const ScorecardDialog: React.FC<ScorecardDialogProps> = ({
    visible, onDismiss, history, players, getPlayerTotalScore, rate
}) => {
    const { t } = useTranslation();

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: '80%' }}>
                <Dialog.Title>{t('common.scorecard')}</Dialog.Title>
                <Dialog.ScrollArea>
                    <ScrollView horizontal>
                        <ScrollView>
                            <DataTable>
                                <DataTable.Header>
                                    <DataTable.Title style={{ width: 40 }}>H</DataTable.Title>
                                    <DataTable.Title style={{ width: 40 }}>P</DataTable.Title>
                                    <DataTable.Title style={{ width: 40 }}>×</DataTable.Title>
                                    {players.map(p => (
                                        <DataTable.Title key={p.id} style={{ width: 90 }} numeric>{p.name}</DataTable.Title>
                                    ))}
                                </DataTable.Header>

                                {history.map((h, i) => (
                                    <DataTable.Row key={i}>
                                        <DataTable.Cell style={{ width: 40 }}>{h.holeNumber}</DataTable.Cell>
                                        <DataTable.Cell style={{ width: 40 }}>{h.par}</DataTable.Cell>
                                        <DataTable.Cell style={{ width: 40 }}>×{h.appliedMultiplier}</DataTable.Cell>
                                        {players.map(p => {
                                            const pts = h.pointsResult[p.id];
                                            const bd = h.breakdown;
                                            const isTeamA = h.teamA_Ids.includes(p.id);
                                            const teamBd = isTeamA ? bd?.teamA : bd?.teamB;
                                            const scoreDisplay = teamBd?.flipped
                                                ? `${teamBd.combinedRaw}→${teamBd.combinedFinal}`
                                                : (h.scores[p.id]?.score ?? '');
                                            return (
                                                <DataTable.Cell key={p.id} style={{ width: 90 }} numeric>
                                                    {scoreDisplay}{pts !== 0 ? ` (${pts > 0 ? '+' : ''}${pts})` : ''}
                                                </DataTable.Cell>
                                            );
                                        })}
                                    </DataTable.Row>
                                ))}

                                {history.length > 0 && (
                                    <DataTable.Row>
                                        <DataTable.Cell style={{ width: 40 }}>計</DataTable.Cell>
                                        <DataTable.Cell style={{ width: 40 }}>{''}</DataTable.Cell>
                                        <DataTable.Cell style={{ width: 40 }}>{''}</DataTable.Cell>
                                        {players.map(p => {
                                            const total = getPlayerTotalScore(p.id);
                                            const yen = total * rate;
                                            const ptColor = total > 0 ? C.greenDeep : total < 0 ? C.coralDeep : C.ink3;
                                            const yenColor = yen > 0 ? C.greenPrimary : yen < 0 ? C.coralPrimary : C.ink3;
                                            return (
                                                <DataTable.Cell key={p.id} style={{ width: 90 }} numeric>
                                                    <View style={styles.totalCell}>
                                                        <Text style={[styles.totalPt, { color: ptColor }]}>
                                                            {total > 0 ? `+${total}` : `${total}`}pt
                                                        </Text>
                                                        <Text style={[styles.totalYen, { color: yenColor }]}>
                                                            ¥{yen.toLocaleString()}
                                                        </Text>
                                                    </View>
                                                </DataTable.Cell>
                                            );
                                        })}
                                    </DataTable.Row>
                                )}
                            </DataTable>
                        </ScrollView>
                    </ScrollView>
                </Dialog.ScrollArea>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>{t('common.close')}</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

const styles = StyleSheet.create({
    totalCell: { alignItems: 'flex-end' },
    totalPt: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
    totalYen: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
