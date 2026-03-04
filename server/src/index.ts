import 'dotenv/config';
import * as Sentry from '@sentry/node';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { recommendationsRouter } from './routes/recommendations.js';
import { stocksRouter } from './routes/stocks.js';
import { closeAgents } from './agents/registry.js';

// Sentry — only initializes when SENTRY_DSN is set
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
  });
}

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(compression());
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST'],
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/stocks', stocksRouter);

// Sentry error handler — must be after routes
Sentry.setupExpressErrorHandler(app);

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
