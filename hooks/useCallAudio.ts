import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import { on } from '../lib/socket-client';

interface SpeechChunkData {
  messageId: string;
  audio: ArrayBuffer | number[];
}

const WAV_HEADER_SIZE = 44;

function concatWavChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];

  const dataParts = chunks.map((c) => c.slice(WAV_HEADER_SIZE));
  const totalDataLength = dataParts.reduce((sum, d) => sum + d.length, 0);

  const header = chunks[0].slice(0, WAV_HEADER_SIZE);
  const newHeader = new Uint8Array(header);
  const view = new DataView(newHeader.buffer);
  view.setUint32(4, 36 + totalDataLength, true);
  view.setUint32(40, totalDataLength, true);

  const result = new Uint8Array(WAV_HEADER_SIZE + totalDataLength);
  result.set(newHeader, 0);
  let offset = WAV_HEADER_SIZE;
  for (const part of dataParts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function useCallAudio() {
  const [currentUri, setCurrentUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const buffers = useRef<Map<string, Uint8Array[]>>(new Map());
  const playQueue = useRef<string[]>([]);
  const completedAudio = useRef<Map<string, Uint8Array[]>>(new Map());
  const busyRef = useRef(false); // guards against overlapping processQueue runs

  const player = useAudioPlayer(currentUri ? { uri: currentUri } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
  }, []);

  useEffect(() => {
    const offChunk = on('speech:chunk', (data: SpeechChunkData) => {
      const bytes = new Uint8Array(data.audio as ArrayBuffer);
      const existing = buffers.current.get(data.messageId) || [];
      existing.push(bytes);
      buffers.current.set(data.messageId, existing);
    });

    const offComplete = on('speech:complete', (data: { messageId: string }) => {
      const chunks = buffers.current.get(data.messageId);
      if (chunks) {
        completedAudio.current.set(data.messageId, chunks);
        buffers.current.delete(data.messageId);
        playQueue.current.push(data.messageId);
        processQueue();
      }
    });

    return () => {
      offChunk();
      offComplete();
    };
  }, []);

  // function declaration — hoisted, safe to reference above in effects
  async function processQueue() {
    if (busyRef.current || playQueue.current.length === 0) return;
    const messageId = playQueue.current.shift()!;
    const chunks = completedAudio.current.get(messageId);
    if (!chunks) return;

    busyRef.current = true;
    setIsPlaying(true);
    try {
      const stitched = concatWavChunks(chunks);
      const path = `${FileSystem.cacheDirectory}speech-${messageId}.wav`;
      const base64 = arrayBufferToBase64(stitched);
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
      setCurrentUri(path);
    } catch (err) {
      console.warn('[useCallAudio] playback failed:', err);
      busyRef.current = false;
      setIsPlaying(false);
      processQueue();
    } finally {
      completedAudio.current.delete(messageId);
    }
  }

  // Start playback once a new URI is loaded into the player
  useEffect(() => {
    if (currentUri && player) {
      player.play();
    }
  }, [currentUri]);

  // Detect when playback finishes, then move to the next queued item
  useEffect(() => {
  if (status?.didJustFinish) {
    queueMicrotask(() => {
      setIsPlaying(false);
      setCurrentUri(null);
      busyRef.current = false;
      processQueue();
    });
  }
}, [status?.didJustFinish]);

  return { isPlaying };
}