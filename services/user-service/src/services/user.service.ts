import { prisma } from '@silent-voice/db';
import { cloudinary } from '../lib/cloudinary';

export const userService = {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phoneNumber: true,
        displayName: true,
        bio: true,
        statusMessage: true,
        profilePicUrl: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new Error('User not found');
    return user;
  },

  async updateProfile(
    userId: string,
    data: { displayName?: string; bio?: string; statusMessage?: string }
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  },

  async updateProfilePicture(userId: string, fileBuffer: Buffer) {
    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'silent-voice/profile-pictures', resource_type: 'image' },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result as { secure_url: string });
        }
      );
      stream.end(fileBuffer);
    });

    return prisma.user.update({
      where: { id: userId },
      data: { profilePicUrl: uploadResult.secure_url },
    });
  },

  async searchUsers(query: string, excludeUserId: string) {
    return prisma.user.findMany({
      where: {
        AND: [
          { id: { not: excludeUserId } },
          {
            OR: [
              { phoneNumber: { contains: query } },
              { displayName: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        displayName: true,
        phoneNumber: true,
        profilePicUrl: true,
        isOnline: true,
      },
      take: 20,
    });
  },

  async deleteAccount(userId: string) {
    // Cascade deletes handle sessions, tokens, friend requests, friendships
    await prisma.user.delete({ where: { id: userId } });
  },
};