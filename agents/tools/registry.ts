import { ToolCall, ToolDefinition, ToolExecutionContext, ToolResult } from "./types";

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): this {
    if (!tool.name) {
      throw new Error("Tool name is required");
    }
    this.tools.set(tool.name, tool);
    return this;
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async execute(call: ToolCall, ctx: ToolExecutionContext): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        name: call.name,
        id: call.id,
        error: `Tool not found: ${call.name}`,
      };
    }
    try {
      const output = await tool.run(call.input, ctx);
      return {
        name: call.name,
        id: call.id,
        output,
      };
    } catch (error: any) {
      return {
        name: call.name,
        id: call.id,
        error: error?.message || "Tool execution failed",
      };
    }
  }
}

export const createToolRegistry = (tools?: ToolDefinition[]): ToolRegistry => {
  const registry = new ToolRegistry();
  tools?.forEach((tool) => registry.register(tool));
  return registry;
};
