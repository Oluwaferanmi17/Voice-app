import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from './jwt-verify';

export interface AuthedRequest extends Request {
  userId?: string;
  deviceId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const payload = verifyAccessToken(header.slice(7), process.env.JWT_ACCESS_SECRET!);
    req.userId = payload.userId;
    req.deviceId = payload.deviceId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}