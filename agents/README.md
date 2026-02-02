# Agents

LangGraph graphs and orchestration. Depends on the LLM layer via interfaces only.

Minimal endpoints (Cloudflare Pages Functions):
- `POST /api/agent/generate`
- `POST /api/agent/stream`

## Architecture

- Tool Registry: `agents/tools`
- Graph: `Plan → Act → Reflect`
- LLM access remains isolated behind `createLLMClient`

## 记忆与“档案库”设计（Agent 层）

目标：让 Agent 拥有可持续沉淀的研究档案，但又与 App 业务数据低耦合。

### 概念
- **App 数据**：用户与阅读材料的原始业务数据（book/chapter/notes 等）。
- **Agent 档案**：Agent 对用户与阅读材料的“理解与研究成果”，是二次沉淀（summary/insight/profile）。
- **档案库**：专属于 Agent 的记忆层，读写都通过 Agent 工具完成，App 只提供上下文，不直接写档案。

### 设计原则
- **低耦合**：App 不直接读写档案；Agent 通过 Tool Registry 访问档案。
- **可追溯**：档案写入必须带来源 metadata（user_id, project_id, book_id, feature）。
- **可进化**：先做“最小可用记忆”，后续可升级为向量检索或多层级摘要。

### 档案类型（建议最小集合）
1) `user_profile`：用户偏好、术语习惯、学习目标（缓慢变化）
2) `reading_dossier`：针对书籍/章节的结构化理解与摘要
3) `project_insights`：项目层级的研究结论与跨文档关联

### 运行路径（Plan → Act → Reflect）
1) **Plan**：判断是否需要调用档案工具（读取/写入/更新）
2) **Act**：调用工具获得档案结果或写入新的档案片段
3) **Reflect**：结合工具结果输出最终答复，并决定是否追加档案

### Tool Registry 设计（建议）
在 `agents/tools` 内定义档案工具（示例）
```ts
{
  name: "archive.read",
  description: "读取指定 scope 的档案",
  run: (input, ctx) => { /* query Supabase */ }
}
{
  name: "archive.write",
  description: "写入或更新档案正文（带 metadata）",
  run: (input, ctx) => { /* insert/upsert */ }
}
{
  name: "archive.catalog.list",
  description: "按关键词/标签检索目录索引",
  run: (input, ctx) => { /* text search */ }
}
```

### 数据落地建议（Supabase）
- 表名：`agent_archives`
- 核心字段：`id, created_at, updated_at, user_id, project_id, book_id, type, content, tags, metadata`
- 允许 Agent 写入；客户端只读或完全禁止（视 RLS 策略）。

### 最小实现路径（建议）
1) 先实现 `archive.read` + `archive.write` 两个工具
2) 在 Plan 阶段提示：需要时调用档案库
3) 每次回答后如果生成了“新洞见”，在 Reflect 阶段写入档案

这样可以保持：**Agent 层有记忆，但与 App 数据层完全解耦**。

---

## 大规模档案库与“渐进式披露”策略

当 Agent 成长为“专家”时，档案量会持续膨胀。我们需要一种**像研究笔记目录一样的索引体系**，而不是纯语义向量检索。

### 核心思路：分层目录 + 逐级收敛
1) **目录层（Catalog）**  
   只保存“档案名录”，包括主题、时间、材料来源、摘要、关键词等结构化信息。  
2) **档案层（Archive）**  
   保存具体研究内容（可大块内容），通过目录索引定位。  
3) **快照层（Snapshot）**  
   对高频主题做“快速摘要”，减少反复读取成本。

这样 Agent 不需要在巨量档案里“全文搜索”，只需要：
**先取目录 → 再选档案 → 再读取具体内容**。

### 渐进式披露流程（非向量）
1) **目录检索（结构过滤）**  
   用 `user_id / project_id / book_id / type / tag / time_range` 过滤到几十条以内  
2) **目录排序（轻量评分）**  
   根据“最近更新时间 / 相关标签匹配 / 事件类型”做排序  
3) **细节检索**  
   只拉取 Top-N 档案正文，避免全量加载  

### 目录索引结构（建议字段）
- `id, user_id, project_id, book_id`
- `archive_type`（profile / reading / insight / glossary / timeline）
- `title`
- `summary`
- `tags[]`
- `updated_at`
- `importance_score`（0-1）
- `source`（agent/tool/app）

### 减轻 Agent 负担的策略
1) **目录维护交给 App**
   - App 负责写入目录索引（如标题、tag、时间）
   - Agent 只写核心正文，减少额外总结负担
2) **归档策略由 App 驱动**
   - App 触发归档（如阅读完成、项目阶段结束）
3) **分页/加载策略由 App 控制**
   - App 在 UI 层控制“逐页加载”，避免一次给 Agent 太多上下文

### Tool Registry 拆分（建议）
- `archive.catalog.list` → 返回目录索引（轻量）
- `archive.catalog.upsert` → 目录维护（由 App 触发）
- `archive.read` → 读取档案正文（Agent 使用）
- `archive.write` → 写入档案正文（Agent 使用）

### 结论
- **大档案库不靠语义向量，而靠“目录索引 + 渐进式披露”**
- **Agent 只做核心写作与理解，目录与归档由 App 逻辑承担**
- 保持 Agent “轻量”但具备强可扩展性

---

## 单 Agent（全知全能）设计建议

你希望系统只有一个主 Agent，不引入多子代理（sub agents）。这是可行且清晰的设计方向，关键是**通过角色分离与工具分层来保持能力扩展**：

### 设计原则
1) **单 Agent，多模式**  
   Agent 内部支持“计划/执行/反思”多阶段，但仍是同一个 Agent 实体。
2) **能力扩展靠工具，不靠子代理**  
   所有能力都以 Tool Registry 形式暴露，单 Agent 选择调用即可。
3) **档案系统是 Agent 的记忆仓库**  
   Agent 读写档案（研究项目/日志/目录），但目录维护由 App 驱动。

### 推荐结构
- **Graph**：Plan → Act → Reflect（仍然单 Agent）
- **Tools**：
  - 读档案（archive.read）
  - 写档案（archive.write）
  - 追加日志（archive.append_entry）
  - 查目录（archive.catalog.list）
- **App 逻辑**：
  - 管理目录索引
  - 触发归档事件
  - 控制上下文注入（避免 Agent 过载）

### 为什么单 Agent 足够
- 项目规模成长时，“复杂性”主要来自数据与任务，而不是代理数量。
- 单 Agent + Tool Registry 更易维护、追踪与审计（结合 AI Traffic Hub）。
- 避免了多 Agent 协作时的状态同步与一致性问题。

### 最小实现路径（单 Agent）
1) 在 Reflect 阶段写入研究日志（archive.append_entry）
2) 在关键节点写入或更新研究项目（archive.write）
3) App 层负责目录更新与整理（archive.catalog）
