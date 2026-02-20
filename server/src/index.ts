import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { recommendationsRouter } from './routes/recommendations.js';
import { stocksRouter } from './routes/stocks.js';
import { closeAgents } from './agents/registry.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST'],
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/stocks', stocksRouter);

const server = app.listen(PORT, () => {
  console.log(`NMSA Server running on http://localhost:${PORT}`);
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
