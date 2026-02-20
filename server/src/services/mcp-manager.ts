import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  Tool as AnthropicTool,
  MessageParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages.js';
import type { StdioMCPConfig } from '../config/mcp.js';

export class MCPClient {
  private client: Client;
  private connected = false;

  constructor(private name: string) {
    this.client = new Client({ name, version: '1.0.0' }, {});
  }

  async connectStdio(config: StdioMCPConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
    });
    await this.client.connect(transport);
    this.connected = true;
    console.log(`[MCPClient:${this.name}] Connected via stdio`);
  }

  async listTools(): Promise<AnthropicTool[]> {
    if (!this.connected) throw new Error(`MCPClient ${this.name} not connected`);
    const { tools } = await this.client.listTools();
    return tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: t.inputSchema as AnthropicTool['input_schema'],
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.connected) throw new Error(`MCPClient ${this.name} not connected`);
    const result = await this.client.callTool({ name, arguments: args });
    if (Array.isArray(result.content)) {
      return result.content
        .map((c) => (typeof c === 'object' && 'text' in c ? String(c.text) : JSON.stringify(c)))
        .join('\n');
    }
    return JSON.stringify(result.content);
  }

  async close(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }
}

export interface AgentLoopOptions {
  model?: string;
  maxTokens?: number;
  maxIterations?: number;
}

/**
 * Runs a full agentic loop: Claude calls tools via MCP until it produces a final text response.
 */
export async function runAgentLoop(
  anthropic: Anthropic,
  systemPrompt: string,
  userMessage: string,
  tools: AnthropicTool[],
  toolExecutor: (name: string, input: Record<string, unknown>) => Promise<string>,
  options: AgentLoopOptions = {}
): Promise<string> {
  const {
    model = 'claude-opus-4-6',
    maxTokens = 8096,
    maxIterations = 10,
  } = options;

  const messages: MessageParam[] = [{ role: 'user', content: userMessage }];
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: tools.length > 0 ? tools : undefined,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text');
      return textBlock ? textBlock.text : '';
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const toolUseBlocks = response.content.filter(
        (b): b is ToolUseBlock => b.type === 'tool_use'
      );

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          try {
            const result = await toolExecutor(
              toolUse.name,
              toolUse.input as Record<string, unknown>
            );
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: result,
            };
          } catch (err) {
            return {
              type: 'tool_result' as const,
              tool_use_id: toolUse.id,
              content: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
              is_error: true,
            };
          }
        })
      );

      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // stop_reason: 'max_tokens' or other — return what we have
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock ? textBlock.text : '';
  }

  throw new Error(`Agent loop exceeded max iterations (${maxIterations})`);
}

/**
 * Runs an agent loop against a URL-based MCP server using Anthropic's native beta MCP support.
 */
export async function runAgentLoopWithUrlMCP(
  anthropic: Anthropic,
  systemPrompt: string,
  userMessage: string,
  mcpServers: Array<{ url: string; name: string; authorizationToken?: string }>,
  options: AgentLoopOptions = {}
): Promise<string> {
  const { model = 'claude-opus-4-6', maxTokens = 8096 } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (anthropic.beta.messages as any).create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    betas: ['mcp-client-2025-04-04'],
    mcp_servers: mcpServers.map((s) => ({
      type: 'url',
      url: s.url,
      name: s.name,
      ...(s.authorizationToken
        ? { authorization_token: s.authorizationToken }
        : {}),
    })),
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content?.find(
    (b: { type: string }) => b.type === 'text'
  );
  return textBlock ? textBlock.text : '';
}
