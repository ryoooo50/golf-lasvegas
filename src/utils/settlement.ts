import { Player, PlayerId } from '../types';

export interface SettlementTransfer {
    fromId: PlayerId;
    fromName: string;
    toId: PlayerId;
    toName: string;
    /** ポイント換算。ニアピンなどポイント以外の金額を含む精算では null */
    points: number | null;
    amount: number;
}

interface BalanceEntry {
    id: PlayerId;
    name: string;
    balance: number;
}

/**
 * 送金回数が最小になる精算を求める。
 * extraAmounts（ニアピンなどの金額）があれば、収支 = ポイント × レート + extraAmounts の金額で精算する。
 * 無ければ従来どおりポイントで精算し、金額はポイント × レートで出す。
 */
export function calculateMinimumSettlement(
    players: Player[],
    finalScores: Record<PlayerId, number>,
    rate: number,
    extraAmounts: Record<PlayerId, number> = {},
): SettlementTransfer[] {
    const hasExtraAmounts = Object.values(extraAmounts).some(amount => amount !== 0);
    // balance の単位: extraAmounts があれば金額、無ければポイント
    const balanceOf = (playerId: PlayerId) => hasExtraAmounts
        ? (finalScores[playerId] ?? 0) * rate + (extraAmounts[playerId] ?? 0)
        : finalScores[playerId] ?? 0;
    const balances: BalanceEntry[] = players
        .filter(player => player.type !== 'bogey_kun')
        .map(player => ({ id: player.id, name: player.name, balance: balanceOf(player.id) }))
        .filter(entry => entry.balance !== 0);

    const total = balances.reduce((sum, entry) => sum + entry.balance, 0);
    if (Math.abs(total) > 0.000001) return [];

    let best: SettlementTransfer[] | null = null;

    const search = (entries: BalanceEntry[], transfers: SettlementTransfer[]) => {
        if (best && transfers.length >= best.length) return;
        const firstIndex = entries.findIndex(entry => Math.abs(entry.balance) > 0.000001);
        if (firstIndex === -1) {
            best = transfers;
            return;
        }

        const first = entries[firstIndex];
        const triedBalances = new Set<number>();
        for (let index = firstIndex + 1; index < entries.length; index += 1) {
            const counterpart = entries[index];
            if (first.balance * counterpart.balance >= 0 || triedBalances.has(counterpart.balance)) continue;
            triedBalances.add(counterpart.balance);

            const settled = Math.min(Math.abs(first.balance), Math.abs(counterpart.balance));
            const debtor = first.balance < 0 ? first : counterpart;
            const creditor = first.balance > 0 ? first : counterpart;
            const nextEntries = entries.map(entry => ({ ...entry }));
            nextEntries[firstIndex].balance += first.balance < 0 ? settled : -settled;
            nextEntries[index].balance += counterpart.balance < 0 ? settled : -settled;

            search(nextEntries, [
                ...transfers,
                {
                    fromId: debtor.id,
                    fromName: debtor.name,
                    toId: creditor.id,
                    toName: creditor.name,
                    points: hasExtraAmounts ? null : settled,
                    amount: hasExtraAmounts ? settled : settled * rate,
                },
            ]);
        }
    };

    search(balances, []);
    return best ?? [];
}
