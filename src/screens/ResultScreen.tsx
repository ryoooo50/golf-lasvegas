import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, DataTable, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';

export const ResultScreen = () => {
    const theme = useTheme();
    const { t } = useTranslation();
    const { players, getPlayerTotalScore, settings, history, resetGame } = useGameStore();

    const getPlayerTotalStrokes = (id: string) => {
        return history.reduce((sum, h) => sum + (h.scores[id]?.score || 0), 0);
    };

    const handleNewGame = () => {
        resetGame();
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.headerTitle}>{t('common.result') || 'Result'}</Text>
                <Text variant="titleMedium" style={styles.subTitle}>{settings.matchName || 'Match Result'}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <DataTable>
                        <DataTable.Header>
                            <DataTable.Title style={{ flex: 2 }}>Player</DataTable.Title>
                            <DataTable.Title numeric>Score</DataTable.Title>
                            <DataTable.Title numeric>Points</DataTable.Title>
                            <DataTable.Title numeric>Money</DataTable.Title>
                        </DataTable.Header>

                        {players.map(p => {
                            const strokes = getPlayerTotalStrokes(p.id);
                            const points = getPlayerTotalScore(p.id);
                            const money = points * settings.rate;

                            const moneyColor = money >= 0 ? '#2E7D32' : '#C62828';
                            const pointsColor = points >= 0 ? '#1565C0' : '#C62828';

                            return (
                                <DataTable.Row key={p.id}>
                                    <DataTable.Cell style={{ flex: 2 }}>{p.name}</DataTable.Cell>
                                    <DataTable.Cell numeric>{strokes}</DataTable.Cell>
                                    <DataTable.Cell numeric>
                                        <Text style={{ color: pointsColor, fontWeight: 'bold' }}>
                                            {points > 0 ? '+' : ''}{points}
                                        </Text>
                                    </DataTable.Cell>
                                    <DataTable.Cell numeric>
                                        <Text style={{ color: moneyColor, fontWeight: 'bold' }}>
                                            {money > 0 ? '+' : ''}{money.toLocaleString()}
                                        </Text>
                                    </DataTable.Cell>
                                </DataTable.Row>
                            );
                        })}
                    </DataTable>
                </View>

                <Button
                    mode="contained"
                    onPress={handleNewGame}
                    style={styles.button}
                    contentStyle={{ height: 50 }}
                >
                    {t('common.newGame') || 'New Game'}
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        padding: 20,
        backgroundColor: '#212121',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
    subTitle: {
        color: '#cccccc',
        marginTop: 4,
    },
    content: {
        padding: 16,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 8,
        elevation: 2,
        padding: 8,
    },
    button: {
        marginTop: 20,
    }
});
