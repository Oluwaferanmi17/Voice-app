interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification(expoPushToken: string, payload: PushPayload) {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        priority: 'high',
        sound: 'default',
        channelId: 'calls', // Android needs a channel for high-priority call alerts
      }),
    });

    const result = await res.json() as { data?: { status?: string; message?: string } };
    if (result?.data?.status === 'error') {
      console.error('[push] Expo push error:', result.data.message);
    }
    return result;
  } catch (err) {
    console.error('[push] failed to send:', err);
  }
}