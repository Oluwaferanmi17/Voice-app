import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import './lib/redis';
import { callRoutes } from './routes/call.routes';
import { messageRoutes } from './routes/message.routes';
import { voiceRoutes } from './routes/voice.routes';
import { presenceService } from './services/presence.service';
import { registerPresenceGateway } from './socket/presence.gateway';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/calls', callRoutes);
app.use('/calls', messageRoutes);
app.use('/voice', voiceRoutes);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }, // tighten this before production
});

registerPresenceGateway(io);

// Periodic Redis → Postgres sync
const SYNC_INTERVAL = Number(process.env.POSTGRES_SYNC_INTERVAL_MS) || 30000;
setInterval(() => {
  presenceService.syncToPostgres().catch((err) => console.error('[presence-sync] failed:', err));
}, SYNC_INTERVAL);

const PORT = process.env.PORT || 4004;
httpServer.listen(PORT, () => console.log(`[presence-service] listening on port ${PORT}`));