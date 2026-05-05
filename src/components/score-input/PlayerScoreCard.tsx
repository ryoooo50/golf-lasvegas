import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Player, PlayerId } from '../../types';
import { C } from '../../theme/colors';

interface PlayerScoreCardProps {
    player: Player;
    team: 'A' | 'B';
    score: number | undefined;
    isBirdie: boolean;
    pushCount: number;
    par: number | null;
    isFront9: boolean;
    totalScore: number;
    maxPushPerHalf: number;
    onScoreChange: (id: PlayerId, value: number | undefined) => void;
    onBirdieToggle: (id: PlayerId, value: boolean) => void;
    onPushCycle: (id: PlayerId) => void;
    onTeamToggle: (id: PlayerId, team: 'A' | 'B') => void;
    onNamePress: (id: PlayerId, name: string) => void;
    onParRequired: () => void;
}

export function PlayerScoreCard({
    player, team, score, isBirdie, pushCount, par, isFront9,
    totalScore, maxPushPerHalf, onScoreChange, onBirdieToggle, onPushCycle,
    onTeamToggle, onNamePress, onParRequired,
}: PlayerScoreCardProps) {
    const { t } = useTranslation();
    const isTeamA = team === 'A';
    const teamColor = isTeamA ? C.greenPrimary : C.coralPrimary;
    const teamTint = isTeamA ? C.greenTint : C.coralTint;
    const teamDeep = isTeamA ? C.greenDeep : C.coralDeep;

    const usedInHalf = isFront9 ? player.pushUsageCount.front9 : player.pushUsageCount.back9;
    const available = Math.max(0, maxPushPerHalf - usedInHalf);
    const canPush = available > 0 || pushCount > 0;

    const isAutoEagle = par !== null && score !== undefined && score > 0 && score <= par - 2;
    const isAutoBirdie = par !== null && score !== undefined && score > 0 && score === par - 1;

    const isAutoRef = useRef(false);
    useEffect(() => {
        if (par !== null && score !== undefined && score > 0) {
            const autoVal = score < par;
            if (autoVal !== isBirdie && !isAutoRef.current) {
                isAutoRef.current = true;
                onBirdieToggle(player.id, autoVal);
                isAutoRef.current = false;
            }
        }
    }, [score, par]);

    const initials = player.name.slice(0, 2).toUpperCase();

    const displayScore = score ?? par ?? 0;
    const diffFromPar = par !== null && score !== undefined ? score - par : null;

    const diffLabel = diffFromPar === null
        ? ''
        : diffFromPar === 0
        ? 'PAR'
        : diffFromPar < 0
        ? `${diffFromPar}`
        : `+${diffFromPar}`;

    const diffColor = diffFromPar === null
        ? C.ink4
        : diffFromPar < 0
        ? C.greenPrimary
        : diffFromPar === 0
        ? C.ink3
        : C.coralPrimary;

    const cardBorderColor = isAutoEagle || isAutoBirdie ? C.gold : C.line;
    const totalDisplay = totalScore === 0 ? '±0' : totalScore > 0 ? `+${totalScore}` : `${totalScore}`;

    const decrement = () => {
        if (par === null) { onParRequired(); return; }
        const current = score ?? par;
        if (current > 1) onScoreChange(player.id, current - 1);
    };

    const increment = () => {
        if (par === null) { onParRequired(); return; }
        const current = score ?? (par - 1);
        onScoreChange(player.id, current + 1);
    };

    return (
        <View style={[styles.card, { borderColor: cardBorderColor }]}>
            {/* ヘッダー: アバター + 名前 + チームバッジ */}
            <View style={styles.cardHeader}>
                <TouchableOpacity
                    style={[styles.avatar, { backgroundColor: teamColor }]}
                    onPress={() => onNamePress(player.id, player.name)}
                >
                    <Text style={styles.avatarText}>{initials}</Text>
                </TouchableOpacity>
                <View style={styles.nameArea}>
                    <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
                    <Text style={[styles.totalScore, { color: teamDeep }]}>{totalDisplay}pt</Text>
                </View>
                <View style={styles.badgeColumn}>
                    {(isAutoEagle || isAutoBirdie) && (
                        <Text style={styles.birdieBadgeText}>
                            {isAutoEagle ? '🦅' : '🐦'}
                        </Text>
                    )}
                    <TouchableOpacity
                        style={[styles.teamBadge, { backgroundColor: teamColor }]}
                        onPress={() => onTeamToggle(player.id, isTeamA ? 'B' : 'A')}
                    >
                        <Text style={styles.teamBadgeText}>{team}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* スコアステッパー */}
            <View style={styles.stepper}>
                <TouchableOpacity onPress={decrement} style={[styles.stepBtn, { borderColor: C.line }]}>
                    <Text style={[styles.stepBtnText, { color: C.ink3 }]}>−</Text>
                </TouchableOpacity>
                <View style={styles.scoreDisplay}>
                    <Text style={[styles.scoreNum, score === undefined && styles.scoreNumEmpty]}>
                        {score !== undefined ? score : (par ?? '—')}
                    </Text>
                    {diffLabel !== '' && (
                        <Text style={[styles.diffLabel, { color: diffColor }]}>{diffLabel}</Text>
                    )}
                </View>
                <TouchableOpacity onPress={increment} style={[styles.stepBtn, { borderColor: C.line }]}>
                    <Text style={[styles.stepBtnText, { color: C.ink3 }]}>+</Text>
                </TouchableOpacity>
            </View>

            {/* プッシュバッジ */}
            <TouchableOpacity
                onPress={() => onPushCycle(player.id)}
                disabled={!canPush}
                style={[
                    styles.pushPill,
                    pushCount > 0
                        ? { backgroundColor: C.sky, borderColor: C.sky }
                        : { backgroundColor: C.skyTint, borderColor: 'rgba(91,141,184,0.3)' },
                    !canPush && pushCount === 0 && styles.pushPillDisabled,
                ]}
            >
                <Text style={[styles.pushText, { color: pushCount > 0 ? '#fff' : C.sky }]}>
                    {t('common.push')}{pushCount > 0 ? ` ×${pushCount}` : ''}
                    {'  '}{usedInHalf + pushCount}/{maxPushPerHalf}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 1.5,
        padding: 10,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    avatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    nameArea: { flex: 1, minWidth: 0 },
    playerName: { fontSize: 12, fontWeight: '700', color: C.ink, lineHeight: 15 },
    totalScore: { fontSize: 10, fontWeight: '700' },
    birdieBadgeText: { fontSize: 13 },
    badgeColumn: { alignItems: 'center', gap: 4 },
    teamBadge: {
        width: 24,
        height: 24,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    teamBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.bg,
        borderRadius: 12,
        overflow: 'hidden',
    },
    stepBtn: {
        width: 36,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
    },
    stepBtnText: { fontSize: 22, fontWeight: '300', lineHeight: 26 },
    scoreDisplay: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 44 },
    scoreNum: { fontSize: 26, fontWeight: '700', color: C.ink, lineHeight: 30, fontVariant: ['tabular-nums'] },
    scoreNumEmpty: { color: C.ink4, fontSize: 20 },
    diffLabel: { fontSize: 10, fontWeight: '700', marginTop: 0 },

    pushPill: {
        borderRadius: 99,
        paddingVertical: 5,
        paddingHorizontal: 8,
        alignItems: 'center',
        borderWidth: 1,
    },
    pushPillDisabled: { opacity: 0.4 },
    pushText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
