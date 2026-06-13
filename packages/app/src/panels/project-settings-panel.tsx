import { Settings } from "lucide-react-native";
import { View } from "react-native";
import invariant from "tiny-invariant";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import { useDevPlatformStore } from "@/stores/dev-platform-store";
import ProjectFormPanel from "@/panels/project-form-panel";

const FLEX_FILL_STYLE = { flex: 1 } as const;

function useProjectSettingsPanelDescriptor(
  target: { kind: "project_settings"; projectId: string },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  const projects = useDevPlatformStore((s) => s.projects);
  const project = projects.find((p) => p.id === target.projectId);
  return {
    label: project?.name ?? "项目设置",
    subtitle: "编辑项目配置",
    titleState: "ready",
    icon: Settings,
    statusBucket: null,
  };
}

function ProjectSettingsPanel() {
  const { target } = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(
    target.kind === "project_settings",
    "ProjectSettingsPanel requires project_settings target",
  );

  if (!isWorkspaceFocused) {
    return <View style={FLEX_FILL_STYLE} />;
  }

  return <ProjectFormPanel mode="edit" projectId={target.projectId} />;
}

export const projectSettingsPanelRegistration: PanelRegistration<"project_settings"> = {
  kind: "project_settings",
  component: ProjectSettingsPanel,
  useDescriptor: useProjectSettingsPanelDescriptor,
};
