import { prisma } from '@silent-voice/db';
import { redis } from '../lib/redis';

const ONLINE_SET_KEY = 'presence:online';
const LAST_SEEN_PREFIX = 'presence:last_seen:';

export const presenceService = {
  async markOnline(userId: string) {
    await redis.sadd(ONLINE_SET_KEY, userId);
  },

  async markOffline(userId: string) {
    await redis.srem(ONLINE_SET_KEY, userId);
    await redis.set(`${LAST_SEEN_PREFIX}${userId}`, Date.now().toString());
  },

  async isOnline(userId: string): Promise<boolean> {
    const result = await redis.sismember(ONLINE_SET_KEY, userId);
    return result === 1;
  },

  async getOnlineUserIds(): Promise<string[]> {
    return redis.smembers(ONLINE_SET_KEY);
  },

  // Called on an interval to push Redis's live state into Postgres
  async syncToPostgres() {
    const onlineIds = await presenceService.getOnlineUserIds();

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { id: { in: onlineIds } },
        data: { isOnline: true },
      }),
      prisma.user.updateMany({
        where: { id: { notIn: onlineIds } },
        data: { isOnline: false },
      }),
    ]);
  },
};