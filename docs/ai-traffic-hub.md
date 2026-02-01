# AI 流量中枢（Token 用量全链路追踪）设计方案

> 目标：确保项目内所有 AI 调用（任何模型、任何路径、任何 Agent/Tool）**100% 可追踪、可审计、可回放**。该模块属于 **LLM 层（能力接入）**，而不是 Agent 层（能力释放）。

---

## 1. 当前项目 AI 能力调用清单（Margin）

### 1.1 直接 LLM 调用路径（App → LLM）
- `services/llmService.ts`
  - `streamAnnotation()` → `streamLLM()` → `POST /api/llm/stream`
  - `streamProjectChat()` → `streamLLM()` → `POST /api/llm/stream`
  - `generateWordDefinition()` → `generateLLM()` → `POST /api/llm/generate`
- `services/articleService.ts`
  - `ingestArticleContent()` → `generateLLM()` → `POST /api/llm/generate`

### 1.2 Agent 入口路径（Agent → LLM）
- `functions/api/agent/generate.ts` → `agents/runAgent()` → LLM generate
- `functions/api/agent/stream.ts` → `agents/streamAgent()` → LLM stream

### 1.3 LLM 服务端入口（云端）
- `functions/api/llm/generate.ts`（非流式）
- `functions/api/llm/stream.ts`（流式 SSE）
- `functions/api/llm/models.ts`（模型列表）

### 1.4 非 LLM AI 能力（本地）
- `services/ttsService.ts` 使用浏览器 `SpeechSynthesis`（无 token 消耗）

> 结论：**所有 token 消耗的 LLM 请求都已集中在 `/api/llm/*` 与 `/api/agent/*`**，非常适合在 LLM 层做全链路追踪。

---

## 2. Script2Video_副本 的参考实现（优点 / 不足）

### 2.1 有价值的部分
- `types.ts` 定义 `TokenUsage` 统一结构（prompt/response/total）
- `components/Dashboard.tsx` 展示 token 统计概览
- `node-workspace/components/QalamAgent.tsx` 汇总 token 总量并在 UI 显示
- `services/*` 中每个 AI 调用返回 usage，业务侧用 `addUsage()` 叠加统计

### 2.2 不足（也是我们要解决的）
- **usage 统计分散在业务逻辑**（每个功能点手工累加）
- **无法保证覆盖率**（新增 AI 调用容易漏统计）
- **无法统一审计**（没有统一入口日志/流水号）
- **流式调用 usage 丢失风险**（依赖业务层收尾）
- **缺少统一的请求元数据**（用户、场景、任务、模型、节点、成本等）

> 结论：Script2Video_副本 的 Dashboard 是“展示层”，但不是“流量中枢”。我们需要在 **LLM 层建立强制入口** 才能做到 100% 覆盖。

---

## 3. AI 流量中枢的定位与原则

### 3.1 位置
- **必须属于 LLM 层**（能力接入）
- 任何调用 LLM 的行为，都必须通过 **LLM Gateway / Traffic Hub**
- Agent 层只能调用 LLM 层接口，**不能直连 provider**

### 3.2 目标
- **100% 覆盖**：无漏记
- **全链路可追溯**：请求、响应、usage、错误、耗时、调用方
- **可审计**：可按用户、项目、功能、模型追踪
- **可扩展**：支持更多 provider、多模型、多 agent

---

## 4. AI 流量中枢的核心结构（建议设计）

### 4.1 关键模块
1) **LLM Gateway（统一入口）**
   - 包装 `createLLMClient()`，对 `generate()` / `stream()` 做拦截
   - 记录每次调用（请求 + usage + 结果）

2) **Usage Recorder（写入层）**
   - 生产环境写入 Supabase
   - 开发环境可使用本地内存/console

3) **Trace ID / Correlation ID**
   - 每次请求生成 `ai_request_id`
   - 贯穿：App → Agent → LLM → Provider

4) **Usage Aggregator**
   - 流式调用：逐 chunk 收集，并在 DONE 时落账
   - 如果 usage 缺失，进行估算或标记为 `unknown`

---

## 5. 数据模型（建议 Schema）

### 5.1 `ai_requests`
| 字段 | 说明 |
|---|---|
| id | 全局请求 ID |
| created_at | 时间戳 |
| user_id | Clerk user id |
| project_id | 当前项目 |
| source | 调用来源（app/agent/tool） |
| feature | 业务场景（annotation/lexicon/project/article） |
| provider | qwen/openai/... |
| model | 模型 ID |
| stream | 是否流式 |
| status | success/error |
| latency_ms | 总耗时 |
| prompt_hash | prompt 摘要（避免保存原文） |
| error | 错误信息（如有） |

### 5.2 `ai_usage`
| 字段 | 说明 |
|---|---|
| request_id | 关联 ai_requests.id |
| prompt_tokens | prompt tokens |
| response_tokens | completion tokens |
| total_tokens | 总 tokens |
| provider_cost | 可选：折算成本 |
| estimated | 是否估算 |

### 5.3 `ai_events`（可选）
记录流式中的中间事件（调试用，可采样）

---

## 6. 如何保证“任何 AI 调用都被追踪”

### 6.1 强制入口策略
- **仅暴露 LLM Gateway 接口**
- 业务层和 Agent 层只允许调用 `llm/gateway`
- 禁止直接调用 provider SDK

### 6.2 代码层面保障
- 在 `llm/runtime/createClient.ts` 内部统一注入 `TrafficHub` 包装
- 直接改造 `createLLMClient()`，使其永远走监控

### 6.3 运行时保障
- 在 Functions 中注入 `request metadata`
  - `user_id` / `project_id` / `feature`
- 返回 `ai_request_id`，供 UI 或日志关联

---

## 7. 流式调用的 token 统计策略

### 7.1 理想情况
- Provider 在最终 chunk 提供 usage
- LLM Hub 记录 DONE 时 usage

### 7.2 退化方案
- 没有 usage 时：
  - 标记 `estimated = true`
  - 通过 token 估算器（如 tiktoken）估算
- 或直接记录 `usage_unknown` 但仍保留请求日志

---

## 8. 与现有系统的对接方案（最小改造）

### 8.1 改造位置
- `llm/runtime/createClient.ts` → 注入 `TrafficHubClient`
- `functions/api/llm/*` → 传入上下文 metadata（user_id, feature）
- `functions/api/agent/*` → 同上

### 8.2 UI 侧
- 仿照 Script2Video_副本 `Dashboard.tsx`
- 新增 AI 使用量面板（按 feature / model / provider）
- 提供“调用明细列表”

---

## 9. 建议的实现阶段

### Phase 1（最小可用）
- LLM Gateway 记录 `ai_requests` + `ai_usage`
- 只做 Qwen provider

### Phase 2（面板化）
- 增加 UI Dashboard 显示 token 使用
- 按 feature / project / user 统计

### Phase 3（完整审计）
- 增加调用明细追溯
- 支持流式事件抽样
- 支持成本估算

---

## 10. 对 Margin 的落地建议

- **Traffic Hub 必须属于 LLM 层**
- 先做最小日志 + usage 采集（Supabase）
- 后续 Agent 系统越复杂，越依赖这个“唯一入口”

---

## 结论

- 目前 Margin 已经完成 LLM 调用集中化，这是实施 AI 流量中枢的最佳时机。
- Script2Video_副本 的 Dashboard 证明了可视化价值，但其统计方式不够稳定和可审计。
- 正确的方向是：**在 LLM 层构建强制入口 + 统一日志 + 使用量记录**，把所有 token 消耗收束到一个中心化系统中。

> 下一步如果你允许，我可以直接为 Margin 增加 `llm/traffic` 模块与 Supabase 日志表，并把现有 LLM 调用全部接入该中枢。  

## 11. 当前实现状态（已开始构建）

已落地的最小实现：
- `llm/traffic/recorder.ts`：统一记录入口（支持 console / Supabase）
- `llm/runtime/createClient.ts`：自动注入流量中枢包装
- `/api/llm/*` 与 `/api/agent/*`：已注入 `traffic` 配置
- App 侧 LLM 调用：通过 metadata 标记 feature/source
- 读取接口：`/api/traffic/list`、`/api/traffic/summary`

当前记录表默认：`ai_requests`

建表示例（Supabase）：`docs/ai-traffic-hub-schema.sql`

建议配置环境变量：
- `AI_TRAFFIC_ENABLED=true`
- `AI_TRAFFIC_SINK=supabase`（无 Supabase 时可改为 `console`）
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `AI_TRAFFIC_TABLE=ai_requests`

读取接口说明（服务端）：
- `GET /api/traffic/list?limit=50&user_id=...&project_id=...&feature=...`
- `GET /api/traffic/summary?limit=500&from=2025-01-01&to=2025-01-31`
