import { HoleResult, PlayerId, RoundResult } from '../types';
import { getRoundHoleSequence } from './holeSequence';

/** スタート画面で選べるニアピンの額（1回・1人あたり）。0 = ニアピンなし */
export const NEAR_PIN_RATE_OPTIONS = [0, 500, 1000] as const;

const NEAR_PIN_PAR = 3;

export function isNearPinHole(par: number | null, nearPinRate: number): boolean {
    return nearPinRate > 0 && par === NEAR_PIN_PAR;
}

export interface NearPinParams {
    history: HoleResult[];
    /** プレー順のホール番号列。持ち越しはこの順に積み上がる */
    sequence: number[];
    /** 支払い・受け取りの対象（実プレイヤーのみ。ボギーくんは含めない） */
    participantIds: PlayerId[];
    nearPinRate: number;
}

export interface NearPinSummary {
    /** プレイヤーごとのニアピン収支（円）。取った人はプラス、他はマイナス */
    amounts: Record<PlayerId, number>;
    /** まだ誰も取っていない持ち越し回数 */
    carryOver: number;
}

/**
 * ニアピンの収支をプレー順に計算する。
 *
 * パー3で取った人は、他の全員から「額 ×（持ち越し回数 + 1）」ずつ受け取る。
 * 該当なしなら次のパー3に持ち越す。最後まで残った持ち越しは流れる。
 */
export function calculateNearPin({ history, sequence, participantIds, nearPinRate }: NearPinParams): NearPinSummary {
    const initial: NearPinSummary = {
        amounts: Object.fromEntries(participantIds.map(id => [id, 0])),
        carryOver: 0,
    };

    return sequence.reduce<NearPinSummary>((summary, holeNumber) => {
        const hole = history.find(h => h.holeNumber === holeNumber);
        // 記録が無いパー3（ニアピンを途中から有効にする前のホール）は対象外
        if (!hole || !isNearPinHole(hole.par, nearPinRate) || hole.nearPinWinnerId === undefined) return summary;

        const winnerId = hole.nearPinWinnerId;
        if (!winnerId || !participantIds.includes(winnerId)) {
            return { ...summary, carryOver: summary.carryOver + 1 };
        }

        const stake = nearPinRate * (summary.carryOver + 1);
        const amounts = Object.fromEntries(participantIds.map(id => [
            id,
            summary.amounts[id] + (id === winnerId ? stake * (participantIds.length - 1) : -stake),
        ]));
        return { amounts, carryOver: 0 };
    }, initial);
}

/** 指定ホールより前にプレーしたホールで積み上がっている持ち越し回数 */
export function nearPinCarryOverBefore(params: NearPinParams, holeNumber: number): number {
    const index = params.sequence.indexOf(holeNumber);
    if (index < 0) return 0;
    return calculateNearPin({ ...params, sequence: params.sequence.slice(0, index) }).carryOver;
}

/** 保存済みラウンドのニアピン収支（円）。ニアピンなしのラウンドは空 */
export function nearPinAmountsForRound(round: RoundResult): Record<PlayerId, number> {
    const nearPinRate = round.settings.nearPinRate ?? 0;
    if (nearPinRate <= 0) return {};

    return calculateNearPin({
        history: round.history,
        sequence: getRoundHoleSequence(round.startHole ?? 1, round.roundLength ?? 18),
        participantIds: round.players.filter(player => player.type !== 'bogey_kun').map(player => player.id),
        nearPinRate,
    }).amounts;
}
