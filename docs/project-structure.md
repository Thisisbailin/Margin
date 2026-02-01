# Project Structure (Planned)

This file documents the target structure for a clean, low-coupling architecture. Existing files remain at the repo root for now; new work should follow the structure below.

```
/llm         LLM layer (providers, registry, streaming)
/agents      LangGraph graphs and agent orchestration
/tools       Agent tools (Supabase, fetch, memory, etc.)
/functions   Cloudflare Pages Functions (HTTP entrypoints)
/docs        Architecture and specs
```

Layer boundaries:
- App (UI) calls functions via HTTP.
- Functions invoke Agent layer.
- Agent layer depends on LLM layer only through interfaces.

Migration note:
- Current root-level UI files can be migrated into `/app` later if desired, but that is not required for the initial LLM/Agent buildout.

