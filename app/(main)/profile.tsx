import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../lib/theme';

const USER_SERVICE_URL = process.env.EXPO_PUBLIC_USER_SERVICE_URL || 'http://localhost:4002';
const FRIENDS_SERVICE_URL = process.env.EXPO_PUBLIC_FRIENDS_SERVICE_URL || 'http://localhost:4003';

interface UserProfile {
  id: string;
  displayName: string;
  bio: string | null;
  statusMessage: string | null;
  profilePicUrl: string | null;
  isOnline: boolean;
}

async function authedFetch(url: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync('sv_access_token');
  return fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    // Note: user-service doesn't currently expose a "get any user by id"
    // endpoint (only /users/me and /users/search) — using search as a
    // stand-in here. Worth adding a dedicated GET /users/:id route later.
    (async () => {
      try {
        const res = await authedFetch(`${USER_SERVICE_URL}/users/search?q=${userId}`);
        const data = await res.json();
        const match = Array.isArray(data) ? data.find((u: UserProfile) => u.id === userId) : null;
        setProfile(match || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const handleRemoveFriend = () => {
    Alert.alert('Remove friend?', 'You can always send a new request later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemoving(true);
          try {
            await authedFetch(`${FRIENDS_SERVICE_URL}/friends/${userId}`, { method: 'DELETE' });
            router.back();
          } finally {
            setRemoving(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't load this profile</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <View style={styles.header}>
        {profile.profilePicUrl ? (
          <Image source={{ uri: profile.profilePicUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{profile.displayName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}
        <Text style={styles.name}>{profile.displayName || 'Unnamed'}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, profile.isOnline && styles.dotOnline]} />
          <Text style={styles.statusText}>{profile.isOnline ? 'Online' : 'Offline'}</Text>
        </View>
        {profile.statusMessage ? <Text style={styles.statusMessage}>{profile.statusMessage}</Text> : null}
      </View>

      <Pressable
        style={styles.callButton}
        onPress={() =>
          router.push({
            pathname: '/call',
            params: {
              mode: 'outgoing',
              otherUserId: profile.id,
              otherUserName: profile.displayName,
              otherUserPhoto: profile.profilePicUrl || '',
            },
          })
        }
      >
        <Text style={styles.callButtonText}>Call</Text>
      </Pressable>

      <Pressable style={styles.removeButton} onPress={handleRemoveFriend} disabled={removing}>
        <Text style={styles.removeButtonText}>{removing ? 'Removing...' : 'Remove Friend'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing(6), paddingTop: theme.spacing(8) },
  centered: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: theme.spacing(6) },
  errorText: { color: theme.colors.textMuted, fontSize: 15, marginBottom: theme.spacing(4) },
  backLink: {},
  backLinkText: { color: theme.colors.accent, fontSize: 15, fontWeight: '500' },
  backButton: { marginBottom: theme.spacing(6) },
  backButtonText: { color: theme.colors.accent, fontSize: 15, fontWeight: '500' },
  header: { alignItems: 'center', marginBottom: theme.spacing(10) },
  avatar: { width: 100, height: 100, borderRadius: 999 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 999,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: theme.colors.textPrimary, fontSize: 36, fontWeight: '600' },
  name: { ...theme.font.display, fontSize: 24, color: theme.colors.textPrimary, marginTop: theme.spacing(4) },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing(2) },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: theme.colors.textMuted, marginRight: 5 },
  dotOnline: { backgroundColor: theme.colors.accent },
  statusText: { color: theme.colors.textMuted, fontSize: 13 },
  statusMessage: { color: theme.colors.textMuted, fontSize: 14, marginTop: theme.spacing(2), fontStyle: 'italic' },
  callButton: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(4), alignItems: 'center', marginBottom: theme.spacing(3),
  },
  callButtonText: { color: theme.colors.background, fontSize: 16, fontWeight: '600' },
  removeButton: {
    borderWidth: 1, borderColor: theme.colors.error, borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(4), alignItems: 'center',
  },
  removeButtonText: { color: theme.colors.error, fontSize: 15, fontWeight: '600' },
});