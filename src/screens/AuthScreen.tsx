import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../theme/colors';
import { useAuthStore } from '../store/authStore';

type AuthMode = 'login' | 'signup';

const FEATURE_PILLS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { icon: 'trending-up-outline', label: 'バーディーFLIP' },
    { icon: 'swap-horizontal-outline', label: 'PUSH倍率' },
    { icon: 'time-outline', label: 'CARRY OVER' },
];

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

    const toggleMode = () => {
        setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={C.greenPrimary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[C.greenTint, C.bg, C.bg]}
                style={StyleSheet.absoluteFillObject}
            />
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <View style={styles.brandPill}>
                        <View style={styles.brandIcon}>
                            <Ionicons name="flag" size={12} color="#fff" />
                        </View>
                        <Text style={styles.brandText}>GOLF LAS VEGAS</Text>
                    </View>

                    <Text style={styles.hero}>
                        ラスベガスの{'\n'}
                        <Text style={styles.heroAccent}>計算ミス、</Text>ゼロへ。
                    </Text>
                    <Text style={styles.heroSub}>
                        バーディーフリップ、プッシュ倍率、キャリーオーバー。{'\n'}複雑な計算は全部おまかせ。
                    </Text>

                    <View style={styles.pillRow}>
                        {FEATURE_PILLS.map((f) => (
                            <View key={f.label} style={styles.featurePill}>
                                <Ionicons name={f.icon} size={13} color={C.greenPrimary} />
                                <Text style={styles.featurePillText}>{f.label}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.tabRow}>
                        <Button
                            mode={mode === 'login' ? 'contained' : 'outlined'}
                            onPress={() => setMode('login')}
                            style={styles.tabButton}
                            compact
                        >
                            {t('auth.loginTitle')}
                        </Button>
                        <Button
                            mode={mode === 'signup' ? 'contained' : 'outlined'}
                            onPress={() => setMode('signup')}
                            style={styles.tabButton}
                            compact
                        >
                            {t('auth.signupTitle')}
                        </Button>
                    </View>

                    <View style={styles.card}>
                        <TextInput
                            label={t('auth.email')}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            mode="outlined"
                            style={styles.input}
                        />
                        <TextInput
                            label={t('auth.password')}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            mode="outlined"
                            style={styles.input}
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
                            disabled={isLoading}
                        >
                            {mode === 'login' ? t('auth.loginButton') : t('auth.signupButton')}
                        </Button>

                        <Button mode="text" onPress={toggleMode} style={styles.toggleButton} compact>
                            {mode === 'login' ? t('auth.noAccount') : t('auth.alreadyAccount')}
                        </Button>
                    </View>

                    <Button
                        mode="text"
                        onPress={() => playAsGuest()}
                        style={styles.guestButton}
                        textColor={C.ink3}
                    >
                        {t('auth.guestButton')} →
                    </Button>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    loadingContainer: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    safeArea: { flex: 1 },
    scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32, justifyContent: 'center' },
    brandPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.9)',
        paddingVertical: 5,
        paddingLeft: 6,
        paddingRight: 12,
        borderRadius: 999,
        marginBottom: 24,
    },
    brandIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.greenPrimary, alignItems: 'center', justifyContent: 'center' },
    brandText: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: C.greenDeep },
    hero: { fontSize: 30, fontWeight: '800', color: C.ink, lineHeight: 38 },
    heroAccent: { color: C.greenPrimary },
    heroSub: { fontSize: 13, color: C.ink3, fontWeight: '500', marginTop: 10, lineHeight: 20 },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16, marginBottom: 28 },
    featurePill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: C.surface, borderWidth: 1, borderColor: C.line,
        borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
    },
    featurePillText: { fontSize: 11, fontWeight: '600', color: C.ink2 },
    tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    tabButton: { flex: 1, borderRadius: 6 },
    card: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 20, gap: 4 },
    input: { marginBottom: 12, backgroundColor: C.surface },
    errorText: { color: C.coralPrimary, fontSize: 13, marginBottom: 8, textAlign: 'center' },
    submitButton: { marginTop: 8, borderRadius: 8 },
    submitContent: { height: 50 },
    submitLabel: { fontSize: 16, fontWeight: 'bold' },
    toggleButton: { marginTop: 4 },
    guestButton: { marginTop: 16, alignSelf: 'center' },
});
