# Margin App 层数据架构（重构方案 v2）

本文档为 **App 层数据模块的全新架构设计**。  
本方案不要求兼容现有模型，面向“重新设计更优解”的目标，适配阅读呈现与语言学习的统一数据底座。

---

## 1. 设计目标

1. **阅读与语言同源**  
阅读呈现与词元统计共享同一底层事实数据。
2. **Occurrence 为核心事实**  
每一次词元出现是系统的最小事实单元，所有统计与交互都可回溯。
3. **格式与结构可扩展**  
保留书名/作者/目录/章节等结构，支持段落、引用、诗节、列表等样式。
4. **可工程化落地**  
数据结构可直接落地到内存/缓存/持久化，不绑定具体存储实现。

---

## 2. 总体分层（四域模型）

```
Content Domain   : 文档结构与排版（Document/Section/Block/Span/Token）
Fact Domain      : Occurrence（词元出现事实）
Lexicon Domain   : Lemma 统计（LexemeStat）
Interaction Domain: 用户行为事件（Interaction）
```

这一分层让“结构呈现”与“事实统计”分离，但保持可追溯关系。

---

## 3. Content Domain（文档结构）

### 3.1 Document / Section

```ts
type DocumentType = "book" | "article";

type Document = {
  id: string;
  type: DocumentType;
  title: string;
  author?: string;
  language?: string;
  metadata?: Record<string, string>;
  toc: TocEntry[];
  sections: Section[];
};

type Section = {
  id: string;
  title: string;
  order: number;
  blocks: Block[];
};

type TocEntry = {
  id: string;
  title: string;
  level: number;
  sectionId?: string;
};
```

**说明**  
- `Document` 保留书名/作者/语言/目录等作品级元数据。  
- `Section` 是章节/片段的统一抽象，可用于学术专著与文章目录结构。  

---

### 3.2 Block / Span / Token

```ts
type BlockType = "paragraph" | "heading" | "quote" | "poetry" | "list";

type Block = {
  id: string;
  type: BlockType;
  level?: number; // heading/list 层级
  align?: "left" | "center" | "right" | "justify";
  spans: Span[];
};

type Span = {
  id: string;
  text: string;
  marks?: ("bold" | "italic" | "underline" | "quote")[];
  tokens: Token[];
};

type Token = {
  id: string;        // = occurrenceId
  surface: string;   // 原词形
  lemma: string;     // 词元
  position: number;  // span 内位置
};
```

**说明**  
- `Block` 是阅读呈现的最小结构容器。  
- `Span` 记录局部样式（粗体/斜体/引文等）。  
- `Token.id` 与 Occurrence.id 完全一致，保证可回溯。

---

## 4. Fact Domain（Occurrence）

```ts
type Occurrence = {
  id: string;
  lemma: string;
  surface: string;
  documentId: string;
  sectionId: string;
  blockId: string;
  spanId: string;
  tokenIndex: number; // span 内索引
};
```

Occurrence **不包含样式与解释**，仅是“词元出现事实”。  
格式通过 `blockId/spanId` 回溯到 Content Domain。

---

## 5. Lexicon Domain（词元库）

```ts
type LexemeStat = {
  lemma: string;
  totalOccurrences: number; // 交互次数
  implicitScore: number;
  explicitScore: number;
  masteryScore: number;
  firstEncounterAt: number;
  lastEncounterAt: number;
};

type LexemeIndex = {
  stats: Record<string, LexemeStat>;
};
```

**说明**  
- `LexemeStat` 仅由交互事件驱动，不直接扫描文本。  
- 文本出现次数可用 `OccurrenceIndex.byLemma[lemma].length` 计算。

---

## 6. Interaction Domain（交互事件）

```ts
type Interaction = {
  id: string;
  occurrenceId: string;
  lemma: string;
  type: "implicit" | "explicit";
  weight: number;
  timestamp: number;
};

type InteractionLog = {
  byOccurrence: Record<string, Interaction[]>;
  byLemma: Record<string, Interaction[]>;
};
```

交互事件用于驱动“学习进度”，不直接改变文本结构。

---

## 7. 索引结构（贯通阅读与语言）

```ts
type OccurrenceIndex = {
  byId: Record<string, Occurrence>;
  byLemma: Record<string, string[]>;      // lemma -> occurrenceId[]
  bySection: Record<string, string[]>;    // sectionId -> occurrenceId[]
  byBlock: Record<string, string[]>;      // blockId -> occurrenceId[]
  bySpan: Record<string, string[]>;       // spanId -> occurrenceId[]
};
```

**关键点**  
- `byBlock/bySpan` 让阅读呈现能快速定位词元出现。  
- `byLemma` 为 Terrain/词汇统计提供入口。

---

## 8. 数据流闭环

### 8.1 Ingest 阶段

1. 解析为 `Document/Section/Block/Span`  
2. Tokenize + Lemma 化  
3. 为每个 Token 创建 Occurrence  
4. 构建 OccurrenceIndex  
5. 初始化 LexemeIndex（lemma 首次出现）

### 8.2 阅读阶段

- 渲染 Block/Span/Token  
- Token 通过 `occurrenceId` 访问 Occurrence  
- 点击/停留触发 Interaction

### 8.3 学习阶段

- Interaction 驱动 LexemeStat 更新  
- Terrain/语言模块只消费 LexemeIndex  

---

## 9. 不变式（系统一致性）

1. **Token.id === Occurrence.id**  
2. **Occurrence 必须能回溯到 Block/Span**  
3. **LexemeStat 只能由 Interaction 驱动**  
4. **格式变化不影响 Occurrence**

---

## 10. 解析输出协议（初期）

建议 LLM/解析器输出：

```json
{
  "title": "string",
  "author": "string(optional)",
  "sections": [
    {
      "title": "Chapter 1",
      "blocks": [
        {
          "type": "paragraph",
          "spans": [
            { "text": "正文...", "marks": [] }
          ]
        }
      ]
    }
  ]
}
```

解析后由系统完成 Token/Lemma/Occurrence 生成。

---

## 11. 可选扩展（不破坏核心）

- PageMap（页码映射）  
- 更复杂的 BlockType（脚注、表格、图注）  
- 多语言 Tokenizer  

这些均不影响 Occurrence 事实层。

---

## 12. 结论

本方案重构 App 层数据模块为四域模型：  
**Content** 保留书籍结构与样式，**Occurrence** 作为事实核心，  
**Lexicon** 承担统计与学习进度，**Interaction** 驱动行为闭环。  

这一架构既可直接落地，也为后续高级能力提供稳定基础。
