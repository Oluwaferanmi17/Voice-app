import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useState } from 'react';
import {
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { theme } from '../../lib/theme';

const FRIENDS_SERVICE_URL = process.env.EXPO_PUBLIC_FRIENDS_SERVICE_URL || 'http://localhost:4003';

interface Friend {
  id: string;
  displayName: string;
  profilePicUrl: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
}

async function authedFetch(url: string) {
  const token = await SecureStore.getItemAsync('sv_access_token');
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Offline';
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ContactsScreen() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        authedFetch(`${FRIENDS_SERVICE_URL}/friends`),
        authedFetch(`${FRIENDS_SERVICE_URL}/friends/requests`),
      ]);
      const friendsData = friendsRes.ok ? await friendsRes.json() : [];
      const requestsData = requestsRes.ok ? await requestsRes.json() : { received: [] };
      setFriends(friendsData);
      setPendingCount(requestsData.received?.length || 0);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Friend }) => (
  <Pressable
    style={styles.row}
    onPress={() => router.push({ pathname: '/(main)/profile', params: { userId: item.id } })}
  >
    {item.profilePicUrl ? (
      <Image source={{ uri: item.profilePicUrl }} style={styles.avatar} />
    ) : (
      <View style={styles.avatarPlaceholder}>
        <Text style={styles.avatarInitial}>{item.displayName?.[0]?.toUpperCase() || '?'}</Text>
      </View>
    )}
    <View style={styles.rowText}>
      <Text style={styles.name}>{item.displayName || 'Unnamed'}</Text>
      <View style={styles.statusRow}>
        <View style={[styles.dot, item.isOnline && styles.dotOnline]} />
        <Text style={styles.statusText}>
          {item.isOnline ? 'Online' : formatLastSeen(item.lastSeenAt)}
        </Text>
      </View>
    </View>

    <Pressable
      style={styles.callButton}
      onPress={(e) => {
        e.stopPropagation(); // don't also trigger the row's onPress (navigate to profile)
        router.push({
          pathname: '/call',
          params: {
            mode: 'outgoing',
            otherUserId: item.id,
            otherUserName: item.displayName,
            otherUserPhoto: item.profilePicUrl || '',
          },
        });
      }}
    >
      <Text style={styles.callButtonText}>Call</Text>
    </Pressable>
  </Pressable>
);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
        <Pressable style={styles.searchButton} onPress={() => router.push('/(main)/search')}>
          <Text style={styles.searchButtonText}>+ Add</Text>
        </Pressable>
      </View>

      {pendingCount > 0 ? (
        <Pressable style={styles.pendingBanner} onPress={() => router.push('/(main)/requests')}>
          <Text style={styles.pendingText}>
            {pendingCount} pending friend {pendingCount === 1 ? 'request' : 'requests'}
          </Text>
        </Pressable>
      ) : null}
      {loaded && friends.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No one here yet</Text>
          <Text style={styles.emptySubtitle}>Add someone to start a silent conversation.</Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
          }
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(4),
  },
  title: { ...theme.font.display, fontSize: 26, color: theme.colors.textPrimary },
  searchButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
  },
  searchButtonText: { color: theme.colors.accent, fontSize: 14, fontWeight: '600' },
  pendingBanner: {
    backgroundColor: theme.colors.accentDim,
    borderRadius: theme.radius.md,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(4),
  },
  pendingText: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '500' },
  list: { paddingBottom: theme.spacing(8) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatar: { width: 48, height: 48, borderRadius: 999 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: theme.colors.textPrimary, fontWeight: '600', fontSize: 17 },
  rowText: { flex: 1, marginLeft: theme.spacing(3) },
  name: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '500' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.textMuted,
    marginRight: 5,
  },
  dotOnline: { backgroundColor: theme.colors.accent },
  statusText: { color: theme.colors.textMuted, fontSize: 12 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: theme.spacing(2) },
  emptySubtitle: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: theme.spacing(8) },
});