import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { userRoutes } from './routes/user.routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/users', userRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`[user-service] listening on port ${PORT}`));