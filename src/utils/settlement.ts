import { Player, PlayerId } from '../types';

export interface SettlementTransfer {
    fromId: PlayerId;
    fromName: string;
    toId: PlayerId;
    toName: string;
    points: number;
    amount: number;
}

interface BalanceEntry {
    id: PlayerId;
    name: string;
    balance: number;
}

export function calculateMinimumSettlement(
    players: Player[],
    finalScores: Record<PlayerId, number>,
    rate: number,
): SettlementTransfer[] {
    const balances: BalanceEntry[] = players
        .filter(player => player.type !== 'bogey_kun')
        .map(player => ({ id: player.id, name: player.name, balance: finalScores[player.id] ?? 0 }))
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

            const points = Math.min(Math.abs(first.balance), Math.abs(counterpart.balance));
            const debtor = first.balance < 0 ? first : counterpart;
            const creditor = first.balance > 0 ? first : counterpart;
            const nextEntries = entries.map(entry => ({ ...entry }));
            nextEntries[firstIndex].balance += first.balance < 0 ? points : -points;
            nextEntries[index].balance += counterpart.balance < 0 ? points : -points;

            search(nextEntries, [
                ...transfers,
                {
                    fromId: debtor.id,
                    fromName: debtor.name,
                    toId: creditor.id,
                    toName: creditor.name,
                    points,
                    amount: points * rate,
                },
            ]);
        }
    };

    search(balances, []);
    return best ?? [];
}
