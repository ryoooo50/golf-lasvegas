import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { buildShareUrl, createShareLink, fetchShareStatus, ShareStatus, stopSharing } from '../../services/roundShares';
import { C } from '../../theme/colors';
import { confirmAction, notify } from '../../utils/dialogs';

interface SharePanelProps {
    /** クラウド上のラウンド ID。ゲストや未同期なら null */
    cloudRoundId: string | null;
}

const canCopy = Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard;

export function SharePanel({ cloudRoundId }: SharePanelProps) {
    const { t } = useTranslation();
    const [status, setStatus] = useState<ShareStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isBusy, setIsBusy] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [hasLoadFailed, setHasLoadFailed] = useState(false);

    const showNetworkError = useCallback(() => {
        notify(t('common.shareTitle'), t('common.shareNetworkError'), t('common.ok'));
    }, [t]);

    useEffect(() => {
        setStatus(null);
        setHasLoadFailed(false);
        if (!cloudRoundId) return;
        let isCancelled = false;
        setIsLoading(true);
        fetchShareStatus(cloudRoundId)
            .then(result => { if (!isCancelled) setStatus(result); })
            .catch(() => { if (!isCancelled) { setHasLoadFailed(true); showNetworkError(); } })
            .finally(() => { if (!isCancelled) setIsLoading(false); });
        return () => { isCancelled = true; };
    }, [cloudRoundId, reloadKey, showNetworkError]);

    // 通信中の連打を防ぎつつ、失敗時は共通のエラーを出す
    const runRequest = async (task: () => Promise<void>) => {
        if (isBusy) return;
        setIsBusy(true);
        try {
            await task();
        } catch {
            showNetworkError();
        } finally {
            setIsBusy(false);
        }
    };

    const create = () => {
        if (!cloudRoundId) return;
        void runRequest(async () => setStatus(await createShareLink(cloudRoundId)));
    };

    const stop = () => {
        if (!cloudRoundId) return;
        confirmAction({
            title: t('common.shareStop'),
            message: t('common.shareStopConfirm'),
            okText: t('common.shareStop'),
            cancelText: t('common.cancel'),
            destructive: true,
            onConfirm: () => {
                void runRequest(async () => {
                    await stopSharing(cloudRoundId);
                    setStatus({ token: null, memberCount: 0 });
                });
            },
        });
    };

    const copyUrl = async (url: string) => {
        await navigator.clipboard.writeText(url);
        notify(t('common.shareTitle'), t('common.shareCopied'), t('common.ok'));
    };

    const send = (url: string) => {
        void runRequest(async () => {
            try {
                if (Platform.OS !== 'web') {
                    await Share.share({ message: url });
                } else if (typeof navigator.share === 'function') {
                    await navigator.share({ url });
                } else {
                    await copyUrl(url);
                }
            } catch (error) {
                // シートを閉じただけなら何も出さない
                if (error instanceof Error && error.name === 'AbortError') return;
                throw error;
            }
        });
    };

    const copy = (url: string) => {
        void runRequest(() => copyUrl(url));
    };

    const url = status?.token ? buildShareUrl(status.token) : null;

    return (
        <View style={styles.card}>
            <Text style={styles.title}>{t('common.shareTitle')}</Text>
            {!cloudRoundId ? (
                <Text style={styles.body}>{t('common.shareUnavailable')}</Text>
            ) : isLoading ? null : !status ? (
                hasLoadFailed ? (
                    <>
                        <Text style={styles.body}>{t('common.shareNetworkError')}</Text>
                        <View style={styles.buttons}>
                            <Button mode="outlined" onPress={() => setReloadKey(key => key + 1)} contentStyle={styles.buttonContent}>
                                {t('common.shareRetry')}
                            </Button>
                        </View>
                    </>
                ) : null
            ) : url ? (
                <>
                    <Text style={styles.status}>{t('common.shareActive', { count: status.memberCount })}</Text>
                    <Text style={styles.url} numberOfLines={1} ellipsizeMode="middle" selectable>{url}</Text>
                    <View style={styles.buttons}>
                        <Button mode="contained" disabled={isBusy} onPress={() => send(url)} contentStyle={styles.buttonContent}>
                            {t('common.shareSend')}
                        </Button>
                        {canCopy && (
                            <Button mode="outlined" disabled={isBusy} onPress={() => copy(url)} contentStyle={styles.buttonContent}>
                                {t('common.shareCopy')}
                            </Button>
                        )}
                        <Button mode="text" textColor={C.coralDeep} disabled={isBusy} onPress={stop} contentStyle={styles.buttonContent}>
                            {t('common.shareStop')}
                        </Button>
                    </View>
                </>
            ) : (
                <>
                    <Text style={styles.body}>{t('common.shareDescription')}</Text>
                    <View style={styles.buttons}>
                        <Button mode="contained" loading={isBusy} disabled={isBusy} onPress={create} contentStyle={styles.buttonContent}>
                            {t('common.shareCreateLink')}
                        </Button>
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 20, marginTop: 16 },
    title: { color: C.ink3, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
    body: { color: C.ink2, fontSize: 13, lineHeight: 20 },
    status: { color: C.ink, fontSize: 14, fontWeight: '700' },
    url: { color: C.ink2, fontSize: 12, marginTop: 6 },
    buttons: { gap: 10, marginTop: 14 },
    buttonContent: { minHeight: 44 },
});
