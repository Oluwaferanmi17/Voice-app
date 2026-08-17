import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { on } from '../lib/socket-client';

interface IncomingCallData {
  callId: string;
  caller: { id: string; displayName: string; profilePicUrl: string | null };
}

export function useIncomingCall() {
  const router = useRouter();

  useEffect(() => {
    const off = on('call:incoming', (data: IncomingCallData) => {
      router.push({
        pathname: '/call',
        params: {
          mode: 'incoming',
          callId: data.callId,
          otherUserId: data.caller.id,
          otherUserName: data.caller.displayName || 'Unknown',
          otherUserPhoto: data.caller.profilePicUrl || '',
        },
      });
    });
    return off;
  }, [router]);
}