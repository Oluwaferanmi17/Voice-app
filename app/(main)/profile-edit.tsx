import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { authedFetch } from '../../lib/api-client';
import { theme } from '../../lib/theme';

const USER_SERVICE_URL = process.env.EXPO_PUBLIC_USER_SERVICE_URL || 'http://localhost:4002';

export default function ProfileEditScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch(`${USER_SERVICE_URL}/users/me`);
        const data = await res.json();
        setDisplayName(data.displayName || '');
        setBio(data.bio || '');
        setStatusMessage(data.statusMessage || '');
        setProfilePicUrl(data.profilePicUrl || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (displayName.trim().length < 1) {
      setError('Name cannot be empty');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const patchRes = await authedFetch(`${USER_SERVICE_URL}/users/me`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim(),
          statusMessage: statusMessage.trim(),
        }),
      });
      if (!patchRes.ok) throw new Error('Could not save changes');

      if (newImageUri) {
        const token = await SecureStore.getItemAsync('sv_access_token');
        const formData = new FormData();
        formData.append('image', {
          uri: newImageUri,
          name: 'profile.jpg',
          type: 'image/jpeg',
        } as unknown as Blob);

        await fetch(`${USER_SERVICE_URL}/users/me/profile-picture`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }).catch(() => {
          // Non-fatal — profile text still saved even if the photo upload fails
        });
      }

      // Keep the locally cached user (used by settings.tsx and elsewhere) in sync
      const rawUser = await SecureStore.getItemAsync('sv_user');
      if (rawUser) {
        const cached = JSON.parse(rawUser);
        await SecureStore.setItemAsync(
          'sv_user',
          JSON.stringify({ ...cached, displayName: displayName.trim() })
        );
      }

      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>Cancel</Text>
      </Pressable>

      <Text style={styles.title}>Edit Profile</Text>

      <Pressable style={styles.avatarWrap} onPress={pickImage}>
        {newImageUri || profilePicUrl ? (
          <Image source={{ uri: newImageUri || profilePicUrl! }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>Add photo</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={(t) => {
          setDisplayName(t);
          if (error) setError(null);
        }}
        maxLength={50}
        placeholder="Your name"
        placeholderTextColor={theme.colors.textMuted}
      />

      <Text style={styles.label}>Status</Text>
      <TextInput
        style={styles.input}
        value={statusMessage}
        onChangeText={setStatusMessage}
        maxLength={100}
        placeholder="What's on your mind?"
        placeholderTextColor={theme.colors.textMuted}
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={setBio}
        maxLength={200}
        multiline
        placeholder="A little about you"
        placeholderTextColor={theme.colors.textMuted}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing(6), paddingTop: theme.spacing(8) },
  centered: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  backButton: { marginBottom: theme.spacing(4) },
  backButtonText: { color: theme.colors.accent, fontSize: 15, fontWeight: '500' },
  title: { ...theme.font.display, fontSize: 24, color: theme.colors.textPrimary, marginBottom: theme.spacing(6) },
  avatarWrap: { alignSelf: 'center', marginBottom: theme.spacing(8) },
  avatar: { width: 96, height: 96, borderRadius: 999 },
  avatarPlaceholder: {
    width: 96, height: 96, borderRadius: 999,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarPlaceholderText: { color: theme.colors.textMuted, fontSize: 13 },
  label: { ...theme.font.caption, color: theme.colors.textMuted, textTransform: 'uppercase', marginBottom: theme.spacing(1) },
  input: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, paddingVertical: theme.spacing(3), paddingHorizontal: theme.spacing(4),
    color: theme.colors.textPrimary, fontSize: 15, marginBottom: theme.spacing(4),
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: theme.colors.error, fontSize: 13, marginBottom: theme.spacing(3) },
  saveButton: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.md, paddingVertical: theme.spacing(4), alignItems: 'center', marginTop: theme.spacing(2) },
  saveButtonPressed: { opacity: 0.85 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: theme.colors.background, fontSize: 16, fontWeight: '600' },
});