import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ThrottlerGuard } from "@nestjs/throttler";
import { SESSION_COOKIE } from "../../common/security/session.constants";

function readCookie(cookieHeader: string, name: string) {
  const prefix = `${name}=`;
  const part = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  return part ? part.slice(prefix.length) : "";
}

@Injectable()
export class SessionAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const token = readCookie(String(req.headers?.cookie || ""), SESSION_COOKIE);

    if (token) {
      try {
        const jwt = new JwtService({
          secret: process.env.JWT_SECRET || "dev-only-change-me",
        });
        const payload = jwt.verify(token);

        if (payload?.sub) {
          return `user:${payload.sub}`;
        }
      } catch {
        // Invalid/expired cookies are intentionally throttled by IP below.
      }
    }

    return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
  }
}
