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
    history: HoleResult[];
    onPrevHole: () => void;
    onNextHole: () => void;
    onParPress: () => void;
    onHelpPress: () => void;
    onHalfToggle: (half: 'front' | 'back') => void;
}

export const HoleHeader: React.FC<HoleHeaderProps> = ({
    currentHole, par, liveMultiplier, isFront9, canGoPrev, canGoNext, history,
    onPrevHole, onNextHole, onParPress, onHelpPress, onHalfToggle,
}) => {
    const { t } = useTranslation();
    const completedHoles = history.length;
    const hasCarry = liveMultiplier > 1;

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
            {/* 前後半タブ + ヘルプボタン */}
            <View style={styles.topRow}>
                <View style={styles.halfToggle}>
                    <TouchableOpacity
                        onPress={() => onHalfToggle('front')}
                        style={[styles.halfBtn, isFront9 && styles.halfBtnActive]}
                    >
                        <Text style={[styles.halfBtnText, isFront9 && styles.halfBtnTextActive]}>
                            OUT 1-9
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onHalfToggle('back')}
                        style={[styles.halfBtn, !isFront9 && styles.halfBtnActive]}
                    >
                        <Text style={[styles.halfBtnText, !isFront9 && styles.halfBtnTextActive]}>
                            IN 10-18
                        </Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={onHelpPress} style={styles.toolBtn}>
                    <Text style={styles.toolBtnText}>?</Text>
                </TouchableOpacity>
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
                            <Text style={styles.carryText}>{t('common.multiplierBadge', { n: liveMultiplier })}</Text>
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
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop: 4,
        paddingBottom: 2,
    },
    halfToggle: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: 2,
        gap: 2,
    },
    halfBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    halfBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    halfBtnText: {
        color: 'rgba(255,255,255,0.40)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    halfBtnTextActive: {
        color: '#ffffff',
    },
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
