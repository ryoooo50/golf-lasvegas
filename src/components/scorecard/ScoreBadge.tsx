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
const TRIANGLE_W = 12;
const TRIANGLE_H = 20;

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, par, pushed }) => {
    if (score === null) {
        return (
            <View style={styles.cell}>
                <Text style={styles.dash}>—</Text>
            </View>
        );
    }

    const symbol = getScoreSymbol(score, par);
    const isDark = symbol === 'eagle';

    return (
        <View style={styles.cell}>
            <View style={styles.badgeWrap}>
                {symbol === 'bogey' && <View style={styles.triangleShape} />}
                {symbol === 'double' && <View style={styles.squareShape} />}
                {symbol === 'birdie' && <View style={styles.birdieCircle} />}
                {symbol === 'eagle' && <View style={styles.eagleCircle} />}
                <Text style={[styles.scoreText, isDark && styles.scoreTextOnFill]}>{score}</Text>
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
    birdieCircle: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: 1.5,
        borderColor: C.gold,
    },
    eagleCircle: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: C.gold,
    },
    squareShape: {
        position: 'absolute',
        top: 2,
        left: 2,
        width: SIZE - 4,
        height: SIZE - 4,
        borderRadius: 3,
        backgroundColor: C.line2,
    },
    triangleShape: {
        position: 'absolute',
        top: (SIZE - TRIANGLE_H) / 2,
        left: (SIZE - TRIANGLE_W * 2) / 2,
        width: 0,
        height: 0,
        borderLeftWidth: TRIANGLE_W,
        borderRightWidth: TRIANGLE_W,
        borderBottomWidth: TRIANGLE_H,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'rgba(196,97,74,0.22)',
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
