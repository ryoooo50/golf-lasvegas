import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { C } from '../../theme/colors';
import { RoundResult } from '../../types';

interface HistoryRoundRowProps {
    round: RoundResult;
    /** 右側のボタン列 */
    children: React.ReactNode;
}

/** 履歴 1 件分の表示（自分のラウンドも共有されたラウンドも同じ見た目） */
export const HistoryRoundRow = ({ round: r, children }: HistoryRoundRowProps) => {
    const { t } = useTranslation();
    return (
        <View style={styles.roundCard}>
            <View style={styles.roundInfo}>
                <Text style={styles.roundName}>{r.name || t('common.untitledMatch')}</Text>
                <Text style={r.gameStatus === 'paused' ? styles.pausedBadge : styles.completedBadge}>
                    {r.gameStatus === 'paused' ? t('common.paused') : t('common.completed')}
                </Text>
                <Text style={styles.roundDate}>{new Date(r.date).toLocaleString()}</Text>
                {r.settings.courseName ? <Text style={styles.roundCourse}>{r.settings.courseName}</Text> : null}
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
            <View style={styles.actionColumn}>{children}</View>
        </View>
    );
};

const styles = StyleSheet.create({
    roundCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 8,
        backgroundColor: C.surface,
    },
    roundInfo: { flex: 1 },
    roundName: { fontWeight: 'bold', fontSize: 15, marginBottom: 2, color: C.ink },
    pausedBadge: { alignSelf: 'flex-start', color: C.coralDeep, backgroundColor: C.coralTint, fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
    completedBadge: { alignSelf: 'flex-start', color: C.greenDeep, backgroundColor: C.greenTint, fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
    roundDate: { fontSize: 11, color: C.ink3, marginBottom: 2 },
    roundCourse: { fontSize: 11, color: C.greenDeep, fontWeight: '600', marginBottom: 2 },
    roundHoles: { fontSize: 11, color: C.ink3, marginBottom: 4 },
    roundScores: { fontSize: 12, color: C.ink2 },
    actionColumn: { gap: 4, alignItems: 'flex-end' },
});
