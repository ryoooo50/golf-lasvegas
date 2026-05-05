import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { Button, DataTable, Dialog, Portal } from 'react-native-paper';
import { HoleResult, Player, PlayerId } from '../../types';

interface ScorecardDialogProps {
    visible: boolean;
    onDismiss: () => void;
    history: HoleResult[];
    players: Player[];
    getPlayerTotalScore: (id: PlayerId) => number;
}

export const ScorecardDialog: React.FC<ScorecardDialogProps> = ({
    visible, onDismiss, history, players, getPlayerTotalScore
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
                                        {players.map(p => (
                                            <DataTable.Cell key={p.id} style={{ width: 90 }} numeric>
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
                    <Button onPress={onDismiss}>{t('common.close')}</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};
