import { prisma } from '@silent-voice/db';

// Canonical ordering so a friendship is always stored as one row,
// regardless of who sent the original request.
function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export const friendsService = {
  async sendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new Error('Cannot send a friend request to yourself');
    }

    const [userAId, userBId] = orderPair(senderId, receiverId);
    const alreadyFriends = await prisma.friend.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
    });
    if (alreadyFriends) throw new Error('Already friends');

    // Reuse/reactivate an existing declined/cancelled request instead of duplicating
    const existing = await prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId, receiverId } },
    });

    if (existing) {
      if (existing.status === 'PENDING') throw new Error('Request already pending');
      return prisma.friendRequest.update({
        where: { id: existing.id },
        data: { status: 'PENDING' },
      });
    }

    // Also check the reverse direction — if they already sent one, auto-accept instead
    const reverse = await prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId: receiverId, receiverId: senderId } },
    });
    if (reverse && reverse.status === 'PENDING') {
      return friendsService.acceptRequest(reverse.id, senderId);
    }

    return prisma.friendRequest.create({
      data: { senderId, receiverId, status: 'PENDING' },
    });
  },

  async acceptRequest(requestId: string, acceptingUserId: string) {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Request not found');
    if (request.receiverId !== acceptingUserId) throw new Error('Not authorized to accept this request');
    if (request.status !== 'PENDING') throw new Error('Request is not pending');

    const [userAId, userBId] = orderPair(request.senderId, request.receiverId);

    return prisma.$transaction([
      prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      }),
      prisma.friend.create({
        data: { userAId, userBId },
      }),
    ]);
  },

  async declineRequest(requestId: string, decliningUserId: string) {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Request not found');
    if (request.receiverId !== decliningUserId) throw new Error('Not authorized to decline this request');

    return prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'DECLINED' },
    });
  },

  async cancelRequest(requestId: string, cancellingUserId: string) {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Request not found');
    if (request.senderId !== cancellingUserId) throw new Error('Not authorized to cancel this request');

    return prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });
  },

  async removeFriend(userId: string, otherUserId: string) {
    const [userAId, userBId] = orderPair(userId, otherUserId);
    await prisma.friend.delete({
      where: { userAId_userBId: { userAId, userBId } },
    });
  },

  async listFriends(userId: string) {
    const friends = await prisma.friend.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: { id: true, displayName: true, profilePicUrl: true, isOnline: true, lastSeenAt: true } },
        userB: { select: { id: true, displayName: true, profilePicUrl: true, isOnline: true, lastSeenAt: true } },
      },
    });

    // Return the "other" user in each pair, not yourself
    return friends
      .map((f) => (f.userAId === userId ? f.userB : f.userA))
      .sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });
  },

  async listPendingRequests(userId: string) {
    const [received, sent] = await Promise.all([
      prisma.friendRequest.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        include: { sender: { select: { id: true, displayName: true, profilePicUrl: true } } },
      }),
      prisma.friendRequest.findMany({
        where: { senderId: userId, status: 'PENDING' },
        include: { receiver: { select: { id: true, displayName: true, profilePicUrl: true } } },
      }),
    ]);
    return { received, sent };
  },
};