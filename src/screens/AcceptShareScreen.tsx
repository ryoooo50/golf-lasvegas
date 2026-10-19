import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { isRoundNotFound } from '../services/cloudSave';
import { acceptSharedRound } from '../services/roundShares';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useSharedRoundsStore } from '../store/sharedRoundsStore';
import { C } from '../theme/colors';
import { AuthScreen } from './AuthScreen';

type AcceptStatus = 'accepting' | 'invalid' | 'error';

/** 共有リンク（/share?token=...）の受け取り。ログイン後に自動で1回だけ追加し、ラウンド詳細へ移動する */
export const AcceptShareScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const { token } = useLocalSearchParams<{ token?: string }>();
    const user = useAuthStore(state => state.user);
    const isLoading = useAuthStore(state => state.isLoading);
    const userId = user?.id ?? null;
    const [status, setStatus] = useState<AcceptStatus>('accepting');

    // 直接このルートを開いた場合は認証が初期化されていないので、ここで1回だけ初期化する
    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        if (!useAuthStore.getState().user) void useAuthStore.getState().initialize();
    }, []);

    // 同じ token・同じユーザーでは1回しか受け取らない（再描画や StrictMode で二重に呼ばない）
    const acceptedKey = useRef<string | null>(null);
    const accept = useCallback(async (viewerId: string, shareToken: string) => {
        setStatus('accepting');
        try {
            const { roundId, isOwner } = await acceptSharedRound(shareToken);
            // 読み込みに失敗したまま詳細へ進むと「見つかりません」になるので、エラー表示にして再試行できるようにする
            let isLoaded: boolean;
            if (isOwner) {
                await useGameStore.getState().loadCloudRounds();
                isLoaded = useGameStore.getState().savedRounds.some(r => r.id === roundId);
            } else {
                isLoaded = await useSharedRoundsStore.getState().loadSharedRounds(viewerId);
            }
            if (!isLoaded) {
                setStatus('error');
                return;
            }
            router.replace({ pathname: '/round-detail', params: { id: roundId } });
        } catch (error) {
            setStatus(isRoundNotFound(error) ? 'invalid' : 'error');
        }
    }, [router]);

    useEffect(() => {
        if (!userId || !token) return;
        const key = `${userId}:${token}`;
        if (acceptedKey.current === key) return;
        acceptedKey.current = key;
        void accept(userId, token);
    }, [accept, token, userId]);

    const retry = () => {
        if (!userId || !token) return;
        void accept(userId, token);
    };

    if (!token) return <Message text={t('common.shareInvalid')} actionLabel={t('common.shareGoHome')} onAction={() => router.replace('/')} />;
    if (isLoading) return <Spinner />;
    if (!userId) return <AuthScreen message={t('common.shareLoginRequired')} allowGuest={false} />;
    if (status === 'invalid') return <Message text={t('common.shareInvalid')} actionLabel={t('common.shareGoHome')} onAction={() => router.replace('/')} />;
    if (status === 'error') return <Message text={t('common.shareNetworkError')} actionLabel={t('common.shareTryAgain')} onAction={retry} />;
    return <Spinner />;
};

const Spinner = () => (
    <View style={styles.center}>
        <ActivityIndicator size="large" color={C.greenPrimary} />
    </View>
);

interface MessageProps {
    text: string;
    actionLabel: string;
    onAction: () => void;
}

const Message = ({ text, actionLabel, onAction }: MessageProps) => (
    <View style={styles.center}>
        <Text style={styles.text}>{text}</Text>
        <Button mode="contained" onPress={onAction} style={styles.button}>{actionLabel}</Button>
    </View>
);

const styles = StyleSheet.create({
    center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
    text: { color: C.ink2, fontSize: 14, textAlign: 'center', lineHeight: 22 },
    button: { borderRadius: 8 },
});
