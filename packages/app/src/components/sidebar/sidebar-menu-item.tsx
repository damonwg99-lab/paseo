import type { LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useMemo } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

interface SidebarMenuItemProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  active?: boolean;
  testID?: string;
}

function SidebarMenuItem({
  icon: Icon,
  label,
  onPress,
  active = false,
  testID,
}: SidebarMenuItemProps) {
  const { theme } = useUnistyles();
  const itemStyle = useMemo(() => [styles.item, active && styles.itemActive], [active]);
  const textStyle = useMemo(() => [styles.label, active && styles.labelActive], [active]);

  return (
    <Pressable onPress={onPress} style={itemStyle} testID={testID}>
      <View style={styles.iconContainer}>
        <Icon size={16} color={active ? theme.colors.foreground : theme.colors.foregroundMuted} />
      </View>
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

export default SidebarMenuItem;

const styles = StyleSheet.create((theme) => ({
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    gap: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
  },
  itemActive: {
    backgroundColor: theme.colors.surfaceSidebarHover,
  },
  iconContainer: {
    width: 20,
    alignItems: "center",
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foregroundMuted,
  },
  labelActive: {
    color: theme.colors.foreground,
  },
}));
