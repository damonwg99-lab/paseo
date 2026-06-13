import { useLocalSearchParams } from "expo-router";
import { HostRouteBootstrapBoundary } from "@/components/host-route-bootstrap-boundary";
import ProjectFormPanel from "@/panels/project-form-panel";
import { MenuHeader } from "@/components/headers/menu-header";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { TitlebarDragRegion } from "@/components/desktop/titlebar-drag-region";

export default function HostCreateProjectRoute() {
  return (
    <HostRouteBootstrapBoundary>
      <HostCreateProjectRouteContent />
    </HostRouteBootstrapBoundary>
  );
}

function HostCreateProjectRouteContent() {
  const params = useLocalSearchParams<{ serverId?: string }>();
  const serverId = typeof params.serverId === "string" ? params.serverId : "";

  return (
    <View style={styles.container}>
      <MenuHeader borderless />
      <TitlebarDragRegion />
      <View style={styles.content}>
        <ProjectFormPanel mode="create" serverId={serverId} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface0,
  },
  content: {
    flex: 1,
  },
}));
