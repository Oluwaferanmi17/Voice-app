import * as SecureStore from 'expo-secure-store';
import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { theme } from '../../lib/theme';

const USER_SERVICE_URL = process.env.EXPO_PUBLIC_USER_SERVICE_URL || 'http://localhost:4002';
const FRIENDS_SERVICE_URL = process.env.EXPO_PUBLIC_FRIENDS_SERVICE_URL || 'http://localhost:4003';

interface SearchResult {
  id: string;
  displayName: string;
  phoneNumber: string;
  profilePicUrl: string | null;
  isOnline: boolean;
}

type RequestState = 'idle' | 'sending' | 'sent' | 'error';

async function authedFetch(url: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync('sv_access_token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestStates, setRequestStates] = useState<Record<string, RequestState>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await authedFetch(`${USER_SERVICE_URL}/users/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(res.ok ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 350);
  };

  const sendRequest = async (targetUserId: string) => {
    setRequestStates((s) => ({ ...s, [targetUserId]: 'sending' }));
    try {
      const res = await authedFetch(`${FRIENDS_SERVICE_URL}/friends/requests`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) throw new Error();
      setRequestStates((s) => ({ ...s, [targetUserId]: 'sent' }));
    } catch {
      setRequestStates((s) => ({ ...s, [targetUserId]: 'error' }));
    }
  };

  const renderItem = ({ item }: { item: SearchResult }) => {
    const state = requestStates[item.id] || 'idle';
    return (
      <View style={styles.row}>
        {item.profilePicUrl ? (
          <Image source={{ uri: item.profilePicUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>
              {item.displayName?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={styles.name}>{item.displayName || item.phoneNumber}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, item.isOnline && styles.dotOnline]} />
            <Text style={styles.statusText}>{item.isOnline ? 'Online' : 'Offline'}</Text>
          </View>
        </View>

        <Pressable
          style={[
            styles.addButton,
            state === 'sent' && styles.addButtonSent,
            state === 'error' && styles.addButtonError,
          ]}
          onPress={() => sendRequest(item.id)}
          disabled={state === 'sending' || state === 'sent'}
        >
          {state === 'sending' ? (
            <ActivityIndicator size="small" color={theme.colors.background} />
          ) : (
            <Text style={styles.addButtonText}>
              {state === 'sent' ? 'Sent' : state === 'error' ? 'Retry' : 'Add'}
            </Text>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search by name or number"
        placeholderTextColor={theme.colors.textMuted}
        value={query}
        onChangeText={handleChange}
        autoFocus
      />

      {loading && results.length === 0 ? (
        <ActivityIndicator style={styles.loader} color={theme.colors.accent} />
      ) : null}

      {!loading && query.trim().length >= 2 && results.length === 0 ? (
        <Text style={styles.empty}>No one found. Check the spelling and try again.</Text>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing(5),
    paddingTop: theme.spacing(6),
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(4),
    color: theme.colors.textPrimary,
    fontSize: 16,
    marginBottom: theme.spacing(4),
  },
  loader: { marginTop: theme.spacing(6) },
  empty: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: theme.spacing(6),
  },
  list: { paddingBottom: theme.spacing(8) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 999 },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: theme.colors.textPrimary, fontWeight: '600', fontSize: 16 },
  rowText: { flex: 1, marginLeft: theme.spacing(3) },
  name: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: '500' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.textMuted,
    marginRight: 5,
  },
  dotOnline: { backgroundColor: theme.colors.accent },
  statusText: { color: theme.colors.textMuted, fontSize: 12 },
  addButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
    minWidth: 64,
    alignItems: 'center',
  },
  addButtonSent: { backgroundColor: theme.colors.surfaceRaised },
  addButtonError: { backgroundColor: theme.colors.error },
  addButtonText: { color: theme.colors.background, fontSize: 13, fontWeight: '600' },
});
