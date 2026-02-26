export interface StdioMCPConfig {
  type: 'stdio';
  command: string;
  args: readonly string[];
  env?: Record<string, string>;
}

export interface UrlMCPConfig {
  type: 'url';
  url: string;
  authorizationToken?: string;
}

export type MCPConfig = StdioMCPConfig | UrlMCPConfig;

export const MCP_CONFIGS = {
  github: {
    type: 'url' as const,
    url: 'https://api.githubcopilot.com/mcp/',
    authorizationToken: process.env.GITHUB_TOKEN,
  },
  yahooFinance: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', 'mcp-yahoo-finance'],
    env: {},
  },
  stockMarket: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', 'mcp-stock-market'],
    env: {},
  },
} as const;
