import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { getHistoryItem, renameHistoryItem, HistoryItem } from "@/hooks/useHistory";

export default function HistoryDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");
  const renameInputRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (!id) return;
    getHistoryItem(id).then((found) => {
      setItem(found);
      setLoading(false);
    });
  }, [id]);

  async function handleCopy() {
    if (!item) return;
    await Clipboard.setStringAsync(item.content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleStartRename() {
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRenameText(item.label);
    setRenaming(true);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }

  async function handleCommitRename() {
    if (!item) return;
    const trimmed = renameText.trim();
    if (trimmed && trimmed !== item.label) {
      await renameHistoryItem(item.id, trimmed);
      setItem({ ...item, label: trimmed });
    }
    setRenaming(false);
  }

  function handleCancelRename() {
    setRenaming(false);
    setRenameText("");
  }

  const typeLabel = item?.type === "resume" ? "Tailored Resume" : "Cover Letter";
  const typeIcon = item?.type === "resume" ? "document-text" : "mail";

  const formattedDate = item
    ? new Date(item.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const s = makeStyles(colors, topPad, botPad);

  return (
    <View style={s.root}>
      <View style={[s.navBar, { paddingTop: topPad }]}>
        <Pressable
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          <Text style={s.backText}>History</Text>
        </Pressable>

        {item && (
          <Pressable
            style={({ pressed }) => [s.copyBtn, pressed && { opacity: 0.75 }]}
            onPress={handleCopy}
          >
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={16}
              color={copied ? colors.primary : colors.foreground}
            />
            <Text style={[s.copyText, copied && { color: colors.primary }]}>
              {copied ? "Copied!" : "Copy"}
            </Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !item ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.mutedForeground} />
          <Text style={s.notFoundText}>Item not found</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.metaRow}>
            <View style={s.typeBadge}>
              <Ionicons name={typeIcon as "document-text" | "mail"} size={13} color={colors.primary} />
              <Text style={s.typeBadgeText}>{typeLabel}</Text>
            </View>
          </View>

          {renaming ? (
            <View style={s.renameRow}>
              <TextInput
                ref={renameInputRef}
                style={s.renameInput}
                value={renameText}
                onChangeText={setRenameText}
                onSubmitEditing={handleCommitRename}
                returnKeyType="done"
                selectTextOnFocus
                maxLength={80}
                multiline={false}
              />
              <View style={s.renameButtons}>
                <Pressable
                  style={({ pressed }) => [s.renameBtn, pressed && { opacity: 0.6 }]}
                  onPress={handleCommitRename}
                  hitSlop={8}
                >
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.renameBtn, pressed && { opacity: 0.6 }]}
                  onPress={handleCancelRename}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={s.labelRow} onPress={handleStartRename}>
              <Text style={s.label} numberOfLines={3}>
                {item.label}
              </Text>
              <Ionicons name="pencil-outline" size={15} color={colors.mutedForeground} style={s.labelEditIcon} />
            </Pressable>
          )}
          <Text style={s.date}>{formattedDate}</Text>

          <View style={s.divider} />

          <Text style={s.content} selectable>
            {item.content}
          </Text>

          <View style={{ height: botPad + 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, _botPad: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    navBar: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    backText: {
      fontSize: 16,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    copyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: colors.secondary,
      borderRadius: 20,
    },
    copyText: {
      fontSize: 13,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    notFoundText: {
      fontSize: 16,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    typeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: `${colors.primary}18`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    typeBadgeText: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600" as const,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 4,
    },
    label: {
      flex: 1,
      fontSize: 20,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    labelEditIcon: {
      marginTop: 4,
    },
    renameRow: {
      marginBottom: 4,
    },
    renameInput: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      borderBottomWidth: 1.5,
      borderBottomColor: colors.primary,
      paddingVertical: 2,
    },
    renameButtons: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    renameBtn: {
      padding: 2,
    },
    date: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 16,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    content: {
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      lineHeight: 22,
    },
  });
}
