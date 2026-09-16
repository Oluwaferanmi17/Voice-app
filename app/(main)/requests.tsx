import { useFocusEffect, useRouter } from 'expo-router';
// import * as SecureStore from 'expo-secure-store';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { authedFetch } from '../../lib/api-client';
import { theme } from '../../lib/theme';

const FRIENDS_SERVICE_URL = process.env.EXPO_PUBLIC_FRIENDS_SERVICE_URL || 'http://localhost:4003';

interface PendingRequest {
  id: string;
  sender: { id: string; displayName: string; profilePicUrl: string | null };
}

interface SentRequest {
  id: string;
  receiver: { id: string; displayName: string; profilePicUrl: string | null };
}

// async function authedFetch(url: string, options: RequestInit = {}) {
//   const token = await SecureStore.getItemAsync('sv_access_token');
//   return fetch(url, {
//     ...options,
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${token}`,
//       ...options.headers,
//     },
//   });
// }

type ActionState = 'idle' | 'working' | 'done';

export default function RequestsScreen() {
  const router = useRouter();
  const [received, setReceived] = useState<PendingRequest[]>([]);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch(`${FRIENDS_SERVICE_URL}/friends/requests`);
      const data = await res.json();
      setReceived(data.received || []);
      setSent(data.sent || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAccept = async (requestId: string) => {
    setActionStates((s) => ({ ...s, [requestId]: 'working' }));
    try {
      const res = await authedFetch(`${FRIENDS_SERVICE_URL}/friends/requests/${requestId}/accept`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error();
      setActionStates((s) => ({ ...s, [requestId]: 'done' }));
      setReceived((list) => list.filter((r) => r.id !== requestId));
    } catch {
      setActionStates((s) => ({ ...s, [requestId]: 'idle' }));
    }
  };

  const handleDecline = async (requestId: string) => {
    setActionStates((s) => ({ ...s, [requestId]: 'working' }));
    try {
      const res = await authedFetch(`${FRIENDS_SERVICE_URL}/friends/requests/${requestId}/decline`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error();
      setReceived((list) => list.filter((r) => r.id !== requestId));
    } catch {
      setActionStates((s) => ({ ...s, [requestId]: 'idle' }));
    }
  };

  const handleCancel = async (requestId: string) => {
    setActionStates((s) => ({ ...s, [requestId]: 'working' }));
    try {
      const res = await authedFetch(`${FRIENDS_SERVICE_URL}/friends/requests/${requestId}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error();
      setSent((list) => list.filter((r) => r.id !== requestId));
    } catch {
      setActionStates((s) => ({ ...s, [requestId]: 'idle' }));
    }
  };

  const renderReceived = ({ item }: { item: PendingRequest }) => {
    const state = actionStates[item.id] || 'idle';
    return (
      <View style={styles.row}>
        {item.sender.profilePicUrl ? (
          <Image source={{ uri: item.sender.profilePicUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {item.sender.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{item.sender.displayName || 'Unnamed'}</Text>

        {state === 'working' ? (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        ) : (
          <View style={styles.actionRow}>
            <Pressable style={styles.declineButton} onPress={() => handleDecline(item.id)}>
              <Text style={styles.declineButtonText}>Decline</Text>
            </Pressable>
            <Pressable style={styles.acceptButton} onPress={() => handleAccept(item.id)}>
              <Text style={styles.acceptButtonText}>Accept</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderSent = ({ item }: { item: SentRequest }) => {
    const state = actionStates[item.id] || 'idle';
    return (
      <View style={styles.row}>
        {item.receiver.profilePicUrl ? (
          <Image source={{ uri: item.receiver.profilePicUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {item.receiver.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{item.receiver.displayName || 'Unnamed'}</Text>

        {state === 'working' ? (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        ) : (
          <Pressable style={styles.cancelButton} onPress={() => handleCancel(item.id)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Friend Requests</Text>

      <Text style={styles.sectionLabel}>Received</Text>
      {received.length === 0 ? (
        <Text style={styles.emptyText}>No pending requests</Text>
      ) : (
        <FlatList
          data={received}
          keyExtractor={(item) => item.id}
          renderItem={renderReceived}
          scrollEnabled={false}
        />
      )}

      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Sent</Text>
      {sent.length === 0 ? (
        <Text style={styles.emptyText}>No sent requests waiting</Text>
      ) : (
        <FlatList
          data={sent}
          keyExtractor={(item) => item.id}
          renderItem={renderSent}
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing(5),
    paddingTop: theme.spacing(8),
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: { marginBottom: theme.spacing(4) },
  backButtonText: { color: theme.colors.accent, fontSize: 15, fontWeight: '500' },
  title: { ...theme.font.display, fontSize: 24, color: theme.colors.textPrimary, marginBottom: theme.spacing(6) },
  sectionLabel: {
    ...theme.font.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: theme.spacing(2),
  },
  sectionLabelSpaced: { marginTop: theme.spacing(6) },
  emptyText: { color: theme.colors.textMuted, fontSize: 13, marginBottom: theme.spacing(2) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatar: { width: 40, height: 40, borderRadius: 999 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: theme.colors.textPrimary, fontWeight: '600', fontSize: 15 },
  name: { flex: 1, marginLeft: theme.spacing(3), color: theme.colors.textPrimary, fontSize: 15, fontWeight: '500' },
  actionRow: { flexDirection: 'row' },
  acceptButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
    marginLeft: theme.spacing(2),
  },
  acceptButtonText: { color: theme.colors.background, fontSize: 12, fontWeight: '600' },
  declineButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
  },
  declineButtonText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
  },
  cancelButtonText: { color: theme.colors.error, fontSize: 12, fontWeight: '600' },
});