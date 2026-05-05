import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Chip, IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

interface HoleHeaderProps {
    currentHole: number;
    par: number | null;
    liveMultiplier: number;
    isFront9: boolean;
    canGoPrev: boolean;
    canGoNext: boolean;
    language: 'en' | 'ja';
    onPrevHole: () => void;
    onNextHole: () => void;
    onParPress: () => void;
    onSettingsPress: () => void;
    onHelpPress: () => void;
    onRestartPress: () => void;
    onScorecardPress: () => void;
    onHistoryPress: () => void;
    onLanguageToggle: () => void;
}

export const HoleHeader: React.FC<HoleHeaderProps> = ({
    currentHole, par, liveMultiplier, isFront9, canGoPrev, canGoNext, language,
    onPrevHole, onNextHole, onParPress, onSettingsPress, onHelpPress,
    onRestartPress, onScorecardPress, onHistoryPress, onLanguageToggle,
}) => {
    const { t } = useTranslation();

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
            <View style={styles.header}>
                <View style={styles.topRow}>
                    <View style={styles.leftButtons}>
                        <IconButton icon="help-circle-outline" iconColor="#ffffff" size={20} onPress={onHelpPress} />
                        <IconButton icon="cog" iconColor="#ffffff" size={20} onPress={onSettingsPress} />
                        <TouchableOpacity onPress={onRestartPress} style={styles.topBtn}>
                            <Text style={styles.topBtnText}>{t('common.restart').toUpperCase()}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.rightButtons}>
                        <TouchableOpacity onPress={onScorecardPress} style={styles.topBtn}>
                            <Text style={styles.topBtnText}>{t('common.scorecard').toUpperCase()}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onHistoryPress} style={styles.topBtn}>
                            <Text style={styles.topBtnText}>{t('common.viewHistory').toUpperCase()}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onLanguageToggle} style={styles.topBtn}>
                            <Text style={[styles.topBtnText, { fontWeight: 'bold' }]}>{language.toUpperCase()}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.navRow}>
                    <IconButton
                        icon="chevron-left"
                        iconColor="#ffffff"
                        size={30}
                        disabled={!canGoPrev}
                        onPress={onPrevHole}
                    />
                    <TouchableOpacity style={styles.holeInfo} onPress={onParPress}>
                        <Text variant="headlineSmall" style={styles.holeText}>Hole {currentHole}</Text>
                        <Text variant="titleSmall" style={styles.parText}>{par ? `Par ${par}` : t('common.tapToChange')}</Text>
                    </TouchableOpacity>
                    <IconButton
                        icon="chevron-right"
                        iconColor="#ffffff"
                        size={30}
                        disabled={!canGoNext}
                        style={{ opacity: canGoNext ? 1 : 0 }}
                        onPress={onNextHole}
                    />
                </View>

                <View style={styles.infoBar}>
                    <Chip
                        icon="fire"
                        mode="outlined"
                        textStyle={{ color: liveMultiplier > 1 ? '#FFD700' : '#ffffff' }}
                        style={[styles.chip, liveMultiplier > 1 && styles.chipActive]}
                    >
                        ×{liveMultiplier}
                    </Chip>
                    <Text style={styles.halfText}>
                        {isFront9 ? t('common.out') : t('common.in')}
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { backgroundColor: '#000000' },
    header: { paddingHorizontal: 16, paddingBottom: 12 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    leftButtons: { flexDirection: 'row', alignItems: 'center' },
    rightButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    topBtn: { padding: 4 },
    topBtnText: { color: '#ccc', fontSize: 12 },
    navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
    holeInfo: { alignItems: 'center' },
    holeText: { color: '#ffffff', fontWeight: 'bold' },
    parText: { color: '#cccccc' },
    infoBar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
    chip: { backgroundColor: '#333', height: 28 },
    chipActive: { backgroundColor: '#5D4037', borderColor: '#FFD700' },
    halfText: { color: '#ddd', fontWeight: 'bold' },
});
