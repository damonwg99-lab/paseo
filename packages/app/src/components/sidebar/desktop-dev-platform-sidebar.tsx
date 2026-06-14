/**
 * Desktop shell for the dev-platform sidebar.
 *
 * Provides the same layout affordances as the upstream `DesktopSidebar`
 * (resizable width, right border, titlebar drag region) but renders
 * dev-platform specific content:
 *
 * - Top: SidebarProjectSwitcher (replaces the upstream Sessions header)
 * - Middle: DevPlatformSidebar (scrollable content: menu, repos, agents)
 * - Bottom: SidebarFooter (reused from left-sidebar.tsx — host picker,
 *   add project, home, settings)
 *
 * This component is fully independent from the upstream `DesktopSidebar`
 * in `left-sidebar.tsx`. Width management logic is intentionally duplicated
 * (~40 lines) so the two sidebars can evolve independently.
 */

import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet as RNStyleSheet, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { usePathname, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { TitlebarDragRegion } from "@/components/desktop/titlebar-drag-region";
import SidebarProjectSwitcher from "@/components/sidebar/sidebar-project-switcher";
import DevPlatformSidebar from "@/components/sidebar/dev-platform-sidebar";
import { SidebarFooter } from "@/components/left-sidebar";
import type { ComboboxOption } from "@/components/ui/combobox";
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, usePanelStore } from "@/stores/panel-store";
import { useWindowControlsPadding } from "@/utils/desktop-window";
import { isWeb } from "@/constants/platform";
import { useActiveServerId } from "@/hooks/use-active-server-id";
import { useHostRuntimeSnapshot, useHosts } from "@/runtime/host-runtime";
import { resolveActiveHost } from "@/utils/active-host";
import { formatConnectionStatus } from "@/utils/daemons";
import {
  buildHostOpenProjectRoute,
  buildSettingsRoute,
  mapPathnameToServer,
} from "@/utils/host-routes";

const MIN_CHAT_WIDTH = 400;

export default function DesktopDevPlatformSidebar() {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const padding = useWindowControlsPadding("sidebar");
  const sidebarWidth = usePanelStore((state) => state.sidebarWidth);
  const setSidebarWidth = usePanelStore((state) => state.setSidebarWidth);
  const { width: viewportWidth } = useWindowDimensions();
  const serverId = useActiveServerId();
  const pathname = usePathname();

  // ── Host picker state (needed by SidebarFooter) ──────────────────────────
  const daemons = useHosts();
  const activeDaemon = useMemo(
    () => resolveActiveHost({ hosts: daemons, pathname }),
    [daemons, pathname],
  );
  const activeServerId = activeDaemon?.serverId ?? null;
  const activeHostLabel = useMemo(() => {
    if (!activeDaemon) return t("sidebar.host.noHost");
    const trimmed = activeDaemon.label?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : activeDaemon.serverId;
  }, [activeDaemon, t]);
  const activeHostSnapshot = useHostRuntimeSnapshot(activeServerId ?? "");
  const activeHostStatus = activeServerId
    ? (activeHostSnapshot?.connectionStatus ?? "connecting")
    : "idle";
  let activeHostStatusColor: string;
  if (activeHostStatus === "online") activeHostStatusColor = theme.colors.palette.green[400];
  else if (activeHostStatus === "connecting")
    activeHostStatusColor = theme.colors.palette.amber[500];
  else activeHostStatusColor = theme.colors.palette.red[500];
  const hostOptions: ComboboxOption[] = useMemo(
    () =>
      daemons.map((daemon) => ({
        id: daemon.serverId,
        label: daemon.label?.trim() || daemon.serverId,
      })),
    [daemons],
  );
  const hostTriggerRef = useRef<View | null>(null);
  const [isHostPickerOpen, setIsHostPickerOpen] = useState(false);

  const handleHostSelect = useCallback(
    (nextServerId: string) => {
      if (!nextServerId) return;
      const nextPath = mapPathnameToServer(pathname, nextServerId);
      setIsHostPickerOpen(false);
      router.push(nextPath);
    },
    [pathname],
  );

  const renderHostOption = useCallback(
    ({
      option,
      selected,
      active,
      onPress,
    }: {
      option: ComboboxOption;
      selected: boolean;
      active: boolean;
      onPress: () => void;
    }) => (
      <HostSwitchOption
        serverId={option.id}
        label={option.label}
        selected={selected}
        active={active}
        onPress={onPress}
      />
    ),
    [],
  );

  const hostStatusDotStyle = useMemo<StyleProp<ViewStyle>>(
    () => [styles.hostStatusDot, { backgroundColor: activeHostStatusColor }],
    [activeHostStatusColor],
  );

  const handleOpenProject = useCallback(() => {
    /* dev-platform: project creation handled via project switcher */
  }, []);

  const handleHome = useCallback(() => {
    if (!serverId) return;
    router.push(buildHostOpenProjectRoute(serverId));
  }, [serverId]);

  const handleSettings = useCallback(() => {
    router.push(buildSettingsRoute());
  }, []);

  const labels = useMemo(
    () => ({
      addProject: t("sidebar.actions.addProject"),
      home: t("sidebar.actions.home"),
      settings: t("sidebar.actions.settings"),
      switchHost: t("sidebar.host.switchTitle"),
      searchHosts: t("sidebar.host.searchPlaceholder"),
    }),
    [t],
  );

  // ── Width management + resize gesture ─────────────────────────────────────
  const startWidthRef = useRef(sidebarWidth);
  const resizeWidth = useSharedValue(sidebarWidth);

  useEffect(() => {
    resizeWidth.value = sidebarWidth;
  }, [sidebarWidth, resizeWidth]);

  const resizeGesture = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop({ left: 8, right: 8, top: 0, bottom: 0 })
        .onStart(() => {
          startWidthRef.current = sidebarWidth;
          resizeWidth.value = sidebarWidth;
        })
        .onUpdate((event) => {
          const newWidth = startWidthRef.current + event.translationX;
          const maxWidth = Math.max(
            MIN_SIDEBAR_WIDTH,
            Math.min(MAX_SIDEBAR_WIDTH, viewportWidth - MIN_CHAT_WIDTH),
          );
          const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxWidth, newWidth));
          resizeWidth.value = clampedWidth;
        })
        .onEnd(() => {
          runOnJS(setSidebarWidth)(resizeWidth.value);
        }),
    [sidebarWidth, resizeWidth, setSidebarWidth, viewportWidth],
  );

  const resizeAnimatedStyle = useAnimatedStyle(() => ({
    width: resizeWidth.value,
  }));

  const paddingTopSpacerStyle = useMemo(() => ({ height: padding.top }), [padding.top]);
  const desktopSidebarStyle = useMemo(
    () => [staticStyles.desktopSidebar, resizeAnimatedStyle],
    [resizeAnimatedStyle],
  );
  const desktopSidebarBorderStyle = useMemo<StyleProp<ViewStyle>>(
    () => [styles.desktopSidebarBorder, { flex: 1, paddingTop: insets.top }],
    [insets.top],
  );
  const resizeHandleStyle = useMemo(
    () => [styles.resizeHandle, isWeb && ({ cursor: "col-resize" } as object)],
    [],
  );

  return (
    <Animated.View style={desktopSidebarStyle}>
      <View style={desktopSidebarBorderStyle}>
        {/* Titlebar drag region (Electron) */}
        <View style={styles.sidebarDragArea}>
          <TitlebarDragRegion />
          {padding.top > 0 ? <View style={paddingTopSpacerStyle} /> : null}
        </View>

        {/* Project switcher at the top (replaces upstream Sessions header) */}
        <SidebarProjectSwitcher serverId={serverId} />

        {/* Dev-platform content (menu, repos, agents).
            showFooter=false: this desktop shell renders its own footer below.
            showProjectSwitcher=false: this shell renders its own switcher above. */}
        <DevPlatformSidebar showFooter={false} showProjectSwitcher={false} />

        {/* Full footer — reused from left-sidebar.tsx (host picker, add project, home, settings) */}
        <SidebarFooter
          theme={theme}
          activeServerId={activeServerId}
          activeHostLabel={activeHostLabel}
          hostStatusDotStyle={hostStatusDotStyle}
          hostOptions={hostOptions}
          hostTriggerRef={hostTriggerRef}
          isHostPickerOpen={isHostPickerOpen}
          setIsHostPickerOpen={setIsHostPickerOpen}
          handleHostSelect={handleHostSelect}
          renderHostOption={renderHostOption}
          handleOpenProject={handleOpenProject}
          handleHome={handleHome}
          handleSettings={handleSettings}
          labels={labels}
        />

        {/* Resize handle - absolutely positioned over right border */}
        <GestureDetector gesture={resizeGesture}>
          <View style={resizeHandleStyle} />
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

/**
 * Host-picker option used by the Combobox in SidebarFooter.
 * Imported inline to avoid circular imports at module-init time.
 */
import { ComboboxItem } from "@/components/ui/combobox";

function HostSwitchOption({
  serverId,
  label,
  selected,
  active,
  onPress,
}: {
  serverId: string;
  label: string;
  selected: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const snapshot = useHostRuntimeSnapshot(serverId);
  const connectionStatus = snapshot?.connectionStatus ?? "connecting";
  return (
    <ComboboxItem
      label={label}
      description={formatConnectionStatus(connectionStatus)}
      selected={selected}
      active={active}
      onPress={onPress}
    />
  );
}

// Static styles for Animated.Views — must NOT use Unistyles dynamic theme to
// avoid the "Unable to find node on an unmounted component" crash when Unistyles
// tries to patch the native node that Reanimated also manages.
const staticStyles = RNStyleSheet.create({
  desktopSidebar: {
    position: "relative" as const,
  },
});

const styles = StyleSheet.create((theme) => ({
  desktopSidebarBorder: {
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSidebar,
  },
  resizeHandle: {
    position: "absolute",
    right: -5,
    top: 0,
    bottom: 0,
    width: 10,
    zIndex: 10,
  },
  sidebarDragArea: {
    position: "relative",
  },
  hostStatusDot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.full,
  },
}));
