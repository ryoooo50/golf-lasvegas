import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { RoundResult } from '../types';
import { calculateMinimumSettlement } from '../utils/settlement';

function safeFilename(value: string): string {
    return (value || 'golf-lasvegas')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '_')
        .slice(0, 80);
}

function csvCell(value: unknown): string {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function buildRoundCsv(round: RoundResult): string {
    const realPlayers = round.players.filter(player => player.type !== 'bogey_kun');
    const rows: string[][] = [
        ['Match', round.name],
        ['Course', round.settings.courseName],
        ['Played At', round.settings.playedAt],
        ['Memo', round.settings.memo],
        [],
        ['Hole', 'Par', ...realPlayers.map(player => player.name), ...realPlayers.map(player => `${player.name} points`)],
    ];

    [...round.history]
        .sort((a, b) => a.holeNumber - b.holeNumber)
        .forEach(hole => {
            rows.push([
                String(hole.holeNumber),
                String(hole.par),
                ...realPlayers.map(player => String(hole.scores[player.id]?.score ?? '')),
                ...realPlayers.map(player => String(hole.pointsResult[player.id] ?? 0)),
            ]);
        });

    rows.push([], ['Final Points', '', ...realPlayers.map(player => String(round.finalScores[player.id] ?? 0))]);
    rows.push(['Amount', '', ...realPlayers.map(player => String((round.finalScores[player.id] ?? 0) * round.settings.rate))]);

    const transfers = calculateMinimumSettlement(round.players, round.finalScores, round.settings.rate);
    rows.push([], ['Settlement']);
    transfers.forEach(transfer => rows.push([
        transfer.fromName,
        '->',
        transfer.toName,
        String(transfer.points),
        String(transfer.amount),
    ]));

    return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\n')}`;
}

export function buildRoundHtml(round: RoundResult): string {
    const realPlayers = round.players.filter(player => player.type !== 'bogey_kun');
    const transfers = calculateMinimumSettlement(round.players, round.finalScores, round.settings.rate);
    const scoreRows = [...round.history]
        .sort((a, b) => a.holeNumber - b.holeNumber)
        .map(hole => `<tr><td>${hole.holeNumber}</td><td>${hole.par}</td>${realPlayers.map(player => `<td>${hole.scores[player.id]?.score ?? '-'}</td>`).join('')}</tr>`)
        .join('');
    const finalRows = realPlayers.map(player => {
        const points = round.finalScores[player.id] ?? 0;
        return `<tr><td>${escapeHtml(player.name)}</td><td>${points > 0 ? '+' : ''}${points} pt</td><td>${(points * round.settings.rate).toLocaleString()}</td></tr>`;
    }).join('');
    const settlementRows = transfers.length > 0
        ? transfers.map(transfer => `<li><strong>${escapeHtml(transfer.fromName)}</strong> → <strong>${escapeHtml(transfer.toName)}</strong>：${transfer.points} pt / ${transfer.amount.toLocaleString()}</li>`).join('')
        : '<li>精算なし</li>';

    return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
      body{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;color:#183028;padding:28px}
      h1{font-size:24px;margin:0 0 4px} .meta{color:#62706a;font-size:12px;margin-bottom:20px}
      table{border-collapse:collapse;width:100%;margin:12px 0 22px} th,td{border:1px solid #dce5e0;padding:7px;text-align:center;font-size:11px}
      th{background:#16794b;color:white} h2{font-size:16px;margin-top:22px} li{margin:8px 0}
      .memo{white-space:pre-wrap;background:#f5f8f6;padding:10px;border-radius:6px}
    </style></head><body>
      <h1>${escapeHtml(round.name)}</h1>
      <div class="meta">${escapeHtml(round.settings.courseName)} / ${escapeHtml(round.settings.playedAt)}</div>
      ${round.settings.memo ? `<div class="memo">${escapeHtml(round.settings.memo)}</div>` : ''}
      <h2>スコアカード</h2><table><thead><tr><th>H</th><th>Par</th>${realPlayers.map(player => `<th>${escapeHtml(player.name)}</th>`).join('')}</tr></thead><tbody>${scoreRows}</tbody></table>
      <h2>最終結果</h2><table><tbody>${finalRows}</tbody></table>
      <h2>最小送金表</h2><ul>${settlementRows}</ul>
    </body></html>`;
}

function downloadWeb(content: string, mimeType: string, filename: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

async function shareNativeFile(uri: string, mimeType: string) {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available');
    await Sharing.shareAsync(uri, { mimeType });
}

export async function exportRoundCsv(round: RoundResult): Promise<void> {
    const filename = `${safeFilename(round.name)}.csv`;
    const csv = buildRoundCsv(round);
    if (Platform.OS === 'web') {
        downloadWeb(csv, 'text/csv;charset=utf-8', filename);
        return;
    }
    const directory = FileSystem.cacheDirectory;
    if (!directory) throw new Error('Cache directory is unavailable');
    const uri = `${directory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await shareNativeFile(uri, 'text/csv');
}

export async function exportRoundPdf(round: RoundResult): Promise<void> {
    const html = buildRoundHtml(round);
    if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (!printWindow) throw new Error('Popup was blocked');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 250);
        return;
    }
    const { uri } = await Print.printToFileAsync({ html });
    await shareNativeFile(uri, 'application/pdf');
}
