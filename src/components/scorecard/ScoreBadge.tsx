import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '../../theme/colors';
import { getScoreSymbol } from '../../utils/scoreSymbol';

interface ScoreBadgeProps {
    score: number | null;
    par: number;
    pushed?: boolean;
}

const SIZE = 26;

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, par, pushed }) => {
    if (score === null) {
        return (
            <View style={styles.cell}>
                <Text style={styles.dash}>—</Text>
            </View>
        );
    }

    const symbol = getScoreSymbol(score, par);

    return (
        <View style={styles.cell}>
            <View style={styles.badgeWrap}>
                {symbol === 'bogey' && <Text style={[styles.glyph, styles.triangleGlyph]}>△</Text>}
                {symbol === 'double' && <Text style={[styles.glyph, styles.squareGlyph]}>□</Text>}
                {symbol === 'birdie' && <View style={styles.birdieCircle} />}
                {symbol === 'eagle' && <View style={styles.eagleCircle} />}
                <Text style={[styles.scoreText, symbol === 'eagle' && styles.scoreTextOnFill]}>{score}</Text>
            </View>
            {pushed && <Text style={styles.pushSup}>P</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    cell: { width: 34, alignItems: 'center', justifyContent: 'center' },
    badgeWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
    dash: { color: C.ink5, fontVariant: ['tabular-nums'] },
    scoreText: { fontSize: 14, fontWeight: '700', color: C.ink2, fontVariant: ['tabular-nums'] },
    scoreTextOnFill: { color: '#fff' },
    glyph: {
        position: 'absolute',
        fontSize: 28,
        lineHeight: 28,
    },
    triangleGlyph: { color: C.coralPrimary },
    squareGlyph: { color: C.ink3, fontSize: 24 },
    birdieCircle: {
        position: 'absolute',
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: 1.5,
        borderColor: C.gold,
    },
    eagleCircle: {
        position: 'absolute',
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: C.gold,
    },
    pushSup: {
        position: 'absolute',
        top: 0,
        right: 2,
        fontSize: 9,
        fontWeight: '700',
        color: C.sky,
    },
});
