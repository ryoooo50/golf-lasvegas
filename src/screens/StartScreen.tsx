import { Image } from 'expo-image'; // Use expo-image for better performance
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Dialog, Portal, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';

export const StartScreen = () => {
    const { startGame, updateSettings, settings, savedRounds } = useGameStore();
    const { t } = useTranslation();
    const theme = useTheme();

    // Background Image
    const BG_IMAGE_URL = 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?q=80&w=2070&auto=format&fit=crop';

    const [isHistoryVisible, setIsHistoryVisible] = React.useState(false);
    const [isSettingsVisible, setIsSettingsVisible] = React.useState(false);
    const [editRate, setEditRate] = React.useState(settings.rate.toString());
    const [editPushLimit, setEditPushLimit] = React.useState(settings.maxPushCountPerHalf.toString());

    const handleSaveSettings = () => {
        const rate = parseInt(editRate, 10) || settings.rate;
        const pushLimit = parseInt(editPushLimit, 10) || settings.maxPushCountPerHalf;
        updateSettings({ rate, maxPushCountPerHalf: pushLimit });
        setIsSettingsVisible(false);
    };

    return (
        <View style={styles.container}>
            <Image
                source={{ uri: BG_IMAGE_URL }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
            />
            {/* Overlay for better text visibility */}
            <View style={styles.overlay} />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    {/* Maybe lang toggle if needed */}
                </View>

                <View style={styles.content}>
                    <Text style={styles.title}>Las Vegas Golf</Text>
                    <Text style={styles.subtitle}>Ultimate Golf Game Calculator</Text>

                    <View style={styles.spacer} />

                    <Button
                        mode="contained"
                        style={styles.mainButton}
                        contentStyle={styles.btnContent}
                        labelStyle={styles.btnLabel}
                        onPress={() => startGame(1)} // Default start hole, logic might trigger setup modal in InputScreen? 
                    // Actually startGame(1) sets hole to 1. InputScreen does checks.
                    // Wait, InputScreen shows Setup Modal if history is empty.
                    // So calling startGame here transitions to 'playing', rendering InputScreen.
                    // InputScreen then checks hole=1 & no history -> Shows Setup.
                    >
                        START
                    </Button>

                    <View style={styles.row}>
                        <Button
                            mode="contained-tonal"
                            icon="history"
                            style={styles.subButton}
                            onPress={() => setIsHistoryVisible(true)}
                        >
                            {t('common.viewHistory') || 'HISTORY'}
                        </Button>

                        <Button
                            mode="contained-tonal"
                            icon="cog"
                            style={styles.subButton}
                            onPress={() => {
                                setEditRate(settings.rate.toString());
                                setEditPushLimit(settings.maxPushCountPerHalf.toString());
                                setIsSettingsVisible(true);
                            }}
                        >
                            {t('common.settings') || 'SETTINGS'}
                        </Button>
                    </View>
                </View>

                <Text style={styles.footer}>© 2024 Golf LasVegas</Text>
            </SafeAreaView>

            {/* Modals */}
            <Portal>
                {/* History */}
                <Dialog visible={isHistoryVisible} onDismiss={() => setIsHistoryVisible(false)} style={{ maxHeight: '80%' }}>
                    <Dialog.Title>{t('common.historyTitle')}</Dialog.Title>
                    <Dialog.ScrollArea>
                        <ScrollView>
                            {savedRounds.length === 0 ? (
                                <Text style={{ padding: 20, textAlign: 'center' }}>{t('common.noHistory')}</Text>
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

                {/* Settings */}
                <Dialog visible={isSettingsVisible} onDismiss={() => setIsSettingsVisible(false)}>
                    <Dialog.Title>{t('common.settings')}</Dialog.Title>
                    <Dialog.Content>
                        <TextInput label={t('common.rate')} value={editRate} onChangeText={setEditRate} keyboardType="numeric" style={{ marginBottom: 15 }} />
                        <TextInput label={t('common.pushLimit')} value={editPushLimit} onChangeText={setEditPushLimit} keyboardType="numeric" />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setIsSettingsVisible(false)}>Cancel</Button>
                        <Button onPress={handleSaveSettings}>Save</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    safeArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        position: 'absolute',
        top: 50,
        right: 20,
    },
    content: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 30,
        justifyContent: 'center',
        flex: 1,
    },
    title: {
        fontSize: 48,
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        letterSpacing: 2,
        marginBottom: 10,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    subtitle: {
        fontSize: 18,
        color: '#ddd',
        marginBottom: 50,
        fontWeight: '300',
    },
    spacer: {
        height: 60,
    },
    mainButton: {
        width: '100%',
        marginBottom: 20,
        borderRadius: 30,
        backgroundColor: '#4CAF50', // Golf Green
        elevation: 5,
    },
    btnContent: {
        height: 60,
    },
    btnLabel: {
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    row: {
        flexDirection: 'row',
        gap: 20,
        width: '100%',
        justifyContent: 'center',
    },
    subButton: {
        flex: 1,
        borderRadius: 12,
    },
    footer: {
        color: '#666',
        marginBottom: 20,
        fontSize: 12,
    }
});
