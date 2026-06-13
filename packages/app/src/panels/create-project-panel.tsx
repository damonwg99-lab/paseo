import { FolderPlus } from "lucide-react-native";
import { View } from "react-native";
import invariant from "tiny-invariant";
import { usePaneContext, usePaneFocus } from "@/panels/pane-context";
import type { PanelDescriptor, PanelRegistration } from "@/panels/panel-registry";
import ProjectFormPanel from "@/panels/project-form-panel";

const FLEX_FILL_STYLE = { flex: 1 } as const;

function useCreateProjectPanelDescriptor(
  _target: { kind: "create_project" },
  _context: { serverId: string; workspaceId: string },
): PanelDescriptor {
  return {
    label: "新建项目",
    subtitle: "创建项目",
    titleState: "ready",
    icon: FolderPlus,
    statusBucket: null,
  };
}

function CreateProjectPanel() {
  const paneCtx = usePaneContext();
  const { isWorkspaceFocused } = usePaneFocus();
  invariant(
    paneCtx.target.kind === "create_project",
    "CreateProjectPanel requires create_project target",
  );

  if (!isWorkspaceFocused) {
    return <View style={FLEX_FILL_STYLE} />;
  }

  return <ProjectFormPanel mode="create" serverId={paneCtx.serverId} />;
}

export const createProjectPanelRegistration: PanelRegistration<"create_project"> = {
  kind: "create_project",
  component: CreateProjectPanel,
  useDescriptor: useCreateProjectPanelDescriptor,
};
