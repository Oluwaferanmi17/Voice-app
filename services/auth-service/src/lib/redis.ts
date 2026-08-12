import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => console.error('[redis] connection error:', err));
redis.on('connect', () => console.log('[redis] connected'));