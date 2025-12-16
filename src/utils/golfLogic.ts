import { HoleResult, PlayerId, ScoreInput } from '../types';

interface CalculateHoleResultParams {
    holeNumber: number;
    par: number;
    scores: Record<PlayerId, ScoreInput>;
    teamA_Ids: [PlayerId, PlayerId];
    teamB_Ids: [PlayerId, PlayerId];
    currentCarryOverMultiplier: number;
}

/**
 * Calculates the result of a single hole based on the Vegas rule.
 */
export function calculateHoleResult(params: CalculateHoleResultParams): HoleResult {
    const { holeNumber, par, scores, teamA_Ids, teamB_Ids, currentCarryOverMultiplier } = params;

    // 1. Calculate raw team scores (concatenation)
    // Logic: min(s1, s2) * 10 + max(s1, s2)
    const getRawTeamScore = (p1Id: PlayerId, p2Id: PlayerId): { val: number, low: number, high: number } => {
        const s1 = scores[p1Id].score;
        const s2 = scores[p2Id].score;
        const low = Math.min(s1, s2);
        const high = Math.max(s1, s2);
        return { val: low * 10 + high, low, high };
    };

    const teamA_Raw = getRawTeamScore(teamA_Ids[0], teamA_Ids[1]);
    const teamB_Raw = getRawTeamScore(teamB_Ids[0], teamB_Ids[1]);

    // 2. Check for Birdies (Flip logic)
    const hasBirdie = (ids: [PlayerId, PlayerId]): boolean => {
        return scores[ids[0]].isBirdie || scores[ids[1]].isBirdie;
    };

    const teamA_HasBirdie = hasBirdie(teamA_Ids);
    const teamB_HasBirdie = hasBirdie(teamB_Ids);

    // Flip Rule: If Team A has birdie, Team B flips. If both have birdie, both flip.
    let teamA_FinalScore = teamA_Raw.val;
    let teamB_FinalScore = teamB_Raw.val;

    if (teamB_HasBirdie) {
        // Team A flips because opponent Team B got a birdie
        teamA_FinalScore = teamA_Raw.high * 10 + teamA_Raw.low;
    }

    if (teamA_HasBirdie) {
        // Team B flips because opponent Team A got a birdie
        teamB_FinalScore = teamB_Raw.high * 10 + teamB_Raw.low;
    }

    // 3. Calculate Diff and Winner
    // Lower score wins in golf
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

    // 4. Calculate Push Multiplier
    let totalPushCount = 0;
    Object.values(scores).forEach(s => {
        if (s.usePush) totalPushCount++;
    });

    let pushMultiplier = 1;
    if (totalPushCount > 0) {
        pushMultiplier = 2 * totalPushCount;
    }

    // 5. Final Points Calculation
    const finalPoints = diff * pushMultiplier * currentCarryOverMultiplier;

    const pointsResult: Record<PlayerId, number> = {};

    // Initialize all to 0
    [...teamA_Ids, ...teamB_Ids].forEach(id => pointsResult[id] = 0);

    if (!isDraw && winningTeamIds && losingTeamIds) {
        // Winners receive points (+), Losers pay points (-)
        // Convention: Each winner gets `finalPoints` from each loser? 
        // Usually in Vegas 2vs2: 
        //   Win -> +Points (from opponent pair?)
        //   Wait, typically if A wins by 10 pts, A1 gets +10, A2 gets +10, B1 gets -10, B2 gets -10.
        //   Let's check specification.md... "プラスは受取、マイナスは支払".
        //   Standard Vegas is individual net calculation often, but here it's team-based.
        //   "TeamA_Score vs TeamB_Score". Diff is team diff.
        //   Implied: Each member of winning team gets +FinalPoints. Each member of losing team gets -FinalPoints.

        winningTeamIds.forEach(id => pointsResult[id] = finalPoints);
        losingTeamIds.forEach(id => pointsResult[id] = -finalPoints);
    }

    const nextMultiplier = isDraw ? currentCarryOverMultiplier + 1 : 1;

    return {
        holeNumber: params.holeNumber,
        par: params.par,
        scores: params.scores,
        teamA_Ids: params.teamA_Ids,
        teamB_Ids: params.teamB_Ids,
        carryOverMultiplier: currentCarryOverMultiplier,
        isDraw,
        pointsResult,
        nextHoleMultiplier: nextMultiplier,
    };
}
