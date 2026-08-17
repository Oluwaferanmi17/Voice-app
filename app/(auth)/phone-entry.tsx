import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { authApi } from '../../lib/api-client';
import { theme } from '../../lib/theme';

export default function PhoneEntryScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ripple, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(ripple, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scale = ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const opacity = ripple.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.35, 0.1, 0] });

  const handleContinue = async () => {
    if (phoneNumber.trim().length < 8) {
      setError('Enter a valid phone number');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await authApi.requestOTP(phoneNumber.trim());
      router.push({ pathname: '/(auth)/otp-verify', params: { phoneNumber: phoneNumber.trim() } });
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
      <View style={styles.rippleWrap}>
        <Animated.View
          style={[styles.ripple, { transform: [{ scale }], opacity }]}
        />
        <View style={styles.rippleCore} />
      </View>

      <Text style={styles.title}>Talk without a sound</Text>
      <Text style={styles.subtitle}>
        Enter your number. We&apos;ll text a code to get you in.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="+234 000 000 0000"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={(t) => {
          setPhoneNumber(t);
          if (error) setError(null);
        }}
        autoFocus
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          loading && styles.buttonDisabled,
        ]}
        onPress={handleContinue}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Continue'}</Text>
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
  rippleWrap: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(10),
  },
  ripple: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  rippleCore: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: theme.colors.accentDim,
    borderWidth: 1,
    borderColor: theme.colors.accent,
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
    marginBottom: theme.spacing(10),
    lineHeight: 22,
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
  },
  error: {
    color: theme.colors.error,
    fontSize: 13,
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
