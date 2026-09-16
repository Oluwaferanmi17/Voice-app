import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { authApi } from '../../lib/api-client';
import { theme } from '../../lib/theme';

interface StoredUser {
  id: string;
  displayName: string;
  phoneNumber: string;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await SecureStore.getItemAsync('sv_user');
      if (raw) setUser(JSON.parse(raw));
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert('Log out?', 'You can log back in anytime with your phone number.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          const refreshToken = await SecureStore.getItemAsync('sv_refresh_token');
          if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
          await Promise.all([
            SecureStore.deleteItemAsync('sv_access_token'),
            SecureStore.deleteItemAsync('sv_refresh_token'),
            SecureStore.deleteItemAsync('sv_user'),
          ]);
          router.replace('/(auth)/phone-entry');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {user ? (
        <View style={styles.userCard}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{user.displayName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{user.displayName || 'Unnamed'}</Text>
            <Text style={styles.userPhone}>{user.phoneNumber}</Text>
          </View>
        </View>
      ) : null}

      <Pressable style={styles.row} onPress={() => router.push('/(main)/profile-edit')}>
        <Text style={styles.rowText}>Edit Profile</Text>
      </Pressable>

      <Pressable style={styles.row} onPress={() => router.push('/(main)/voice-settings')}>
        <Text style={styles.rowText}>Voice Preference</Text>
      </Pressable>

      <Pressable style={[styles.row, styles.logoutRow]} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing(5), paddingTop: theme.spacing(8) },
  title: { ...theme.font.display, fontSize: 26, color: theme.colors.textPrimary, marginBottom: theme.spacing(6) },
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    padding: theme.spacing(4), marginBottom: theme.spacing(6),
  },
  avatarPlaceholder: {
    width: 56, height: 56, borderRadius: 999,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing(3),
  },
  avatarInitial: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '600' },
  userName: { color: theme.colors.textPrimary, fontSize: 17, fontWeight: '600' },
  userPhone: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  row: {
    paddingVertical: theme.spacing(4),
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  rowText: { color: theme.colors.textPrimary, fontSize: 15 },
  logoutRow: { marginTop: theme.spacing(6), borderBottomWidth: 0 },
  logoutText: { color: theme.colors.error, fontSize: 15, fontWeight: '600' },
});