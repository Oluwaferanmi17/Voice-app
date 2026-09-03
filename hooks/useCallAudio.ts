import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { on } from '../lib/socket-client';

interface SpeechChunkData {
  messageId: string;
  audio: ArrayBuffer | number[];
}

// Standard canonical WAV header is 44 bytes (RIFF + fmt + data chunk header).
// Kokoro's soundfile writer produces this format, so we can safely parse
// and rebuild it when stitching multiple segments together.
const WAV_HEADER_SIZE = 44;

function concatWavChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];

  const dataParts = chunks.map((c) => c.slice(WAV_HEADER_SIZE));
  const totalDataLength = dataParts.reduce((sum, d) => sum + d.length, 0);

  // Copy the first chunk's header and patch the two size fields that
  // change when we extend the data — everything else (sample rate,
  // channels, bit depth) stays identical across segments from the same synth call.
  const header = chunks[0].slice(0, WAV_HEADER_SIZE);
  const newHeader = new Uint8Array(header);
  const view = new DataView(newHeader.buffer);
  view.setUint32(4, 36 + totalDataLength, true);  // RIFF chunk size
  view.setUint32(40, totalDataLength, true);       // data subchunk size

  const result = new Uint8Array(WAV_HEADER_SIZE + totalDataLength);
  result.set(newHeader, 0);
  let offset = WAV_HEADER_SIZE;
  for (const part of dataParts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function useCallAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const buffers = useRef<Map<string, Uint8Array[]>>(new Map());
  const playQueue = useRef<string[]>([]);
  const soundRef = useRef<Audio.Sound | null>(null);
  const completedAudio = useRef<Map<string, Uint8Array[]>>(new Map());

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

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
      soundRef.current?.unloadAsync();
    };
  }, []);

  const processQueue = async () => {
    if (isPlaying || playQueue.current.length === 0) return;
    const messageId = playQueue.current.shift()!;
    const chunks = completedAudio.current.get(messageId);
    if (!chunks) return;

    setIsPlaying(true);
    try {
      const stitched = concatWavChunks(chunks);
      const path = `${FileSystem.cacheDirectory}speech-${messageId}.wav`;
      const base64 = arrayBufferToBase64(stitched);
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });

      const { sound } = await Audio.Sound.createAsync({ uri: path });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          soundRef.current = null;
          setIsPlaying(false);
          processQueue();
        }
      });
      await sound.playAsync();
    } catch (err) {
      console.warn('[useCallAudio] playback failed:', err);
      setIsPlaying(false);
      processQueue();
    } finally {
      completedAudio.current.delete(messageId);
    }
  };

  return { isPlaying };
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}