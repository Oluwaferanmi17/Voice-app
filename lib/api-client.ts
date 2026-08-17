const AUTH_SERVICE_URL = process.env.EXPO_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:4001';

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${AUTH_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const authApi = {
  requestOTP: (phoneNumber: string) => post<{ sent: boolean }>('/auth/request-otp', { phoneNumber }),

  verifyOTP: (phoneNumber: string, code: string, deviceId: string, deviceName?: string) =>
    post<{
      user: { id: string; phoneNumber: string; displayName: string };
      accessToken: string;
      refreshToken: string;
      isNewUser: boolean;
    }>('/auth/verify-otp', { phoneNumber, code, deviceId, deviceName }),

  refresh: (refreshToken: string) => post<{ accessToken: string }>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) => post<{ loggedOut: boolean }>('/auth/logout', { refreshToken }),
};