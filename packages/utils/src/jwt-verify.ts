import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  deviceId: string;
}

export function verifyAccessToken(token: string, secret: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}