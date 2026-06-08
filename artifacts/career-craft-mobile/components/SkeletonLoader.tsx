import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

const ROWS: Array<{ width: `${number}%` }> = [
  { width: "100%" },
  { width: "88%" },
  { width: "95%" },
  { width: "76%" },
  { width: "100%" },
  { width: "83%" },
  { width: "91%" },
  { width: "68%" },
  { width: "100%" },
  { width: "87%" },
];

function SkeletonRow({ width }: { width: `${number}%` }) {
  const colors = useColors();
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height: 13,
          borderRadius: 6,
          backgroundColor: colors.border,
          marginBottom: 10,
        },
        animStyle,
      ]}
    />
  );
}

export function SkeletonLoader() {
  return (
    <View>
      {ROWS.map((row, i) => (
        <SkeletonRow key={i} width={row.width} />
      ))}
    </View>
  );
}
