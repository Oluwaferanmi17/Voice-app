interface QueuedSpeech {
  messageId: string;
  callId: string;
  recipientId: string;
  text: string;
  voiceId: string;
  speed: number;
}

const callQueues = new Map<string, QueuedSpeech[]>();
const activelyPlaying = new Set<string>();
const cancelledMessages = new Set<string>();

export const speechQueueService = {
  enqueue(item: QueuedSpeech) {
    const queue = callQueues.get(item.callId) || [];
    queue.push(item);
    callQueues.set(item.callId, queue);
  },

  dequeue(callId: string): QueuedSpeech | undefined {
    return callQueues.get(callId)?.shift();
  },

  hasQueued(callId: string): boolean {
    return (callQueues.get(callId)?.length ?? 0) > 0;
  },

  isPlaying(callId: string): boolean {
    return activelyPlaying.has(callId);
  },

  setPlaying(callId: string, playing: boolean) {
    if (playing) activelyPlaying.add(callId);
    else activelyPlaying.delete(callId);
  },

  cancelMessage(messageId: string) {
    cancelledMessages.add(messageId);
  },

  isCancelled(messageId: string): boolean {
    return cancelledMessages.has(messageId);
  },

  clearCallQueue(callId: string) {
    callQueues.delete(callId);
    activelyPlaying.delete(callId);
  },
};