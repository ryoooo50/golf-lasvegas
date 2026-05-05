import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Checkbox, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { Player, PlayerId } from '../../types';

// チームA: ディープインディゴ系（落ち着いたプレミアム感）
const COLOR_TEAM_A_BG = '#F0F4FF';
const COLOR_TEAM_A_TEXT = '#3730A3';
const COLOR_TEAM_A_BORDER = '#818CF8';

// チームB: エメラルドグリーン系（ゴルフフィールドのイメージ）
const COLOR_TEAM_B_BG = '#F0FDF7';
const COLOR_TEAM_B_TEXT = '#065F46';
const COLOR_TEAM_B_BORDER = '#34D399';

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
    onScoreChange: (id: PlayerId, value: string) => void;
    onBirdieToggle: (id: PlayerId, value: boolean) => void;
    onPushCycle: (id: PlayerId) => void;
    onTeamToggle: (id: PlayerId, team: 'A' | 'B') => void;
    onNamePress: (id: PlayerId, name: string) => void;
    onParRequired: () => void;
}

export const PlayerScoreCard: React.FC<PlayerScoreCardProps> = ({
    player, team, score, isBirdie, pushCount, par, isFront9,
    totalScore, maxPushPerHalf, onScoreChange, onBirdieToggle, onPushCycle,
    onTeamToggle, onNamePress, onParRequired,
}) => {
    const { t } = useTranslation();
    const isTeamA = team === 'A';
    const cardBg = isTeamA ? COLOR_TEAM_A_BG : COLOR_TEAM_B_BG;
    const cardText = isTeamA ? COLOR_TEAM_A_TEXT : COLOR_TEAM_B_TEXT;
    const borderColor = isTeamA ? COLOR_TEAM_A_BORDER : COLOR_TEAM_B_BORDER;
    const accentBg = isTeamA ? '#3730A3' : '#065F46';

    const usedInHalf = isFront9 ? player.pushUsageCount.front9 : player.pushUsageCount.back9;
    const totalUsed = usedInHalf + pushCount;
    const canPush = usedInHalf < maxPushPerHalf;

    // スコアとパーからバーディー/イーグルを自動判定
    const isAutoEagle = par !== null && score !== undefined && score > 0 && score <= par - 2;
    const isAutoBirdie = par !== null && score !== undefined && score > 0 && score === par - 1;

    const isAutoRef = useRef(false);
    useEffect(() => {
        if (par !== null && score !== undefined && score > 0) {
            const autoVal = score < par; // バーディー以上（イーグル含む）
            if (autoVal !== isBirdie && !isAutoRef.current) {
                isAutoRef.current = true;
                onBirdieToggle(player.id, autoVal);
                isAutoRef.current = false;
            }
        }
    }, [score, par]);

    const totalScoreDisplay = totalScore === 0 ? '±0' : totalScore > 0 ? `+${totalScore}` : `${totalScore}`;

    return (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            {/* 左: プレイヤー名・合計 */}
            <TouchableOpacity style={styles.nameSection} onPress={() => onNamePress(player.id, player.name)}>
                <Text style={[styles.playerName, { color: cardText }]} numberOfLines={1} adjustsFontSizeToFit>
                    {player.name}
                </Text>
                <View style={[styles.totalScoreRow, { backgroundColor: accentBg }]}>
                    <Text style={styles.totalValue}>{totalScoreDisplay}</Text>
                </View>
            </TouchableOpacity>

            {/* 中: スコア入力 */}
            <View style={styles.scoreSection}>
                <TextInput
                    mode="outlined"
                    value={score?.toString() ?? ''}
                    onChangeText={txt => onScoreChange(player.id, txt)}
                    onFocus={() => { if (par === null) onParRequired(); }}
                    keyboardType="number-pad"
                    style={[styles.scoreInput, { borderColor }]}
                    contentStyle={styles.scoreInputContent}
                    outlineColor={borderColor}
                    activeOutlineColor={cardText}
                    textColor="#111111"
                    dense
                />
            </View>

            {/* 右: チーム・プッシュ・バーディー */}
            <View style={styles.controlsSection}>
                <SegmentedButtons
                    value={team}
                    onValueChange={val => onTeamToggle(player.id, val as 'A' | 'B')}
                    density="high"
                    buttons={[
                        { value: 'A', label: 'A', style: { minWidth: 20 } },
                        { value: 'B', label: 'B', style: { minWidth: 20 } },
                    ]}
                    style={styles.teamSeg}
                />

                <TouchableOpacity
                    onPress={() => onPushCycle(player.id)}
                    disabled={!canPush && pushCount === 0}
                    style={[
                        styles.pushButton,
                        pushCount > 0
                            ? { backgroundColor: accentBg }
                            : { borderColor: cardText, borderWidth: 1 }
                    ]}
                >
                    <Text style={{ fontSize: 10, color: pushCount > 0 ? '#fff' : cardText, fontWeight: '600' }}>
                        {t('common.push')}{pushCount > 0 ? ` ×${pushCount}` : ''}  {totalUsed}/{maxPushPerHalf}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.birdieRow} onPress={() => onBirdieToggle(player.id, !isBirdie)}>
                    <Checkbox
                        status={isBirdie ? 'checked' : 'unchecked'}
                        color={accentBg}
                        onPress={() => onBirdieToggle(player.id, !isBirdie)}
                    />
                    <Text style={{ fontSize: 10, color: cardText, fontWeight: '600' }}>
                        {isAutoEagle ? '🦅' : isAutoBirdie ? '🐦' : t('common.birdie')}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        marginBottom: 10,
        borderRadius: 14,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    nameSection: { flex: 1, marginRight: 8, justifyContent: 'center', gap: 6 },
    playerName: { fontSize: 14, fontWeight: '700' },
    totalScoreRow: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
    totalValue: { fontSize: 12, fontWeight: '800', color: '#fff' },
    scoreSection: { width: 62, marginRight: 8 },
    scoreInput: { backgroundColor: '#ffffff', height: 52 },
    scoreInputContent: { textAlign: 'center', fontWeight: '800', fontSize: 20, color: '#111111' },
    controlsSection: { flexDirection: 'column', alignItems: 'center', gap: 4 },
    teamSeg: { height: 28, width: 90 },
    pushButton: { borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4, minWidth: 80, alignItems: 'center' },
    birdieRow: { flexDirection: 'row', alignItems: 'center' },
});
