import {
  Bug,
  ClipboardList,
  Code,
  FileText,
  Layout,
  Rocket,
  TestTube,
  type LucideIcon,
} from "lucide-react-native";
import type {
  DevPlatformTaskType,
  DevPlatformTaskStatus,
  DevPlatformTaskPriority,
} from "@getpaseo/protocol/dev-platform/types";

export const TASK_TYPE_ICONS: Record<DevPlatformTaskType, LucideIcon> = {
  requirement: ClipboardList,
  design: Layout,
  development: Code,
  bug: Bug,
  testing: TestTube,
  documentation: FileText,
  deployment: Rocket,
};

export const TASK_TYPE_LABELS: Record<DevPlatformTaskType, string> = {
  requirement: "Requirement",
  design: "Design",
  development: "Development",
  bug: "Bug",
  testing: "Testing",
  documentation: "Documentation",
  deployment: "Deployment",
};

export const TASK_TYPE_SHORT_LABELS: Record<DevPlatformTaskType, string> = {
  requirement: "Req",
  design: "Des",
  development: "Dev",
  bug: "Bug",
  testing: "Test",
  documentation: "Doc",
  deployment: "Deploy",
};

export const STATUS_LABELS: Record<DevPlatformTaskStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
  merge_conflict: "Merge Conflict",
  archived: "Archived",
};

export const PRIORITY_LABELS: Record<DevPlatformTaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const STATUS_COLUMNS: DevPlatformTaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
  "blocked",
  "merge_conflict",
];

export const TYPE_GROUPS: DevPlatformTaskType[] = [
  "requirement",
  "design",
  "development",
  "bug",
  "testing",
  "deployment",
  "documentation",
];

export function getStatusDotColorKey(status: DevPlatformTaskStatus): string {
  switch (status) {
    case "todo":
      return "muted";
    case "in_progress":
      return "blue";
    case "review":
      return "amber";
    case "done":
      return "green";
    case "blocked":
    case "merge_conflict":
      return "red";
    case "archived":
      return "muted";
    default:
      return "muted";
  }
}

export function getPriorityColorKey(priority: DevPlatformTaskPriority): string {
  switch (priority) {
    case "low":
      return "muted";
    case "medium":
      return "blue";
    case "high":
      return "amber";
    case "critical":
      return "red";
    default:
      return "muted";
  }
}

export const DEPLOYMENT_STATUS_LABELS: Record<string, string> = {
  not_deployed: "Not deployed",
  deployed_uat: "UAT",
  deployed_production: "Production",
};

export const BUILD_STATUS_LABELS: Record<string, string> = {
  not_built: "Not built",
  building: "Building",
  success: "Success",
  failed: "Failed",
};
