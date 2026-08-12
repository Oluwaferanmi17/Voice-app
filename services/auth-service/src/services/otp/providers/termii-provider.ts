import { OTPProvider, SendOTPResult, VerifyOTPResult } from '../otp-provider.interface';

export class TermiiProvider implements OTPProvider {
  private apiKey = process.env.TERMII_API_KEY!;
  private baseUrl = 'https://api.ng.termii.com/api';

  async sendOTP(phoneNumber: string): Promise<SendOTPResult> {
    const res = await fetch(`${this.baseUrl}/sms/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        message_type: 'NUMERIC',
        to: phoneNumber,
        from: 'SilentVoice',
        channel: 'generic',
        pin_attempts: 3,
        pin_time_to_live: 5,
        pin_length: 6,
        pin_placeholder: '< 123456 >',
        message_text: 'Your Silent Voice code is < 123456 >. Expires in 5 minutes.',
      }),
    });

    if (!res.ok) return { success: false };

    const data = await res.json() as { pinId?: string };
    return { success: !!data.pinId, messageId: data.pinId };
  }

  async verifyOTP(_phoneNumber: string, code: string, pinId: string): Promise<VerifyOTPResult> {
    const res = await fetch(`${this.baseUrl}/sms/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: this.apiKey, pin_id: pinId, pin: code }),
    });

    if (!res.ok) return { verified: false, reason: 'provider_error' };

    const data = await res.json() as { verified?: boolean };
    return { verified: data.verified === true, reason: data.verified ? undefined : 'invalid_code' };
  }
}