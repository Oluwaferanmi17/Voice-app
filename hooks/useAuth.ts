import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { authApi } from '../lib/api-client';

interface AuthUser {
  id: string;
  phoneNumber: string;
  displayName: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const KEYS = { access: 'sv_access_token', refresh: 'sv_refresh_token', user: 'sv_user' };

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    (async () => {
      const [accessToken, userJson] = await Promise.all([
        SecureStore.getItemAsync(KEYS.access),
        SecureStore.getItemAsync(KEYS.user),
      ]);
      if (accessToken && userJson) {
        setState({ user: JSON.parse(userJson), accessToken, isLoading: false, isAuthenticated: true });
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  const login = useCallback(async (phoneNumber: string, code: string, deviceId: string, deviceName?: string) => {
    const result = await authApi.verifyOTP(phoneNumber, code, deviceId, deviceName);
    await SecureStore.setItemAsync(KEYS.access, result.accessToken);
    await SecureStore.setItemAsync(KEYS.refresh, result.refreshToken);
    await SecureStore.setItemAsync(KEYS.user, JSON.stringify(result.user));
    setState({ user: result.user, accessToken: result.accessToken, isLoading: false, isAuthenticated: true });
    return result;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = await SecureStore.getItemAsync(KEYS.refresh);
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.access),
      SecureStore.deleteItemAsync(KEYS.refresh),
      SecureStore.deleteItemAsync(KEYS.user),
    ]);
    setState({ user: null, accessToken: null, isLoading: false, isAuthenticated: false });
  }, []);

  return { ...state, login, logout };
}