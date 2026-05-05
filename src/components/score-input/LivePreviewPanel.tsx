import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { LivePreviewResult } from '../../utils/golfLogic';

interface LivePreviewPanelProps {
    preview: LivePreviewResult;
    teamANames: string;
    teamBNames: string;
}

export const LivePreviewPanel: React.FC<LivePreviewPanelProps> = ({ preview, teamANames, teamBNames }) => {
    const { t } = useTranslation();

    if (!preview.isComplete) return null;

    const { winnerTeam, diff, pushMultiplier, carryOverMultiplier, finalMultiplier, estimatedPoints, teamAFlipped, teamBFlipped, teamAFinalScore, teamBFinalScore } = preview;

    const isDraw = winnerTeam === 'draw';
    const winnerName = winnerTeam === 'A' ? teamANames : teamBNames;
    const bgColor = isDraw ? '#FFF8E1' : winnerTeam === 'A' ? '#E3F2FD' : '#FCE4EC';
    const textColor = isDraw ? '#F57F17' : winnerTeam === 'A' ? '#0D47A1' : '#880E4F';

    const flipNote = [];
    if (teamAFlipped) flipNote.push(`A: →${teamAFinalScore}`);
    if (teamBFlipped) flipNote.push(`B: →${teamBFinalScore}`);

    const multiplierDetail = [];
    if (pushMultiplier > 1) multiplierDetail.push(`Push×${pushMultiplier}`);
    if (carryOverMultiplier > 1) multiplierDetail.push(`CO×${carryOverMultiplier}`);
    const multiplierExpression =
        multiplierDetail.length > 1 ? `(${multiplierDetail.join(' + ')})` : multiplierDetail[0];

    return (
        <View style={[styles.container, { backgroundColor: bgColor, borderColor: textColor }]}>
            {isDraw ? (
                <>
                    <Text style={[styles.result, { color: textColor }]}>{t('common.draw')}</Text>
                    <Text style={[styles.sub, { color: textColor }]}>
                        {t('common.nextCarryOver', { rate: carryOverMultiplier === 1 ? 2 : carryOverMultiplier + 2 })}
                    </Text>
                </>
            ) : (
                <>
                    <Text style={[styles.result, { color: textColor }]}>
                        {winnerName} {t('common.wins')} +{estimatedPoints}pt
                    </Text>
                    <Text style={[styles.formula, { color: textColor }]}>
                        {diff}{multiplierExpression ? ` × ${multiplierExpression}` : ''} = ×{finalMultiplier}
                        {flipNote.length > 0 ? `  [Flip: ${flipNote.join(', ')}]` : ''}
                    </Text>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 8,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1.5,
        alignItems: 'center',
    },
    result: { fontSize: 16, fontWeight: 'bold' },
    formula: { fontSize: 12, marginTop: 2 },
    sub: { fontSize: 13, marginTop: 2 },
});
