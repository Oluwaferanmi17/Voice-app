import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";


interface TokenPayload extends JwtPayload {
  userId: string;
  deviceId: string;
}       

export const jwtService = {
  signAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
        expiresIn: (process.env.JWT_ACCESS_TTL ?? "15m") as SignOptions["expiresIn"],
    });
  },

  signRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
       expiresIn: (process.env.JWT_REFRESH_TTL ?? "30d") as SignOptions["expiresIn"],
    });
  },

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as TokenPayload;
  },

  verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload;
  },
};