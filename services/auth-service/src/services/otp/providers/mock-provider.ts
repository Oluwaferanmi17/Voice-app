import { OTPProvider, SendOTPResult, VerifyOTPResult } from '../otp-provider.interface';

// Dev/test-only provider — never sends a real SMS. Always "succeeds"
// sending, and only accepts a fixed code so integration tests are
// deterministic and repeatable without touching Termii/any real SMS cost.
const MOCK_CODE = '123456';

export class MockProvider implements OTPProvider {
  async sendOTP(phoneNumber: string): Promise<SendOTPResult> {
    console.log(`[mock-otp] Pretend-sending OTP ${MOCK_CODE} to ${phoneNumber}`);
    return { success: true, messageId: `mock-${phoneNumber}` };
  }

  async verifyOTP(_phoneNumber: string, code: string, _pinId: string): Promise<VerifyOTPResult> {
    if (code === MOCK_CODE) {
      return { verified: true };
    }
    return { verified: false, reason: 'invalid_code' };
  }

//   list_voices?: never; // not applicable here, ignore — leftover typing guard
}