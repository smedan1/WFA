import * as Sentry from '@sentry/node';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { recommendationsRouter } from './routes/recommendations.js';
import { stocksRouter } from './routes/stocks.js';

export function createApp() {
  const app = express();

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  app.use(compression());
  app.use(cors({ origin: corsOrigins, methods: ['GET', 'POST'] }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.use('/api/recommendations', recommendationsRouter);
  app.use('/api/stocks', stocksRouter);

  Sentry.setupExpressErrorHandler(app);

  return app;
}
