import { prisma } from '@silent-voice/db';

export const messageService = {
  async createMessage(callId: string, senderId: string, content: string) {
    return prisma.message.create({
      data: { callId, senderId, content, status: 'SENDING' },
    });
  },

  async markDelivered(messageId: string) {
    return prisma.message.update({
      where: { id: messageId },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
  },

  async markFailed(messageId: string) {
    return prisma.message.update({
      where: { id: messageId },
      data: { status: 'FAILED' },
    });
  },

  async getMessagesForCall(callId: string) {
    return prisma.message.findMany({
      where: { callId },
      orderBy: { createdAt: 'asc' },
    });
  },

  // Validates that this user is actually a participant of this call,
  // and that the call is currently CONNECTED — messaging only works live
  async assertCanMessage(callId: string, userId: string) {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new Error('Call not found');
    if (call.status !== 'CONNECTED') throw new Error('Call is not active');
    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new Error('Not a participant of this call');
    }
    return call;
  },
};