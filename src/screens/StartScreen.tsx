import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, RadioButton, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlayerNamesForm } from "../components/shared/PlayerNamesForm";
import { SyncStatusBanner } from "../components/shared/SyncStatusBanner";
import { useAuthStore } from "../store/authStore";
import { useGameStore } from "../store/gameStore";
import { C } from "../theme/colors";
import { Player } from "../types";

const DEFAULT_PLAYER_NAMES = ["Player 1", "Player 2", "Player 3", "Player 4"];

export const StartScreen = () => {
  const router = useRouter();
  const {
    startGame, updateSettings, updatePlayerName, settings, players,
    savedRounds, resumeRound, resetGame, playerProfiles, togglePlayerFavorite,
  } = useGameStore();
  const { signOut, user, isGuest } = useAuthStore();
  const { t } = useTranslation();

  // Form state
  const [matchName, setMatchName] = useState(settings.matchName ?? "");
  const [courseName, setCourseName] = useState(settings.courseName ?? "");
  const [playedAt, setPlayedAt] = useState(
    settings.playedAt || new Date().toISOString().slice(0, 10),
  );
  const [memo, setMemo] = useState(settings.memo ?? "");
  const [rate, setRate] = useState((settings.rate ?? 10).toString());
  const [playerCount, setPlayerCount] = useState<3 | 4>(
    settings.playerCount ?? 4,
  );
  const [roundLength, setRoundLength] = useState<9 | 18>(
    settings.roundLength ?? 18,
  );
  const [pushLimit, setPushLimit] = useState(settings.maxPushCountPerHalf ?? 2);
  const [pushRecoveryOnBirdie, setPushRecoveryOnBirdie] = useState(
    settings.pushRecoveryOnBirdie ?? 1,
  );
  const [pushRecoveryOnEagle, setPushRecoveryOnEagle] = useState(
    settings.pushRecoveryOnEagle ?? 2,
  );
  const [startCourse, setStartCourse] = useState<"OUT" | "IN">("OUT");
  const [playerNames, setPlayerNames] = useState<string[]>([
    players[0]?.name ?? DEFAULT_PLAYER_NAMES[0],
    players[1]?.name ?? DEFAULT_PLAYER_NAMES[1],
    players[2]?.name ?? DEFAULT_PLAYER_NAMES[2],
    players[3]?.name ?? DEFAULT_PLAYER_NAMES[3],
  ]);

  const handlePlayerNameChange = (index: number, value: string) => {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const buildPlayers = (): Player[] => {
    const base: Player[] = Array.from({ length: 4 }, (_, i) => ({
      id: `p${i + 1}`,
      name: playerNames[i] || DEFAULT_PLAYER_NAMES[i],
      type: "real" as const,
      pushUsageCount: { front9: 0, back9: 0 },
    }));

    if (playerCount === 3) {
      base[3] = {
        id: "p4",
        name: "ボギーくん",
        type: "bogey_kun",
        pushUsageCount: { front9: 0, back9: 0 },
      };
    }

    return base;
  };

  const handleStart = () => {
    const parsedRate = parseInt(rate, 10);

    updateSettings({
      matchName,
      courseName,
      playedAt,
      memo,
      rate: isNaN(parsedRate) ? 10 : parsedRate,
      maxPushCountPerHalf: pushLimit,
      playerCount,
      roundLength,
      pushRecoveryOnBirdie,
      pushRecoveryOnEagle,
    });

    // Apply player names directly via store
    const newPlayers = buildPlayers();
    newPlayers.forEach((p, i) => {
      if (players[i]) {
        updatePlayerName(players[i].id, p.name);
      }
    });

    const startHole = startCourse === "OUT" ? 1 : 10;
    startGame(startHole);
  };

  const applyPlayerProfile = (name: string) => {
    setPlayerNames((current) => {
      if (current.slice(0, playerCount).some((value) => value === name)) return current;
      const next = [...current];
      const replaceIndex = next.slice(0, playerCount).findIndex((value, index) =>
        !value.trim() || value === DEFAULT_PLAYER_NAMES[index] || /^Player [A-D]$/.test(value),
      );
      next[replaceIndex >= 0 ? replaceIndex : 0] = name;
      return next;
    });
  };

  const currentOwnerId = user?.id ?? (isGuest ? "guest" : null);
  const visiblePlayerProfiles = playerProfiles.filter((profile) =>
    profile.ownerId === currentOwnerId || (!profile.ownerId && isGuest),
  );
  const pausedRounds = savedRounds.filter((round) =>
    round.gameStatus === "paused" &&
    (round.ownerId === currentOwnerId || (!round.ownerId && isGuest)),
  );

  const handleExitSession = () => {
    const execute = async () => {
      await signOut();
      resetGame();
    };
    const message = user
      ? t("auth.confirmLogout")
      : t("auth.confirmExitGuest");
    if (Platform.OS === "web") {
      if (window.confirm(message)) void execute();
      return;
    }
    Alert.alert(
      user ? t("auth.logoutButton") : t("auth.exitGuestButton"),
      message,
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.ok"), onPress: () => { void execute(); } },
      ],
    );
  };

  const decrementPushLimit = () => setPushLimit((v) => Math.max(0, v - 1));
  const incrementPushLimit = () => setPushLimit((v) => Math.min(5, v + 1));
  const decrementBirdieRecovery = () =>
    setPushRecoveryOnBirdie((v) => Math.max(0, v - 1));
  const incrementBirdieRecovery = () =>
    setPushRecoveryOnBirdie((v) => Math.min(5, v + 1));
  const decrementEagleRecovery = () =>
    setPushRecoveryOnEagle((v) => Math.max(0, v - 1));
  const incrementEagleRecovery = () =>
    setPushRecoveryOnEagle((v) => Math.min(5, v + 1));

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <SyncStatusBanner />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandPill}>
            <View style={styles.brandIcon}>
              <Ionicons name="flag" size={12} color="#fff" />
            </View>
            <Text style={styles.brandText}>GOLF LAS VEGAS</Text>
          </View>
          <Text style={styles.title}>試合をセットアップ</Text>

          {pausedRounds.map((round) => (
            <View key={round.id} style={styles.resumeCard}>
              <View style={styles.resumeInfo}>
                <Text style={styles.resumeTitle}>{round.name}</Text>
                <Text style={styles.resumeMeta}>
                  {t("common.pausedRoundSummary", {
                    holes: round.history.length,
                    total: round.roundLength,
                  })}
                </Text>
              </View>
              <Button mode="contained" compact onPress={() => resumeRound(round.id)}>
                {t("common.resume")}
              </Button>
            </View>
          ))}

          <View style={styles.card}>
            {/* Match Name */}
            <TextInput
              label={t("common.matchName")}
              value={matchName}
              onChangeText={setMatchName}
              style={styles.input}
              mode="outlined"
              accessibilityLabel={t("common.matchName")}
            />

            <TextInput
              label={t("setup.courseNameLabel")}
              value={courseName}
              onChangeText={setCourseName}
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label={t("setup.playedAtLabel")}
              value={playedAt}
              onChangeText={setPlayedAt}
              placeholder="YYYY-MM-DD"
              style={styles.input}
              mode="outlined"
            />

            <TextInput
              label={t("setup.memoLabel")}
              value={memo}
              onChangeText={setMemo}
              multiline
              numberOfLines={2}
              style={styles.input}
              mode="outlined"
            />

            {/* Rate — no currency symbol */}
            <TextInput
              label={t("setup.rateLabel")}
              value={rate}
              onChangeText={setRate}
              keyboardType="numeric"
              style={styles.input}
              mode="outlined"
              accessibilityLabel={t("setup.rateLabel")}
            />

            {/* Player Count */}
            <Text style={styles.fieldLabel}>{t("setup.playerCount")}</Text>
            <View style={styles.row}>
              <RadioButton.Group
                onValueChange={(v) => setPlayerCount(Number(v) as 3 | 4)}
                value={playerCount.toString()}
              >
                <View style={styles.radioRow}>
                  <RadioButton.Item
                    label="3"
                    value="3"
                    style={styles.radioItem}
                    labelStyle={styles.radioLabel}
                  />
                  <RadioButton.Item
                    label="4"
                    value="4"
                    style={styles.radioItem}
                    labelStyle={styles.radioLabel}
                  />
                </View>
              </RadioButton.Group>
            </View>

            {/* Push Limit */}
            <Text style={styles.fieldLabel}>{t("setup.pushLimitLabel")}</Text>
            <View style={styles.stepperRow}>
              <Button
                mode="outlined"
                compact
                onPress={decrementPushLimit}
                style={styles.stepperBtn}
                accessibilityLabel="プッシュ上限を減らす"
              >
                −
              </Button>
              <Text style={styles.stepperValue}>{pushLimit}</Text>
              <Button
                mode="outlined"
                compact
                onPress={incrementPushLimit}
                style={styles.stepperBtn}
                accessibilityLabel="プッシュ上限を増やす"
              >
                ＋
              </Button>
            </View>

            {/* Push Recovery on Birdie */}
            <Text style={styles.fieldLabel}>
              {t("setup.pushRecoveryBirdieLabel")}
            </Text>
            <View style={styles.stepperRow}>
              <Button
                mode="outlined"
                compact
                onPress={decrementBirdieRecovery}
                style={styles.stepperBtn}
                accessibilityLabel={t("setup.pushRecoveryBirdieLabel")}
              >
                −
              </Button>
              <Text style={styles.stepperValue}>{pushRecoveryOnBirdie}</Text>
              <Button
                mode="outlined"
                compact
                onPress={incrementBirdieRecovery}
                style={styles.stepperBtn}
                accessibilityLabel={t("setup.pushRecoveryBirdieLabel")}
              >
                ＋
              </Button>
            </View>

            {/* Push Recovery on Eagle */}
            <Text style={styles.fieldLabel}>
              {t("setup.pushRecoveryEagleLabel")}
            </Text>
            <View style={styles.stepperRow}>
              <Button
                mode="outlined"
                compact
                onPress={decrementEagleRecovery}
                style={styles.stepperBtn}
                accessibilityLabel={t("setup.pushRecoveryEagleLabel")}
              >
                −
              </Button>
              <Text style={styles.stepperValue}>{pushRecoveryOnEagle}</Text>
              <Button
                mode="outlined"
                compact
                onPress={incrementEagleRecovery}
                style={styles.stepperBtn}
                accessibilityLabel={t("setup.pushRecoveryEagleLabel")}
              >
                ＋
              </Button>
            </View>

            {/* Player Names */}
            <PlayerNamesForm
              names={playerNames}
              playerCount={playerCount}
              onChange={handlePlayerNameChange}
            />

            {visiblePlayerProfiles.length > 0 && (
              <View style={styles.profileSection}>
                <Text style={styles.fieldLabel}>{t("setup.savedPlayersLabel")}</Text>
                <View style={styles.profileList}>
                  {visiblePlayerProfiles.slice(0, 8).map((profile) => (
                    <View key={profile.id} style={styles.profileChip}>
                      <TouchableOpacity onPress={() => applyPlayerProfile(profile.name)}>
                        <Text style={styles.profileName}>{profile.name}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => togglePlayerFavorite(profile.id)}
                        accessibilityLabel={t("setup.toggleFavorite", { name: profile.name })}
                      >
                        <Ionicons
                          name={profile.isFavorite ? "star" : "star-outline"}
                          size={15}
                          color={profile.isFavorite ? "#C88700" : C.ink4}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.fieldLabel}>{t("setup.roundLengthLabel")}</Text>
            <RadioButton.Group
              onValueChange={(value) => setRoundLength(Number(value) as 9 | 18)}
              value={roundLength.toString()}
            >
              <View style={styles.radioRow}>
                <RadioButton.Item label="9" value="9" style={styles.radioItem} labelStyle={styles.radioLabel} />
                <RadioButton.Item label="18" value="18" style={styles.radioItem} labelStyle={styles.radioLabel} />
              </View>
            </RadioButton.Group>

            {/* Start Course */}
            <Text style={styles.fieldLabel}>{t("setup.startCourseLabel")}</Text>
            <RadioButton.Group
              onValueChange={(v) => setStartCourse(v as "OUT" | "IN")}
              value={startCourse}
            >
              <View style={styles.radioRow}>
                <RadioButton.Item
                  label={t("common.out")}
                  value="OUT"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                />
                <RadioButton.Item
                  label={t("common.in")}
                  value="IN"
                  style={styles.radioItem}
                  labelStyle={styles.radioLabel}
                />
              </View>
            </RadioButton.Group>

            {/* Start Button */}
            <Button
              mode="contained"
              onPress={handleStart}
              style={styles.startButton}
              contentStyle={styles.startContent}
              labelStyle={styles.startLabel}
              accessibilityLabel={t("common.startGame")}
            >
              {t("common.startGame")}
            </Button>
          </View>

          {/* History */}
          <Button
            mode="outlined"
            icon="history"
            style={styles.historyButton}
            onPress={() => router.push("/history")}
          >
            {t("common.viewHistory")}
          </Button>
          {(user || isGuest) && (
            <Button
              mode="text"
              icon="logout"
              textColor={C.ink3}
              onPress={handleExitSession}
            >
              {user ? t("auth.logoutButton") : t("auth.exitGuestButton")}
            </Button>
          )}
        </ScrollView>

        <Text style={styles.footer}>© 2026 Golf LasVegas</Text>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 999,
    marginBottom: 16,
  },
  brandIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.greenPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: C.greenDeep,
  },
  title: { fontSize: 24, fontWeight: "800", color: C.ink, marginBottom: 20 },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 20,
    gap: 4,
  },
  profileSection: { marginTop: 4 },
  profileList: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 8 },
  profileChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 7 },
  profileName: { color: C.ink2, fontSize: 12, fontWeight: "600" },
  resumeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.greenTint,
    borderWidth: 1,
    borderColor: C.greenPrimary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  resumeInfo: { flex: 1 },
  resumeTitle: { color: C.ink, fontSize: 15, fontWeight: "700" },
  resumeMeta: { color: C.ink3, fontSize: 12, marginTop: 3 },
  input: { marginBottom: 8, backgroundColor: C.surface },
  fieldLabel: {
    color: C.ink3,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 4,
  },
  row: { flexDirection: "row", alignItems: "center" },
  radioRow: { flexDirection: "row" },
  radioItem: { flex: 1 },
  radioLabel: { color: C.ink2 },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginVertical: 6,
  },
  stepperBtn: { minWidth: 48 },
  stepperValue: {
    color: C.ink,
    fontSize: 20,
    fontWeight: "bold",
    width: 32,
    textAlign: "center",
  },
  startButton: { marginTop: 20, borderRadius: 8 },
  startContent: { height: 56 },
  startLabel: { fontSize: 17, fontWeight: "bold", letterSpacing: 0.5 },
  historyButton: { marginTop: 16, borderRadius: 6 },
  footer: {
    color: C.ink4,
    textAlign: "center",
    marginBottom: 20,
    fontSize: 12,
  },
});
