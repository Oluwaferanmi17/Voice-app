import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import './lib/redis'; // establishes connection on boot
import { authRoutes } from './routes/auth.routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`[auth-service] listening on port ${PORT}`));