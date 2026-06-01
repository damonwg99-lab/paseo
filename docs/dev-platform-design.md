# AI Dev Platform 设计文档

> 本文档为AI Dev Platform的完整设计规范，可直接用于二次开发。
> 所有条目已与用户确认，UI风格保持与现有Paseo app一致。

---

## 1. 整体架构

### 1.1 左侧栏层级

项目替代现有"工作区"概念，成为左侧第一层组织单元。完全替代，无传统模式fallback。

```
项目（第一层）
 ├── 📋 任务列表 → 点击跳转到看板
 ├── 📂 工作区 → 展开显示git仓库列表
 │    ├── repo-A
 │    ├── repo-B
 │    └── ...
 └── 🤖 Session → 展开显示agent列表
      ├── Agent-1  📎任务2       ← 关联了任务2
      ├── Agent-2  自由          ← 自由agent
      └── ...
```

### 1.2 核心规则

| 规则                     | 说明                                                         |
| ------------------------ | ------------------------------------------------------------ |
| 项目替代工作区           | 左侧第一层从workspace改为project，完全替代                   |
| Session cwd = 项目根目录 | 所有在项目下创建的agent，cwd都是项目rootDirectory            |
| 自由agent统一在项目下    | 自由agent显示在项目Session列表，标注"自由"                   |
| 现有agent自动归属        | 按cwd路径匹配项目rootDirectory，不在任何项目内的归入"未归类" |
| 中间区域动态切换         | 根据左侧选中内容切换中间区域内容                             |

### 1.3 中间区域映射

| 左侧选中                 | 中间区域           | 右侧explorer          |
| ------------------------ | ------------------ | --------------------- |
| 项目header               | 看板视图           | —                     |
| 任务列表                 | 看板视图           | —                     |
| 看板中某任务（点击卡片） | 任务详情页         | —                     |
| git仓库                  | 不变（保持看板等） | 文件目录（该repo）    |
| agent session            | 对话流             | 文件目录（agent cwd） |
| 看板上方"分支管理"       | 分支管理视图       | —                     |
| 看板上方"归档任务"       | 归档任务列表       | —                     |

### 1.4 Agent自动归属逻辑

现有Paseo agent（按cwd创建）需自动归属到项目：

```
算法：
1. 获取所有项目的rootDirectory列表
2. 对每个agent，检查其cwd是否是某个项目rootDirectory的子路径
3. 如果是 → 归属到该项目
4. 如果不是任何项目的子路径 → 归入"未归类"区域
5. 一个agent只归属一个项目（取最长匹配）
```

---

## 2. 数据模型

### 2.1 DevPlatformGitRepo（嵌入类型）

| 字段        | Zod类型                    | 必填 | 默认值    | 验证        | 说明                             |
| ----------- | -------------------------- | ---- | --------- | ----------- | -------------------------------- |
| url         | `z.string().trim().min(1)` | 是   | —         | 非空trimmed | git仓库URL或本地路径             |
| workspaceId | `z.string().optional()`    | 否   | undefined | —           | Paseo workspace ID               |
| label       | `z.string().optional()`    | 否   | undefined | —           | 显示标签（微服务场景区分仓库名） |

### 2.2 CicdConfig（嵌入类型）

| 字段           | Zod类型                                                     | 必填 | 默认值 | 验证        | 说明          |
| -------------- | ----------------------------------------------------------- | ---- | ------ | ----------- | ------------- |
| type           | `z.enum(["jenkins","github_actions","gitlab_ci","custom"])` | 是   | —      | —           | CI/CD平台类型 |
| url            | `z.string().trim().min(1)`                                  | 是   | —      | 非空trimmed | 平台地址      |
| token          | `z.string().trim().min(1)`                                  | 是   | —      | 非空trimmed | 认证token     |
| uatJob         | `z.string().trim().min(1)`                                  | 是   | —      | 非空trimmed | UAT job名     |
| prdJob         | `z.string().trim().min(1)`                                  | 是   | —      | 非空trimmed | 生产job名     |
| autoTriggerUat | `z.boolean().default(true)`                                 | 否   | true   | —           | UAT自动触发   |
| autoTriggerPrd | `z.boolean().default(false)`                                | 否   | false  | —           | 生产自动触发  |

> 修复：Phase 1中token缺少`.trim().min(1)`，现已修正。

### 2.3 DevPlatformProviderConfig（嵌入类型）

| 字段     | Zod类型                               | 必填 | 默认值    | 验证        | 说明       |
| -------- | ------------------------------------- | ---- | --------- | ----------- | ---------- |
| provider | `z.string().trim().min(1)`            | 是   | —         | 非空trimmed | provider名 |
| model    | `z.string().trim().min(1).optional()` | 否   | undefined | —           | model名    |
| mode     | `z.string().trim().min(1).optional()` | 否   | undefined | —           | mode名     |

### 2.4 DevPlatformProject

| 字段            | Zod类型                                         | 必填     | 默认值                           | 验证         | 说明                    | 变更                            |
| --------------- | ----------------------------------------------- | -------- | -------------------------------- | ------------ | ----------------------- | ------------------------------- |
| id              | `z.string()`                                    | 系统生成 | `randomBytes(8).toString("hex")` | 16字符hex    | 实体ID                  | —                               |
| name            | `z.string().trim().min(1)`                      | 是       | —                                | 非空trimmed  | 项目名称                | —                               |
| description     | `z.string().optional()`                         | 否       | undefined                        | —            | 项目描述                | 修复：Phase1用""应改为undefined |
| rootDirectory   | `z.string().trim().min(1)`                      | 是       | —                                | 非空trimmed  | 项目根目录（agent cwd） | **新增**                        |
| gitRepos        | `z.array(DevPlatformGitRepoSchema).default([])` | 否       | []                               | —            | git仓库列表             | —                               |
| zentaoProjectId | `z.string().optional()`                         | 否       | undefined                        | —            | 禅道项目ID              | —                               |
| uatBranch       | `z.string().optional()`                         | 否       | undefined                        | —            | UAT分支名               | —                               |
| prdBranch       | `z.string().optional()`                         | 否       | undefined                        | —            | 生产分支名              | —                               |
| cicdConfig      | `CicdConfigSchema.nullable().default(null)`     | 否       | null                             | —            | CI/CD配置               | —                               |
| archivedAt      | `z.string().nullable().default(null)`           | 否       | null                             | —            | 归档时间，null=未归档   | **新增**                        |
| createdAt       | `z.string()`                                    | 系统生成 | ISO timestamp                    | —            | 创建时间                | —                               |
| updatedAt       | `z.string()`                                    | 系统生成 | ISO timestamp                    | 每次修改更新 | 修改时间                | —                               |

### 2.5 DevPlatformTask

| 字段             | Zod类型                                                        | 必填     | 默认值        | 验证                                                               | 说明                  | 变更                                    |
| ---------------- | -------------------------------------------------------------- | -------- | ------------- | ------------------------------------------------------------------ | --------------------- | --------------------------------------- |
| id               | `z.string()`                                                   | 系统生成 | 16字符hex     | —                                                                  | 实体ID                | —                                       |
| projectId        | `z.string()`                                                   | 是       | —             | **需验证项目存在**                                                 | 所属项目ID            | 修复：service需验证                     |
| type             | `DevPlatformTaskTypeSchema`                                    | 是       | —             | enum                                                               | 任务类型              | —                                       |
| title            | `z.string().trim().min(1)`                                     | 是       | —             | 非空trimmed                                                        | 任务标题              | —                                       |
| description      | `z.string().optional()`                                        | 否       | undefined     | —                                                                  | 任务描述              | 修复：Phase1用""应改为undefined         |
| priority         | `z.enum(["low","medium","high","critical"]).default("medium")` | 否       | medium        | —                                                                  | 优先级                | —                                       |
| status           | `DevPlatformTaskStatusSchema.default("todo")`                  | 否       | todo          | enum: todo/in_progress/review/done/blocked/merge_conflict/archived | 状态                  | —                                       |
| interactionMode  | `DevPlatformInteractionModeSchema.default("step_by_step")`     | 否       | step_by_step  | enum: step_by_step/auto                                            | 交互模式              | —                                       |
| parentTaskId     | `z.string().nullable().default(null)`                          | 否       | null          | —                                                                  | 父任务ID              | —                                       |
| agentIds         | `z.array(z.string()).default([])`                              | 否       | []            | —                                                                  | 关联agent ID列表      | —                                       |
| activeAgentId    | `z.string().nullable().default(null)`                          | 否       | null          | —                                                                  | 当前活跃agent         | —                                       |
| syncToZentao     | `z.boolean().default(false)`                                   | 否       | false         | —                                                                  | 是否同步禅道          | —                                       |
| zentaoId         | `z.string().nullable().default(null)`                          | 否       | null          | —                                                                  | 禅道对象ID            | —                                       |
| branchName       | `z.string().nullable().default(null)`                          | 否       | null          | 非null时需trim().min(1)                                            | 分支名                | 修复：update需验证非空                  |
| deploymentStatus | `DevPlatformDeploymentStatusSchema.default("not_deployed")`    | 否       | not_deployed  | enum: not_deployed/uat/production                                  | 部署状态              | —                                       |
| buildStatus      | `DevPlatformBuildStatusSchema.default("not_built")`            | 否       | not_built     | enum: not_built/building/build_success/build_failed                | 构建状态              | —                                       |
| dependsOn        | `z.array(z.string()).default([])`                              | 否       | []            | —                                                                  | 依赖任务ID列表        | 修复：Phase1用optional应改为default([]) |
| contextIds       | `z.array(z.string()).default([])`                              | 否       | []            | —                                                                  | 注入的上下文ID列表    | 修复：同上                              |
| skillIds         | `z.array(z.string()).default([])`                              | 否       | []            | —                                                                  | 关联skill ID列表      | 修复：同上                              |
| outputDir        | `z.string().nullable().default(null)`                          | 否       | null          | —                                                                  | 产出物存储目录        | —                                       |
| providerConfig   | `DevPlatformProviderConfigSchema.nullable().default(null)`     | 否       | null          | —                                                                  | agent provider配置    | —                                       |
| involvedRepos    | `z.array(z.string()).default([])`                              | 否       | []            | —                                                                  | 涉及的仓库URL列表     | 修复：同上                              |
| archivedAt       | `z.string().nullable().default(null)`                          | 否       | null          | —                                                                  | 归档时间，null=未归档 | **新增**                                |
| createdAt        | `z.string()`                                                   | 系统生成 | ISO timestamp | —                                                                  | 创建时间              | —                                       |
| updatedAt        | `z.string()`                                                   | 系统生成 | ISO timestamp | 每次修改更新                                                       | 修改时间              | —                                       |

> **状态转换规则**：自由转换，无限制。用户可从任意状态切换到任意状态。

### 2.6 DevPlatformContext

| 字段           | Zod类型                              | 必填     | 默认值        | 验证                                                                                | 说明       | 变更                |
| -------------- | ------------------------------------ | -------- | ------------- | ----------------------------------------------------------------------------------- | ---------- | ------------------- |
| id             | `z.string()`                         | 系统生成 | 16字符hex     | —                                                                                   | 实体ID     | —                   |
| projectId      | `z.string()`                         | 是       | —             | **需验证项目存在**                                                                  | 所属项目   | 修复：service需验证 |
| sourceType     | `DevPlatformContextSourceTypeSchema` | 是       | —             | enum: previous_output/workspace_file/task_background/zentao_sync/agent_conversation | 来源类型   | —                   |
| sourceId       | `z.string().optional()`              | 否       | undefined     | —                                                                                   | 来源实体ID | —                   |
| title          | `z.string().trim().min(1)`           | 是       | —             | 非空trimmed                                                                         | 上下文标题 | —                   |
| filePath       | `z.string().optional()`              | 否       | undefined     | —                                                                                   | 文件路径   | —                   |
| contentPreview | `z.string().optional()`              | 否       | undefined     | —                                                                                   | 内容预览   | —                   |
| createdAt      | `z.string()`                         | 系统生成 | ISO timestamp | —                                                                                   | 创建时间   | —                   |
| updatedAt      | `z.string()`                         | 系统生成 | ISO timestamp | 每次修改更新                                                                        | 修改时间   | —                   |

### 2.7 DefaultAgentConfig（全局配置，所有项目共用）

| 字段                 | Zod类型                          | 必填 | 默认值                        | 说明                |
| -------------------- | -------------------------------- | ---- | ----------------------------- | ------------------- |
| type                 | `DevPlatformTaskTypeSchema`      | 是   | —                             | 任务类型（作为key） |
| provider             | `z.string().trim().min(1)`       | 是   | "claude"（默认值）            | provider名          |
| model                | `z.string().trim().min(1)`       | 是   | "claude-sonnet-4-6"（默认值） | model名             |
| mode                 | `z.string().trim().min(1)`       | 是   | "default"（默认值）           | mode名              |
| systemPromptTemplate | `z.string().optional()`          | 否   | undefined                     | system prompt模板   |
| skillIds             | `z.array(z.string()).optional()` | 否   | undefined                     | 默认skill ID列表    |

> **变更**：Phase 1实现中DefaultAgentConfig在项目设置中，现已改为全局Settings配置，所有项目共用。

### 2.8 ZentaoConfig（全局配置）

| 字段         | Zod类型                               | 必填 | 默认值    | 说明           |
| ------------ | ------------------------------------- | ---- | --------- | -------------- |
| url          | `z.string().trim().min(1)`            | 是   | —         | 禅道服务器地址 |
| token        | `z.string()`                          | 是   | —         | 认证token      |
| account      | `z.string().trim().min(1)`            | 是   | —         | 禅道账号       |
| productId    | `z.string().optional()`               | 否   | undefined | 禅道产品ID     |
| lastSyncedAt | `z.string().nullable().default(null)` | 否   | null      | 最后同步时间   |

> **变更**：禅道连接配置从项目设置移到全局Settings，所有项目共用同一禅道服务器。

### 2.9 TaskActivity（append-only日志）

| 字段      | Zod类型                    | 必填     | 默认值        | 说明                    |
| --------- | -------------------------- | -------- | ------------- | ----------------------- |
| id        | `z.string()`               | 系统生成 | 16字符hex     | 实体ID                  |
| taskId    | `z.string()`               | 是       | —             | 关联任务ID              |
| timestamp | `z.string()`               | 系统生成 | ISO timestamp | 操作时间                |
| actor     | `TaskActivityActorSchema`  | 是       | —             | enum: user/agent/system |
| action    | `TaskActivityActionSchema` | 是       | —             | enum（17种操作类型）    |
| detail    | `z.string().optional()`    | 否       | undefined     | 操作详情                |

> Phase 1 handler返回空数组stub，Phase 2实现JSONL持久化。

### 2.10 枚举类型定义

```typescript
DevPlatformTaskTypeSchema = z.enum([
  "requirement",
  "design",
  "development",
  "bug",
  "testing",
  "documentation",
  "deployment",
]);

DevPlatformTaskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "review",
  "done",
  "blocked",
  "merge_conflict",
  "archived",
]);

DevPlatformInteractionModeSchema = z.enum(["step_by_step", "auto"]);

DevPlatformDeploymentStatusSchema = z.enum(["not_deployed", "uat", "production"]);

DevPlatformBuildStatusSchema = z.enum(["not_built", "building", "build_success", "build_failed"]);

DevPlatformContextSourceTypeSchema = z.enum([
  "previous_output",
  "workspace_file",
  "task_background",
  "zentao_sync",
  "agent_conversation",
]);

TaskActivityActorSchema = z.enum(["user", "agent", "system"]);

TaskActivityActionSchema = z.enum([
  "created",
  "agent_created",
  "agent_linked",
  "agent_switched",
  "mode_changed",
  "context_added",
  "context_removed",
  "output_confirmed",
  "status_changed",
  "branch_set",
  "deployed_to_uat",
  "deployed_to_production",
  "zentao_synced",
  "zentao_sync_toggled",
  "split_suggested",
  "split_confirmed",
  "merge_conflict_detected",
  "merge_conflict_resolved",
  "archived",
]);
```

---

## 3. RPC设计

### 3.1 RPC命名规范

遵循 `docs/rpc-namespacing.md` 的dotted namespace + direction suffix规范：

- Request: `dev.project.create`, `dev.task.list`
- Response: `dev.project.create/response`, `dev.task.list/response`

### 3.2 通用response格式

所有response payload包含：

- `requestId: z.string()` — 请求ID
- `error: z.string().nullable()` — 错误信息

实体类response额外包含实体字段（用对应Schema），删除类response返回请求的ID。

### 3.3 RPC清单（含Phase标注）

#### dev.project.\*

| RPC                            | Request字段                                                                                                                              | Response payload             | Phase | 说明                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----- | ------------------------------------- |
| dev.project.create             | requestId, name, description?, rootDirectory, gitRepos?, zentaoProjectId?, uatBranch?, prdBranch?, cicdConfig?                           | requestId, project?, error   | 1     | 创建项目                              |
| dev.project.list               | requestId                                                                                                                                | requestId, projects[], error | 1     | 列出所有项目（排除archived）          |
| dev.project.inspect            | requestId, projectId                                                                                                                     | requestId, project?, error   | 1     | 查看单个项目                          |
| dev.project.update             | requestId, projectId, name?, description?, rootDirectory?, gitRepos?, zentaoProjectId?, uatBranch?, prdBranch?, cicdConfig?, archivedAt? | requestId, project?, error   | 1     | 更新项目（归档通过此RPC设archivedAt） |
| dev.project.archive            | requestId, projectId                                                                                                                     | requestId, project?, error   | 1     | 归档项目（设archivedAt）              |
| dev.project.branch_status.list | requestId, projectId                                                                                                                     | requestId, branches[], error | 2     | 分支状态列表                          |

> **变更**：dev.project.create request新增rootDirectory必填字段。dev.project.list排除archived项目。原`dev.project.delete`重命名为`dev.project.archive`，行为是设置archivedAt。旧RPC名`dev.project.delete`可作为COMPAT标记保留。

#### dev.task.\*

| RPC                             | Request字段                                                                                                                                             | Response payload                              | Phase | 说明                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----- | ------------------------------------- |
| dev.task.create                 | requestId, projectId, taskType, title, description?, priority?, interactionMode?, parentTaskId?, syncToZentao?                                          | requestId, task?, error                       | 1     | 创建任务                              |
| dev.task.list                   | requestId, projectId                                                                                                                                    | requestId, tasks[], error                     | 1     | 列出项目下所有任务（排除archived）    |
| dev.task.inspect                | requestId, taskId                                                                                                                                       | requestId, task?, error                       | 1     | 查看单个任务                          |
| dev.task.update                 | requestId, taskId, title?, description?, priority?, status?, interactionMode?, parentTaskId?, branchName?, providerConfig?, involvedRepos?, archivedAt? | requestId, task?, error                       | 1     | 更新任务（归档通过此RPC设archivedAt） |
| dev.task.delete                 | requestId, taskId                                                                                                                                       | requestId, taskId, error                      | 1     | 删除任务（硬删除，不常用）            |
| dev.task.assign_agent           | requestId, taskId, providerConfig?, previewPrompt?                                                                                                      | requestId, agentId?, composedPrompt?, error   | 2     | 创建任务关联agent                     |
| dev.task.set_active_agent       | requestId, taskId, agentId                                                                                                                              | requestId, task?, error                       | 1     | 切换活跃agent                         |
| dev.task.link_agent             | requestId, taskId, agentId                                                                                                                              | requestId, task?, error                       | 1     | 手动关联已有agent                     |
| dev.task.set_interaction_mode   | requestId, taskId, interactionMode                                                                                                                      | requestId, task?, error                       | 1     | 切换交互模式                          |
| dev.task.add_context            | requestId, taskId, contextIds[]                                                                                                                         | requestId, task?, error                       | 1     | 注入上下文                            |
| dev.task.remove_context         | requestId, taskId, contextIds[]                                                                                                                         | requestId, task?, error                       | 1     | 移除上下文                            |
| dev.task.toggle_zentao_sync     | requestId, taskId, enabled                                                                                                                              | requestId, task?, error                       | 1     | toggle禅道同步                        |
| dev.task.suggest_split          | requestId, taskId                                                                                                                                       | requestId, suggestions[], error               | 2     | AI建议拆分方案                        |
| dev.task.confirm_split          | requestId, parentTaskId, subTasks[]                                                                                                                     | requestId, createdTasks[], error              | 2     | 确认拆分创建子任务                    |
| dev.task.merge_to_uat           | requestId, taskId                                                                                                                                       | requestId, success?, deploymentStatus?, error | 2     | 合并到UAT                             |
| dev.task.merge_to_production    | requestId, taskId                                                                                                                                       | requestId, success?, deploymentStatus?, error | 2     | 合并到生产                            |
| dev.task.resolve_merge_conflict | requestId, taskId, resolutionType                                                                                                                       | requestId, resolved?, task?, error            | 2     | 解决合并冲突                          |
| dev.task.set_branch             | requestId, taskId, branchName                                                                                                                           | requestId, task?, error                       | 1     | 设置分支名                            |
| dev.task.archive                | requestId, taskId                                                                                                                                       | requestId, task?, error                       | 1     | 归档任务（设archivedAt+停止agent）    |

> **变更**：dev.task.create新增syncToZentao可选字段。dev.task.list排除archived任务。dev.task.archive额外行为：停止关联agent。
> **修复**：dev.task.update的branchName应为 `z.string().trim().min(1).nullable().optional()`（非null时必须非空）。

#### dev.context.\*

| RPC                | Request字段                                                                    | Response payload             | Phase | 说明       |
| ------------------ | ------------------------------------------------------------------------------ | ---------------------------- | ----- | ---------- |
| dev.context.list   | requestId, projectId, taskId?                                                  | requestId, contexts[], error | 1     | 列出上下文 |
| dev.context.add    | requestId, projectId, sourceType, sourceId?, title, filePath?, contentPreview? | requestId, context?, error   | 1     | 添加上下文 |
| dev.context.remove | requestId, contextId                                                           | requestId, contextId, error  | 1     | 移除上下文 |

#### dev.default_config.\*

| RPC                       | Request字段                                                                  | Response payload            | Phase | 说明              |
| ------------------------- | ---------------------------------------------------------------------------- | --------------------------- | ----- | ----------------- |
| dev.default_config.list   | requestId                                                                    | requestId, configs[], error | 1     | 列出默认agent配置 |
| dev.default_config.update | requestId, taskType, provider, model, mode, systemPromptTemplate?, skillIds? | requestId, config?, error   | 1     | 更新默认配置      |

#### dev.zentao.\*（全局配置，Phase 3）

| RPC                              | Phase | 说明             |
| -------------------------------- | ----- | ---------------- |
| dev.zentao.configure             | 3     | 配置禅道连接     |
| dev.zentao.configure.status      | 3     | 查看禅道连接状态 |
| dev.zentao.sync.push             | 3     | 推送任务到禅道   |
| dev.zentao.sync.pull             | 3     | 从禅道拉取任务   |
| dev.zentao.sync.bidirectional    | 3     | 双向同步         |
| dev.zentao.sync.status           | 3     | 同步状态         |
| dev.zentao.sync.conflict.list    | 3     | 列出冲突         |
| dev.zentao.sync.conflict.resolve | 3     | 解决冲突         |

#### dev.skill.\*（Phase 4）

| RPC              | Phase | 说明      |
| ---------------- | ----- | --------- |
| dev.skill.list   | 4     | 列出skill |
| dev.skill.add    | 4     | 添加skill |
| dev.skill.remove | 4     | 移除skill |
| dev.skill.update | 4     | 更新skill |

#### 推送事件（服务端→客户端）

| 事件类型               | Payload字段                                                  | Phase | 说明              |
| ---------------------- | ------------------------------------------------------------ | ----- | ----------------- |
| dev.zentao.sync_update | projectId, taskId, syncStatus                                | 3     | 禅道同步状态变更  |
| dev.cicd.build_update  | projectId, environment, buildStatus, buildNumber?, buildUrl? | 2     | CI/CD构建状态变更 |

---

## 4. 数据持久化

### 4.1 存储方案

保持文件型JSON持久化，与Paseo现有架构一致。Phase 3-4再评估SQLite迁移。

### 4.2 文件结构

```
$PASEO_HOME/dev-platform/
├── projects/
│   └── {id}.json               # 每个项目一个JSON文件
├── tasks/
│   └── {id}.json                # 每个任务一个JSON文件
├── contexts/
│   └── {id}.json                # 每个上下文一个JSON文件
├── default-agent-configs.json   # 默认agent配置（单文件）
├── zentao-config.json           # 禅道连接配置（单文件，全局）
└── activities/
    └── {taskId}.jsonl           # append-only操作日志（Phase 2）
```

### 4.3 Service层需修复的问题

| #   | 问题                        | 修复方案                                           |
| --- | --------------------------- | -------------------------------------------------- |
| 1   | description字段undefined→"" | service create/update中改为保持undefined语义       |
| 2   | 项目删除不级联              | ProjectService.delete()需遍历删除tasks和contexts   |
| 3   | projectId不验证存在性       | TaskService/ContextService create时需检查项目存在  |
| 4   | contextId不验证存在性       | ContextService.add时需检查项目存在                 |
| 5   | 20个RPC有schema无handler    | Phase 2+的RPC至少返回"not_implemented"错误而非挂死 |

---

## 5. UI设计

### 5.1 新建项目

**入口**：

1. Sidebar顶部"+"按钮（始终可见）
2. 中间区域空状态页"新建项目"按钮

**流程**：点击 → 中间区域全屏创建项目表单 → 填写 → 创建 → 自动跳转到该项目看板

**表单字段**（16个）：

| #   | 字段          | 表单控件                       | 必填                | 默认值 |
| --- | ------------- | ------------------------------ | ------------------- | ------ |
| 1   | 项目名称      | 单行文本输入                   | 是                  | —      |
| 2   | 项目描述      | 多行文本输入                   | 否                  | —      |
| 3   | 项目根目录    | 路径选择器                     | 是                  | —      |
| 4   | Git仓库列表   | 动态添加列表（每条含URL+名称） | 否                  | 空     |
| 5   | UAT分支名     | 单行文本输入                   | 否                  | —      |
| 6   | 生产分支名    | 单行文本输入                   | 否                  | —      |
| 7   | 禅道项目ID    | 单行文本输入                   | 否                  | —      |
| 8   | CI/CD平台类型 | 下拉选择                       | 否                  | —      |
| 9   | CI/CD URL     | 单行文本输入                   | 否（如8已选则必填） | —      |
| 10  | 认证Token     | 单行文本输入                   | 否（如8已选则必填） | —      |
| 11  | UAT Job名     | 单行文本输入                   | 否（如8已选则必填） | —      |
| 12  | 生产Job名     | 单行文本输入                   | 否（如8已选则必填） | —      |
| 13  | UAT自动触发   | 开关                           | 否                  | true   |
| 14  | 生产自动触发  | 开关                           | 否                  | false  |

> CI/CD字段（8-14）全部不必填。如果选了CI/CD平台类型，URL/Token/Job名变为条件必填。

### 5.2 新建任务

**入口**：

1. 看板视图上方创建任务按钮
2. Sidebar任务列表"+"按钮

**流程**：点击 → 中间区域全屏创建任务表单 → 填写 → 跳转到任务详情页 → 回到看板

**表单字段**（8个）：

| #   | 字段     | 表单控件                    | 必填 | 默认值   |
| --- | -------- | --------------------------- | ---- | -------- |
| 1   | 所属项目 | 自动填充（不可改）          | 是   | 当前项目 |
| 2   | 任务类型 | 下拉选择（7种）             | 是   | —        |
| 3   | 任务标题 | 单行文本输入                | 是   | —        |
| 4   | 任务描述 | 多行文本输入                | 否   | —        |
| 5   | 优先级   | 下拉选择（低/中/高/紧急）   | 否   | 中       |
| 6   | 交互模式 | 下拉选择（逐步互动/全自动） | 否   | 逐步互动 |
| 7   | 父任务   | 下拉选择（项目下已有任务）  | 否   | —        |
| 8   | 同步禅道 | checkbox                    | 否   | 否       |

### 5.3 看板视图

**两种展示模式**（看板上方切换按钮）：

1. 状态列视图：todo | in_progress | review | done | blocked | merge_conflict（archived不在列中）
2. 类型分组视图：需求 | 设计 | 开发 | 缺陷 | 测试 | 文档 | 部署

**看板上方控件**：

- 切换按钮（状态列/类型分组）
- "分支管理"入口按钮 → 切换到分支管理视图
- "归档任务"入口按钮 → 切换到归档任务列表视图
- "项目设置"入口按钮 → 切换到项目设置页
- 创建任务入口按钮
- **搜索框 + 过滤按钮（按状态/类型/优先级）** → Phase 2实现

**看板任务卡片**：

常态（简洁）：

```
┌──────────────────────┐
│ 📋 任务标题           │  ← 类型图标 + 标题
│ ●中  ⚡逐步           │  ← 优先级圆点 + 交互模式
│ A1  🚧待发版  Z       │  ← agent标记 + 部署标记 + 禅道标记
└──────────────────────┘
```

悬停展开（显示操作）：

```
┌──────────────────────┐
│ 📋 任务标题           │
│ ●中  ⚡逐步           │
│ A1  🚧待发版  Z       │
│──────────────────────│
│ [+ 创建Agent]        │
│ ⋮ 更多操作            │
│   ├ 修改状态          │
│   ├ 同步禅道          │
│   ├ 合并到UAT         │
│   ├ 合并到生产        │
│   ├ 拆分任务          │
│   └ 归档              │
└──────────────────────┘
```

> **悬停规则**：hover-to-show模式。Native/compact端始终显示操作按钮（`isHovered || isNative || isCompact`），web端hover展开。

**部署状态标记**（卡片叠加，非独立列）：

| deploymentStatus | 标记   | 颜色   |
| ---------------- | ------ | ------ |
| not_deployed     | 待发版 | 琥珀色 |
| uat              | UAT    | 蓝色   |
| production       | 已生产 | 绿色   |

**agent标记**：

| agentIds状态 | 标记   |
| ------------ | ------ |
| []           | 无标记 |
| [1个]        | A1     |
| [2个+]       | A{n}   |

### 5.4 创建Agent

#### 从任务卡片创建

**流程**：

1. 看板卡片悬停展开 → 点击"创建Agent"
2. 弹出创建agent确认面板
3. 自动构建prompt（任务类型+标题+描述+上下文注入）
4. 可预览和修改prompt
5. 确认创建 → agentId加入任务agentIds，activeAgentId设为该agent
6. 中间区域切换到agent对话流

> **agent配置**：cwd=项目rootDirectory，provider/model/mode从全局DefaultAgentConfig继承，agent中可自由修改。

#### 自由Agent创建

**入口**：Sidebar Session区域"+"按钮

**流程**：

1. 点"+" → 创建自由agent
2. cwd=项目rootDirectory
3. provider/model/mode从全局DefaultAgentConfig继承
4. 创建后 → Session列表中显示，标注"自由"
5. 中间区域切换到agent对话流

**两种入口对比**：

| 入口                | 关联                | prompt                                |
| ------------------- | ------------------- | ------------------------------------- |
| 看板卡片"创建Agent" | 自动关联任务        | 自动构建（任务类型+标题+描述+上下文） |
| Sidebar Session"+"  | 不关联（自由agent） | 空prompt                              |

### 5.5 任务详情页

**入口**：点击看板任务卡片标题

**纯信息展示页**，不包含agent对话区。四个分区全部展示：

**基本信息区**：

| 展示项   | 字段            | 形式                    |
| -------- | --------------- | ----------------------- |
| 任务类型 | type            | 类型图标 + 文字标签     |
| 任务标题 | title           | 大标题                  |
| 状态     | status          | 状态标签 + 颜色圆点     |
| 优先级   | priority        | 标签（低/中/高/紧急）   |
| 交互模式 | interactionMode | 标签（逐步互动/全自动） |
| 任务描述 | description     | 多行文本块              |
| 所属项目 | projectId       | 项目名称链接            |

**关联信息区**：

| 展示项     | 字段          | 形式                                    |
| ---------- | ------------- | --------------------------------------- |
| 关联Agent  | agentIds      | agent列表卡片（名称+provider+活跃标记） |
| 活跃Agent  | activeAgentId | agent列表中高亮标记                     |
| 父任务     | parentTaskId  | 父任务标题链接                          |
| 任务依赖   | dependsOn     | 依赖任务标题列表                        |
| 上下文注入 | contextIds    | 上下文标题列表                          |
| 涉及仓库   | involvedRepos | 仓库名称标签                            |

**禅道与部署信息区**：

| 展示项   | 字段             | 形式      |
| -------- | ---------------- | --------- |
| 禅道同步 | syncToZentao     | 开/关标记 |
| 禅道ID   | zentaoId         | ID文字    |
| 分支名   | branchName       | 文字      |
| 部署状态 | deploymentStatus | 标签      |
| 构建状态 | buildStatus      | 标签      |

**时间+活动日志区**：

| 展示项         | 字段         | 归式                       |
| -------------- | ------------ | -------------------------- |
| 创建时间       | createdAt    | 日期时间                   |
| 修改时间       | updatedAt    | 日期时间                   |
| 活动日志摘要   | TaskActivity | 底部显示最近N条操作记录    |
| "查看完整日志" | —            | 按钮跳转到独立活动日志页面 |

### 5.6 分支管理视图

**入口**：看板上方"分支管理"按钮

**三个分组**（空分组不显示）：

| 分组              | 含义                      | 颜色   |
| ----------------- | ------------------------- | ------ |
| 待合并UAT         | 代码完成，等待合并到UAT   | 琥珀色 |
| 已合UAT待合并生产 | 已合并UAT，等待合并到生产 | 蓝色   |
| 已部署生产        | 已合并到生产              | 绿色   |

**分支行内容**：分支名、仓库标签、ahead/behind计数、构建状态badge、关联任务子行（点击展开）

**分支行操作**（条件显示）：

| 操作         | 条件                | 说明                  |
| ------------ | ------------------- | --------------------- |
| 合并到UAT    | 待合并UAT组         | 将分支合并到UAT分支   |
| 合并到生产   | 已合UAT待合并生产组 | 将UAT合并到生产       |
| 解决合并冲突 | merge_conflict状态  | 选择AI解决或手动解决  |
| 跳转关联任务 | 所有分支行          | 点击任务子行→任务详情 |

### 5.7 Session列表

**每个条目**：Agent名称 + 关联标记（任务标题或"自由")

**操作**：

- 点击条目 → 中间区域切换到agent对话流
- "+"按钮 → 创建自由agent

### 5.8 项目设置页

**入口**：Sidebar项目header齿轮图标 + 看板上方"项目设置"按钮

**分区1：项目基本信息**（7字段，可编辑，rootDirectory不可改）

| 字段        | 控件       | 可编辑 |
| ----------- | ---------- | ------ |
| 项目名称    | 单行文本   | 是     |
| 项目描述    | 多行文本   | 是     |
| 项目根目录  | 文字展示   | 否     |
| Git仓库列表 | 动态增删改 | 是     |
| UAT分支名   | 单行文本   | 是     |
| 生产分支名  | 单行文本   | 是     |
| 禅道项目ID  | 单行文本   | 是     |

**分区2：CI/CD配置**（7字段，全部可编辑不必填）

| 字段          | 控件     | 可编辑 |
| ------------- | -------- | ------ |
| CI/CD平台类型 | 下拉选择 | 是     |
| CI/CD URL     | 单行文本 | 是     |
| 认证Token     | 单行文本 | 是     |
| UAT Job名     | 单行文本 | 是     |
| 生产Job名     | 单行文本 | 是     |
| UAT自动触发   | 开关     | 是     |
| 生产自动触发  | 开关     | 是     |

### 5.9 全局Settings页面

**分区1：默认Agent配置**（所有项目共用，7种任务类型各一行）

| 字段              | 控件                | 说明                      |
| ----------------- | ------------------- | ------------------------- |
| 任务类型          | 文字展示（7种固定） | 行key                     |
| Provider          | 下拉选择            | 每种类型默认provider      |
| Model             | 下拉选择            | 每种类型默认model         |
| Mode              | 下拉选择            | 每种类型默认mode          |
| System Prompt模板 | 多行文本（可选）    | 每种类型默认system prompt |

**分区2：禅道连接配置**（全局）

| 字段     | 控件     | 说明                 |
| -------- | -------- | -------------------- |
| 禅道URL  | 单行文本 | 禅道服务器地址       |
| 账号     | 单行文本 | 禅道账号             |
| 密码     | 单行文本 | 禅道密码             |
| 产品ID   | 单行文本 | 禅道产品ID           |
| 连接状态 | 文字展示 | 自动检测是否连接成功 |

> 项目创建时的"禅道项目ID"字段保留，用于关联具体禅道项目。服务器连接信息在全局配置。

### 5.10 归档任务列表视图

**入口**：看板上方"归档任务"按钮

显示所有archivedAt不为null的任务，按归档时间倒序排列。

### 5.11 自由Agent反向拆分

**流程**：

1. 自由agent在对话流中分析后输出建议拆分方案
2. 显示确认面板：勾选/编辑/删除/补充建议任务
3. 箮认创建 → 批量创建任务 → 看板可见

> Agent可以建议，但**最终创建必须用户确认**。

### 5.12 任务拆分（从卡片kebab菜单）

两种方式：

1. 手动创建子任务
2. AI建议拆分 → 确认面板 → 创建子任务

创建的子任务parentTaskId指向原任务。

### 5.13 上下文注入UI

**位置**：agent对话区Composer上方

**交互**：

- chip标签区显示当前注入的上下文标题
- 点击"+"可搜索/勾选更多上下文
- chip标签可快速移除已注入的上下文

### 5.14 空状态

| 场景       | 提示          | 引导按钮         |
| ---------- | ------------- | ---------------- |
| 无项目     | "还没有项目"  | "新建项目"       |
| 看板无任务 | "还没有任务"  | "创建第一个任务" |
| 无agent    | "还没有Agent" | "创建Agent"      |

### 5.15 Agent对话区

纯对话流，无任务信息条。任务信息在任务详情页查看。

### 5.16 错误处理

| 错误类型 | 处理方式                | 示例                                           |
| -------- | ----------------------- | ---------------------------------------------- |
| 严重错误 | Modal弹窗+详情+操作选项 | 合并冲突（选AI或手动）、禅道冲突（字段级选择） |
| 普通错误 | inline红色提示          | 创建失败、网络断开                             |

### 5.17 加载状态

使用Paseo现有加载组件，保持风格一致。

---

## 6. UI风格一致性规范

| 规范                  | 来源                                                                          |
| --------------------- | ----------------------------------------------------------------------------- | --- | -------- | --- | ------------------------------- |
| 颜色/字体/间距/radius | `docs/design.md` 主题token                                                    |
| 平台gate              | `@/constants/platform`（isWeb/isNative/getIsElectron/useIsCompactFormFactor） |
| 悬停/交互             | `isHovered                                                                    |     | isNative |     | isCompact`（hover-to-show模式） |
| 加载状态              | Paseo现有组件                                                                 |
| 错误提示              | 严重→Modal，普通→inline，与现有风格一致                                       |
| 文件组织              | Metro extension: `.web.ts` / `.native.ts` / `.electron.tsx`                   |
| function声明          | `function Component()` 而非arrow assignment                                   |
| Store订阅             | 狭窄selector `(s) => s.projects`                                              |
| 无barrel文件          | 直接导入，不用index.ts                                                        |

---

## 7. 文件组织（新增文件）

### Protocol层

```
packages/protocol/src/dev-platform/
├── types.ts              # Zod entity schemas + TS interfaces（需更新）
└── rpc-schemas.ts        # RPC request/response schemas（需更新）
```

### Server层

```
packages/server/src/server/dev-platform/
├── store.ts              # File-backed JSON stores（需更新，加archivedAt/rootDirectory）
├── project-service.ts    # Project CRUD + cascade delete（需更新）
├── task-service.ts       # Task CRUD + agent linking（需更新）
├── context-service.ts    # Context CRUD（需更新，验证projectId）
├── default-agent-config-service.ts  # 全局默认配置（需更新，改为全局）
├── zentao-config-service.ts         # 全局禅道配置（新增）
├── dev-platform-session-handlers.ts # RPC dispatch（需更新，修复as casts）
└── index.ts              # Factory function（需更新）
```

### Client层

```
packages/client/src/
└── daemon-client.ts      # RPC methods（需全面修复类型）
```

### App层

```
packages/app/src/
├── stores/
│   └── dev-platform-store.ts         # Zustand store（需全面修复类型）
├── panels/
│   ├── create-project-panel.tsx      # 新建项目表单页（新增）
│   ├── create-task-panel.tsx         # 新建任务表单页（新增）
│   ├── task-detail-panel.tsx         # 任务详情页（新增）
│   ├── task-activity-panel.tsx       # 活动日志页（新增）
│   ├── archived-tasks-panel.tsx      # 归档任务列表（新增）
│   ├── kanban-panel.tsx             # 看板视图（需重构）
│   └── branches-panel.tsx           # 分支管理视图（需重构）
├── components/
│   ├── sidebar-dev-platform-task-list.tsx  # Sidebar任务列表（需重构）
│   ├── sidebar-project-section.tsx        # Sidebar项目区域（新增）
│   ├── sidebar-workspace-section.tsx      # Sidebar工作区区域（新增）
│   ├── sidebar-session-section.tsx        # Sidebar Session区域（新增）
│   ├── create-agent-modal.tsx             # 创建Agent确认面板（新增）
│   ├── task-split-confirm-panel.tsx       # 拆分任务确认面板（新增）
│   ├── context-chip-bar.tsx              # 上下文chip标签区（新增）
│   └── kanban-task-card.tsx              # 看板任务卡片（需重构）
├── screens/
│   └── settings-screen.tsx           # 全局设置（需扩展禅道+agent配置区）
└── constants/
    └── dev-platform-icons.ts         # 任务类型图标/状态颜色常量（新增）
```

---

## 8. 与现有Paseo的集成点

| 集成点           | 说明                                                        |
| ---------------- | ----------------------------------------------------------- |
| Sidebar重构      | 从workspace→session改为project→tasks/workspaces/sessions    |
| Agent归属        | 现有AgentManager的agent按cwd自动归属项目                    |
| WorkspaceTab重构 | 从workspace-centric改为project-centric tab系统              |
| Daemon info      | `buildServerInfoStatusPayload`增加dev_platform feature flag |
| Session dispatch | `session.ts`增加dev_platform feature flag门控               |
| Explorer联动     | 点击sidebar git仓库时右侧explorer切换到该仓库               |

---

## 9. 开发计划

### 当前分支已有代码盘点

**已提交（2个commit）**:

| 文件                                                                       | 行数    | 内容                                                  |
| -------------------------------------------------------------------------- | ------- | ----------------------------------------------------- |
| `packages/protocol/src/dev-platform/types.ts`                              | 314     | Zod schemas + TS interfaces                           |
| `packages/protocol/src/dev-platform/rpc-schemas.ts`                        | 934     | 全部45个RPC request/response schemas                  |
| `packages/protocol/src/messages.ts`                                        | 88新增  | 注册dev-platform schemas到SessionInboundMessage       |
| `packages/server/src/server/dev-platform/store.ts`                         | 204     | ProjectStore/TaskStore/ContextStore (JSON per-entity) |
| `packages/server/src/server/dev-platform/project-service.ts`               | 93      | Project CRUD                                          |
| `packages/server/src/server/dev-platform/task-service.ts`                  | 248     | Task CRUD + 8个specialized methods                    |
| `packages/server/src/server/dev-platform/context-service.ts`               | 50      | Context list/add/remove                               |
| `packages/server/src/server/dev-platform/default-agent-config-service.ts`  | 119     | Default config list/update                            |
| `packages/server/src/server/dev-platform/dev-platform-session-handlers.ts` | 587     | 24个handler dispatch                                  |
| `packages/server/src/server/dev-platform/index.ts`                         | 20      | Factory function                                      |
| `packages/server/src/server/bootstrap.ts`                                  | 6新增   | 创建devPlatformServices                               |
| `packages/server/src/server/session.ts`                                    | 229变更 | dispatchDevPlatformMessage                            |
| `packages/server/src/server/websocket-server.ts`                           | 4新增   | devPlatformServices注入                               |
| `packages/client/src/daemon-client.ts`                                     | 176新增 | 14个dev-platform RPC methods                          |
| `packages/app/src/stores/dev-platform-store.ts`                            | 223新增 | Zustand store + fetch actions                         |

**未提交（12个文件）**:

| 文件                                                             | 内容                 | 状态                 |
| ---------------------------------------------------------------- | -------------------- | -------------------- |
| `packages/app/src/components/sidebar-dev-platform-task-list.tsx` | Sidebar任务列表      | 新文件               |
| `packages/app/src/panels/kanban-panel.tsx`                       | 看板视图（两种模式） | 新文件               |
| `packages/app/src/panels/branches-panel.tsx`                     | 分支管理视图         | 新文件               |
| `packages/app/src/panels/task-panel.tsx`                         | 任务面板             | 新文件（在commit中） |
| `packages/app/src/components/left-sidebar.tsx`                   | Sidebar扩展          | 修改                 |
| `packages/app/src/panels/register-panels.ts`                     | Panel注册            | 修改                 |
| `packages/app/src/screens/settings-screen.tsx`                   | Settings扩展         | 修改                 |
| `packages/app/src/screens/workspace/workspace-screen.tsx`        | Workspace集成        | 修改                 |
| `packages/app/src/screens/workspace/workspace-tab-menu.ts`       | Tab菜单              | 修改                 |
| `packages/app/src/stores/dev-platform-store.ts`                  | Store actions        | 修改                 |
| `packages/app/src/stores/workspace-tabs-store/state.ts`          | Tab target           | 修改                 |
| `packages/app/src/utils/host-routes.ts`                          | Settings路由         | 修改                 |
| `packages/app/src/workspace-tabs/identity.ts`                    | Tab identity         | 修改                 |
| `packages/client/src/daemon-client.ts`                           | RPC methods          | 修改                 |

### 需要做的变更（基于新设计文档 vs 已有代码）

变更分为三类：**修复**（已有代码需修改）、**新增**（新设计要求的新功能）、**重构**（架构性调整）。

---

### Phase 1 开发计划（分5个step）

#### Step 1: Protocol schema更新

**目标**：将现有schema对齐到新设计文档的定义

**修改文件**：

| 文件                                                | 修改内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/protocol/src/dev-platform/types.ts`       | 1. DevPlatformProject新增`rootDirectory`字段（`z.string().trim().min(1)`必填）<br>2. DevPlatformProject新增`archivedAt`字段（`z.string().nullable().default(null)`）<br>3. DevPlatformTask新增`archivedAt`字段<br>4. CicdConfigSchema.token改为`z.string().trim().min(1)`<br>5. DevPlatformTaskSchema: dependsOn/contextIds/skillIds/involvedRepos从`.optional()`改为`.default([])`<br>6. DevPlatformProjectSchema.description从现有schema确认保持`.optional()`<br>7. CreateDevPlatformProjectInput新增`rootDirectory`必填字段<br>8. UpdateDevPlatformProjectInput新增`archivedAt`可选字段<br>9. UpdateDevPlatformTaskInput新增`archivedAt`可选字段 |
| `packages/protocol/src/dev-platform/rpc-schemas.ts` | 1. DevProjectCreateRequestSchema新增`rootDirectory`必填字段<br>2. DevProjectUpdateRequestSchema新增`archivedAt`可选字段<br>3. DevTaskUpdateRequestSchema: `branchName`改为`z.string().trim().min(1).nullable().optional()`<br>4. DevTaskUpdateRequestSchema新增`archivedAt`可选字段<br>5. 将`dev.project.delete`重命名为`dev.project.archive`（更新type literal）                                                                                                                                                                                                                                                                                   |

**验证**：`npm run build:client` + `npm run typecheck`

#### Step 2: Server service修复 + 新增字段支持

**目标**：修复service层5个已知问题，支持新增字段

**修改文件**：

| 文件                                                                       | 修改内容                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/server/src/server/dev-platform/store.ts`                         | 无需修改（Zod parse on read会自动处理新字段defaults）                                                                                                                                                                                                                |
| `packages/server/src/server/dev-platform/project-service.ts`               | 1. create()新增rootDirectory参数<br>2. create()中description改为`input.description ?? undefined`（不再转为""）<br>3. delete()改为archive()：设置archivedAt而非删除文件<br>4. 新增cascadeArchive：归档项目时归档其下所有任务和上下文<br>5. update()支持archivedAt字段 |
| `packages/server/src/server/dev-platform/task-service.ts`                  | 1. create()中description改为`input.description ?? undefined`<br>2. create()验证projectId存在（需注入projectService或store引用）<br>3. archive()增加停止关联agent行为<br>4. update()支持archivedAt字段                                                                |
| `packages/server/src/server/dev-platform/context-service.ts`               | 1. add()验证projectId存在（需注入projectStore引用）                                                                                                                                                                                                                  |
| `packages/server/src/server/dev-platform/default-agent-config-service.ts`  | 无需修改（已是全局配置）                                                                                                                                                                                                                                             |
| `packages/server/src/server/dev-platform/dev-platform-session-handlers.ts` | 1. dev.project.delete改名为dev.project.archive<br>2. 所有`as CreateDevPlatformProjectInput`等强转改为显式构造对象<br>3. 新增dev.project.branch_status.list handler（Phase1 stub返回空数组）<br>4. dev.task.archive handler增加停止agent逻辑                          |
| `packages/server/src/server/dev-platform/index.ts`                         | 1. createDevPlatformServices注入projectStore/taskStore到各service（用于存在性验证）<br>2. 新增ZentaoConfigService（全局配置，单文件存储）                                                                                                                            |
| `packages/server/src/server/session.ts`                                    | 1. dispatchDevPlatformMessage增加dev_platform feature flag门控                                                                                                                                                                                                       |
| `packages/server/src/server/websocket-server.ts`                           | 1. buildServerInfoStatusPayload增加`dev_platform` feature flag                                                                                                                                                                                                       |

**新增文件**：

| 文件                                                               | 内容                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| `packages/server/src/server/dev-platform/zentao-config-service.ts` | 全局禅道配置：read/save/verifyConnection（Phase1 stub） |

**验证**：`npm run build:server` + `npm run typecheck`

#### Step 3: Client RPC类型修复

**目标**：消除所有unknown/as强转，使用Zod response schema验证

**修改文件**：

| 文件                                   | 修改内容                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/client/src/daemon-client.ts` | 1. 所有dev-platform方法返回类型改为`z.infer<typeof XxxResponseSchema>["payload"]`而非手写unknown类型<br>2. 每个方法内部用对应ResponseSchema.parse()验证响应<br>3. 新增devProjectArchive方法（替代devProjectDelete）<br>4. 新增rootDirectory参数到devProjectCreate<br>5. devTaskUpdate新增archivedAt参数 |

**验证**：`npm run build:client` + `npm run typecheck`

#### Step 4: Zustand store类型修复 + 新增字段支持

**目标**：消除所有as强转，使用精确类型

**修改文件**：

| 文件                                            | 修改内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/app/src/stores/dev-platform-store.ts` | 1. createProject input: `gitRepos?: unknown[]` → `gitRepos?: DevPlatformGitRepo[]`<br>2. createTask input: `taskType: string` → `taskType: DevPlatformTaskType`, priority/interactionMode/status改为枚举<br>3. updateTask input: 同上改为枚举类型<br>4. updateDefaultConfig input: `taskType: string` → `taskType: DevPlatformTaskType`<br>5. 所有`(result.xxx as Yyy[]) ?? []`改为直接使用payload字段（已在daemon-client层验证）<br>6. 新增archiveProject action<br>7. 新增archiveTask action（调用update设archivedAt）<br>8. createProject增加rootDirectory参数<br>9. 新增fetchArchivedTasks action |

**验证**：`npm run typecheck`

#### Step 5: UI重构（基于新设计）

**目标**：将现有UI组件重构对齐新设计，新增缺失的UI页面

这是最大的step。现有UI组件需要重构，新设计要求的多个页面需要新建。

**修改文件**（重构现有）：

| 文件                                                             | 修改内容                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/app/src/panels/kanban-panel.tsx`                       | 1. STATUS_COLUMNS增加blocked和merge_conflict列<br>2. 卡片增加部署状态标记（deploymentStatus badge）<br>3. 卡片增加禅道同步标记（syncToZentao/Z标记）<br>4. 悬停展开操作：新增"归档"和"拆分任务"选项<br>5. 看板上方增加"归档任务"入口和"项目设置"入口<br>6. "Branches"按钮改为NavigationButton而非ViewModeButton |
| `packages/app/src/panels/branches-panel.tsx`                     | 无重大修改（当前实现已对齐设计）                                                                                                                                                                                                                                                                                |
| `packages/app/src/components/sidebar-dev-platform-task-list.tsx` | 需重构为项目-centric sidebar结构（见下方新增文件）                                                                                                                                                                                                                                                              |
| `packages/app/src/components/left-sidebar.tsx`                   | 重构：从workspace→session改为project→tasks/workspaces/sessions层级                                                                                                                                                                                                                                              |
| `packages/app/src/screens/settings-screen.tsx`                   | 1. DevPlatformSection增加编辑UI（provider/model/mode选择器）<br>2. 新增禅道连接配置区（全局Settings中）                                                                                                                                                                                                         |

**新增文件**：

| 文件                                                        | 内容                                     |
| ----------------------------------------------------------- | ---------------------------------------- |
| `packages/app/src/panels/create-project-panel.tsx`          | 新建项目全屏表单页（16字段）             |
| `packages/app/src/panels/create-task-panel.tsx`             | 新建任务全屏表单页（8字段）              |
| `packages/app/src/panels/task-detail-panel.tsx`             | 任务详情页（4分区展示）                  |
| `packages/app/src/panels/task-activity-panel.tsx`           | 任务活动日志独立页面                     |
| `packages/app/src/panels/archived-tasks-panel.tsx`          | 归档任务列表视图                         |
| `packages/app/src/panels/project-settings-panel.tsx`        | 项目设置页（2分区）                      |
| `packages/app/src/components/sidebar-project-section.tsx`   | Sidebar项目区域（header+齿轮+展开）      |
| `packages/app/src/components/sidebar-workspace-section.tsx` | Sidebar工作区区域（git仓库列表）         |
| `packages/app/src/components/sidebar-session-section.tsx`   | Sidebar Session区域（agent列表+"+"按钮） |
| `packages/app/src/components/create-agent-modal.tsx`        | 创建Agent确认面板（prompt预览+修改）     |
| `packages/app/src/constants/dev-platform-icons.ts`          | 任务类型图标/状态颜色/优先级颜色常量     |

**修改文件**（路由/tab系统）：

| 文件                                                      | 修改内容                                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `packages/app/src/stores/workspace-tabs-store/state.ts`   | WorkspaceTabTarget增加: create_project/create_task/task_detail/task_activity/archived_tasks/project_settings kind |
| `packages/app/src/workspace-tabs/identity.ts`             | 对应identity/coercion函数                                                                                         |
| `packages/app/src/panels/register-panels.ts`              | 注册所有新增panel                                                                                                 |
| `packages/app/src/screens/workspace/workspace-screen.tsx` | 集成项目-centric导航                                                                                              |
| `packages/app/src/utils/host-routes.ts`                   | 新增project_settings路由                                                                                          |

**验证**：`npm run typecheck` + `npm run lint` + `npm run format` + 启动dev server手动验证

---

### Phase 2 开发计划（简要，后续细化）

| Step | 内容                                                                             |
| ---- | -------------------------------------------------------------------------------- |
| 2.1  | 看板搜索+过滤功能                                                                |
| 2.2  | 创建Agent完整流程（prompt预览+修改+确认面板）                                    |
| 2.3  | 自由Agent反向拆分确认面板                                                        |
| 2.4  | 任务拆分确认面板                                                                 |
| 2.5  | 上下文注入chip bar + 搜索勾选面板                                                |
| 2.6  | dev.project.branch_status.list handler实现（git操作）                            |
| 2.7  | dev.task.assign_agent handler实现                                                |
| 2.8  | dev.task.suggest_split / confirm_split handler实现                               |
| 2.9  | dev.task.merge_to_uat / merge_to_production / resolve_merge_conflict handler实现 |
| 2.10 | 产出物管理系统（project-Knowledge/目录结构）                                     |
| 2.11 | 产出物Tab（Explorer右侧）                                                        |
| 2.12 | 交互模式切换按钮（对话区内）                                                     |
| 2.13 | Agent切换前置上下文注入                                                          |

### Phase 3 开发计划（简要）

| Step | 内容                                       |
| ---- | ------------------------------------------ |
| 3.1  | ZentaoApiClient + ZentaoSyncService实现    |
| 3.2  | CicdClient（Jenkins API）+ CicdService实现 |
| 3.3  | 禅道配置页面完善（连接验证+手动同步）      |
| 3.4  | CI/CD配置页面完善                          |
| 3.5  | 禅道同步状态指示器（灰/绿/红）             |
| 3.6  | 构建状态指示器                             |
| 3.7  | 禅道冲突解决弹窗（字段级对比）             |

### Phase 4-5（简要）

| Step | 内容                                     |
| ---- | ---------------------------------------- |
| 4.1  | AI辅助功能（需求分析/模块拆分/设计生成） |
| 4.2  | Skill管理完整实现                        |
| 4.3  | Token水位线                              |
| 4.4  | 文件树VS Code颜色标记                    |
| 5.1  | 产出物版本管理                           |
| 5.2  | E2E测试                                  |
| 5.3  | 键盘快捷键+打磨                          |

---

## 10. Phase 2+ 遗漏项（需后续设计细化）

以下内容在旧计划中有详细设计，但新设计文档中未细化，需Phase 2+开始前补充设计：

| #   | 遗漏项                                                               | 旧计划位置   | 需补充设计的Phase |
| --- | -------------------------------------------------------------------- | ------------ | ----------------- |
| 1   | 产出物管理系统（project-Knowledge/目录结构、命名规则、确认保存流程） | 旧计划第六节 | Phase 2           |
| 2   | 产出物Tab（Explorer右侧新增outputs tab）                             | 旧计划3.3节  | Phase 2           |
| 3   | 文件树VS Code颜色标记                                                | 旧计划3.3节  | Phase 2           |
| 4   | Agent切换前置上下文（切换activeAgentId时注入上一个agent结论）        | 决策51       | Phase 2           |
| 5   | Token水位线（绿/黄/红）                                              | 决策50       | Phase 2+4         |
| 6   | pendingAgentLink机制（CLI唤醒+自动关联）                             | 决策32       | Phase 2           |
| 7   | 交互模式切换按钮（对话区内，不只是任务创建）                         | 决策25       | Phase 2           |
| 8   | 产出物确认保存（对话流中卡片确认按钮→保存到project-Knowledge/）      | 决策27       | Phase 2           |
| 9   | 批量分支操作                                                         | 旧计划3.5节  | Phase 2           |
| 10  | 数据源双重验证（任务元数据+git实际状态）                             | 旧计划3.5节  | Phase 2           |
