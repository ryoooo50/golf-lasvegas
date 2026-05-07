import { CalculationBreakdown, HoleResult, PlayerId, ScoreInput, TeamScoreBreakdown } from '../types';

interface CalculateHoleResultParams {
    holeNumber: number;
    par: number;
    scores: Record<PlayerId, ScoreInput>;
    teamA_Ids: [PlayerId, PlayerId];
    teamB_Ids: [PlayerId, PlayerId];
    // COLevel: キャリーオーバーが発生した累積回数（0=なし, 1=1回目, 2=2回目...）
    // COMult = COLevel × 2
    currentCarryOverLevel: number;
}

export interface LivePreviewResult {
    isComplete: boolean;
    teamAFinalScore: number;
    teamBFinalScore: number;
    teamAFlipped: boolean;
    teamBFlipped: boolean;
    winnerTeam: 'A' | 'B' | 'draw' | null;
    diff: number;
    pushMultiplier: number;
    carryOverMultiplier: number;
    eagleMultiplier: number;
    finalMultiplier: number;
    estimatedPoints: number;
}

/** 個人スコアを最大9でキャップする */
function capScore(score: number): number {
    return Math.min(score, 9);
}

/** チームの連結スコアを計算する（各スコアは9でキャップ後にmin/maxで並べる） */
function buildTeamScore(
    p1Id: PlayerId,
    p2Id: PlayerId,
    scores: Record<PlayerId, ScoreInput>
): { val: number; low: number; high: number; s1: number; s2: number } {
    const s1 = capScore(scores[p1Id].score);
    const s2 = capScore(scores[p2Id].score);
    const low = Math.min(s1, s2);
    const high = Math.max(s1, s2);
    return { val: low * 10 + high, low, high, s1, s2 };
}

/**
 * PushMult = pushCount × 2（プッシュなし=0、加算式）
 * 最終倍率は max(1, PushMult + COMult + EagleMult) で決まるため
 * ここでは生の値（0以上の整数）を返す
 */
function computePushMult(scores: Record<PlayerId, ScoreInput>): number {
    let totalPushCount = 0;
    Object.values(scores).forEach(s => { totalPushCount += (s.pushCount || 0); });
    return totalPushCount * 2;
}

/**
 * COMult = COLevel × 2
 * currentCarryOverLevel: キャリーオーバー発生累積回数（0=なし）
 */
function computeCoMult(currentCarryOverLevel: number): number {
    return currentCarryOverLevel * 2;
}

/**
 * EagleMult = eagleCount × 2
 * イーグル（パー-2以下）またはホールインワンのプレイヤー人数分加算
 */
function computeEagleMult(scores: Record<PlayerId, ScoreInput>): number {
    let eagleCount = 0;
    Object.values(scores).forEach(s => { if (s.isEagle) eagleCount++; });
    return eagleCount * 2;
}

/**
 * finalMultiplier = max(1, PushMult + COMult + EagleMult)
 */
function computeFinalMultiplier(pushMult: number, coMult: number, eagleMult: number): number {
    return Math.max(1, pushMult + coMult + eagleMult);
}

/**
 * 次ホールのCOLevel計算
 * - 引き分け: COLevel + 1
 * - 勝敗確定: 0 にリセット
 */
function computeNextCarryOverLevel(isDraw: boolean, currentLevel: number): number {
    if (!isDraw) return 0;
    return currentLevel + 1;
}

export function calculateHoleResult(params: CalculateHoleResultParams): HoleResult {
    const { holeNumber, par, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel } = params;

    // 1. 各チームの連結スコアを計算（スコアキャップ9適用済み）
    const teamA_Raw = buildTeamScore(teamA_Ids[0], teamA_Ids[1], scores);
    const teamB_Raw = buildTeamScore(teamB_Ids[0], teamB_Ids[1], scores);

    // 2. バーディー/イーグルチェック（フリップ判定）
    // isEagle=trueの場合も isBirdie=trueとみなしてフリップ対象とする
    const teamA_HasBirdie = scores[teamA_Ids[0]].isBirdie || scores[teamA_Ids[0]].isEagle
        || scores[teamA_Ids[1]].isBirdie || scores[teamA_Ids[1]].isEagle;
    const teamB_HasBirdie = scores[teamB_Ids[0]].isBirdie || scores[teamB_Ids[0]].isEagle
        || scores[teamB_Ids[1]].isBirdie || scores[teamB_Ids[1]].isEagle;

    // フリップルール: 相手チームがバーディー以上を取ったら自チームのスコアを反転
    // 両チームがバーディーの場合: 各チームの元スコアを基準に同時フリップ（連鎖なし）
    let teamA_FinalScore = teamA_Raw.val;
    let teamA_Flipped = false;
    let teamB_FinalScore = teamB_Raw.val;
    let teamB_Flipped = false;

    if (teamB_HasBirdie) {
        teamA_FinalScore = teamA_Raw.high * 10 + teamA_Raw.low;
        teamA_Flipped = true;
    }
    if (teamA_HasBirdie) {
        teamB_FinalScore = teamB_Raw.high * 10 + teamB_Raw.low;
        teamB_Flipped = true;
    }

    // 3. 勝敗・差分計算
    let diff = 0;
    let winningTeamIds: [PlayerId, PlayerId] | null = null;
    let losingTeamIds: [PlayerId, PlayerId] | null = null;
    let isDraw = false;

    if (teamA_FinalScore < teamB_FinalScore) {
        diff = teamB_FinalScore - teamA_FinalScore;
        winningTeamIds = teamA_Ids;
        losingTeamIds = teamB_Ids;
    } else if (teamB_FinalScore < teamA_FinalScore) {
        diff = teamA_FinalScore - teamB_FinalScore;
        winningTeamIds = teamB_Ids;
        losingTeamIds = teamA_Ids;
    } else {
        isDraw = true;
    }

    // 4. 倍率計算: multiplier = max(1, PushMult + COMult + EagleMult)
    const pushMult = computePushMult(scores);
    const coMult = computeCoMult(currentCarryOverLevel);
    const eagleMult = computeEagleMult(scores);
    const finalRate = computeFinalMultiplier(pushMult, coMult, eagleMult);

    // 5. ポイント計算
    const finalPoints = diff * finalRate;
    const pointsResult: Record<PlayerId, number> = {};
    [...teamA_Ids, ...teamB_Ids].forEach(id => { pointsResult[id] = 0; });

    if (!isDraw && winningTeamIds && losingTeamIds) {
        winningTeamIds.forEach(id => { pointsResult[id] = finalPoints; });
        losingTeamIds.forEach(id => { pointsResult[id] = -finalPoints; });
    }

    // 6. 次ホールの倍率: 引き分け時は総倍率（push+CO+eagle）を全て持ち越し+2
    //    例: ×4のホールが引き分け → 4+2=×6
    const nextHoleMultiplier = isDraw ? pushMult + coMult + eagleMult + 2 : 1;

    // 7. 計算内訳の生成
    const teamABreakdown: TeamScoreBreakdown = {
        player1Score: capScore(scores[teamA_Ids[0]].score),
        player2Score: capScore(scores[teamA_Ids[1]].score),
        combinedRaw: teamA_Raw.val,
        flipped: teamA_Flipped,
        combinedFinal: teamA_FinalScore,
    };
    const teamBBreakdown: TeamScoreBreakdown = {
        player1Score: capScore(scores[teamB_Ids[0]].score),
        player2Score: capScore(scores[teamB_Ids[1]].score),
        combinedRaw: teamB_Raw.val,
        flipped: teamB_Flipped,
        combinedFinal: teamB_FinalScore,
    };
    const breakdown: CalculationBreakdown = {
        teamA: teamABreakdown,
        teamB: teamBBreakdown,
        diff,
        pushMultiplier: pushMult,
        carryOverMultiplier: coMult,
        eagleMultiplier: eagleMult,
        finalMultiplier: finalRate,
        finalPoints,
        isDraw,
    };

    return {
        holeNumber,
        par,
        scores,
        teamA_Ids,
        teamB_Ids,
        carryOverMultiplier: coMult,
        isDraw,
        appliedMultiplier: finalRate,
        pointsResult,
        nextHoleMultiplier,
        breakdown,
    };
}

/**
 * スコア入力中のリアルタイム倍率プレビュー用ヘルパー
 */
export function calculateCurrentHoleRate(
    currentCarryOverLevel: number,
    scores: Record<PlayerId, ScoreInput>
): number {
    const pushMult = computePushMult(scores);
    const coMult = computeCoMult(currentCarryOverLevel);
    const eagleMult = computeEagleMult(scores);
    return computeFinalMultiplier(pushMult, coMult, eagleMult);
}

/**
 * スコア入力中のリアルタイム計算プレビュー（全員入力済みの場合のみ完全な予測を返す）
 */
export function calculateLivePreview(
    currentCarryOverLevel: number,
    scores: Record<PlayerId, Partial<ScoreInput>>,
    teamA_Ids: [PlayerId, PlayerId],
    teamB_Ids: [PlayerId, PlayerId],
    par: number | null
): LivePreviewResult {
    const allIds = [...teamA_Ids, ...teamB_Ids];
    const isComplete = allIds.every(id => {
        const s = scores[id];
        return s !== undefined && s.score !== undefined && s.score > 0;
    });

    const coMult = computeCoMult(currentCarryOverLevel);

    if (!isComplete || par === null) {
        return {
            isComplete: false,
            teamAFinalScore: 0,
            teamBFinalScore: 0,
            teamAFlipped: false,
            teamBFlipped: false,
            winnerTeam: null,
            diff: 0,
            pushMultiplier: 0,
            carryOverMultiplier: coMult,
            eagleMultiplier: 0,
            finalMultiplier: Math.max(1, coMult),
            estimatedPoints: 0,
        };
    }

    const fullScores: Record<PlayerId, ScoreInput> = {};
    allIds.forEach(id => {
        const s = scores[id]!;
        const scoreVal = s.score!;
        const isEagle = s.isEagle ?? (scoreVal <= par - 2);
        const isBirdie = s.isBirdie ?? (!isEagle && scoreVal === par - 1);
        fullScores[id] = {
            score: scoreVal,
            isBirdie: isBirdie || isEagle,
            isEagle,
            pushCount: s.pushCount ?? 0,
        };
    });

    const teamA_Raw = buildTeamScore(teamA_Ids[0], teamA_Ids[1], fullScores);
    const teamB_Raw = buildTeamScore(teamB_Ids[0], teamB_Ids[1], fullScores);

    const teamA_HasBirdie = fullScores[teamA_Ids[0]].isBirdie || fullScores[teamA_Ids[0]].isEagle
        || fullScores[teamA_Ids[1]].isBirdie || fullScores[teamA_Ids[1]].isEagle;
    const teamB_HasBirdie = fullScores[teamB_Ids[0]].isBirdie || fullScores[teamB_Ids[0]].isEagle
        || fullScores[teamB_Ids[1]].isBirdie || fullScores[teamB_Ids[1]].isEagle;

    let teamAFinalScore = teamA_Raw.val;
    let teamAFlipped = false;
    let teamBFinalScore = teamB_Raw.val;
    let teamBFlipped = false;

    if (teamB_HasBirdie) { teamAFinalScore = teamA_Raw.high * 10 + teamA_Raw.low; teamAFlipped = true; }
    if (teamA_HasBirdie) { teamBFinalScore = teamB_Raw.high * 10 + teamB_Raw.low; teamBFlipped = true; }

    const diff = Math.abs(teamAFinalScore - teamBFinalScore);
    const pushMult = computePushMult(fullScores);
    const eagleMult = computeEagleMult(fullScores);
    const finalMultiplier = computeFinalMultiplier(pushMult, coMult, eagleMult);
    const estimatedPoints = diff * finalMultiplier;

    let winnerTeam: 'A' | 'B' | 'draw';
    if (teamAFinalScore < teamBFinalScore) winnerTeam = 'A';
    else if (teamBFinalScore < teamAFinalScore) winnerTeam = 'B';
    else winnerTeam = 'draw';

    return {
        isComplete: true,
        teamAFinalScore,
        teamBFinalScore,
        teamAFlipped,
        teamBFlipped,
        winnerTeam,
        diff,
        pushMultiplier: pushMult,
        carryOverMultiplier: coMult,
        eagleMultiplier: eagleMult,
        finalMultiplier,
        estimatedPoints,
    };
}
