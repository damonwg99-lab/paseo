import { agentPanelRegistration } from "@/panels/agent-panel";
import { browserPanelRegistration } from "@/panels/browser-panel";
import { draftPanelRegistration } from "@/panels/draft-panel";
import { filePanelRegistration } from "@/panels/file-panel";
import { registerPanel } from "@/panels/panel-registry";
import { setupPanelRegistration } from "@/panels/setup-panel";
import { taskPanelRegistration } from "@/panels/task-panel";
import { terminalPanelRegistration } from "@/panels/terminal-panel";
import { kanbanPanelRegistration } from "@/panels/kanban-panel";
import { branchesPanelRegistration } from "@/panels/branches-panel";
import { createProjectPanelRegistration } from "@/panels/create-project-panel";
import { createTaskPanelRegistration } from "@/panels/create-task-panel";
import { taskDetailPanelRegistration } from "@/panels/task-detail-panel";
import { taskActivityPanelRegistration } from "@/panels/task-activity-panel";
import { archivedTasksPanelRegistration } from "@/panels/archived-tasks-panel";
import { projectSettingsPanelRegistration } from "@/panels/project-settings-panel";

let panelsRegistered = false;

export function ensurePanelsRegistered(): void {
  if (panelsRegistered) {
    return;
  }
  registerPanel(draftPanelRegistration);
  registerPanel(agentPanelRegistration);
  registerPanel(setupPanelRegistration);
  registerPanel(terminalPanelRegistration);
  registerPanel(browserPanelRegistration);
  registerPanel(filePanelRegistration);
  registerPanel(taskPanelRegistration);
  registerPanel(kanbanPanelRegistration);
  registerPanel(branchesPanelRegistration);
  registerPanel(createProjectPanelRegistration);
  registerPanel(createTaskPanelRegistration);
  registerPanel(taskDetailPanelRegistration);
  registerPanel(taskActivityPanelRegistration);
  registerPanel(archivedTasksPanelRegistration);
  registerPanel(projectSettingsPanelRegistration);
  panelsRegistered = true;
}
