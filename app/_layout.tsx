import { Stack } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

export default function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null; // or a splash/loading screen

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="(main)" />
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
}