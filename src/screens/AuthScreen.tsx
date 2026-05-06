import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';

type AuthMode = 'login' | 'signup';

export const AuthScreen = () => {
    const { t } = useTranslation();
    const { signIn, signUp, playAsGuest, isLoading, error } = useAuthStore();

    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async () => {
        if (mode === 'login') {
            await signIn(email, password);
        } else {
            await signUp(email, password);
        }
    };

    const handleGuest = () => {
        playAsGuest();
    };

    const toggleMode = () => {
        setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.inner}>
                    {/* ロゴ・タイトル */}
                    <Text style={styles.title}>Las Vegas Golf</Text>
                    <Text style={styles.subtitle}>Ultimate Golf Game Calculator</Text>

                    {/* タブ切り替え */}
                    <View style={styles.tabRow}>
                        <Button
                            mode={mode === 'login' ? 'contained' : 'outlined'}
                            onPress={() => setMode('login')}
                            style={styles.tabButton}
                            buttonColor={mode === 'login' ? '#4CAF50' : undefined}
                            textColor={mode === 'login' ? '#fff' : '#aaa'}
                            compact
                        >
                            {t('auth.loginTitle')}
                        </Button>
                        <Button
                            mode={mode === 'signup' ? 'contained' : 'outlined'}
                            onPress={() => setMode('signup')}
                            style={styles.tabButton}
                            buttonColor={mode === 'signup' ? '#4CAF50' : undefined}
                            textColor={mode === 'signup' ? '#fff' : '#aaa'}
                            compact
                        >
                            {t('auth.signupTitle')}
                        </Button>
                    </View>

                    {/* フォーム */}
                    <View style={styles.card}>
                        <TextInput
                            label={t('auth.email')}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            mode="outlined"
                            style={styles.input}
                            textColor="#fff"
                            outlineColor="#555"
                            activeOutlineColor="#4CAF50"
                        />
                        <TextInput
                            label={t('auth.password')}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            mode="outlined"
                            style={styles.input}
                            textColor="#fff"
                            outlineColor="#555"
                            activeOutlineColor="#4CAF50"
                        />

                        {error !== null && (
                            <Text style={styles.errorText}>{error}</Text>
                        )}

                        <Button
                            mode="contained"
                            onPress={handleSubmit}
                            style={styles.submitButton}
                            contentStyle={styles.submitContent}
                            labelStyle={styles.submitLabel}
                            buttonColor="#4CAF50"
                            disabled={isLoading}
                        >
                            {mode === 'login' ? t('auth.loginButton') : t('auth.signupButton')}
                        </Button>

                        <Button
                            mode="text"
                            onPress={toggleMode}
                            style={styles.toggleButton}
                            textColor="#aaa"
                            compact
                        >
                            {mode === 'login' ? t('auth.noAccount') : t('auth.alreadyAccount')}
                        </Button>
                    </View>

                    {/* ゲストとして開始 */}
                    <View style={styles.dividerRow}>
                        <View style={styles.divider} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.divider} />
                    </View>

                    <Button
                        mode="outlined"
                        onPress={handleGuest}
                        style={styles.guestButton}
                        contentStyle={styles.guestContent}
                        textColor="#ccc"
                        icon="account-outline"
                    >
                        {t('auth.guestButton')}
                    </Button>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    safeArea: {
        flex: 1,
    },
    inner: {
        flex: 1,
        paddingHorizontal: 24,
        paddingVertical: 32,
        justifyContent: 'center',
    },
    title: {
        fontSize: 40,
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        letterSpacing: 2,
        marginBottom: 6,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    subtitle: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 32,
        fontWeight: '300',
        textAlign: 'center',
    },
    tabRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    tabButton: {
        flex: 1,
        borderRadius: 8,
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: 20,
        gap: 4,
    },
    input: {
        marginBottom: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    errorText: {
        color: '#f44336',
        fontSize: 13,
        marginBottom: 8,
        textAlign: 'center',
    },
    submitButton: {
        marginTop: 8,
        borderRadius: 30,
    },
    submitContent: {
        height: 50,
    },
    submitLabel: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    toggleButton: {
        marginTop: 4,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
        gap: 12,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#333',
    },
    dividerText: {
        color: '#555',
        fontSize: 12,
    },
    guestButton: {
        borderColor: '#444',
        borderRadius: 30,
    },
    guestContent: {
        height: 50,
    },
});
