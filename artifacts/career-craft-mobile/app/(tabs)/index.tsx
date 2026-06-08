import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiFetch, getApiBase, getStoredCookie, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/hooks/useHistory";
import { useSavedResumes, extractResumeText } from "@/hooks/useSavedResumes";
import { SkeletonLoader } from "@/components/SkeletonLoader";

type Phase = "idle" | "uploading" | "streaming" | "done" | "error";
type ResumeMode = "paste" | "upload" | "saved";

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

export default function TailorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { addItem } = useHistory();

  const { resumes: savedResumes, loading: savedLoading } = useSavedResumes(!!user);

  const [resumeMode, setResumeMode] = useState<ResumeMode>("paste");
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [loadedResume, setLoadedResume] = useState<{ id: string; title: string; text: string } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("resumeInputMode").then((saved) => {
      if (saved === "paste" || saved === "upload") {
        setResumeMode(saved);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (savedResumes.length === 0) return;
    const mostRecent = savedResumes.reduce((a, b) =>
      new Date(b.updatedAt) > new Date(a.updatedAt) ? b : a
    );
    setSelectedResumeId((prev) => prev ?? mostRecent.id);
  }, [savedResumes]);

  const [resumeText, setResumeText] = useState("");
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [picking, setPicking] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [output, setOutput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const abortRef = useRef<boolean>(false);
  const controllerRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<string>("");
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startFlushInterval() {
    if (flushIntervalRef.current !== null) return;
    flushIntervalRef.current = setInterval(() => {
      if (pendingRef.current) {
        const chunk = pendingRef.current;
        pendingRef.current = "";
        setOutput((prev) => prev + chunk);
      }
    }, 100);
  }

  function stopFlushInterval() {
    if (flushIntervalRef.current !== null) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
    if (pendingRef.current) {
      const chunk = pendingRef.current;
      pendingRef.current = "";
      setOutput((prev) => prev + chunk);
    }
  }

  useEffect(() => {
    return () => {
      if (flushIntervalRef.current !== null) {
        clearInterval(flushIntervalRef.current);
      }
      // Cancel any in-flight stream so the server stops spending OpenAI tokens.
      controllerRef.current?.abort();
    };
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handlePickFile() {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/msword",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      setPickedFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
        size: asset.size,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert("File Error", "Could not open the file picker. Please try again.");
    } finally {
      setPicking(false);
    }
  }

  function handleClearFile() {
    setPickedFile(null);
  }

  function switchMode(mode: ResumeMode) {
    setResumeMode(mode);
    if (mode === "paste") { setPickedFile(null); setLoadedResume(null); }
    if (mode === "upload") { setResumeText(""); setPickedFile(null); setLoadedResume(null); }
    if (mode === "saved") { setPickedFile(null); }
    if (mode === "paste" || mode === "upload") {
      AsyncStorage.setItem("resumeInputMode", mode).catch(() => {});
    }
  }

  function handleSelectSavedResume(id: string) {
    setSelectedResumeId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleConfirmSavedResume() {
    const resume = savedResumes.find((r) => r.id === selectedResumeId);
    if (!resume) return;
    const text = extractResumeText(resume.content);
    if (!text) {
      Alert.alert("Unsupported Format", "This resume was built with the visual editor and cannot be loaded as text. Please use the web app or paste your resume manually.");
      return;
    }
    setLoadedResume({ id: resume.id, title: resume.title, text });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  async function handleTailor() {
    const hasResume =
      resumeMode === "upload"
        ? pickedFile !== null
        : resumeMode === "saved"
        ? loadedResume !== null
        : resumeText.trim().length > 0;
    if (!hasResume) {
      Alert.alert(
        "Missing Resume",
        resumeMode === "upload"
          ? "Please upload a PDF or DOCX file."
          : resumeMode === "saved"
          ? "Please select and confirm a saved resume."
          : "Please paste your resume text."
      );
      return;
    }
    if (!jobDescription.trim()) {
      Alert.alert("Missing Job Description", "Please paste the job description.");
      return;
    }

    const isFileUpload = resumeMode === "upload" && pickedFile !== null;
    setPhase(isFileUpload ? "uploading" : "streaming");
    setOutput("");
    setErrorMsg("");
    abortRef.current = false;
    const controller = new AbortController();
    controllerRef.current = controller;
    pendingRef.current = "";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const base = getApiBase();
      const cookie = await getStoredCookie();

      let res: Response;

      if (resumeMode === "upload" && pickedFile) {
        const formData = new FormData();
        formData.append("resume", {
          uri: pickedFile.uri,
          name: pickedFile.name,
          type: pickedFile.mimeType,
        } as unknown as Blob);
        formData.append("jobDescription", jobDescription.trim());

        const headers: Record<string, string> = {};
        if (cookie) headers["Cookie"] = cookie;

        res = await fetch(`${base}/api/ai/tailor`, {
          method: "POST",
          headers,
          body: formData,
          signal: controller.signal,
        });

        setPhase("streaming");
        startFlushInterval();
      } else {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (cookie) headers["Cookie"] = cookie;

        const textForAi = resumeMode === "saved" ? (loadedResume?.text ?? "") : resumeText.trim();
        res = await fetch(`${base}/api/ai/tailor`, {
          method: "POST",
          headers,
          body: JSON.stringify({ resumeText: textForAi, jobDescription: jobDescription.trim() }),
          signal: controller.signal,
        });
        startFlushInterval();
      }

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Tailoring failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullOutput = "";

      while (true) {
        if (abortRef.current) break;
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as { content?: string; done?: boolean; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.content) {
              fullOutput += parsed.content;
              pendingRef.current += parsed.content;
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Unexpected token") throw e;
          }
        }
      }

      stopFlushInterval();
      setPhase("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (fullOutput && !abortRef.current) {
        addItem("resume", jobDescription.trim(), fullOutput).catch(() => {});
      }
    } catch (e: unknown) {
      stopFlushInterval();
      // A user-initiated cancel (Start Over / leaving the screen) is not an error.
      if (abortRef.current || controller.signal.aborted || (e instanceof Error && e.name === "AbortError")) {
        return;
      }
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setErrorMsg(msg);
      setPhase("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function handleSave() {
    if (!output || !user) return;
    setSaving(true);
    try {
      const res = await apiFetch("/api/resumes", {
        method: "POST",
        body: JSON.stringify({
          title: `Tailored Resume — ${new Date().toLocaleDateString()}`,
          content: output,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { message?: string; error?: string };
        const msg = body.message ?? body.error ?? "Could not save";
        Alert.alert("Save Failed", msg);
        return;
      }
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Your tailored resume was saved to your account.");
    } catch {
      Alert.alert("Error", "Could not save resume. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    abortRef.current = true;
    controllerRef.current?.abort();
    stopFlushInterval();
    pendingRef.current = "";
    setPhase("idle");
    setOutput("");
    setErrorMsg("");
  }

  const s = makeStyles(colors, topPad, botPad);
  const isUploading = phase === "uploading";
  const isStreaming = phase === "streaming";
  const isDone = phase === "done";
  const showSkeleton = isStreaming && !output;

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.header}>
          <Text style={s.heading}>Tailor Resume</Text>
          <Text style={s.sub}>AI-optimized for your target role</Text>
        </View>

        {isUploading && (
          <Animated.View key="uploading" entering={FadeIn.duration(220)}>
            <View style={[s.card, s.outputCard, s.uploadingCard]}>
              <View style={s.cardHeader}>
                <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                <Text style={s.cardTitle}>Uploading Resume…</Text>
              </View>
              <Text style={s.uploadingLabel}>
                Sending your file to the server
              </Text>
              <IndeterminateBar colors={colors} />
            </View>
          </Animated.View>
        )}

        {(phase === "idle" || phase === "error") && (
          <Animated.View key="form" entering={FadeIn.duration(280)}>
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                <Text style={s.cardTitle}>Your Resume</Text>
              </View>

              <View style={s.modeToggle}>
                <Pressable
                  style={[s.modeTab, resumeMode === "paste" && s.modeTabActive]}
                  onPress={() => switchMode("paste")}
                >
                  <Ionicons
                    name="create-outline"
                    size={14}
                    color={resumeMode === "paste" ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text style={[s.modeTabText, resumeMode === "paste" && s.modeTabTextActive]}>
                    Paste Text
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.modeTab, resumeMode === "upload" && s.modeTabActive]}
                  onPress={() => switchMode("upload")}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={14}
                    color={resumeMode === "upload" ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text style={[s.modeTabText, resumeMode === "upload" && s.modeTabTextActive]}>
                    Upload File
                  </Text>
                </Pressable>
                {user && (
                  <Pressable
                    style={[s.modeTab, resumeMode === "saved" && s.modeTabActive]}
                    onPress={() => switchMode("saved")}
                  >
                    <Ionicons
                      name="bookmark-outline"
                      size={14}
                      color={resumeMode === "saved" ? colors.primaryForeground : colors.mutedForeground}
                    />
                    <Text style={[s.modeTabText, resumeMode === "saved" && s.modeTabTextActive]}>
                      My Resumes
                    </Text>
                  </Pressable>
                )}
              </View>

              {resumeMode === "paste" ? (
                <TextInput
                  style={s.textarea}
                  placeholder="Paste your resume text here..."
                  placeholderTextColor={colors.mutedForeground}
                  value={resumeText}
                  onChangeText={setResumeText}
                  multiline
                  textAlignVertical="top"
                  scrollEnabled={false}
                />
              ) : resumeMode === "saved" ? (
                <View style={s.savedList}>
                  {loadedResume ? (
                    <>
                      <View style={s.fileChip}>
                        <Ionicons name="bookmark" size={18} color={colors.primary} />
                        <View style={s.fileChipInfo}>
                          <Text style={s.fileChipName} numberOfLines={1}>
                            {loadedResume.title}
                          </Text>
                          <Text style={s.fileChipSize}>Resume loaded</Text>
                        </View>
                        <Pressable
                          onPress={() => switchMode("paste")}
                          hitSlop={8}
                          style={s.fileChipRemove}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                      <Pressable
                        style={({ pressed }) => [s.changeFileBtn, pressed && { opacity: 0.75 }]}
                        onPress={() => setLoadedResume(null)}
                      >
                        <Ionicons name="swap-horizontal-outline" size={14} color={colors.primary} />
                        <Text style={s.changeFileBtnText}>Change resume</Text>
                      </Pressable>
                    </>
                  ) : savedLoading ? (
                    <View style={s.savedEmpty}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={s.savedEmptyText}>Loading resumes…</Text>
                    </View>
                  ) : savedResumes.length === 0 ? (
                    <View style={s.savedEmpty}>
                      <Ionicons name="bookmark-outline" size={28} color={colors.mutedForeground} />
                      <Text style={s.savedEmptyText}>No saved resumes yet.</Text>
                      <Text style={s.savedEmptyHint}>
                        Save a tailored resume to your account to use it here.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {savedResumes.map((r) => {
                        const isSelected = r.id === selectedResumeId;
                        return (
                          <Pressable
                            key={r.id}
                            style={({ pressed }) => [
                              s.savedCard,
                              isSelected && s.savedCardSelected,
                              pressed && { opacity: 0.75 },
                            ]}
                            onPress={() => handleSelectSavedResume(r.id)}
                          >
                            <View style={s.savedCardLeft}>
                              <Ionicons
                                name={isSelected ? "document-text" : "document-text-outline"}
                                size={20}
                                color={isSelected ? colors.primary : colors.mutedForeground}
                              />
                            </View>
                            <View style={s.savedCardBody}>
                              <Text
                                style={[s.savedCardTitle, isSelected && { color: colors.primary }]}
                                numberOfLines={1}
                              >
                                {r.title}
                              </Text>
                              {r.jobTitle ? (
                                <Text style={s.savedCardSub} numberOfLines={1}>{r.jobTitle}</Text>
                              ) : null}
                            </View>
                            {isSelected ? (
                              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                            ) : (
                              <Ionicons name="ellipse-outline" size={18} color={colors.border} />
                            )}
                          </Pressable>
                        );
                      })}
                      {selectedResumeId && (
                        <Pressable
                          style={({ pressed }) => [s.savedConfirmBtn, pressed && { opacity: 0.85 }]}
                          onPress={handleConfirmSavedResume}
                        >
                          <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                          <Text style={s.savedConfirmBtnText}>Use This Resume</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              ) : (
                <View style={s.uploadArea}>
                  {pickedFile ? (
                    <View style={s.fileChip}>
                      <Ionicons name="document-attach" size={18} color={colors.primary} />
                      <View style={s.fileChipInfo}>
                        <Text style={s.fileChipName} numberOfLines={1}>
                          {pickedFile.name}
                        </Text>
                        {pickedFile.size != null && (
                          <Text style={s.fileChipSize}>
                            {(pickedFile.size / 1024).toFixed(0)} KB
                          </Text>
                        )}
                      </View>
                      <Pressable onPress={handleClearFile} hitSlop={8} style={s.fileChipRemove}>
                        <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [s.uploadBtn, pressed && { opacity: 0.75 }]}
                      onPress={handlePickFile}
                      disabled={picking}
                    >
                      {picking ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                          <Text style={s.uploadBtnLabel}>Tap to select a file</Text>
                          <Text style={s.uploadBtnSub}>PDF or DOCX, up to 10 MB</Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  {pickedFile && (
                    <Pressable
                      style={({ pressed }) => [s.changeFileBtn, pressed && { opacity: 0.75 }]}
                      onPress={handlePickFile}
                      disabled={picking}
                    >
                      <Ionicons name="swap-horizontal-outline" size={14} color={colors.primary} />
                      <Text style={s.changeFileBtnText}>Change file</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            <View style={s.card}>
              <View style={s.cardHeader}>
                <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
                <Text style={s.cardTitle}>Job Description</Text>
              </View>
              <TextInput
                style={s.textarea}
                placeholder="Paste the job description here..."
                placeholderTextColor={colors.mutedForeground}
                value={jobDescription}
                onChangeText={setJobDescription}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />
            </View>

            {phase === "error" && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.destructive} />
                <Text style={s.errorText}>{errorMsg}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85 }]}
              onPress={handleTailor}
            >
              <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
              <Text style={s.primaryBtnText}>Tailor My Resume</Text>
            </Pressable>
          </Animated.View>
        )}

        {(isStreaming || isDone) && (
          <Animated.View key="output" entering={FadeIn.duration(280)}>
            <View style={[s.card, s.outputCard]}>
              <View style={s.cardHeader}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
                <Text style={s.cardTitle}>Tailored Resume</Text>
                {isStreaming && (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </View>

              {showSkeleton ? (
                <SkeletonLoader />
              ) : (
                <Text style={s.outputText} selectable>
                  {output}
                  {isStreaming && <Text style={{ color: colors.primary }}>▌</Text>}
                </Text>
              )}
            </View>

            {isDone && (
              <View style={s.savedNotice}>
                <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                <Text style={s.savedNoticeText}>Auto-saved to History</Text>
              </View>
            )}

            <View style={s.actionRow}>
              {isDone && (
                <Pressable
                  style={({ pressed }) => [
                    s.saveBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <>
                      <Ionicons name="bookmark" size={16} color={colors.primaryForeground} />
                      <Text style={s.saveBtnText}>Save to Account</Text>
                    </>
                  )}
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  s.resetBtn,
                  pressed && { opacity: 0.75 },
                ]}
                onPress={handleReset}
              >
                <Ionicons name="refresh" size={16} color={colors.foreground} />
                <Text style={s.resetBtnText}>Start Over</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        <View style={{ height: botPad + 80 }} />
      </ScrollView>
    </View>
  );
}

function IndeterminateBar({ colors }: { colors: ReturnType<typeof useColors> }) {
  const offset = useSharedValue(0);
  const [trackWidth, setTrackWidth] = React.useState(0);

  React.useEffect(() => {
    if (trackWidth <= 0) return;
    const barW = trackWidth * 0.45;
    offset.value = -barW;
    offset.value = withRepeat(
      withSequence(
        withTiming(trackWidth, {
          duration: 900,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(-barW, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [trackWidth]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const barW = trackWidth * 0.45;

  return (
    <View
      style={{
        height: 4,
        borderRadius: 2,
        backgroundColor: `${colors.primary}25`,
        overflow: "hidden",
        marginTop: 20,
      }}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          {
            position: "absolute",
            height: 4,
            width: barW || 80,
            borderRadius: 2,
            backgroundColor: colors.primary,
          },
          animStyle,
        ]}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, botPad: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
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
    sub: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
    },
    outputCard: { minHeight: 200 },
    uploadingCard: { minHeight: 120, justifyContent: "center" },
    uploadingLabel: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 4,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    modeToggle: {
      flexDirection: "row",
      backgroundColor: colors.secondary,
      borderRadius: 8,
      padding: 3,
      marginBottom: 12,
      gap: 2,
    },
    modeTab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 7,
      borderRadius: 6,
    },
    modeTabActive: {
      backgroundColor: colors.primary,
    },
    modeTabText: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.mutedForeground,
      fontFamily: "Inter_600SemiBold",
    },
    modeTabTextActive: {
      color: colors.primaryForeground,
    },
    textarea: {
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      minHeight: 120,
      lineHeight: 20,
    },
    uploadArea: {
      gap: 10,
    },
    uploadBtn: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderStyle: "dashed",
      borderRadius: 10,
      paddingVertical: 28,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: `${colors.primary}08`,
    },
    uploadBtnLabel: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
    },
    uploadBtnSub: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    fileChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: `${colors.primary}12`,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    fileChipInfo: {
      flex: 1,
    },
    fileChipName: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    fileChipSize: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 1,
    },
    fileChipRemove: {
      padding: 2,
    },
    changeFileBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
      paddingVertical: 4,
    },
    changeFileBtnText: {
      fontSize: 13,
      color: colors.primary,
      fontFamily: "Inter_400Regular",
    },
    outputText: {
      fontSize: 13,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      lineHeight: 20,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: `${colors.destructive}18`,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    errorText: {
      flex: 1,
      color: colors.destructive,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    savedNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    savedNoticeText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    savedList: {
      gap: 8,
      minHeight: 80,
    },
    savedEmpty: {
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 24,
    },
    savedEmptyText: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.mutedForeground,
      fontFamily: "Inter_600SemiBold",
      textAlign: "center",
    },
    savedEmptyHint: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      maxWidth: 240,
    },
    savedCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 10,
    },
    savedCardSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}0d`,
    },
    savedConfirmBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      height: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      marginTop: 4,
    },
    savedConfirmBtnText: {
      fontSize: 15,
      fontWeight: "700" as const,
      color: colors.primaryForeground,
      fontFamily: "Inter_700Bold",
    },
    savedCardLeft: {
      width: 32,
      alignItems: "center",
    },
    savedCardBody: {
      flex: 1,
    },
    savedCardTitle: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    savedCardSub: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: colors.primaryForeground,
      fontFamily: "Inter_700Bold",
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    saveBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      height: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    saveBtnText: {
      fontSize: 15,
      fontWeight: "700" as const,
      color: colors.primaryForeground,
      fontFamily: "Inter_700Bold",
    },
    resetBtn: {
      backgroundColor: colors.secondary,
      borderRadius: colors.radius,
      height: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 16,
    },
    resetBtnText: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
