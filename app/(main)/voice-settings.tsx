import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { authedFetch } from '../../lib/api-client';
import { theme } from '../../lib/theme';

const PRESENCE_SERVICE_URL = process.env.EXPO_PUBLIC_PRESENCE_SERVICE_URL || 'http://localhost:4004';

interface Voice {
  id: string;
  name: string;
  language: string;
  gender: string;
}

// Mirrors the fixed voice list in ai-speech-service's kokoro_provider.py —
// worth eventually fetching this from a real endpoint rather than duplicating,
// but ai-speech-service isn't behind presence-service's auth layer yet.
const AVAILABLE_VOICES: Voice[] = [
  { id: 'af_heart', name: 'Heart', language: 'en-US', gender: 'female' },
  { id: 'af_bella', name: 'Bella', language: 'en-US', gender: 'female' },
  { id: 'am_michael', name: 'Michael', language: 'en-US', gender: 'male' },
  { id: 'bf_emma', name: 'Emma', language: 'en-GB', gender: 'female' },
  { id: 'bm_george', name: 'George', language: 'en-GB', gender: 'male' },
];

export default function VoiceSettingsScreen() {
  const router = useRouter();
  const [selectedVoice, setSelectedVoice] = useState('af_heart');
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch(`${PRESENCE_SERVICE_URL}/voice/preference`);
        if (res.ok) {
          const data = await res.json();
          setSelectedVoice(data.voiceId || 'af_heart');
          setSpeed(data.speed ?? 1.0);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authedFetch(`${PRESENCE_SERVICE_URL}/voice/preference`, {
        method: 'PATCH',
        body: JSON.stringify({ voiceId: selectedVoice, speed }),
      });
      router.back();
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

      <Text style={styles.title}>Voice Preference</Text>
      <Text style={styles.subtitle}>This is how your typed messages will sound to others.</Text>

      <Text style={styles.label}>Voice</Text>
      {AVAILABLE_VOICES.map((voice) => (
        <Pressable
          key={voice.id}
          style={[styles.voiceRow, selectedVoice === voice.id && styles.voiceRowSelected]}
          onPress={() => setSelectedVoice(voice.id)}
        >
          <View>
            <Text style={styles.voiceName}>{voice.name}</Text>
            <Text style={styles.voiceMeta}>{voice.language} · {voice.gender}</Text>
          </View>
          {selectedVoice === voice.id ? <View style={styles.selectedDot} /> : null}
        </Pressable>
      ))}

      <Text style={[styles.label, styles.speedLabel]}>Speed: {speed.toFixed(1)}x</Text>
      <View style={styles.speedRow}>
        <Pressable
          style={styles.speedButton}
          onPress={() => setSpeed((s) => Math.max(0.5, Math.round((s - 0.1) * 10) / 10))}
        >
          <Text style={styles.speedButtonText}>−</Text>
        </Pressable>
        <Text style={styles.speedValue}>{speed.toFixed(1)}x</Text>
        <Pressable
          style={styles.speedButton}
          onPress={() => setSpeed((s) => Math.min(2.0, Math.round((s + 0.1) * 10) / 10))}
        >
          <Text style={styles.speedButtonText}>+</Text>
        </Pressable>
      </View>

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
  title: { ...theme.font.display, fontSize: 24, color: theme.colors.textPrimary, marginBottom: theme.spacing(2) },
  subtitle: { color: theme.colors.textMuted, fontSize: 14, marginBottom: theme.spacing(6) },
  label: { ...theme.font.caption, color: theme.colors.textMuted, textTransform: 'uppercase', marginBottom: theme.spacing(2) },
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, padding: theme.spacing(4), marginBottom: theme.spacing(2),
  },
  voiceRowSelected: { borderColor: theme.colors.accent },
  voiceName: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '500' },
  voiceMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  selectedDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: theme.colors.accent },
  speedLabel: { marginTop: theme.spacing(6) },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing(8) },
  speedButton: {
    width: 44, height: 44, borderRadius: 999,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  speedButtonText: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '600' },
  speedValue: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '600', marginHorizontal: theme.spacing(6), minWidth: 56, textAlign: 'center' },
  saveButton: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.md, paddingVertical: theme.spacing(4), alignItems: 'center' },
  saveButtonPressed: { opacity: 0.85 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: theme.colors.background, fontSize: 16, fontWeight: '600' },
});