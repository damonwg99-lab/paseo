# AI Dev Platform 二次改造 — 实施计划

## 一、核心架构原则

### 1.1 最小侵入原则（应对上游合并）

**目标**：每次上游更新合并时间 < 15 分钟

| 策略              | 说明                                  |
| ----------------- | ------------------------------------- |
| 添加 > 修改       | 新增文件为主，极少修改上游文件        |
| 包装 > 替换       | 用 wrapper/registry 包装上游组件      |
| Feature Flag 门控 | 所有定制行为在 `dev_platform` flag 后 |
| 扩展点 > 深入修改 | 上游文件只加 1-5 行插槽/门控          |

**上游文件改动清单**：

| 文件                   | 改动                         | 性质                                     |
| ---------------------- | ---------------------------- | ---------------------------------------- |
| `left-sidebar.tsx`     | +3 行                        | feature flag → 渲染 `DevPlatformSidebar` |
| `workspace-screen.tsx` | +2 行                        | panel registry 查找（在 switch 前）      |
| `session.ts`           | 已改 ✅                      | dispatch 注册                            |
| `bootstrap.ts`         | 已改 ✅                      | service 注册                             |
| `websocket-server.ts`  | 已改 ✅                      | feature flag                             |
| `daemon-client.ts`     | 只追加                       | 新增方法，不改已有                       |
| **合计**               | **~5 行修改 + ~30 新增文件** |                                          |

### 1.2 项目-Workspace 模型

**核心原则**：一个 Dev Platform 项目 = 一个 workspace（在 rootDirectory）

```
Dev Platform Project
├── rootDirectory: /path/to/parent     ← 唯一 workspace
├── gitRepos:                          ← 项目内子条目（不是 workspace）
│    ├── { relativePath: "frontend", url: "...", label: "前端" }
│    ├── { relativePath: "user-svc",  url: "...", label: "用户服务" }
│    └── { relativePath: "order-svc", url: "...", label: "订单服务" }
├── worktrees: []                      ← 每个 repo 可有 worktree 子条目
└── agents: [所有 agent，cwd = rootDirectory]
```

**行为规则**：

| 行为                     | 结果                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| 点击 sidebar git repo 行 | 中间区域不变 + 右侧切到该 repo 文件树/git 信息                     |
| 点击 agent 行            | 中间切到 agent 对话 + 右侧切到 agent 文件                          |
| 创建 agent               | cwd = rootDirectory，统一根目录                                    |
| 所有 agent 会话          | 统一列在 sidebar 会话列表（不按 workspace 分）                     |
| 单仓项目                 | `gitRepos: [{ relativePath: "." }]`（rootDirectory 本身就是 repo） |

### 1.3 两层关注点分离

```
┌─────── project scope（固定不变）────────┐
│  中间区域 tab（kanban、task、agent chat）│
│  agent 列表（所有 agent）               │
│  创建 agent 的 cwd                      │
└──────────────────────────────────────────┘

┌─────── repo scope（随 sidebar 选择变）──┐
│  sidebar git repo 行的状态展示           │
│  右侧面板（文件树 / git 信息）           │
└──────────────────────────────────────────┘
```

---

## 二、Sidebar 改造

### 2.1 上游文件改动（仅 3 行）

**文件**: `packages/app/src/components/left-sidebar.tsx`

```typescript
// 在组件函数开头加：
import DevPlatformSidebar from "@/components/sidebar/dev-platform-sidebar";

function LeftSidebarContent(props: LeftSidebarProps) {
  // ↓↓↓ 仅加这 3 行 ↓↓↓
  if (useHasDevPlatformFeature()) {
    return <DevPlatformSidebar {...props} />;
  }
  // ↑↑↑ 其余上游代码完全不动 ↑↑↑

  // ... upstream sidebar code ...
}
```

### 2.2 新增文件：`dev-platform-sidebar.tsx`

**文件**: `packages/app/src/components/sidebar/dev-platform-sidebar.tsx` (新建 ~500 行)

完全独立实现，不依赖上游 `SidebarWorkspaceList`、`SidebarHeaderRow` 等。可复用上游基础 UI 组件（Combobox、Tooltip 等）。

**结构**：

```
┌─────────────────────────────────────┐
│  [项目切换器 combo]                 │  ← SidebarProjectSwitcher（已有）
├─────────────────────────────────────┤
│  📋 项目列表                        │  ← SidebarMenuItem（已有）
│  📋 任务列表                        │  ← SidebarMenuItem（已有）
├─────────────────────────────────────┤
│  📂 Git 仓库                        │
│   📁 frontend  main ↑2 ✓ PR#12     │  ← 含 git 状态，点击→右侧面板
│   📁 user-svc  feat/ ⚠             │
│     └ 📁 worktree: hotfix/zzz      │  ← worktree 子条目
│   📁 order-svc main ↑0 ✓           │
├─────────────────────────────────────┤
│  🤖 会话列表（项目所有 agent）      │
│   🟢 Agent-1 (task: 登录优化)       │  ← 扁平列表，不按 task 分组
│   🔵 Agent-2 (自由)                 │
│   [+ 创建 Agent]                    │
├─────────────────────────────────────┤
│  [Add Project] [Home] [Settings]   │  ← 复用上游 SidebarFooter
│  Host picker                        │
└─────────────────────────────────────┘
```

### 2.3 Sidebar 选择状态（新 store）

**文件**: `packages/app/src/stores/sidebar-selection-store.ts` (新建)

```typescript
// 驱动右侧面板，不影响中间区域
type SidebarSelection =
  | { kind: "repo"; relativePath: string }
  | { kind: "worktree"; relativePath: string; worktreePath: string }
  | { kind: "agent"; agentId: string }
  | { kind: "menu"; item: "project_list" | "task_list" }
  | { kind: "none" };
```

### 2.4 右侧面板联动

右侧 explorer 监听 `sidebarSelection`，切换显示内容：

- 选中 repo → 显示该 repo 文件树 + git 状态
- 选中 agent → 显示 agent cwd 文件树
- 选中 menu → 收起或保持

---

## 三、Tab 系统改造（双层存储）

### 3.1 核心思路：Wrapper Store，不修改上游 store

**不修改** `workspace-tabs-store/state.ts`。创建包装 store：

**文件**: `packages/app/src/stores/dev-platform-tabs-store.ts` (新建)

```typescript
// 独立存储 project 级 tab
interface DevPlatformTabsState {
  // Project 级 tab 存储（按 projectId）
  uiTabsByProject: Record<string, WorkspaceTab[]>;
  tabOrderByProject: Record<string, string[]>;
  focusedTabIdByProject: Record<string, string>;

  // Project 级操作
  ensureProjectTab: (input: { serverId: string; projectId: string; target: WorkspaceTabTarget }) => string | null;
  focusProjectTab: (input: { serverId: string; projectId: string; tabId: string }) => void;
  closeProjectTab: (input: { serverId: string; projectId: string; tabId: string }) => void;

  // 统一查询（合并 project + workspace tab）
  getMergedTabs: (input: { serverId: string; workspaceId: string; projectId: string }) => WorkspaceTab[];

  // 委托给上游的 workspace 级操作
  ensureWorkspaceTab: (input: { ... }) => string | null;  // → 调用上游
  focusWorkspaceTab: (input: { ... }) => void;            // → 调用上游
  closeWorkspaceTab: (input: { ... }) => void;            // → 调用上游
}
```

### 3.2 Tab 类型分类

| Scope            | Tab kinds                                                                                                                 | 存储 key                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Project 级**   | kanban, branches, create_task, task_detail, task_activity, archived_tasks, project_settings, project_list, create_project | `serverId:projectId`               |
| **Workspace 级** | agent, terminal, browser, file, draft, setup                                                                              | `serverId:workspaceId`（上游存储） |

### 3.3 projectId 获取

**方案 A**（推荐）：DevPlatformProject 新增 `workspaceIds` 字段

```typescript
// packages/protocol/src/dev-platform/types.ts（已有文件，加 1 个字段）
export const DevPlatformProjectSchema = z.object({
  // ... 现有字段
  workspaceIds: z.array(z.string()).default([]),
});
```

**工具函数**：`packages/app/src/utils/project-workspace-mapping.ts` (新建)

```typescript
export function getProjectIdByWorkspaceId(workspaceId: string): string | null;
```

### 3.4 UI 层集成

**上游 workspace-screen.tsx 的改动（仅 2 行）**：

在 tab 渲染前加 panel registry 查找：

```typescript
// workspace-screen.tsx 渲染 tab 内容的地方
const customRenderer = getPanelRenderer(tab.target.kind); // ← 加这 1 行
if (customRenderer) return customRenderer(tab, props); // ← 加这 1 行
// ... upstream switch/case ...
```

**Dev-platform tab 渲染器**：`packages/app/src/screens/workspace/dev-platform-tab-renderer.tsx` (新建)

```typescript
import { registerPanelRenderer } from "./panel-registry";
import { KanbanPanel } from "@/panels/kanban-panel";
import { TaskDetailPanel } from "@/panels/task-detail-panel";
// ... 注册所有 dev-platform panel
registerPanelRenderer("kanban", KanbanPanel);
registerPanelRenderer("task_detail", TaskDetailPanel);
registerPanelRenderer("branches", BranchesPanel);
// ... etc
```

### 3.5 Tab 栏视觉区分

```
┌─────────────────────────────────────────────────────┐
│ ● Kanban | ● Task#123 | ● Task#456                │  ← Project 级（● 小圆点标记）
│ Agent-1 | Terminal | file.tsx                      │  ← Workspace 级（无标记）
└─────────────────────────────────────────────────────┘
```

---

## 四、Git 功能兼容

### 4.1 Git 状态展示

每个 DevPlatformGitRepo 在 sidebar 行上显示完整 git 状态：

- 当前分支名
- ahead/behind 计数
- PR badge
- CI checks badge
- dirty/clean 状态

**数据源**：daemon 通过 `rootDirectory/relativePath` 执行 git 命令，不依赖 Paseo workspace。

**文件**: `packages/server/src/server/dev-platform/git-repo-monitor.ts` (新建)

- 定期获取每个 git repo 的状态
- 通过 WebSocket push 到客户端

### 4.2 Git 操作

通过 repo 行的 kebab 菜单触发：

- commit / push / pull
- 分支切换
- 查看 diff

操作目标 = `rootDirectory/relativePath`

### 4.3 Worktrees

作为 git repo 行的子条目显示：

```
📁 frontend-web (main)
  └── 📁 worktree: feature/xxx   ← 点击 → 右侧面板切换
```

**数据模型**：

```typescript
export const DevPlatformWorktreeSchema = z.object({
  path: z.string().trim().min(1), // 绝对路径
  branch: z.string().trim().min(1), // 分支名
});

export const DevPlatformGitRepoSchema = z.object({
  url: z.string().trim().min(1),
  relativePath: z.string().trim().min(1), // "." 表示根仓库
  label: z.string().optional(),
  worktrees: z.array(DevPlatformWorktreeSchema).default([]),
});
```

### 4.4 PR 详细视图

点击 sidebar PR badge → 在项目 workspace 的中间区域开一个 PR tab。

---

## 五、项目创建：Git Repo 自动检测

### 5.1 检测逻辑

**文件**: `packages/server/src/server/dev-platform/repo-scanner.ts` (新建)

```typescript
// 递归扫描 rootDirectory 下所有 .git 子目录
async function scanGitRepos(rootDirectory: string): Promise<DetectedRepo[]> {
  // 规则：
  // - 最大深度 5 层
  // - 忽略 node_modules, dist, build, .cache, .git 自身
  // - 结果上限 50 个 repo
  // - 如果 rootDirectory 本身有 .git，返回 relativePath: "."
}
```

### 5.2 集成到项目创建

`dev.project.create` handler 中：

1. 创建项目实体
2. 如果 rootDirectory 有 `.git` → 添加 `{ relativePath: "." }` 到 gitRepos
3. 递归扫描子目录 → 添加检测到的 repo 到 gitRepos
4. 返回带 gitRepos 的完整项目

---

## 六、Schema 变更

### 6.1 DevPlatformGitRepo（更新）

```typescript
// 旧（Phase 1）
{ url: string; workspaceId?: string; label?: string }

// 新
{
  url: string;
  relativePath: string;    // 相对于 rootDirectory 的路径，"." = 根仓库
  label?: string;
  worktrees: DevPlatformWorktree[];
}
```

### 6.2 DevPlatformProject（追加字段）

```typescript
// 追加（不改已有字段）
{
  // ... 现有字段不变
  workspaceIds: string[];  // 关联的 workspace ID 列表
}
```

---

## 七、实施步骤

### Step 1: Protocol schema 更新 (0.5 天)

- [ ] `DevPlatformGitRepoSchema` 改为 `relativePath`，删除 `workspaceId`，添加 `worktrees`
- [ ] `DevPlatformProjectSchema` 添加 `workspaceIds` 字段
- [ ] 新增 `DevPlatformWorktreeSchema`
- [ ] `npm run build:client` + `npm run typecheck` 验证

### Step 2: Server 端 — repo scanner + 服务更新 (1.5 天)

- [ ] 新建 `repo-scanner.ts`：递归扫描 git repos
- [ ] 新建 `git-repo-monitor.ts`：获取 git 状态并 push
- [ ] 更新 `project-service.ts`：创建项目时自动扫描 repos
- [ ] 更新 `dev-platform-session-handlers.ts`：支持新字段
- [ ] `npm run build:server` + `npm run typecheck` 验证

### Step 3: 包装 Store — dev-platform-tabs-store (1.5 天)

- [ ] 新建 `dev-platform-tabs-store.ts`：project 级 tab 存储 + 包装上游 store
- [ ] 新建 `project-workspace-mapping.ts`：projectId ↔ workspaceId 映射
- [ ] 新建 `sidebar-selection-store.ts`：sidebar 选择状态
- [ ] 单元测试
- [ ] `npm run typecheck` 验证

### Step 4: Sidebar 整合 (2 天)

- [ ] 重构 `sidebar-dev-platform-content.tsx` → 重命名为 `dev-platform-sidebar.tsx`
- [ ] 实现 git repo 行：显示 git 状态，点击→更新 sidebar-selection
- [ ] 实现 worktree 子条目
- [ ] 实现 agent 扁平列表
- [ ] 在 `left-sidebar.tsx` 加 3 行 feature flag 门控
- [ ] `npm run typecheck` + `npm run lint` 验证

### Step 5: Panel Registry + Tab 整合 (1.5 天)

- [ ] 新建 `panel-registry.ts`：panel 注册表
- [ ] 新建 `dev-platform-tab-renderer.tsx`：注册所有 dev-platform panels
- [ ] 在 `workspace-screen.tsx` 加 2 行 registry 查找
- [ ] 更新 tab bar UI：合并 project + workspace tabs，scope 视觉标记
- [ ] `npm run typecheck` + `npm run lint` 验证

### Step 6: 右侧面板联动 (1 天)

- [ ] Explorer 监听 sidebar-selection，切换文件树源
- [ ] 选中 repo 时显示 git 状态面板
- [ ] 选中 agent 时显示 agent 文件

### Step 7: 集成测试 + 打磨 (1 天)

- [ ] 验证：切 git repo 时 project 级 tab 不变
- [ ] 验证：workspace 级 tab 独立管理
- [ ] 验证：sidebar 点击 repo 只影响右侧面板
- [ ] 验证：feature flag off 时上游 sidebar 正常工作
- [ ] `npm run typecheck` + `npm run lint` + `npm run format`

**总预估**: ~9 天

---

## 八、文件清单

### 新增文件（~15 个）

| 文件                                                               | 说明                             |
| ------------------------------------------------------------------ | -------------------------------- |
| `packages/app/src/components/sidebar/dev-platform-sidebar.tsx`     | 完整 dev-platform sidebar        |
| `packages/app/src/stores/dev-platform-tabs-store.ts`               | Project 级 tab store（包装上游） |
| `packages/app/src/stores/sidebar-selection-store.ts`               | Sidebar 选择状态                 |
| `packages/app/src/utils/project-workspace-mapping.ts`              | projectId ↔ workspaceId          |
| `packages/app/src/screens/workspace/panel-registry.ts`             | Panel 注册表                     |
| `packages/app/src/screens/workspace/dev-platform-tab-renderer.tsx` | Dev-platform panel 注册          |
| `packages/server/src/server/dev-platform/repo-scanner.ts`          | Git repo 扫描器                  |
| `packages/server/src/server/dev-platform/git-repo-monitor.ts`      | Git 状态监控                     |
| `packages/app/src/components/sidebar/sidebar-worktree-entry.tsx`   | Worktree 子条目                  |
| `packages/app/src/components/sidebar/sidebar-git-repo-row.tsx`     | Git repo 行（含状态）            |
| `packages/app/src/components/sidebar/sidebar-agent-list-flat.tsx`  | 扁平 agent 列表                  |
| `packages/app/src/hooks/use-git-repo-status.ts`                    | Git 状态 hook                    |
| `packages/app/src/hooks/use-sidebar-selection.ts`                  | Sidebar 选择 hook                |
| `project-knowledge/design/dev-platform-design.md`                  | 更新设计文档                     |
| `project-knowledge/design/workspace-tabs.md`                       | 更新 workspace 文档              |

### 修改的上游文件（~5 行）

| 文件                                                      | 改动量 | 说明                |
| --------------------------------------------------------- | ------ | ------------------- |
| `packages/app/src/components/left-sidebar.tsx`            | +3 行  | Feature flag 门控   |
| `packages/app/src/screens/workspace/workspace-screen.tsx` | +2 行  | Panel registry 查找 |

### 修改的自有文件（非上游）

| 文件                                                                       | 说明                               |
| -------------------------------------------------------------------------- | ---------------------------------- |
| `packages/protocol/src/dev-platform/types.ts`                              | 更新 GitRepo schema，添加 Worktree |
| `packages/server/src/server/dev-platform/project-service.ts`               | 创建时扫描 repos                   |
| `packages/server/src/server/dev-platform/dev-platform-session-handlers.ts` | 支持新字段                         |
| `packages/app/src/stores/dev-platform-store.ts`                            | 适配新 schema                      |
| `packages/app/src/components/sidebar-dev-platform-content.tsx`             | 重构/重命名                        |

---

## 九、合并上游的 SOP

```bash
# 1. 拉取上游更新
git fetch upstream
git merge upstream/main

# 2. 解决冲突（预计 5-6 个文件，每个 1-5 行）
# 对每个冲突文件：
#   - 接受上游的内部重构
#   - 重新插入你的 1-5 行（门控/插槽）

# 3. 验证
npm run typecheck
npm run lint
# Feature flag off → 原版 Paseo 正常
# Feature flag on → Dev-platform 定制正常

# 4. 提交
git commit
```
