import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { createHash } from "node:crypto";
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
      const sessionHash = createHash("sha256").update(token).digest("hex").slice(0, 24);
      return `session:${sessionHash}`;
    }

    return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
  }
}
