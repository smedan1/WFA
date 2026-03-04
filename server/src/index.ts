import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { createApp } from './app.js';
import { closeAgents } from './agents/registry.js';

// Sentry — only initializes when SENTRY_DSN is set
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
  });
}

const PORT = Number(process.env.PORT ?? 3001);
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`WFA Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down...');
  server.close();
  await closeAgents();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
