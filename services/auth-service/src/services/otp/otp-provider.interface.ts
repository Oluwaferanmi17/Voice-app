export interface SendOTPResult {
  success: boolean;
  messageId?: string;
}

export interface VerifyOTPResult {
  verified: boolean;
  reason?: string;
}

export interface OTPProvider {
  sendOTP(phoneNumber: string): Promise<SendOTPResult>;
  verifyOTP(phoneNumber: string, code: string, pinId: string): Promise<VerifyOTPResult>;
}