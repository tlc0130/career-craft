import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useHistory, HistoryItem, MAX_ITEMS, NEAR_CAP_THRESHOLD } from "@/hooks/useHistory";

interface Resume {
  id: string;
  title: string;
  jobTitle: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  lifetime: "Lifetime",
};

const PLAN_COLORS: Record<string, string> = {
  starter: "#65758B",
  pro: "#3875A3",
  lifetime: "#DBC157",
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "resume" | "cover-letter">("all");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const { items: historyItems, deleteItem: deleteHistoryItem, renameItem: renameHistoryItem, clearAll: clearAllHistory } = useHistory();

  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const closeOtherSwipeables = useCallback((exceptId: string) => {
    swipeableRefs.current.forEach((ref, id) => {
      if (id !== exceptId && ref) {
        ref.close();
      }
    });
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const {
    data: resumes,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Resume[]>({
    queryKey: ["resumes"],
    queryFn: async () => {
      const res = await apiFetch("/api/resumes");
      if (!res.ok) throw new Error("Failed to load resumes");
      return res.json() as Promise<Resume[]>;
    },
    enabled: !!user,
  });

  const handleLogout = useCallback(async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
        },
      },
    ]);
  }, [logout]);

  const handleDeleteResume = useCallback(
    (id: string, title: string) => {
      Alert.alert("Delete Resume", `Delete "${title}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              const res = await apiFetch(`/api/resumes/${id}`, {
                method: "DELETE",
              });
              if (res.ok) {
                queryClient.invalidateQueries({ queryKey: ["resumes"] });
                await refreshUser();
              }
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    [queryClient, refreshUser]
  );

  const handleDeleteResumeSwipe = useCallback(
    async (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setDeletingId(id);
      try {
        const res = await apiFetch(`/api/resumes/${id}`, { method: "DELETE" });
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["resumes"] });
          await refreshUser();
        }
      } finally {
        setDeletingId(null);
      }
    },
    [queryClient, refreshUser]
  );

  const handleStartRename = useCallback((item: HistoryItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRenamingId(item.id);
    setRenameText(item.label);
  }, []);

  const handleCommitRename = useCallback(
    async (id: string) => {
      const trimmed = renameText.trim();
      if (trimmed) {
        await renameHistoryItem(id, trimmed);
      }
      setRenamingId(null);
      setRenameText("");
    },
    [renameText, renameHistoryItem]
  );

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameText("");
  }, []);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      "Clear All History",
      `This will permanently delete all ${historyItems.length} item${historyItems.length === 1 ? "" : "s"} from your history. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await clearAllHistory();
          },
        },
      ]
    );
  }, [historyItems.length, clearAllHistory]);

  const handleDeleteHistory = useCallback(
    (item: HistoryItem) => {
      const typeLabel = item.type === "resume" ? "resume" : "cover letter";
      Alert.alert("Delete from History", `Remove this ${typeLabel} from your history?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await deleteHistoryItem(item.id);
          },
        },
      ]);
    },
    [deleteHistoryItem]
  );

  const handleDeleteHistorySwipe = useCallback(
    async (item: HistoryItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await deleteHistoryItem(item.id);
    },
    [deleteHistoryItem]
  );

  const filteredHistoryItems = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return historyItems.filter((item) => {
      const matchesType =
        historyFilter === "all" ||
        (historyFilter === "resume" && item.type === "resume") ||
        (historyFilter === "cover-letter" && item.type === "cover-letter");
      const matchesSearch = q === "" || item.label.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [historyItems, historySearch, historyFilter]);

  const planColor = user ? (PLAN_COLORS[user.plan] ?? "#65758B") : "#65758B";
  const planLabel = user ? (PLAN_LABELS[user.plan] ?? user.plan) : "";

  const s = makeStyles(colors, topPad, botPad);

  const renderSwipeDeleteAction = useCallback(
    (onDelete: () => void) => () => (
      <Pressable
        style={s.swipeDeleteAction}
        onPress={onDelete}
      >
        <Ionicons name="trash" size={20} color="#fff" />
        <Text style={s.swipeDeleteText}>Delete</Text>
      </Pressable>
    ),
    [s]
  );

  const renderResume = useCallback(
    ({ item }: { item: Resume }) => {
      const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      const dateLabel =
        item.updatedAt > item.createdAt
          ? `Last edited ${formatDate(item.updatedAt)}`
          : `Saved ${formatDate(item.createdAt)}`;
      const isDeleting = deletingId === item.id;

      return (
        <View style={s.swipeableContainer}>
          <Swipeable
            ref={(ref) => { swipeableRefs.current.set(`resume-${item.id}`, ref); }}
            renderRightActions={renderSwipeDeleteAction(() => {
              swipeableRefs.current.get(`resume-${item.id}`)?.close();
              handleDeleteResumeSwipe(item.id);
            })}
            onSwipeableOpen={() => closeOtherSwipeables(`resume-${item.id}`)}
            rightThreshold={60}
            overshootRight={false}
          >
            <View style={s.resumeCard}>
              <View style={s.resumeInfo}>
                <Ionicons
                  name="document-text"
                  size={20}
                  color={colors.primary}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.resumeTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={s.resumeDate}>{dateLabel}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => handleDeleteResume(item.id, item.title)}
                hitSlop={8}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.destructive} />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.mutedForeground}
                  />
                )}
              </Pressable>
            </View>
          </Swipeable>
        </View>
      );
    },
    [deletingId, handleDeleteResume, handleDeleteResumeSwipe, renderSwipeDeleteAction, closeOtherSwipeables, colors, s]
  );

  if (!user) {
    return (
      <View style={[s.root, s.centeredEmpty]}>
        <Animated.View entering={FadeIn.duration(350)} style={s.emptyState}>
          <Ionicons name="person-circle-outline" size={56} color={colors.mutedForeground} />
          <Text style={s.emptyTitle}>Not signed in</Text>
          <Text style={s.emptyDesc}>
            Sign in to view your profile, history, and saved resumes
          </Text>
        </Animated.View>
      </View>
    );
  }

  const ListHeader = (
    <View>
      <View style={s.header}>
        <Text style={s.heading}>Profile</Text>
      </View>

      <View style={s.profileCard}>
        <View style={s.avatarCircle}>
          <Text style={s.avatarInitial}>
            {user.email?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.emailText} numberOfLines={1}>
            {user.email ?? ""}
          </Text>
          <View style={[s.planBadge, { backgroundColor: `${planColor}22` }]}>
            <View style={[s.planDot, { backgroundColor: planColor }]} />
            <Text style={[s.planText, { color: planColor }]}>
              {planLabel} Plan
            </Text>
          </View>
        </View>
      </View>

      {user.plan === "starter" && (
        <View style={s.upgradeCard}>
          <View style={s.upgradeLeft}>
            <Ionicons name="rocket" size={18} color={colors.primary} />
            <View>
              <Text style={s.upgradeTitle}>Upgrade to Pro</Text>
              <Text style={s.upgradeDesc}>
                Unlimited tailoring &amp; resume saves
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* History Section */}
      <View style={s.sectionRow}>
        <Text style={s.sectionLabel}>
          History{historyItems.length > 0 ? ` (${historyItems.length}/${MAX_ITEMS})` : ""}
        </Text>
        {historyItems.length > 0 && (
          <Pressable onPress={handleClearHistory} hitSlop={8}>
            <Text style={s.clearAllText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {historyItems.length >= NEAR_CAP_THRESHOLD && (
        <View style={s.capWarning}>
          <Ionicons name="warning-outline" size={14} color="#B45309" />
          <Text style={s.capWarningText}>
            History is almost full — oldest items will be removed after {MAX_ITEMS}.
          </Text>
        </View>
      )}

      {historyItems.length > 0 && (
        <>
          {/* Search bar */}
          <View style={s.searchRow}>
            <Ionicons name="search" size={16} color={colors.mutedForeground} style={s.searchIcon} />
            <TextInput
              style={s.searchInput}
              placeholder="Search history…"
              placeholderTextColor={colors.mutedForeground}
              value={historySearch}
              onChangeText={setHistorySearch}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {historySearch.length > 0 && (
              <Pressable onPress={() => setHistorySearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          {/* Filter chips */}
          <View style={s.filterRow}>
            {(["all", "resume", "cover-letter"] as const).map((f) => {
              const active = historyFilter === f;
              const label = f === "all" ? "All" : f === "resume" ? "Resumes" : "Cover Letters";
              return (
                <Pressable
                  key={f}
                  style={[s.filterChip, active && s.filterChipActive]}
                  onPress={() => setHistoryFilter(f)}
                >
                  <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {historyItems.length === 0 ? (
        <Animated.View entering={FadeIn.duration(300)} style={s.emptyState}>
          <Ionicons
            name="time-outline"
            size={40}
            color={colors.mutedForeground}
          />
          <Text style={s.emptyTitle}>No history yet</Text>
          <Text style={s.emptyDesc}>
            Tailored resumes and cover letters appear here automatically
          </Text>
        </Animated.View>
      ) : filteredHistoryItems.length === 0 ? (
        <Animated.View entering={FadeIn.duration(300)} style={s.emptyState}>
          <Ionicons
            name="search-outline"
            size={40}
            color={colors.mutedForeground}
          />
          <Text style={s.emptyTitle}>No results</Text>
          <Text style={s.emptyDesc}>
            Try a different keyword or filter
          </Text>
        </Animated.View>
      ) : (
        filteredHistoryItems.map((item) => {
          const date = new Date(item.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const isResume = item.type === "resume";
          const isRenaming = renamingId === item.id;
          const swipeKey = `history-${item.id}`;
          return (
            <View key={item.id} style={s.swipeableContainer}>
            <Swipeable
              enabled={!isRenaming}
              ref={(ref) => { swipeableRefs.current.set(swipeKey, ref); }}
              renderRightActions={renderSwipeDeleteAction(() => {
                swipeableRefs.current.get(swipeKey)?.close();
                handleDeleteHistorySwipe(item);
              })}
              onSwipeableOpen={() => closeOtherSwipeables(swipeKey)}
              rightThreshold={60}
              overshootRight={false}
            >
              <Pressable
                style={({ pressed }) => [
                  s.historyCard,
                  pressed && !isRenaming && { opacity: 0.75 },
                ]}
                onPress={() => {
                  if (!isRenaming) router.push(`/history-detail?id=${item.id}`);
                }}
              >
                <View style={s.historyInfo}>
                  <View
                    style={[
                      s.historyTypeDot,
                      {
                        backgroundColor: isResume
                          ? `${colors.primary}22`
                          : `${colors.mutedForeground}22`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isResume ? "document-text" : "mail"}
                      size={14}
                      color={isResume ? colors.primary : colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    {isRenaming ? (
                      <TextInput
                        style={s.renameInput}
                        value={renameText}
                        onChangeText={setRenameText}
                        onSubmitEditing={() => handleCommitRename(item.id)}
                        onBlur={() => handleCommitRename(item.id)}
                        autoFocus
                        returnKeyType="done"
                        selectTextOnFocus
                        maxLength={80}
                      />
                    ) : (
                      <Text style={s.historyLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                    )}
                    <View style={s.historyMeta}>
                      <Text style={s.historyType}>
                        {isResume ? "Tailored Resume" : "Cover Letter"}
                      </Text>
                      <Text style={s.historyDot}>·</Text>
                      <Text style={s.historyDate}>{date}</Text>
                    </View>
                  </View>
                </View>
                <View style={s.historyActions}>
                  {isRenaming ? (
                    <>
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); handleCommitRename(item.id); }}
                        hitSlop={8}
                        style={s.renameActionBtn}
                      >
                        <Ionicons name="checkmark" size={17} color={colors.primary} />
                      </Pressable>
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); handleCancelRename(); }}
                        hitSlop={8}
                        style={s.renameActionBtn}
                      >
                        <Ionicons name="close" size={17} color={colors.mutedForeground} />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); handleStartRename(item); }}
                        hitSlop={8}
                        style={{ marginRight: 6 }}
                      >
                        <Ionicons name="pencil-outline" size={15} color={colors.mutedForeground} />
                      </Pressable>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.mutedForeground}
                      />
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteHistory(item);
                        }}
                        hitSlop={8}
                        style={{ marginLeft: 6 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.mutedForeground}
                        />
                      </Pressable>
                    </>
                  )}
                </View>
              </Pressable>
            </Swipeable>
            </View>
          );
        })
      )}

      {/* Saved Resumes Section */}
      <Text style={[s.sectionLabel, { marginTop: 20 }]}>Saved Resumes</Text>

      {isLoading && (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: 24 }}
        />
      )}

      {!isLoading && (!resumes || resumes.length === 0) && (
        <Animated.View entering={FadeIn.duration(300)} style={s.emptyState}>
          <Ionicons
            name="document-outline"
            size={40}
            color={colors.mutedForeground}
          />
          <Text style={s.emptyTitle}>No saved resumes</Text>
          <Text style={s.emptyDesc}>
            Tailor a resume and tap "Save to Account"
          </Text>
        </Animated.View>
      )}
    </View>
  );

  return (
    <FlatList<Resume>
      style={[s.root]}
      contentContainerStyle={s.content}
      data={resumes ?? []}
      keyExtractor={(item) => item.id}
      renderItem={renderResume}
      scrollEnabled
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={ListHeader}
      ListFooterComponent={
        <View style={s.footer}>
          <Pressable
            style={({ pressed }) => [
              s.logoutBtn,
              pressed && { opacity: 0.75 },
            ]}
            onPress={handleLogout}
          >
            <Ionicons
              name="log-out-outline"
              size={18}
              color={colors.destructive}
            />
            <Text style={s.logoutText}>Sign Out</Text>
          </Pressable>
          <View style={{ height: botPad + 80 }} />
        </View>
      }
    />
  );
}

function makeStyles(
  colors: ReturnType<typeof useColors>,
  topPad: number,
  botPad: number
) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    centeredEmpty: {
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      paddingTop: topPad + 20,
      paddingHorizontal: 16,
    },
    header: { marginBottom: 20 },
    heading: {
      fontSize: 26,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    profileCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 12,
    },
    avatarCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: `${colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: colors.primary,
      fontFamily: "Inter_700Bold",
    },
    emailText: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 6,
    },
    planBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 20,
    },
    planDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    planText: {
      fontSize: 12,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
    upgradeCard: {
      backgroundColor: `${colors.primary}14`,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: `${colors.primary}40`,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    upgradeLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    upgradeTitle: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    upgradeDesc: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
      marginTop: 8,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.mutedForeground,
      fontFamily: "Inter_600SemiBold",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    clearAllText: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.destructive,
      fontFamily: "Inter_600SemiBold",
    },
    capWarning: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#FEF3C7",
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: "#FDE68A",
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 10,
    },
    capWarningText: {
      flex: 1,
      fontSize: 12,
      color: "#92400E",
      fontFamily: "Inter_400Regular",
    },
    swipeableContainer: {
      marginBottom: 8,
    },
    swipeDeleteAction: {
      backgroundColor: colors.destructive,
      justifyContent: "center",
      alignItems: "center",
      width: 80,
      borderRadius: colors.radius,
      gap: 4,
    },
    swipeDeleteText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
    },
    historyCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    historyInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginRight: 8,
    },
    historyTypeDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    historyLabel: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    historyMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
    },
    historyType: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    historyDot: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    historyDate: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    historyActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    renameInput: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      borderBottomWidth: 1,
      borderBottomColor: colors.primary,
      paddingVertical: 0,
      marginBottom: 2,
    },
    renameActionBtn: {
      marginLeft: 6,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      height: 40,
      marginBottom: 10,
      gap: 6,
    },
    searchIcon: {
      flexShrink: 0,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      paddingVertical: 0,
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: "500" as const,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    filterChipTextActive: {
      color: "#fff",
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
    },
    resumeCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    resumeInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginRight: 12,
    },
    resumeTitle: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    resumeDate: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: 32,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    emptyDesc: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      maxWidth: 240,
    },
    footer: {
      marginTop: 24,
    },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: `${colors.destructive}14`,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: `${colors.destructive}30`,
      height: 48,
    },
    logoutText: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.destructive,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
