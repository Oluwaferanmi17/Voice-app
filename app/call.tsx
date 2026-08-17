import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    BackHandler,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useCallAudio } from '../hooks/useCallAudio';
import { emitToServer, on } from '../lib/socket-client';
import { theme } from '../lib/theme';

type CallStatus = 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'busy' | 'timeout';

interface SentMessage {
  id: string;
  content: string;
  status: 'sending' | 'delivered' | 'failed';
}

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode: 'outgoing' | 'incoming';
    callId?: string;
    otherUserId: string;
    otherUserName: string;
    otherUserPhoto?: string;
  }>();

  const [callId, setCallId] = useState(params.callId || null);
  const [status, setStatus] = useState<CallStatus>(
    params.mode === 'incoming' ? 'ringing' : 'calling'
  );
  const [duration, setDuration] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isPlaying } = useCallAudio();

  useEffect(() => {
    if (status === 'calling' || status === 'ringing') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [status]);

  useEffect(() => {
    if (params.mode === 'outgoing') {
      emitToServer('call:start', { calleeId: params.otherUserId });
    }
  }, []);

  useEffect(() => {
    const offs = [
      on('call:ringing', (data: { callId: string }) => {
        setCallId(data.callId);
        setStatus('ringing');
      }),
      on('call:connected', (data: { callId: string }) => {
        if (!callId || data.callId === callId) {
          setCallId(data.callId);
          setStatus('connected');
          durationInterval.current = setInterval(() => setDuration((d) => d + 1), 1000);
        }
      }),
      on('call:rejected', () => setStatus('rejected')),
      on('call:busy', () => setStatus('busy')),
      on('call:timeout', () => setStatus('timeout')),
      on('call:ended', () => setStatus('ended')),
      on('call:error', (data: { message: string }) => {
        console.warn('[call] error:', data.message);
        setStatus('ended');
      }),
      on('message:ack', (data: { clientMessageId: string; messageId: string }) => {
        setSentMessages((msgs) =>
          msgs.map((m) => (m.id === data.clientMessageId ? { ...m, id: data.messageId } : m))
        );
      }),
      on('message:status', (data: { messageId: string; status: 'DELIVERED' | 'FAILED' }) => {
        setSentMessages((msgs) =>
          msgs.map((m) =>
            m.id === data.messageId
              ? { ...m, status: data.status === 'DELIVERED' ? 'delivered' : 'failed' }
              : m
          )
        );
      }),
      on('message:typing', (data: { isTyping: boolean }) => setOtherTyping(data.isTyping)),
    ];
    return () => offs.forEach((off) => off());
  }, [callId]);

  useEffect(() => {
    if (['ended', 'rejected', 'busy', 'timeout'].includes(status)) {
      if (durationInterval.current) clearInterval(durationInterval.current);
      const t = setTimeout(() => router.back(), 1600);
      return () => clearTimeout(t);
    }
  }, [status]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (status === 'connected') {
        handleEnd();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [status, callId]);

  const handleAccept = () => {
    if (callId) emitToServer('call:accept', { callId });
  };

  const handleReject = () => {
    if (callId) emitToServer('call:reject', { callId });
    router.back();
  };

  const handleEnd = () => {
    if (callId) emitToServer(status === 'calling' ? 'call:cancel' : 'call:end', { callId });
    setStatus('ended');
  };

  const handleSendMessage = () => {
    const trimmed = messageText.trim();
    if (!trimmed || !callId) return;

    const clientMessageId = `local-${Date.now()}`;
    setSentMessages((msgs) => [...msgs, { id: clientMessageId, content: trimmed, status: 'sending' }]);
    emitToServer('message:send', { callId, content: trimmed, clientMessageId });
    setMessageText('');
    emitToServer('message:typing:stop', { callId });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
  };

  const handleTextChange = (text: string) => {
    setMessageText(text);
    if (!callId) return;
    emitToServer('message:typing:start', { callId });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      emitToServer('message:typing:stop', { callId });
    }, 2000);
  };

  const statusLabel: Record<CallStatus, string> = {
    calling: 'Calling...',
    ringing: params.mode === 'incoming' ? 'Incoming call' : 'Ringing...',
    connected: formatDuration(duration),
    ended: 'Call ended',
    rejected: 'Call declined',
    busy: 'User is busy',
    timeout: 'No answer',
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          {params.otherUserPhoto ? (
            <Image source={{ uri: params.otherUserPhoto }} style={styles.avatarSmall} />
          ) : (
            <View style={styles.avatarPlaceholderSmall}>
              <Text style={styles.avatarInitialSmall}>
                {params.otherUserName?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </Animated.View>

        <Text style={styles.name}>{params.otherUserName}</Text>
        <Text style={styles.status}>{statusLabel[status]}</Text>
      </View>

      {status === 'connected' ? (
        <KeyboardAvoidingView
          style={styles.messagingArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {isPlaying ? (
            <View style={styles.speakingBadge}>
              <Text style={styles.speakingBadgeText}>Speaking...</Text>
            </View>
          ) : otherTyping ? (
            <View style={styles.speakingBadge}>
              <Text style={styles.speakingBadgeText}>{params.otherUserName} is typing...</Text>
            </View>
          ) : null}

          <ScrollView style={styles.messageLog} contentContainerStyle={styles.messageLogContent}>
            {sentMessages.map((m) => (
              <View key={m.id} style={styles.sentBubble}>
                <Text style={styles.sentBubbleText}>{m.content}</Text>
                <Text style={styles.sentBubbleStatus}>
                  {m.status === 'sending' ? 'Sending...' : m.status === 'delivered' ? 'Spoken' : 'Failed'}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.messageInput}
              placeholder="Type to talk..."
              placeholderTextColor={theme.colors.textMuted}
              value={messageText}
              onChangeText={handleTextChange}
              onSubmitEditing={handleSendMessage}
              returnKeyType="send"
            />
            <Pressable style={styles.sendButton} onPress={handleSendMessage}>
              <Text style={styles.sendButtonText}>Send</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.controls}>
          {status === 'ringing' && params.mode === 'incoming' ? (
            <View style={styles.incomingRow}>
              <Pressable style={[styles.circleButton, styles.declineButton]} onPress={handleReject}>
                <Text style={styles.circleButtonText}>End</Text>
              </Pressable>
              <Pressable style={[styles.circleButton, styles.acceptButton]} onPress={handleAccept}>
                <Text style={styles.circleButtonText}>Accept</Text>
              </Pressable>
            </View>
          ) : status === 'calling' || status === 'ringing' ? (
            <Pressable style={[styles.circleButton, styles.declineButton, styles.singleButton]} onPress={handleEnd}>
              <Text style={styles.circleButtonText}>End</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {status === 'connected' ? (
        <Pressable style={styles.endBarButton} onPress={handleEnd}>
          <Text style={styles.endBarButtonText}>End Call</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing(10),
    paddingHorizontal: theme.spacing(6),
    paddingBottom: theme.spacing(6),
  },
  top: { alignItems: 'center' },
  avatarSmall: { width: 84, height: 84, borderRadius: 999 },
  avatarPlaceholderSmall: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialSmall: { color: theme.colors.textPrimary, fontSize: 30, fontWeight: '600' },
  name: {
    ...theme.font.display,
    fontSize: 22,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing(3),
  },
  status: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(4),
  },
  controls: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: theme.spacing(6),
  },
  circleButton: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleButton: { alignSelf: 'center' },
  acceptButton: { backgroundColor: theme.colors.accent },
  declineButton: { backgroundColor: theme.colors.error },
  circleButtonText: { color: theme.colors.background, fontSize: 13, fontWeight: '700' },

  messagingArea: { flex: 1 },
  speakingBadge: {
    alignSelf: 'center',
    backgroundColor: theme.colors.accentDim,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(4),
    marginBottom: theme.spacing(3),
  },
  speakingBadgeText: { color: theme.colors.textPrimary, fontSize: 12, fontWeight: '500' },
  messageLog: { flex: 1 },
  messageLogContent: { paddingBottom: theme.spacing(2) },
  sentBubble: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
    marginBottom: theme.spacing(2),
    maxWidth: '80%',
  },
  sentBubbleText: { color: theme.colors.background, fontSize: 14 },
  sentBubbleStatus: { color: theme.colors.background, fontSize: 10, opacity: 0.7, marginTop: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing(2) },
  messageInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(4),
    color: theme.colors.textPrimary,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(4),
    marginLeft: theme.spacing(2),
  },
  sendButtonText: { color: theme.colors.background, fontSize: 14, fontWeight: '600' },

  endBarButton: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(3),
    alignItems: 'center',
    marginTop: theme.spacing(3),
  },
  endBarButtonText: { color: theme.colors.background, fontSize: 15, fontWeight: '600' },
});