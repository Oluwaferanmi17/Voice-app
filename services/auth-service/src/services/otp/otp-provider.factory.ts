// import { OTPProvider } from './otp-provider.interface';
// import { TermiiProvider } from './providers/termii-provider';

// export function createOTPProvider(): OTPProvider {
//   const provider = process.env.OTP_PROVIDER || 'termii';
//   switch (provider) {
//     case 'termii':
//       return new TermiiProvider();
//     default:
//       throw new Error(`Unknown OTP provider: ${provider}`);
//   }
// }

import { OTPProvider } from './otp-provider.interface';
import { MockProvider } from './providers/mock-provider';
import { TermiiProvider } from './providers/termii-provider';

export function createOTPProvider(): OTPProvider {
  const provider = process.env.OTP_PROVIDER || 'termii';
  switch (provider) {
    case 'termii':
      return new TermiiProvider();
    case 'mock':
      return new MockProvider();
    default:
      throw new Error(`Unknown OTP provider: ${provider}`);
  }
}