import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { theme } from '../../lib/theme';

const USER_SERVICE_URL = process.env.EXPO_PUBLIC_USER_SERVICE_URL || 'http://localhost:4002';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleFinish = async () => {
    if (displayName.trim().length < 1) {
      setError('Enter a name so friends recognize you');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const accessToken = await SecureStore.getItemAsync('sv_access_token');

      const profileRes = await fetch(`${USER_SERVICE_URL}/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (!profileRes.ok) throw new Error('Could not save your name');

      if (imageUri) {
        const formData = new FormData();
        formData.append('image', {
          uri: imageUri,
          name: 'profile.jpg',
          type: 'image/jpeg',
        } as unknown as Blob);

        await fetch(`${USER_SERVICE_URL}/users/me/profile-picture`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        }).catch(() => {
          // Photo upload failing shouldn't block onboarding — they can add it later in settings
        });
      }

      router.replace('/(main)/contacts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>You&apos;re in</Text>
      <Text style={styles.subtitle}>A name and a photo help people recognize you.</Text>

      <Pressable style={styles.avatarWrap} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>Add photo</Text>
          </View>
        )}
      </Pressable>

      <TextInput
        style={styles.input}
        placeholder="Your name"
        placeholderTextColor={theme.colors.textMuted}
        value={displayName}
        onChangeText={(t) => {
          setDisplayName(t);
          if (error) setError(null);
        }}
        maxLength={50}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          loading && styles.buttonDisabled,
        ]}
        onPress={handleFinish}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Start talking'}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing(6),
    justifyContent: 'center',
  },
  title: {
    ...theme.font.display,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing(2),
  },
  subtitle: {
    ...theme.font.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing(8),
  },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: theme.spacing(8),
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 999,
  },
  avatarPlaceholder: {
    width: 104,
    height: 104,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(4),
    paddingHorizontal: theme.spacing(4),
    color: theme.colors.textPrimary,
    fontSize: 17,
    marginBottom: theme.spacing(3),
    textAlign: 'center',
  },
  error: {
    color: theme.colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: theme.spacing(3),
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(4),
    alignItems: 'center',
    marginTop: theme.spacing(2),
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});