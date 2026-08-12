import { prisma } from '@silent-voice/db';
import WebSocket from 'ws';
import { getUserSocket } from '../socket/socket-registry';
import { speechQueueService } from './speech-queue.service';

const AI_SPEECH_SERVICE_URL = process.env.AI_SPEECH_SERVICE_URL || 'ws://localhost:5001/synthesize';

export const speechService = {
  async getVoicePreference(userId: string) {
    const pref = await prisma.voicePreference.findUnique({ where: { userId } });
    return pref || { voiceId: 'af_heart', speed: 1.0, language: 'en-US' };
  },

  async setVoicePreference(userId: string, data: { voiceId?: string; speed?: number; language?: string }) {
    return prisma.voicePreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  },

  // Called when a message arrives during an active call — queues it,
  // and kicks off playback processing if nothing's currently playing
  async handleIncomingMessage(params: {
    messageId: string;
    callId: string;
    senderId: string;
    recipientId: string;
    text: string;
  }) {
    const voicePref = await speechService.getVoicePreference(params.senderId);

    speechQueueService.enqueue({
      messageId: params.messageId,
      callId: params.callId,
      recipientId: params.recipientId,
      text: params.text,
      voiceId: voicePref.voiceId,
      speed: voicePref.speed,
    });

    if (!speechQueueService.isPlaying(params.callId)) {
      speechService.processNextInQueue(params.callId);
    }
  },

  async processNextInQueue(callId: string) {
    const next = speechQueueService.dequeue(callId);
    if (!next) return; // queue empty, nothing to do

    if (speechQueueService.isCancelled(next.messageId)) {
      // Skip cancelled messages entirely, move to the next one
      speechService.processNextInQueue(callId);
      return;
    }

    speechQueueService.setPlaying(callId, true);

    const recipientSocket = getUserSocket(next.recipientId);
    if (!recipientSocket) {
      // Recipient disconnected mid-call — drop this item, move on
      speechQueueService.setPlaying(callId, false);
      speechService.processNextInQueue(callId);
      return;
    }

    try {
      await speechService.streamToRecipient(next, recipientSocket);
    } catch (err) {
      console.error('[speech] synthesis/stream failed:', err);
      recipientSocket.emit('speech:error', { messageId: next.messageId });
    } finally {
      speechQueueService.setPlaying(callId, false);
      // Process the next queued item, if any
      speechService.processNextInQueue(callId);
    }
  },

  streamToRecipient(item: ReturnType<typeof speechQueueService.dequeue> & {}, recipientSocket: any) {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(AI_SPEECH_SERVICE_URL);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          text: item!.text,
          voiceId: item!.voiceId,
          speed: item!.speed,
          messageId: item!.messageId,
        }));
      });

      ws.on('message', (data, isBinary) => {
        if (speechQueueService.isCancelled(item!.messageId)) {
          ws.close();
          return resolve(); // cancelled mid-stream — stop relaying further chunks
        }

        if (isBinary) {
          // Relay the raw audio chunk straight to the recipient's socket
          recipientSocket.emit('speech:chunk', {
            messageId: item!.messageId,
            audio: data, // Socket.IO handles Buffer/binary payloads natively
          });
        } else {
          const marker = JSON.parse(data.toString());
          if (marker.type === 'complete') {
            recipientSocket.emit('speech:complete', { messageId: item!.messageId });
            ws.close();
            resolve();
          }
        }
      });

      ws.on('error', (err) => reject(err));
    });
  },
};