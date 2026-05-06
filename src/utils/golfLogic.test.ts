import { PlayerId, ScoreInput } from '../types';
import { calculateHoleResult } from './golfLogic';

describe('calculateHoleResult', () => {
    const p1 = 'p1';
    const p2 = 'p2';
    const p3 = 'p3';
    const p4 = 'p4';

    const teamA_Ids: [PlayerId, PlayerId] = [p1, p2];
    const teamB_Ids: [PlayerId, PlayerId] = [p3, p4];

    /**
     * スコア生成ヘルパー
     * isBirdie: バーディー（パー-1）フラグ（イーグルの場合は false のまま isEagle を使う）
     * isEagle: イーグル以下フラグ（true の場合、フリップ+EagleMult加算）
     * pushCount: プッシュ人数（先頭から割り当て）
     */
    const createScores = (
        s1: number, s2: number, s3: number, s4: number,
        b1 = false, b2 = false, b3 = false, b4 = false,
        pushCount = 0,
        e1 = false, e2 = false, e3 = false, e4 = false,
    ): Record<PlayerId, ScoreInput> => {
        let pushesAssigned = 0;
        const getPush = () => (pushesAssigned++ < pushCount ? 1 : 0);
        return {
            [p1]: { score: s1, isBirdie: b1, isEagle: e1, pushCount: getPush() },
            [p2]: { score: s2, isBirdie: b2, isEagle: e2, pushCount: getPush() },
            [p3]: { score: s3, isBirdie: b3, isEagle: e3, pushCount: getPush() },
            [p4]: { score: s4, isBirdie: b4, isEagle: e4, pushCount: getPush() },
        };
    };

    // ─── 基本計算 ───────────────────────────────────────────────

    test('基本計算: チームAが勝利（倍率要素なし → ×1）', () => {
        // A: 4,5 → 45  B: 5,6 → 56  diff=11
        // PushMult=0, COMult=0, EagleMult=0 → max(1,0)=×1 → 11pt
        const scores = createScores(4, 5, 5, 6);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.pointsResult[p1]).toBe(11);
        expect(result.pointsResult[p2]).toBe(11);
        expect(result.pointsResult[p3]).toBe(-11);
        expect(result.pointsResult[p4]).toBe(-11);
        expect(result.appliedMultiplier).toBe(1);
        expect(result.isDraw).toBe(false);
    });

    // ─── バーディーフリップ（倍率影響なし） ─────────────────────

    test('バーディーフリップ: チームAがバーディー → チームBがフリップ（倍率変化なし）', () => {
        // A: 3(B),5 → 35  B: 4,6 → 46 → Flip 64  diff=29
        // バーディーは倍率に影響しない: PushMult=0, COMult=0, EagleMult=0 → ×1 → 29pt
        const scores = createScores(3, 5, 4, 6, true, false, false, false);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.pointsResult[p1]).toBe(29);
        expect(result.pointsResult[p3]).toBe(-29);
        expect(result.appliedMultiplier).toBe(1);
    });

    test('バーディーフリップ: 両チームがバーディー → 各元スコア基準で同時フリップ（倍率変化なし）', () => {
        // A: 3(B),5 → 35 → Flip 53  B: 3(B),6 → 36 → Flip 63  diff=10
        // PushMult=0, COMult=0, EagleMult=0 → ×1 → 10pt
        const scores = createScores(3, 5, 3, 6, true, false, true, false);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.pointsResult[p1]).toBe(10);
        expect(result.pointsResult[p3]).toBe(-10);
        expect(result.appliedMultiplier).toBe(1);
    });

    test('バーディーフリップ + プッシュ1人: 倍率はプッシュのみ', () => {
        // A: 3(B),5 → 35  B: 4,6 → Flip 64  diff=29
        // PushMult=2, COMult=0, EagleMult=0 → max(1,2)=×2 → 58pt
        const scores = createScores(3, 5, 4, 6, true, false, false, false, 1);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.pointsResult[p1]).toBe(58);
        expect(result.appliedMultiplier).toBe(2);
    });

    // ─── プッシュ倍率 ────────────────────────────────────────────

    test('プッシュ倍率: 1人プッシュ → PushMult=2 → ×2', () => {
        // diff=11, PushMult=2, COMult=0, EagleMult=0 → ×2 → 22pt
        const scores = createScores(4, 5, 5, 6, false, false, false, false, 1);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.pointsResult[p1]).toBe(22);
        expect(result.appliedMultiplier).toBe(2);
    });

    test('プッシュ倍率: 2人プッシュ → PushMult=4 → ×4', () => {
        // diff=11, PushMult=4, COMult=0, EagleMult=0 → ×4 → 44pt
        const scores = createScores(4, 5, 5, 6, false, false, false, false, 2);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.pointsResult[p1]).toBe(44);
        expect(result.appliedMultiplier).toBe(4);
    });

    test('プッシュ倍率: 3人プッシュ → PushMult=6 → ×6', () => {
        // diff=11, PushMult=6, COMult=0, EagleMult=0 → ×6 → 66pt
        const scores = createScores(4, 5, 5, 6, false, false, false, false, 3);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.pointsResult[p1]).toBe(66);
        expect(result.appliedMultiplier).toBe(6);
    });

    test('プッシュ倍率: 4人プッシュ → PushMult=8 → ×8', () => {
        // diff=11, PushMult=8, COMult=0, EagleMult=0 → ×8 → 88pt
        const scores = createScores(4, 5, 5, 6, false, false, false, false, 4);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.pointsResult[p1]).toBe(88);
        expect(result.appliedMultiplier).toBe(8);
    });

    // ─── キャリーオーバー倍率 ────────────────────────────────────

    test('キャリーオーバー1回目: COLevel=1 → COMult=2 → ×2', () => {
        // diff=11, PushMult=0, COMult=2, EagleMult=0 → max(1,2)=×2 → 22pt
        const scores = createScores(4, 5, 5, 6);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 1 });

        expect(result.pointsResult[p1]).toBe(22);
        expect(result.appliedMultiplier).toBe(2);
    });

    test('プッシュ + キャリーオーバーは加算: Push2(PushMult=4) + CO1(COMult=2) = ×6', () => {
        // diff=11, PushMult=4, COMult=2, EagleMult=0 → max(1,6)=×6 → 66pt
        const scores = createScores(4, 5, 5, 6, false, false, false, false, 2);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 1 });

        expect(result.pointsResult[p1]).toBe(66);
        expect(result.appliedMultiplier).toBe(6);
    });

    test('バーディー + プッシュ1 + キャリーオーバーCOLevel=2(COMult=4): Push1(PushMult=2) + CO(COMult=4) = ×6', () => {
        // A: 3(B),5 → 35  B: 4,6 → Flip 64  diff=29
        // PushMult=2, COMult=4, EagleMult=0 → max(1,6)=×6 → 174pt
        const scores = createScores(3, 5, 4, 6, true, false, false, false, 1);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 2 });

        expect(result.pointsResult[p1]).toBe(174);
        expect(result.appliedMultiplier).toBe(6);
    });

    // ─── 引き分けとキャリーオーバー伝播 ─────────────────────────

    test('引き分け: ポイントは0、isDraw=true', () => {
        const scores = createScores(4, 5, 4, 5);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.pointsResult[p1]).toBe(0);
        expect(result.isDraw).toBe(true);
    });

    test('キャリーオーバー伝播: COLevel=0 で引き分け → nextHoleMultiplier=2（COLevel=1→COMult=2）', () => {
        const scores = createScores(4, 5, 4, 5);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.nextHoleMultiplier).toBe(2);
    });

    test('キャリーオーバー伝播: COLevel=1 で引き分け → nextHoleMultiplier=4（COLevel=2→COMult=4）', () => {
        const scores = createScores(4, 5, 4, 5);
        const result = calculateHoleResult({ holeNumber: 2, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 1 });

        expect(result.nextHoleMultiplier).toBe(4);
    });

    test('キャリーオーバー伝播: COLevel=2 で引き分け → nextHoleMultiplier=6（COLevel=3→COMult=6）', () => {
        const scores = createScores(4, 5, 4, 5);
        const result = calculateHoleResult({ holeNumber: 3, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 2 });

        expect(result.nextHoleMultiplier).toBe(6);
    });

    test('勝敗確定後: キャリーオーバーは×1にリセット（COLevel=0→nextHoleMultiplier=1）', () => {
        const scores = createScores(4, 5, 5, 6);
        const result = calculateHoleResult({ holeNumber: 2, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 2 });

        expect(result.isDraw).toBe(false);
        expect(result.nextHoleMultiplier).toBe(1);
    });

    // ─── CO連続伝播 ─────────────────────────────────────────────

    test('CO連続3回: COLevel=0→1→2→3 (COMult=0→2→4→6)', () => {
        // 1回目引き分け: COLevel=0 → nextLevel=1 → nextMult=2
        const scores1 = createScores(4, 5, 4, 5);
        const r1 = calculateHoleResult({ holeNumber: 1, par: 4, scores: scores1, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });
        expect(r1.isDraw).toBe(true);
        expect(r1.nextHoleMultiplier).toBe(2);

        // 2回目引き分け: COLevel=1(COMult=2) → nextLevel=2 → nextMult=4
        const scores2 = createScores(4, 5, 4, 5);
        const r2 = calculateHoleResult({ holeNumber: 2, par: 4, scores: scores2, teamA_Ids, teamB_Ids, currentCarryOverLevel: 1 });
        expect(r2.isDraw).toBe(true);
        expect(r2.appliedMultiplier).toBe(2); // COMult=2が適用される
        expect(r2.nextHoleMultiplier).toBe(4);

        // 3回目引き分け: COLevel=2(COMult=4) → nextLevel=3 → nextMult=6
        const scores3 = createScores(4, 5, 4, 5);
        const r3 = calculateHoleResult({ holeNumber: 3, par: 4, scores: scores3, teamA_Ids, teamB_Ids, currentCarryOverLevel: 2 });
        expect(r3.isDraw).toBe(true);
        expect(r3.appliedMultiplier).toBe(4); // COMult=4が適用される
        expect(r3.nextHoleMultiplier).toBe(6);
    });

    // ─── イーグル/ホールインワン ──────────────────────────────────

    test('イーグル単独: フリップ + EagleMult=2 → ×2', () => {
        // p1がイーグル: チームBをフリップ + EagleMult=2
        // A: 2(E),5 → 25  B: 4,6 → 46 → Flip 64  diff=39
        // PushMult=0, COMult=0, EagleMult=2 → max(1,2)=×2 → 78pt
        const scores = createScores(2, 5, 4, 6, false, false, false, false, 0, true, false, false, false);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.breakdown.teamB.flipped).toBe(true);
        expect(result.breakdown.teamB.combinedFinal).toBe(64);
        expect(result.breakdown.teamA.combinedFinal).toBe(25);
        expect(result.breakdown.eagleMultiplier).toBe(2);
        expect(result.appliedMultiplier).toBe(2);
        expect(result.pointsResult[p1]).toBe(78);
        expect(result.pointsResult[p3]).toBe(-78);
    });

    test('イーグル2人: EagleMult=4 → ×4', () => {
        // p1,p3がイーグル: 両チームフリップ + EagleMult=4
        // A: 2(E),5 → 25 → Flip(Bイーグルで) 52  B: 2(E),6 → 26 → Flip(Aイーグルで) 62  diff=10
        // PushMult=0, COMult=0, EagleMult=4 → max(1,4)=×4 → 40pt
        const scores = createScores(2, 5, 2, 6, false, false, false, false, 0, true, false, true, false);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.breakdown.eagleMultiplier).toBe(4);
        expect(result.appliedMultiplier).toBe(4);
        expect(result.pointsResult[p1]).toBe(40);
        expect(result.pointsResult[p3]).toBe(-40);
    });

    test('イーグル + プッシュ1: PushMult=2 + EagleMult=2 = ×4', () => {
        // p1がイーグル、プッシュ1人
        // A: 2(E),5 → 25  B: 4,6 → Flip 64  diff=39
        // PushMult=2, COMult=0, EagleMult=2 → max(1,4)=×4 → 156pt
        const scores = createScores(2, 5, 4, 6, false, false, false, false, 1, true, false, false, false);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.breakdown.pushMultiplier).toBe(2);
        expect(result.breakdown.eagleMultiplier).toBe(2);
        expect(result.appliedMultiplier).toBe(4);
        expect(result.pointsResult[p1]).toBe(156);
    });

    test('イーグル + CO(COLevel=1, COMult=2): PushMult=0 + COMult=2 + EagleMult=2 = ×4', () => {
        // p1がイーグル、COLevel=1(COMult=2)
        // A: 2(E),5 → 25  B: 4,6 → Flip 64  diff=39
        // PushMult=0, COMult=2, EagleMult=2 → max(1,4)=×4 → 156pt
        const scores = createScores(2, 5, 4, 6, false, false, false, false, 0, true, false, false, false);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 1 });

        expect(result.breakdown.carryOverMultiplier).toBe(2);
        expect(result.breakdown.eagleMultiplier).toBe(2);
        expect(result.appliedMultiplier).toBe(4);
        expect(result.pointsResult[p1]).toBe(156);
    });

    test('バーディー（パー-1）: フリップのみ、EagleMult加算なし', () => {
        // p1がバーディー（isEagle=false, isBirdie=true）
        // フリップはあるがEagleMult=0
        // A: 3(B),5 → 35  B: 4,6 → Flip 64  diff=29
        // PushMult=0, COMult=0, EagleMult=0 → ×1 → 29pt
        const scores = createScores(3, 5, 4, 6, true, false, false, false, 0, false, false, false, false);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.breakdown.teamB.flipped).toBe(true);
        expect(result.breakdown.eagleMultiplier).toBe(0);
        expect(result.appliedMultiplier).toBe(1);
        expect(result.pointsResult[p1]).toBe(29);
    });

    // ─── スコアキャップ9 ────────────────────────────────────────

    test('スコアキャップ: 10打は9として計算される', () => {
        // A: 10→9, 5 → min=5,max=9 → 59  B: 5,6 → 56  diff=3
        // PushMult=0, COMult=0, EagleMult=0 → ×1 → 3pt (チームBが勝利)
        const scores = createScores(10, 5, 5, 6);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.breakdown.teamA.combinedRaw).toBe(59); // 5×10+9=59 (min=5,max=9)
        expect(result.breakdown.teamA.player1Score).toBe(9); // キャップ適用
        expect(result.pointsResult[p3]).toBe(3);  // チームBが勝利
        expect(result.pointsResult[p1]).toBe(-3);
    });

    test('スコアキャップ: 12打・11打 → 両者9として計算', () => {
        // A: 12→9, 11→9 → min=9,max=9 → 99  B: 5,6 → 56  diff=43
        const scores = createScores(12, 11, 5, 6);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.breakdown.teamA.player1Score).toBe(9);
        expect(result.breakdown.teamA.player2Score).toBe(9);
        expect(result.breakdown.teamA.combinedRaw).toBe(99);
        expect(result.pointsResult[p3]).toBe(43); // チームBが勝利
    });

    // ─── CalculationBreakdown ─────────────────────────────────────

    test('breakdown: フリップなし時の内訳', () => {
        const scores = createScores(4, 5, 5, 6);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.breakdown.teamA.combinedRaw).toBe(45);
        expect(result.breakdown.teamA.flipped).toBe(false);
        expect(result.breakdown.teamA.combinedFinal).toBe(45);
        expect(result.breakdown.teamB.combinedRaw).toBe(56);
        expect(result.breakdown.teamB.flipped).toBe(false);
        expect(result.breakdown.diff).toBe(11);
        expect(result.breakdown.pushMultiplier).toBe(0);
        expect(result.breakdown.carryOverMultiplier).toBe(0);
        expect(result.breakdown.eagleMultiplier).toBe(0);
        expect(result.breakdown.finalMultiplier).toBe(1);
    });

    test('breakdown: バーディーフリップ時の内訳', () => {
        // A: 3(B),5 → 35  B: 4,6 → Flip 64
        const scores = createScores(3, 5, 4, 6, true, false, false, false);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.breakdown.teamA.flipped).toBe(false);
        expect(result.breakdown.teamA.combinedFinal).toBe(35);
        expect(result.breakdown.teamB.combinedRaw).toBe(46);
        expect(result.breakdown.teamB.flipped).toBe(true);
        expect(result.breakdown.teamB.combinedFinal).toBe(64);
        expect(result.breakdown.diff).toBe(29);
        expect(result.breakdown.eagleMultiplier).toBe(0);
    });

    test('breakdown: イーグル時の内訳', () => {
        // p1がイーグル
        const scores = createScores(2, 5, 4, 6, false, false, false, false, 0, true, false, false, false);
        const result = calculateHoleResult({ holeNumber: 1, par: 4, scores, teamA_Ids, teamB_Ids, currentCarryOverLevel: 0 });

        expect(result.breakdown.teamB.flipped).toBe(true);
        expect(result.breakdown.eagleMultiplier).toBe(2);
        expect(result.breakdown.pushMultiplier).toBe(0);
        expect(result.breakdown.carryOverMultiplier).toBe(0);
        expect(result.breakdown.finalMultiplier).toBe(2);
    });
});
