import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Divider, Portal, Text } from 'react-native-paper';
import { RoundResult } from '../../types';

interface HistoryDialogProps {
    visible: boolean;
    onDismiss: () => void;
    savedRounds: RoundResult[];
    onResume?: (roundId: string) => void;
}

export const HistoryDialog: React.FC<HistoryDialogProps> = ({ visible, onDismiss, savedRounds, onResume }) => {
    const { t } = useTranslation();

    const handleResume = (roundId: string) => {
        onResume?.(roundId);
        onDismiss();
    };

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
                <Dialog.Title>{t('common.historyTitle')}</Dialog.Title>
                <Dialog.ScrollArea style={styles.scrollArea}>
                    <ScrollView>
                        {savedRounds.length === 0 ? (
                            <Text style={styles.empty}>{t('common.noHistory')}</Text>
                        ) : (
                            savedRounds.map((r, index) => (
                                <View key={r.id}>
                                    <View style={styles.roundCard}>
                                        <View style={styles.roundInfo}>
                                            <Text style={styles.roundName}>{r.name || t('common.untitledMatch')}</Text>
                                            <Text style={styles.roundDate}>{new Date(r.date).toLocaleString()}</Text>
                                            <Text style={styles.roundHoles}>
                                                {r.history.length}{t('common.holesPlayed')}
                                            </Text>
                                            <Text style={styles.roundScores}>
                                                {r.players.map(p => {
                                                    const pts = r.finalScores[p.id] ?? 0;
                                                    return `${p.name}: ${pts > 0 ? '+' : ''}${pts}`;
                                                }).join('  ')}
                                            </Text>
                                        </View>
                                        {onResume && (
                                            <Button
                                                mode="contained"
                                                compact
                                                onPress={() => handleResume(r.id)}
                                                style={styles.resumeButton}
                                                labelStyle={styles.resumeLabel}
                                                buttonColor="#3730A3"
                                            >
                                                {t('common.resume')}
                                            </Button>
                                        )}
                                    </View>
                                    {index < savedRounds.length - 1 && <Divider />}
                                </View>
                            ))
                        )}
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
    dialog: { maxHeight: '85%' },
    scrollArea: { paddingHorizontal: 0 },
    empty: { padding: 20, textAlign: 'center', color: '#888' },
    roundCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 8,
    },
    roundInfo: { flex: 1 },
    roundName: { fontWeight: 'bold', fontSize: 15, marginBottom: 2 },
    roundDate: { fontSize: 11, color: '#888', marginBottom: 2 },
    roundHoles: { fontSize: 11, color: '#666', marginBottom: 4 },
    roundScores: { fontSize: 12, color: '#333' },
    resumeButton: { borderRadius: 8 },
    resumeLabel: { fontSize: 12 },
});
