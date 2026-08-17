import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { theme } from '../../lib/theme';
import { authApi } from '../../lib/api-client';

const CODE_LENGTH = 6;

// A simple, stable per-install device id — generated once and cached.
async function getDeviceId(): Promise<string> {
  const KEY = 'sv_device_id';
  let id = await SecureStore.getItemAsync(KEY);
  if (!id) {
    id = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await SecureStore.setItemAsync(KEY, id);
  }
  return id;
}

export default function OtpVerifyScreen() {
  const router = useRouter();
  const { phoneNumber } = useLocalSearchParams<{ phoneNumber: string }>();
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const code = digits.join('');

  const handleChange = (value: string, index: number) => {
    if (error) setError(null);
    const clean = value.replace(/[^0-9]/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }
    const next = [...digits];
    next[index] = clean[clean.length - 1];
    setDigits(next);
    if (index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    if (code.length === CODE_LENGTH) verify();
  }, [code]);

  const verify = async () => {
    setLoading(true);
    setError(null);
    try {
      const deviceId = await getDeviceId();
      const result = await authApi.verifyOTP(phoneNumber, code, deviceId, 'Mobile');
      await SecureStore.setItemAsync('sv_access_token', result.accessToken);
      await SecureStore.setItemAsync('sv_refresh_token', result.refreshToken);
      await SecureStore.setItemAsync('sv_user', JSON.stringify(result.user));

      if (result.isNewUser || !result.user.displayName) {
        router.replace('/(auth)/profile-setup');
      } else {
        router.replace('/(main)/contacts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    try {
      await authApi.requestOTP(phoneNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Enter the code</Text>
      <Text style={styles.subtitle}>Sent to {phoneNumber}</Text>

      <View style={styles.codeRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            style={[styles.digitBox, d && styles.digitBoxFilled, error && styles.digitBoxError]}
            value={d}
            onChangeText={(v) => handleChange(v, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <Text style={styles.status}>Verifying...</Text> : null}

      <Pressable onPress={handleResend} disabled={resending} style={styles.resendWrap}>
        <Text style={styles.resendText}>
          {resending ? 'Resending...' : "Didn't get a code? Resend"}
        </Text>
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
    marginBottom: theme.spacing(10),
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(4),
  },
  digitBox: {
    width: 46,
    height: 56,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
  },
  digitBoxFilled: {
    borderColor: theme.colors.accent,
  },
  digitBoxError: {
    borderColor: theme.colors.error,
  },
  error: {
    color: theme.colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: theme.spacing(2),
  },
  status: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: theme.spacing(2),
  },
  resendWrap: {
    marginTop: theme.spacing(6),
    alignItems: 'center',
  },
  resendText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});
