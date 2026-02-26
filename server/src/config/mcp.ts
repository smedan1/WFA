export interface StdioMCPConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface UrlMCPConfig {
  type: 'url';
  url: string;
  authorizationToken?: string;
}

export type MCPConfig = StdioMCPConfig | UrlMCPConfig;

export const MCP_CONFIGS = {
  reddit: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@vinod827/mcp-server-reddit'],
    env: {
      REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID ?? '',
      REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET ?? '',
      REDDIT_USER_AGENT: process.env.REDDIT_USER_AGENT ?? 'WFA-App/1.0',
    },
  },
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
