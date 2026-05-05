import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../theme/colors';
import { HoleResult } from '../../types';

interface HoleHeaderProps {
    currentHole: number;
    par: number | null;
    liveMultiplier: number;
    isFront9: boolean;
    canGoPrev: boolean;
    canGoNext: boolean;
    language: 'en' | 'ja';
    history: HoleResult[];
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
    currentHole, par, liveMultiplier, isFront9, canGoPrev, canGoNext, language, history,
    onPrevHole, onNextHole, onParPress, onSettingsPress, onHelpPress,
    onRestartPress, onScorecardPress, onHistoryPress, onLanguageToggle,
}) => {
    const { t } = useTranslation();
    const completedHoles = history.length;
    const hasCarry = liveMultiplier > 1;

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
            {/* ツールバー */}
            <View style={styles.toolbar}>
                <View style={styles.toolRow}>
                    <TouchableOpacity onPress={onHelpPress} style={styles.toolBtn}>
                        <Text style={styles.toolBtnText}>?</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onSettingsPress} style={styles.toolBtn}>
                        <Text style={styles.toolBtnText}>⚙</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onRestartPress} style={styles.toolBtn}>
                        <Text style={styles.toolBtnText}>{t('common.restart').toUpperCase()}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.toolRow}>
                    <TouchableOpacity onPress={onScorecardPress} style={styles.toolBtn}>
                        <Text style={styles.toolBtnText}>{t('common.scorecard').toUpperCase()}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onHistoryPress} style={styles.toolBtn}>
                        <Text style={styles.toolBtnText}>{t('common.viewHistory').toUpperCase()}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onLanguageToggle} style={styles.toolBtn}>
                        <Text style={[styles.toolBtnText, { fontWeight: '700' }]}>{language.toUpperCase()}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ホールナビゲーション */}
            <View style={styles.holeBar}>
                <TouchableOpacity
                    onPress={onPrevHole}
                    disabled={!canGoPrev}
                    style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
                >
                    <Text style={styles.navBtnText}>‹</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.holeCenter} onPress={onParPress}>
                    <View style={styles.holeNumRow}>
                        <Text style={styles.holeNum}>{String(currentHole).padStart(2, '0')}</Text>
                        <View style={styles.holeMeta}>
                            <Text style={styles.holeLabel}>HOLE / 18</Text>
                            <Text style={styles.parLabel}>
                                {par ? `PAR ${par}` : t('common.tapToChange')}
                            </Text>
                            <Text style={styles.halfLabel}>
                                {isFront9 ? t('common.out') : t('common.in')}
                            </Text>
                        </View>
                    </View>
                    {hasCarry && (
                        <View style={styles.carryBadge}>
                            <Text style={styles.carryText}>CARRY ×{liveMultiplier}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onNextHole}
                    disabled={!canGoNext}
                    style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
                >
                    <Text style={styles.navBtnText}>›</Text>
                </TouchableOpacity>
            </View>

            {/* 18ドット進捗 */}
            <View style={styles.dotsRow}>
                {Array.from({ length: 18 }).map((_, i) => {
                    const holeNum = i + 1;
                    const isDone = history.some(h => h.holeNumber === holeNum);
                    const isCurrent = holeNum === currentHole;
                    return (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                isDone ? styles.dotDone : isCurrent ? styles.dotCurrent : styles.dotEmpty,
                            ]}
                        />
                    );
                })}
            </View>

            <View style={styles.completedRow}>
                <Text style={styles.completedText}>{completedHoles}/18 {t('common.holesPlayed')}</Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { backgroundColor: C.dark },
    toolbar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop: 4,
    },
    toolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    toolBtn: { padding: 5 },
    toolBtnText: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

    holeBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    navBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navBtnDisabled: { opacity: 0.25 },
    navBtnText: { color: '#ffffff', fontSize: 24, lineHeight: 28 },

    holeCenter: { flex: 1, alignItems: 'center', paddingVertical: 4 },
    holeNumRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    holeNum: {
        fontFamily: 'monospace',
        fontSize: 44,
        fontWeight: '600',
        color: '#ffffff',
        letterSpacing: -1,
        lineHeight: 50,
    },
    holeMeta: { gap: 1 },
    holeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '700', letterSpacing: 1 },
    parLabel: { fontSize: 14, color: '#ffffff', fontWeight: '700' },
    halfLabel: { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },

    carryBadge: {
        marginTop: 6,
        backgroundColor: 'rgba(255,200,80,0.15)',
        borderRadius: 99,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,200,80,0.35)',
    },
    carryText: { color: 'rgba(255,220,100,0.95)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 2,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotDone: { backgroundColor: 'rgba(255,255,255,0.85)' },
    dotCurrent: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#ffffff' },
    dotEmpty: { backgroundColor: 'rgba(255,255,255,0.22)' },

    completedRow: { alignItems: 'center', paddingBottom: 8 },
    completedText: { fontSize: 10, color: 'rgba(255,255,255,0.40)', fontWeight: '600', letterSpacing: 0.5 },
});
