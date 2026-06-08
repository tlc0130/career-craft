import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleRegister() {
    if (!email.trim() || !password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await register(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  const s = makeStyles(colors, topPad, botPad);

  return (
    <KeyboardAwareScrollViewCompat
      style={s.scroll}
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
      bottomOffset={20}
    >
      <View style={s.logoRow}>
        <View style={s.logoMark}>
          <Ionicons name="document-text" size={28} color={colors.primary} />
        </View>
        <Text style={s.brand}>Career Craft</Text>
      </View>

      <Text style={s.title}>Create account</Text>
      <Text style={s.subtitle}>
        Get AI-powered resume tailoring on the go
      </Text>

      {error ? (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle" size={16} color={colors.destructive} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={s.field}>
        <Text style={s.label}>Email</Text>
        <View style={s.inputWrap}>
          <Ionicons
            name="mail-outline"
            size={18}
            color={colors.mutedForeground}
            style={s.inputIcon}
          />
          <TextInput
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Password</Text>
        <View style={s.inputWrap}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={colors.mutedForeground}
            style={s.inputIcon}
          />
          <TextInput
            ref={passwordRef}
            style={[s.input, { flex: 1 }]}
            placeholder="Min. 6 characters"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
            style={s.eyeBtn}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Confirm Password</Text>
        <View style={s.inputWrap}>
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={colors.mutedForeground}
            style={s.inputIcon}
          />
          <TextInput
            ref={confirmRef}
            style={s.input}
            placeholder="Repeat your password"
            placeholderTextColor={colors.mutedForeground}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={s.btnText}>Create Account</Text>
        )}
      </Pressable>

      <View style={s.switchRow}>
        <Text style={s.switchText}>Already have an account? </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={s.switchLink}>Sign in</Text>
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

function makeStyles(
  colors: ReturnType<typeof useColors>,
  topPad: number,
  botPad: number
) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.background },
    container: {
      flexGrow: 1,
      paddingTop: topPad + 40,
      paddingBottom: botPad + 24,
      paddingHorizontal: 24,
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 40,
    },
    logoMark: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    brand: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    title: {
      fontSize: 28,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 32,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: `${colors.destructive}18`,
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      flex: 1,
      color: colors.destructive,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    field: { marginBottom: 16 },
    label: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 8,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: colors.radius,
      paddingHorizontal: 12,
      height: 50,
    },
    inputIcon: { marginRight: 8 },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    eyeBtn: { padding: 4 },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
      marginBottom: 20,
    },
    btnText: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: colors.primaryForeground,
      fontFamily: "Inter_700Bold",
    },
    switchRow: { flexDirection: "row", justifyContent: "center" },
    switchText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    switchLink: {
      fontSize: 14,
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
