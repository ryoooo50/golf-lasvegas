import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Dialog, Menu, Portal, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/shared/ScreenHeader';
import * as adminUsers from '../services/adminUsers';
import { AdminUser } from '../services/adminUsers';
import { useAuthStore } from '../store/authStore';
import { C } from '../theme/colors';
import { toAuthErrorKey } from '../utils/authErrorMessage';
import { confirmAction, notify } from '../utils/dialogs';

const MIN_PASSWORD_LENGTH = 8;
const SEARCH_DEBOUNCE_MS = 300;

export const AdminScreen = () => {
    const router = useRouter();
    const { t } = useTranslation();
    const currentUser = useAuthStore(state => state.user);

    const [search, setSearch] = useState('');
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [menuUserId, setMenuUserId] = useState<string | null>(null);
    const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
    const [newPassword, setNewPassword] = useState('');

    const errorText = useCallback((error: unknown, key: string) => {
        const { key: authKey, detail } = toAuthErrorKey(error);
        return t(key, { detail: detail ?? t(authKey) });
    }, [t]);

    const load = useCallback(async (query: string) => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const result = await adminUsers.listUsers(query);
            setUsers(result.users);
            setTotal(result.total);
        } catch (error: unknown) {
            setLoadError(errorText(error, 'admin.loadError'));
        } finally {
            setIsLoading(false);
        }
    }, [errorText]);

    useEffect(() => {
        if (!currentUser?.isAdmin) return;
        const timer = setTimeout(() => { void load(search); }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search, load, currentUser?.isAdmin]);

    const runAction = async (action: () => Promise<void>, successMessage?: string) => {
        try {
            await action();
            if (successMessage) notify(successMessage, '', t('common.ok'));
            await load(search);
        } catch (error: unknown) {
            notify(t('common.warning'), errorText(error, 'admin.actionError'), t('common.ok'));
        }
    };

    const confirmThen = (message: string, okText: string, action: () => Promise<void>, destructive = false) => {
        setMenuUserId(null);
        confirmAction({
            title: message,
            okText,
            cancelText: t('common.cancel'),
            destructive,
            onConfirm: () => { void runAction(action); },
        });
    };

    const submitPassword = () => {
        const target = passwordTarget;
        if (!target || newPassword.length < MIN_PASSWORD_LENGTH) return;
        setPasswordTarget(null);
        void runAction(() => adminUsers.setUserPassword(target.id, newPassword), t('admin.passwordUpdated'));
    };

    if (!currentUser?.isAdmin) {
        return (
            <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
                <ScreenHeader title={t('admin.title')} onBack={() => router.back()} />
                <Text style={styles.message}>{t('admin.forbidden')}</Text>
            </SafeAreaView>
        );
    }

    const renderUser = ({ item }: { item: AdminUser }) => {
        const isSelf = item.id === currentUser.id;
        const meta = [
            item.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser'),
            item.banned ? t('admin.banned') : null,
            t('admin.createdAt', { date: item.createdAt.slice(0, 10) }),
        ].filter(Boolean).join(' · ');

        return (
            <View style={styles.row}>
                <View style={styles.rowText}>
                    <Text style={styles.email} numberOfLines={1}>
                        {item.email}{isSelf ? `（${t('admin.you')}）` : ''}
                    </Text>
                    <Text style={styles.meta}>{meta}</Text>
                </View>
                {!isSelf && (
                    <Menu
                        visible={menuUserId === item.id}
                        onDismiss={() => setMenuUserId(null)}
                        anchor={
                            <Button mode="outlined" compact onPress={() => setMenuUserId(item.id)} textColor={C.ink2}>
                                {t('admin.actions')}
                            </Button>
                        }
                    >
                        <Menu.Item
                            title={t('admin.resetPassword')}
                            onPress={() => { setMenuUserId(null); setNewPassword(''); setPasswordTarget(item); }}
                        />
                        <Menu.Item
                            title={item.role === 'admin' ? t('admin.makeUser') : t('admin.makeAdmin')}
                            onPress={() => {
                                const nextRole = item.role === 'admin' ? 'user' : 'admin';
                                confirmThen(
                                    t(nextRole === 'admin' ? 'admin.confirmMakeAdmin' : 'admin.confirmMakeUser', { email: item.email }),
                                    t('common.ok'),
                                    () => adminUsers.setUserRole(item.id, nextRole),
                                );
                            }}
                        />
                        <Menu.Item
                            title={item.banned ? t('admin.unban') : t('admin.ban')}
                            onPress={() => confirmThen(
                                t(item.banned ? 'admin.confirmUnban' : 'admin.confirmBan', { email: item.email }),
                                item.banned ? t('admin.unban') : t('admin.ban'),
                                () => adminUsers.setUserBanned(item.id, !item.banned),
                                !item.banned,
                            )}
                        />
                        <Menu.Item
                            title={t('admin.remove')}
                            titleStyle={{ color: C.coralDeep }}
                            onPress={() => confirmThen(
                                t('admin.confirmRemove', { email: item.email }),
                                t('admin.remove'),
                                () => adminUsers.removeUser(item.id),
                                true,
                            )}
                        />
                    </Menu>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
            <ScreenHeader title={t('admin.title')} onBack={() => router.back()} />
            <FlatList
                data={users}
                keyExtractor={user => user.id}
                renderItem={renderUser}
                contentContainerStyle={styles.body}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <TextInput
                            label={t('admin.searchLabel')}
                            value={search}
                            onChangeText={setSearch}
                            mode="outlined"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            style={styles.search}
                        />
                        <View style={styles.countRow}>
                            <Text style={styles.meta}>{t('admin.count', { count: total })}</Text>
                            {isLoading && <ActivityIndicator size="small" />}
                        </View>
                        {loadError && <Text style={styles.error}>{loadError}</Text>}
                    </View>
                }
                ListEmptyComponent={!isLoading && !loadError ? <Text style={styles.message}>{t('admin.empty')}</Text> : null}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />

            <Portal>
                <Dialog visible={passwordTarget !== null} onDismiss={() => setPasswordTarget(null)}>
                    <Dialog.Title>{t('admin.newPasswordTitle', { email: passwordTarget?.email ?? '' })}</Dialog.Title>
                    <Dialog.Content>
                        <TextInput
                            label={t('admin.newPasswordLabel')}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry
                            autoCapitalize="none"
                            mode="outlined"
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setPasswordTarget(null)}>{t('common.cancel')}</Button>
                        <Button onPress={submitPassword} disabled={newPassword.length < MIN_PASSWORD_LENGTH}>
                            {t('common.save')}
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    body: { padding: 16, paddingBottom: 40 },
    header: { marginBottom: 8 },
    search: { backgroundColor: C.surface },
    countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 24 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 56,
    },
    rowText: { flex: 1, minWidth: 0 },
    email: { fontSize: 14, fontWeight: '700', color: C.ink },
    meta: { fontSize: 12, color: C.ink3, marginTop: 2 },
    separator: { height: 8 },
    message: { color: C.ink3, textAlign: 'center', marginTop: 24 },
    error: { color: C.coralDeep, marginTop: 8 },
});
