import { useNetInfo } from '@react-native-community/netinfo';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { useGameStore } from '../../store/gameStore';
import { C } from '../../theme/colors';

export function SyncStatusBanner() {
    const { t } = useTranslation();
    const network = useNetInfo();
    const user = useAuthStore(state => state.user);
    const pendingCloudSaves = useGameStore(state => state.pendingCloudSaves);
    const syncPendingCloudSaves = useGameStore(state => state.syncPendingCloudSaves);
    const pendingCount = user
        ? pendingCloudSaves.filter(item => item.userId === user.id).length
        : 0;

    useEffect(() => {
        if (!user || network.isConnected !== true || pendingCount === 0) return;
        void syncPendingCloudSaves();
    }, [network.isConnected, pendingCount, syncPendingCloudSaves, user]);

    const offline = network.isConnected === false;
    const text = offline
        ? t('common.offlineStatus')
        : pendingCount > 0
            ? t('common.pendingSyncStatus', { count: pendingCount })
            : user
                ? t('common.syncedStatus')
                : t('common.localOnlyStatus');

    return (
        <View style={[styles.banner, offline ? styles.offline : pendingCount > 0 ? styles.pending : styles.online]}>
            <View style={[styles.dot, offline ? styles.dotOffline : pendingCount > 0 ? styles.dotPending : styles.dotOnline]} />
            <Text style={styles.text}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 5 },
    online: { backgroundColor: C.greenTint },
    pending: { backgroundColor: '#FFF4D6' },
    offline: { backgroundColor: C.coralTint },
    dot: { width: 7, height: 7, borderRadius: 4 },
    dotOnline: { backgroundColor: C.greenPrimary },
    dotPending: { backgroundColor: '#C88700' },
    dotOffline: { backgroundColor: C.coralPrimary },
    text: { color: C.ink3, fontSize: 10, fontWeight: '700' },
});
