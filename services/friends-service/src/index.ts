import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { friendsRoutes } from './routes/friends.routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/friends', friendsRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4003;
app.listen(PORT, () => console.log(`[friends-service] listening on port ${PORT}`));